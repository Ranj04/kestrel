/**
 * The one thin LLM wrapper. The model NEVER writes clinical or policy text
 * (D1) — its only jobs are parsing free-text orders and mapping brand names
 * to CPIC generics. With no API key both functions return null IMMEDIATELY
 * and never throw: the whole app demos with no network and no key, because
 * the deterministic paths in lib/pgx/resolve.ts were built first and do not
 * touch this file's network code.
 *
 * Every successful call returns its ModelProvenance so the route can log a
 * `model.invoked` ledger record. `rawOutput` is the unedited model text —
 * ALCOA "Original" — stored untouched: no trim, no parse, no normalization.
 */
import type { ModelProvenance } from "./contracts";

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";

export interface LlmOutcome<T> {
  value: T | null;
  provenance: ModelProvenance;
}

function apiKey(): string | null {
  const k = process.env.ANTHROPIC_API_KEY;
  return k && k.trim() !== "" ? k.trim() : null;
}

/** One completion. Null on no key, non-2xx, timeout, or any network error —
 *  a model failure is never allowed to break the prescribe flow. */
async function complete(prompt: string): Promise<ModelProvenance | null> {
  const key = apiKey();
  if (!key) return null;
  const model = process.env.ATTEST_LLM_MODEL ?? "claude-sonnet-4-5";
  const params = { max_tokens: 300, temperature: 0 };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": API_VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify({ model, ...params, messages: [{ role: "user", content: prompt }] }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = (await res.json()) as { content?: { text?: string }[] };
    const rawOutput = (data.content ?? []).map((b) => b.text ?? "").join("");
    return { id: model, version: API_VERSION, params, prompt, rawOutput };
  } catch {
    return null;
  }
}

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
