/**
 * The one thin LLM wrapper. The model NEVER writes clinical or policy text
 * (D1) — its only jobs are parsing free-text orders and mapping brand names
 * to CPIC generics. With no provider configured both functions return null
 * IMMEDIATELY and never throw: the whole app demos with no network and no
 * key, because the deterministic paths in lib/pgx/resolve.ts were built
 * first and do not touch this file's network code.
 *
 * Provider selection, by key presence, in this order:
 *
 *   1. Bedrock   — AWS_REGION + (AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY or
 *                  AWS_PROFILE). The SDK is loaded with a dynamic import();
 *                  if @aws-sdk/client-bedrock-runtime is not installed the
 *                  branch falls through to the next provider. Inert until
 *                  both the creds and the SDK exist.
 *   2. OpenAI    — OPENAI_API_KEY
 *   3. Anthropic — ANTHROPIC_API_KEY
 *   4. null      — no keys. A first-class path, not an error.
 *
 * Every successful call returns its ModelProvenance so the route can log a
 * `model.invoked` ledger record. The provider that actually served the call
 * is recorded INSIDE the frozen shape: prefixed on `id` ("openai:gpt-4o-mini")
 * and repeated in `params.provider`. `rawOutput` is the unedited model text —
 * ALCOA "Original" — stored untouched: no trim, no parse, no normalization.
 * Timeouts, non-2xx responses, and network errors all return null.
 */
import type { ModelProvenance } from "./contracts";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const BEDROCK_ANTHROPIC_VERSION = "bedrock-2023-05-31";
const TIMEOUT_MS = 15_000;
const BASE_PARAMS = { max_tokens: 300, temperature: 0 };

export interface LlmOutcome<T> {
  value: T | null;
  provenance: ModelProvenance;
}

function env(name: string): string | null {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : null;
}

function hasBedrockCreds(): boolean {
  if (!env("AWS_REGION")) return false;
  if (env("AWS_ACCESS_KEY_ID") && env("AWS_SECRET_ACCESS_KEY")) return true;
  return env("AWS_PROFILE") !== null;
}

// ---------------------------------------------------------------- bedrock

/** The minimal slice of @aws-sdk/client-bedrock-runtime this file touches. */
interface BedrockSdk {
  BedrockRuntimeClient: new (config: { region: string }) => {
    send(command: unknown, options?: { abortSignal?: AbortSignal }): Promise<{ body?: Uint8Array }>;
  };
  InvokeModelCommand: new (input: {
    modelId: string;
    contentType: string;
    accept: string;
    body: string;
  }) => unknown;
}

/**
 * Dynamic import so an absent SDK is a fall-through, not a crash. The
 * specifier is a runtime string variable ON PURPOSE: a literal would make
 * tsc resolve the (uninstalled) package and fail. The webpackIgnore magic
 * comment (honored by Turbopack too) stops the bundler from trying to
 * resolve the expression at build time — without it, `next build` logs a
 * module-not-found warning for a package that is deliberately optional
 * (.sol/requests/phase2-build-blockers.md). Do not add the dependency and
 * do not hand-roll SigV4 — this branch stays inert until Ranjiv has both
 * creds and the SDK.
 */
async function loadBedrockSdk(): Promise<BedrockSdk | null> {
  try {
    const specifier: string = "@aws-sdk/client-bedrock-runtime";
    return (await import(/* webpackIgnore: true */ specifier)) as BedrockSdk;
  } catch {
    return null;
  }
}

