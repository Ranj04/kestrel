/**
 * Drug string -> CPIC drug name. The first two steps are deterministic and
 * work with no LLM and no network — they were built first and cover the whole
 * demo. Step 3 consults the LLM but its answer is DISCARDED unless it is an
 * index key character for character: the model does not get to invent a drug.
 */
import type { ModelProvenance } from "../contracts";
import * as llm from "../llm";
import { getIndex } from "./index";

/** DEMO SHIM: hardcoded brand -> generic map covering the demo drugs, so
 *  "Xeloda" reaches capecitabine with no LLM key. The LLM path (step 3)
 *  handles the long tail when a key is present. */
const BRAND_MAP: Record<string, string> = {
  xeloda: "capecitabine",
  adrucil: "fluorouracil",
};

/** Dose / route / frequency tokens stripped before matching. Any token
 *  containing a digit (1250, mg/m2, q6h, 30mg) is stripped separately. */
const STOPWORDS = new Set([
  "mg", "mcg", "g", "ml", "units",
  "bid", "tid", "qid", "qd", "qhs", "prn", "daily", "weekly", "nightly",
  "po", "iv", "im", "sc", "subq", "oral", "topical",
  "tab", "tabs", "tablet", "tablets", "cap", "caps", "capsule", "capsules",
  "dose", "doses", "x", "of", "per",
]);

export interface Resolution {
  drugName: string | null;
  method: "exact" | "substring" | "llm" | "none";
  candidates: string[];
  /** Present whenever the LLM was actually consulted, so the route can log
   *  `model.invoked` — even when the answer was discarded. */
  provenance?: ModelProvenance;
}

export async function resolveDrug(raw: string): Promise<Resolution> {
  const keys = Object.keys(getIndex());
  const lowered = raw.trim().toLowerCase();
  const tokens = lowered.split(/\s+/).filter((t) => !/\d/.test(t) && !STOPWORDS.has(t));
  const cleaned = tokens.join(" ");

  // 1. Exact match — whole string, dose-stripped string, then each token,
  //    each also tried through the demo brand map.
  for (const c of [lowered, cleaned, ...tokens]) {
    if (c === "") continue;
    const mapped = BRAND_MAP[c] ?? c;
    if (keys.includes(mapped)) return { drugName: mapped, method: "exact", candidates: [] };
  }

  // 2. Substring — take it only if EXACTLY one index key hits; two candidates
  //    is ambiguity, and ambiguity goes to step 3 or to "none", never to a guess.
  const hits = keys.filter((k) =>
    tokens.some((t) => t.length >= 4 && (k.includes(t) || t.includes(k))),
  );
  if (hits.length === 1) return { drugName: hits[0], method: "substring", candidates: hits };

  // 3. LLM — must return an index key verbatim or the answer is discarded.
  const res = await llm.resolveDrug(raw, keys);
  if (res) {
    const answer = res.value?.trim().toLowerCase() ?? null;
    if (answer && keys.includes(answer)) {
      return { drugName: answer, method: "llm", candidates: hits, provenance: res.provenance };
    }
    return { drugName: null, method: "none", candidates: hits, provenance: res.provenance };
  }
  return { drugName: null, method: "none", candidates: hits };
}
