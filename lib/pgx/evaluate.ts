/**
 * The actual check. Joins the patient's gene results against the CPIC cache
 * ON `lookup` — exact after trim + case-fold, never fuzzy, never substring,
 * never numeric coercion ("3.0" must not match "≥3.0"). `phenotype` is for
 * display only (D3): a card reading "DPYD 0.0" is a bug, and a phenotype join
 * can cite the wrong row (null for HLA, non-unique for DPYD).
 *
 * Every clinical string on the Alert is copied through VERBATIM from
 * data/cpic/index.json — no slice, no replace, no case change, no truncation.
 * `sourceUrl` is the entry's own `_source`, never reconstructed.
 */
import { randomBytes } from "node:crypto";
import type {
  Alert,
  EvidenceSnapshot,
  GeneAssessment,
  GeneResult,
  Patient,
  Severity,
} from "../contracts";
import { stableHash } from "../ledger/hash";
import { fdaAssociation } from "./fda";
import { getIndex, type CpicEntry, type CpicIndex } from "./index";
import { matchCoverage, type PolicyClause } from "./policy";

/**
 * THE severity rule — the single declaration in the codebase (closes R-5).
 * MOVED verbatim from scripts/verify-setup.mjs, which now imports this
 * function instead of carrying its own copy: two declarations of a closed set
 * can silently stop agreeing while both still run, and the preflight would
 * keep printing PASS while evaluate.ts classified differently.
 *
 * Severity is derived from CPIC's own text, never invented. "none" means the
 * caller raises no alert at all.
 */
export function severityOf(text: unknown, classification: string | null | undefined): Severity {
  const t = String(text ?? "");
  if (/avoid/i.test(t)) return "critical";
  if (classification === "Strong" && /reduce|not recommended/i.test(t)) return "critical";
  if (/no indication to change|label-recommended|standard dosing|no recommendation/i.test(t))
    return "none";
  return "caution";
}

const RANK: Record<Severity, number> = { none: 0, caution: 1, critical: 2 };

/**
 * THE D6 disagree rule — the single declaration (the R-5 lesson applies here
 * too: two copies of a closed rule can silently stop agreeing). Used by
 * evaluate() to suppress a conflicting triple and by assessGenes() to carry
 * that suppression as `conflict: true`, so the renderer can never paint a
 * refused determination as an assessed pass (G-5 / R-25).
 */
function rowsDisagree(rows: CpicEntry[]): boolean {
  const first = rows[0];
  const severity = severityOf(first.recommendation, first.classification);
  return rows.some(
    (r) =>
      r.recommendation !== first.recommendation ||
      severityOf(r.recommendation, r.classification) !== severity,
  );
}

/**
 * `index` is injectable ONLY so tests can prove the D6 conflict guard fires
 * against a synthetic two-row disagreement; production callers omit it.
 */
export function evaluate(
  patient: Patient,
  drugName: string,
  orderId: string,
  index: CpicIndex = getIndex(),
): Alert | null {
  const drug = drugName.trim().toLowerCase();
  const byGene = index[drug];
  if (!byGene) return null;

  // A real system would surface EVERY gene's alert; returning the single
  // highest-severity one is right for a 90-second demo.
  let best: Alert | null = null;

  for (const result of patient.results) {
    const entries = byGene[result.gene];
    if (!entries || entries.length === 0) continue;

    const want = String(result.lookup).trim().toLowerCase();
    const rows = entries.filter((e) => String(e.lookup).trim().toLowerCase() === want);
    if (rows.length === 0) continue;

    // D6 — `lookup` is NOT unique (339 keys match >1 row; 146 disagree on
    // severity, because multi-gene guidelines flatten into per-gene buckets).
    // Taking "the first row encountered" would make the clinical answer
    // insertion-order dependent. N rows must agree on severity AND text;
    // if they disagree, raise NO alert for this gene and log the conflict.
    const entry = rows[0];
    const severity = severityOf(entry.recommendation, entry.classification);
    if (rows.length > 1 && rowsDisagree(rows)) {
      console.warn(
        `[pgx] CONFLICT (D6): ${rows.length} CPIC rows for (${drug}, ${result.gene}, ` +
          `lookup "${result.lookup}") disagree on severity or recommendation text — ` +
          `raising NO alert for this gene. Rendering one of two conflicting ` +
          `recommendations is worse than rendering none.`,
      );
      continue;
    }

    if (severity === "none") continue; // CPIC says standard therapy: no alert.

    const alert = buildAlert(patient, result, entry, drug, orderId, severity);
    if (!best || RANK[severity] > RANK[best.severity]) best = alert;
  }

  return best;
}

