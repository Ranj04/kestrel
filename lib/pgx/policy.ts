/**
 * Coverage layer (phase0). data/policies.json is SYNTHETIC payer policy —
 * fictional payer, labelled as such inside the file. Every clause string that
 * reaches the screen is copied verbatim from that file; nothing here writes
 * policy language (D1 covers policy text as well as clinical text).
 *
 * Matching note (D3 / R-6): clause criteria match the patient's `phenotype` —
 * the display name — because payers write policy in phenotype language. That
 * is the single documented exception to "join on lookup", stated in the data
 * file itself. Match is exact after trim + case-fold, same discipline as
 * evaluate.ts; never fuzzy.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Coverage, Patient } from "../contracts";

interface Criterion {
  type: string; // "genotype_required" | "phenotype_restriction"
  gene: string;
  phenotype?: string; // absent on a catch-all clause ("all other phenotypes")
  outcome?: string;
  alternative?: string;
}

export interface PolicyClause {
  clauseId: string;
  text: string;
  criterion: Criterion;
  scopes: string[];
}

export interface Policy {
  policyId: string;
  title: string;
  version: string;
  effectiveDate: string;
  drugs: string[];
  clauses: PolicyClause[];
}

export interface PolicyFile {
  payer: string;
  policies: Policy[];
  revision: {
    policyId: string;
    newVersion: string;
    affectedScopes: string[];
    summary: string;
    clauseId: string;
  };
}

const POLICIES_PATH = join(process.cwd(), "data", "policies.json");
const policyFile = JSON.parse(readFileSync(POLICIES_PATH, "utf8")) as PolicyFile;

/** Phase 2b hook (Sol): the policy revision happens IN MEMORY ONLY. Sol
 *  registers a transform here rather than editing this file. */
type PolicyOverlay = (file: PolicyFile) => PolicyFile;
let overlay: PolicyOverlay | null = null;
export function setPolicyOverlay(fn: PolicyOverlay | null): void {
  overlay = fn;
}

export function getPolicyFile(): PolicyFile {
  return overlay ? overlay(policyFile) : policyFile;
}

function determinationOf(outcome: string | undefined): Coverage["determination"] {
  switch (outcome) {
    case "approve":
      return "covered";
    case "approve_with_conditions":
      return "covered-with-conditions";
    case "deny":
    case "deny_standard_dose":
      return "not-covered";
    default:
      return "pended"; // unknown outcome: pend rather than invent an approval
  }
}

/**
 * Walk the matching policy's clauses in order; first determination wins.
 * Returns the raw matched clause too — evaluate.ts hashes it into the
 * evidence snapshot (`stableHash({ cpicEntry, clause })`, see contracts.ts).
 */
export function matchCoverage(
  patient: Patient,
  drugName: string,
): { coverage: Coverage; clause: PolicyClause } | null {
  const file = getPolicyFile();
  const drug = drugName.trim().toLowerCase();
  const policy = file.policies.find((p) => p.drugs.includes(drug));
  // No policy on file for this drug: render NOTHING. Absence of a policy in a
  // synthetic file is not evidence — do not invent "no PA required".
  if (!policy) return null;

  for (const clause of policy.clauses) {
    const crit = clause.criterion;
    const result = patient.results.find((r) => r.gene === crit.gene) ?? null;

    if (crit.type === "genotype_required") {
      if (result) continue; // requirement satisfied — keep walking
      return { coverage: build(file, policy, clause, "pended", null), clause };
    }

    if (crit.type === "phenotype_restriction") {
      if (!result) continue; // nothing on file to restrict against
      if (crit.phenotype) {
        const want = crit.phenotype.trim().toLowerCase();
        const have = (result.phenotype ?? "").trim().toLowerCase();
        if (want !== have) continue;
      }
      // A criterion without `phenotype` is the policy's own catch-all clause.
      return {
        coverage: build(file, policy, clause, determinationOf(crit.outcome), crit.alternative ?? null),
        clause,
      };
    }
    // Unknown criterion type: skip. Never guess a determination.
  }
  return null;
}

export function coverageFor(patient: Patient, drugName: string): Coverage | null {
  return matchCoverage(patient, drugName)?.coverage ?? null;
}

function build(
  file: PolicyFile,
  policy: Policy,
  clause: PolicyClause,
  determination: Coverage["determination"],
  alternative: string | null,
): Coverage {
  return {
    payer: file.payer,
    policyId: policy.policyId,
    policyVersion: policy.version,
    clauseId: clause.clauseId,
    clauseText: clause.text, // VERBATIM from data/policies.json
    determination,
    alternative,
    scopes: clause.scopes,
  };
}