async function completeBedrock(sdk: BedrockSdk, prompt: string): Promise<ModelProvenance | null> {
  const region = env("AWS_REGION");
  if (!region) return null;
  const modelId = env("ATTEST_BEDROCK_MODEL") ?? "anthropic.claude-3-5-sonnet-20240620-v1:0";
  const params = { provider: "bedrock", region, ...BASE_PARAMS };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const client = new sdk.BedrockRuntimeClient({ region });
    const command = new sdk.InvokeModelCommand({
      modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: BEDROCK_ANTHROPIC_VERSION,
        ...BASE_PARAMS,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const res = await client.send(command, { abortSignal: controller.signal });
    clearTimeout(timer);
    if (!res.body) return null;
    const data = JSON.parse(new TextDecoder().decode(res.body)) as {
      content?: { text?: string }[];
    };
    const rawOutput = (data.content ?? []).map((b) => b.text ?? "").join("");
    return { id: `bedrock:${modelId}`, version: BEDROCK_ANTHROPIC_VERSION, params, prompt, rawOutput };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- openai

/** One attempt against one credential. Returns null on ANY failure, as ever. */
async function tryOpenAI(
  key: string,
  credential: "primary" | "fallback",
  prompt: string,
): Promise<ModelProvenance | null> {
  // Default chosen from what the venue's project key can actually reach:
  // its model list is {gpt-4-turbo, gpt-4.1-nano, gpt-5.3-codex, gpt-5.4}
  // (gpt-4o-mini 403s: "model_not_found"). gpt-4.1-nano is the cheapest of
  // the set and accepts max_tokens + temperature:0 as-is; the gpt-5.x
  // reasoning models reject both, so don't default to them.
  const model = env("ATTEST_OPENAI_MODEL") ?? "gpt-4.1-nano";
  // `credential` rides in params so the ledger records WHICH key served the
  // call. ALCOA "Original" is about the result being attributable; a
  // silent failover that nothing records is an unattributable one.
  const params = { provider: "openai", credential, ...BASE_PARAMS };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        ...BASE_PARAMS,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: { message?: { content?: string | null } }[];
    };
    const rawOutput = data.choices?.[0]?.message?.content ?? "";
    return { id: `openai:${model}`, version: "v1", params, prompt, rawOutput };
  } catch {
    return null;
  }
}

/**
 * Primary key, then fallback. Measured 2026-08-13: the original service-account
 * key began returning 429 on every model it had previously served, so the
 * fallback is not decoration -- it is the difference between the LLM path
 * working and silently degrading to null.
 *
 * A fallback that fires unnoticed is its own defect, so the credential that
 * actually served the call is recorded in ModelProvenance.params. Both keys
 * failing is still a fully supported outcome: resolveDrug falls back to exact
 * and substring matching, which carries the entire demo on its own.
 */
async function completeOpenAI(key: string, prompt: string): Promise<ModelProvenance | null> {
  const first = await tryOpenAI(key, "primary", prompt);
  if (first) return first;
  const fallback = env("OPENAI_API_KEY_FALLBACK");
  if (!fallback || fallback === key) return null;
  return tryOpenAI(fallback, "fallback", prompt);
}

// ---------------------------------------------------------------- anthropic

async function completeAnthropic(key: string, prompt: string): Promise<ModelProvenance | null> {
  const model = env("ATTEST_LLM_MODEL") ?? "claude-sonnet-4-5";
  const params = { provider: "anthropic", ...BASE_PARAMS };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        ...BASE_PARAMS,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = (await res.json()) as { content?: { text?: string }[] };
    const rawOutput = (data.content ?? []).map((b) => b.text ?? "").join("");
    return { id: `anthropic:${model}`, version: ANTHROPIC_VERSION, params, prompt, rawOutput };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- dispatch

/** One completion via the first configured provider. Null on no provider,
 *  non-2xx, timeout, or any network error — a model failure is never
 *  allowed to break the prescribe flow. */
async function complete(prompt: string): Promise<ModelProvenance | null> {
  if (hasBedrockCreds()) {
    const sdk = await loadBedrockSdk();
    // SDK installed -> Bedrock is the provider; its failures return null.
    // SDK absent -> fall through and try the next provider.
    if (sdk) return completeBedrock(sdk, prompt);
  }
  const openaiKey = env("OPENAI_API_KEY");
  if (openaiKey) return completeOpenAI(openaiKey, prompt);
  const anthropicKey = env("ANTHROPIC_API_KEY");
  if (anthropicKey) return completeAnthropic(anthropicKey, prompt);
  return null;
}

// ---------------------------------------------------------------- exports

/**
 * Map a free-text order to one of `candidates` (the CPIC index keys).
 * `value` is the model's answer with only outer whitespace removed — the
 * caller (lib/pgx/resolve.ts) validates it against the index keys and
 * DISCARDS anything that is not one; the model does not get to invent a drug.
 */
export async function resolveDrug(
  raw: string,
  candidates: string[],
): Promise<LlmOutcome<string> | null> {
  const prompt =
    `A prescriber typed this drug order: "${raw}"\n\n` +
    `Which ONE of the following known drug names does it refer to? ` +
    `These are the only valid answers.\n\n${candidates.join("\n")}\n\n` +
    `Reply with exactly one name from the list, or the single word NONE.`;
  const provenance = await complete(prompt);
  if (!provenance) return null;
  const answer = provenance.rawOutput.trim();
  return { value: answer === "" || /^none$/i.test(answer) ? null : answer, provenance };
}

export interface ParsedOrder {
  drug: string | null;
  dose: string | null;
  route: string | null;
}

/** Parse a free-text order into { drug, dose, route }. Null value when the
 *  model's output is not valid JSON; provenance is kept either way. */
export async function parseOrder(raw: string): Promise<LlmOutcome<ParsedOrder> | null> {
  const prompt =
    `Parse this free-text drug order into JSON with exactly these keys: ` +
    `{"drug": string|null, "dose": string|null, "route": string|null}.\n` +
    `Order: "${raw}"\nReply with the JSON object only.`;
  const provenance = await complete(prompt);
  if (!provenance) return null;
  let value: ParsedOrder | null = null;
  try {
    const m = provenance.rawOutput.match(/\{[\s\S]*\}/);
    if (m) {
      const parsed = JSON.parse(m[0]) as Record<string, unknown>;
      value = {
        drug: typeof parsed.drug === "string" ? parsed.drug : null,
        dose: typeof parsed.dose === "string" ? parsed.dose : null,
        route: typeof parsed.route === "string" ? parsed.route : null,
      };
    }
  } catch {
    value = null;
  }
  return { value, provenance };
}