/**
 * Which of THIS DRUG's genes were actually assessed. `index[drug]`'s keys are
 * exactly the set of genes CPIC associates with the drug, so the answer is
 * derived from data already on disk — nothing is invented.
 *
 * Exists because evaluate() returning null is ambiguous: "assessed and no
 * alert raised" and "the relevant gene was never tested" produce the identical
 * null, and phase6's cross-review caught the UI rendering the second as the
 * first (a green clearance for pt_reyes + capecitabine citing CYP2D6, a gene
 * irrelevant to the drug, with no DPYD result on file). The renderer needs
 * these facts carried through the response, not re-derived in a component.
 *
 * Matching discipline is evaluate()'s own: exact on `lookup` after trim +
 * case-fold, never fuzzy. A result whose lookup matches no CPIC row is NOT
 * assessed (R-6's silent-join failure must not render as a pass).
 */
export function assessGenes(
  patient: Patient,
  drugName: string,
  index: CpicIndex = getIndex(),
): GeneAssessment[] | null {
  const drug = drugName.trim().toLowerCase();
  const byGene = index[drug];
  if (!byGene) return null;

  return Object.keys(byGene).map((gene) => {
    const result = patient.results.find((r) => r.gene === gene) ?? null;
    const want = result ? String(result.lookup).trim().toLowerCase() : null;
    const rows =
      want === null
        ? []
        : (byGene[gene] ?? []).filter((e) => String(e.lookup).trim().toLowerCase() === want);
    return {
      gene,
      assessed: rows.length > 0,
      // G-5 / R-25: when the matched rows disagree, evaluate() suppressed this
      // gene (the D6 guard) — carry that fact so the screen renders an amber
      // unknown, never the green assessed line, for a refused determination.
      conflict: rows.length > 1 && rowsDisagree(rows),
      resultOnFile: result !== null,
      phenotype: result?.phenotype ?? null,
      diplotype: result?.diplotype ?? null,
    };
  });
}

function buildAlert(
  patient: Patient,
  result: GeneResult,
  entry: CpicEntry,
  drug: string,
  orderId: string,
  severity: Severity,
): Alert {
  const matched = matchCoverage(patient, drug);
  const snapshot = buildSnapshot(entry, drug, matched?.clause ?? null, matched?.coverage ?? null);

  return {
    alertId: "alert_" + randomBytes(4).toString("hex"),
    orderId,
    gene: entry.gene,
    diplotype: result.diplotype,
    lookup: String(entry.lookup), // the CPIC join key that matched
    phenotype: entry.phenotype, // the human name, for display; null for HLA
    drugName: entry.drug,
    severity,
    recommendation: entry.recommendation, // VERBATIM
    implication: entry.implication ?? null, // VERBATIM
    classification: entry.classification ?? null,
    comments: entry.comments ?? null, // VERBATIM
    population: entry.population ?? null,
    cpicLevelA: entry.cpic_level_a === true,
    guidelineName: entry.guideline_name ?? null,
    guidelineUrl: entry.guideline_url ?? null,
    citations: entry.citations ?? [],
    sourceUrl: entry._source, // the exact CPIC API row, never reconstructed
    // Secondary evidence, queried on the SAME (gene, drug) the card names.
    // null when the FDA has published no association — which renders nothing at
    // all, because the table lists associations and not exclusions.
    fdaLabeled: fdaAssociation(entry.gene, entry.drug),
    coverage: matched?.coverage ?? null,
    snapshot,
    raisedAt: new Date().toISOString(),
  };
}

/**
 * The evidence as it stands right now, bound to BOTH sources (contracts.ts):
 * `entryHash = stableHash({ cpicEntry, clause })` — key names are the contract;
 * Sol's phase 2b recomputes the identical object to detect drift, so changing
 * either key name silently breaks the supersede beat. `clause` is null when no
 * policy clause matched. Revise either source and the hash moves by itself.
 */
function buildSnapshot(
  entry: CpicEntry,
  drug: string,
  clause: PolicyClause | null,
  coverage: { policyId: string; policyVersion: string } | null,
): EvidenceSnapshot {
  const years = (entry.citations ?? []).map((c) => c.year).filter((y) => Number.isFinite(y));
  const newest = years.length ? Math.max(...years) : null; // "undated" only if CPIC ships no citation

  // CPIC-derived scopes: dosing always; monitoring when CPIC's own text says so.
  const scopes = ["dosing." + drug];
  if (/monitor/i.test(String(entry.recommendation) + " " + String(entry.comments ?? ""))) {
    scopes.push("monitoring." + entry.gene.toLowerCase());
  }
  // Union with the matched clause's scopes — so a policy revision can
  // invalidate one authorization and leave a sibling alone.
  for (const s of clause?.scopes ?? []) if (!scopes.includes(s)) scopes.push(s);

  return {
    snapshotId: `cpic:${entry.gene}:${drug}:${newest ?? "undated"}`,
    entryHash: stableHash({ cpicEntry: entry, clause }),
    guidelineName: entry.guideline_name ?? null,
    policyId: coverage?.policyId ?? null,
    policyVersion: coverage?.policyVersion ?? null,
    scopes,
    capturedAt: new Date().toISOString(),
  };
}
