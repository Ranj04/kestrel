/**
 * THE INTERFACE. Fable owns this file. Sol reads it constantly and never edits it.
 *
 * It is written up front and FROZEN so neither agent is ever blocked on the other.
 * Adding a field is safe. Renaming or removing one is not -- if you need that,
 * write .sol/requests/<task>.md and keep moving.
 *
 * Rule this file exists to enforce: every clinical string comes verbatim from
 * data/cpic/index.json and every policy string comes verbatim from
 * data/policies.json. The model never writes either one. It routes to them.
 */

// ---------------------------------------------------------------- patient

export interface GeneResult {
  gene: string; // "DPYD"
  diplotype: string; // "c.1905+1G>A/c.1679T>G"
  /** MUST match CPIC's `lookup` value character for character, or nothing fires. */
  lookup: string; // "Poor Metabolizer"
  source: string; // "PharmCAT v3.2.0 (synthetic VCF)"
  reportedAt: string; // ISO
}

export interface Patient {
  patientId: string;
  displayName: string;
  mrn: string;
  age: number;
  sex: string;
  indication: string;
  results: GeneResult[];
}

// ---------------------------------------------------------------- order

export interface Order {
  orderId: string;
  patientId: string;
  drugRaw: string; // exactly what the prescriber typed
  drugName: string; // resolved CPIC drug name
  dose: string | null;
  route: string | null;
  orderedBy: string;
  orderedAt: string;
}

// ---------------------------------------------------------------- evidence

export type Severity = "none" | "caution" | "critical";
export type RiskLevel = "low" | "medium" | "high";

export interface Citation {
  pmid: string;
  title: string;
  year: number;
}

/** Coverage determination from data/policies.json. Secondary to the clinical
 *  finding -- it renders as one line UNDER the alert, never above it. */
export interface Coverage {
  payer: string;
  policyId: string;
  policyVersion: string;
  clauseId: string;
  clauseText: string; // VERBATIM from data/policies.json
  determination: "covered" | "covered-with-conditions" | "not-covered" | "pended";
  alternative: string | null;
  scopes: string[];
}

/** An authorization is granted against the evidence as it stood when signed.
 *  Revise either source and the authorization goes stale by itself.
 *  Ported from writ.ai's snapshot binding, evaluated one hop deep. */
export interface EvidenceSnapshot {
  snapshotId: string; // "cpic:DPYD:capecitabine:2017"
  /** stableHash({ cpicEntry, clause }) -- bound to BOTH sources. */
  entryHash: string;
  guidelineName: string | null;
  policyId: string | null;
  policyVersion: string | null;
  /** union of CPIC-derived scopes and the matched clause's scopes */
  scopes: string[];
  capturedAt: string;
}

/** Every string field below is VERBATIM from data/cpic/index.json. */
export interface Alert {
  alertId: string;
  orderId: string;
  gene: string;
  diplotype: string;
  lookup: string;
  drugName: string;
  severity: Severity;
  recommendation: string;
  implication: string | null;
  classification: string | null; // "Strong" | "Moderate" | "Optional" | ...
  comments: string | null;
  population: string | null;
  cpicLevelA: boolean;
  guidelineName: string | null;
  guidelineUrl: string | null;
  citations: Citation[];
  sourceUrl: string; // the exact CPIC API row this came from
  coverage: Coverage | null;
  snapshot: EvidenceSnapshot;
  raisedAt: string;
}

/** FDA draft guidance on AI in regulatory decision-making:
 *  risk = model influence x decision consequence. */
export interface Credibility {
  contextOfUse: string;
  modelInfluence: RiskLevel;
  decisionConsequence: RiskLevel;
  risk: RiskLevel;
  requiredControl: "auto" | "human-review" | "human-signature";
  rationale: string;
}

export interface PrescribeResponse {
  order: Order;
  alert: Alert | null;
  credibility: Credibility;
  resolution: {
    matched: boolean;
    method: "exact" | "substring" | "llm" | "none";
    candidates: string[];
  };
}

// ---------------------------------------------------------------- ledger

export type LedgerEventType =
  | "order.placed"
  | "genotype.resolved"
  | "alert.raised"
  | "alert.accepted"
  | "alert.overridden"
  | "model.invoked"
  | "policy.revised"
  | "export.generated";

export interface Actor {
  id: string;
  name: string;
  role: string;
}

/** ALCOA "Original" requires the unedited model result be retained separately
 *  from any human-edited version. Store rawOutput untouched -- do not parse,
 *  trim, or normalize it before writing. */
export interface ModelProvenance {
  id: string;
  version: string;
  params: Record<string, unknown>;
  prompt: string;
  rawOutput: string;
}

export interface LedgerRecord {
  seq: number;
  recordId: string;
  type: LedgerEventType;
  occurredAt: string; // set at append time. NEVER accepted from the caller.
  actor: Actor;
  payload: unknown;
  model?: ModelProvenance;
  clauses: string[]; // e.g. ["21CFR11.10(e)", "ALCOA+:Attributable"]
  prevHash: string;
  hash: string;
}

/** 21 CFR 11.50: a signature manifestation must carry printed name, date/time,
 *  and the MEANING of the signature. All three are named fields, not implied. */
export interface OverridePayload {
  alertId: string;
  orderId: string;
  printedName: string;
  signedAt: string;
  signatureMeaning: "authorship" | "review" | "approval";
  rationale: string; // the human's final text
  suggestedRationale: string | null; // the model's draft, kept separately
  boundTo: EvidenceSnapshot;
}

export interface VerifyResult {
  ok: boolean;
  total: number;
  firstBrokenSeq: number | null;
  /** firstBroken AND everything after it. The cascade is the point. */
  brokenSeqs: number[];
  checkedAt: string;
}

export type AuthorizationStatus = "valid" | "superseded" | "needs-review";

export interface AuthorizationView {
  seq: number;
  authorizationId: string;
  alertId: string;
  drugName: string;
  actor: Actor;
  status: AuthorizationStatus;
  boundTo: EvidenceSnapshot;
  currentEntryHash: string;
  intersectingScopes: string[];
  supersededBy: { policyId: string; version: string; summary: string } | null;
}
