/**
 * Engine acceptance. Runs evaluate() directly — no dev server needed.
 *
 * The two that matter most:
 *  - Lindqvist + capecitabine MUST be null. A system that flags the normal
 *    metabolizer is worse than useless.
 *  - The D6 conflict guard MUST be observed to fire — first on a controlled
 *    synthetic fixture, then swept across every real conflicting triple in
 *    the shipped cache through the REAL evaluate() and the REAL index. A
 *    guard never observed to trigger is a vacuous instrument.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

// Deterministic paths only: the whole demo must work with no key and no
// network, so the tests run exactly that configuration.
delete process.env.ANTHROPIC_API_KEY;

import type { Patient } from "../lib/contracts.ts";
import * as llm from "../lib/llm.ts";
import { assess } from "../lib/credibility.ts";
import { evaluate, severityOf } from "../lib/pgx/evaluate.ts";
import { getIndex, getPatient, type CpicEntry, type CpicIndex } from "../lib/pgx/index.ts";
import { coverageFor } from "../lib/pgx/policy.ts";
import { resolveDrug } from "../lib/pgx/resolve.ts";

const patient = (id: string): Patient => {
  const p = getPatient(id);
  assert.ok(p, `${id} must exist in data/patients.json`);
  return p;
};

// ---------------------------------------------------------------- demo cases

test("pt_okafor + capecitabine: critical, verbatim CPIC strings, snapshot bound", () => {
  const alert = evaluate(patient("pt_okafor"), "capecitabine", "ord_test1");
  assert.ok(alert, "the money shot must fire");
  assert.equal(alert.severity, "critical");
  assert.match(alert.recommendation, /Avoid use of 5-fluorouracil/);
  assert.ok(alert.citations.length > 0, "citations must ride along");

  // Verbatim proof: the string on the alert IS the string in the cache file,
  // character for character — therefore the text on screen is CPIC's.
  const entry = getIndex()["capecitabine"]["DPYD"].find(
    (e) => String(e.lookup).trim().toLowerCase() === "0.0",
  );
  assert.ok(entry);
  assert.equal(alert.recommendation, entry.recommendation);
  assert.equal(alert.implication, entry.implication);
  assert.equal(alert.sourceUrl, entry._source);

  // Display vs join key: the card must be able to say "Poor Metabolizer".
  assert.equal(alert.lookup, "0.0");
  assert.equal(alert.phenotype, "Poor Metabolizer");
  assert.equal(alert.diplotype, "c.1905+1G>A (*2A)/c.1905+1G>A (*2A)");

  // Snapshot: bound to BOTH sources, self-describing hash, scoped.
  assert.match(alert.snapshot.entryHash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(alert.snapshot.snapshotId, "cpic:DPYD:capecitabine:2017");
  assert.ok(alert.snapshot.scopes.includes("dosing.capecitabine"));
  assert.equal(alert.snapshot.policyId, "PA-ONC-014");

  // Coverage renders INSIDE the alert card too.
  assert.ok(alert.coverage);
  assert.equal(alert.coverage.clauseId, "PA-ONC-014.2");
  assert.equal(alert.coverage.determination, "not-covered");

  // FDA grid: critical -> nothing less than a signature.
  assert.equal(assess(alert).requiredControl, "human-signature");
});

test("pt_lindqvist + capecitabine: NO alert (check this one twice)", () => {
  assert.equal(evaluate(patient("pt_lindqvist"), "capecitabine", "ord_test2"), null);
  // Same drug, same policy — covered. Coverage must still render with no alert.
  const cov = coverageFor(patient("pt_lindqvist"), "capecitabine");
  assert.ok(cov);
  assert.equal(cov.clauseId, "PA-ONC-014.4");
  assert.equal(cov.determination, "covered");
});

test("pt_reyes + codeine: critical with DIFFERENT text — not one hardcoded case", () => {
  const alert = evaluate(patient("pt_reyes"), "codeine", "ord_test3");
  assert.ok(alert);
  assert.equal(alert.severity, "critical");
  assert.match(alert.recommendation, /Avoid codeine/);
  const okafor = evaluate(patient("pt_okafor"), "capecitabine", "ord_test3b");
  assert.ok(okafor);
  assert.notEqual(alert.recommendation, okafor.recommendation);
  assert.equal(alert.phenotype, "Ultrarapid Metabolizer");
  assert.ok(alert.coverage);
  assert.equal(alert.coverage.clauseId, "PA-PAIN-007.1");
  assert.equal(alert.coverage.determination, "not-covered");
  assert.ok(alert.coverage.alternative);
});

test("pt_bhattacharya + capecitabine: no genotype -> no alert, coverage pended", () => {
  assert.equal(evaluate(patient("pt_bhattacharya"), "capecitabine", "ord_test4"), null);
  const cov = coverageFor(patient("pt_bhattacharya"), "capecitabine");
  assert.ok(cov);
  assert.equal(cov.clauseId, "PA-ONC-014.1");
  assert.equal(cov.determination, "pended");
});

// ------------------------------------------------------------- D6: the guard

function syntheticEntry(overrides: Partial<CpicEntry>): CpicEntry {
  return {
    gene: "CYP2D6",
    lookup: "1.0",
    phenotype: "Normal Metabolizer",
    drug: "testdrug",
    recommendation: "Avoid testdrug entirely.",
    classification: "Strong",
    implication: null,
    comments: null,
    population: "general",
    cpic_level_a: true,
    guideline_name: "Synthetic",
    guideline_url: null,
    citations: [{ pmid: "0", title: "synthetic", year: 2020 }],
    _source: "synthetic://d6-test",
    ...overrides,
  };
}

const syntheticPatient: Patient = {
  patientId: "pt_synth",
  displayName: "Synthetic Patient",
  mrn: "0000-0",
  age: 50,
  sex: "X",
  indication: "D6 guard test",
  results: [
    {
      gene: "CYP2D6",
      diplotype: "synthetic",
      lookup: "1.0",
      phenotype: "Normal Metabolizer",
      source: "synthetic",
      reportedAt: "2026-08-13T00:00:00Z",
    },
  ],
};

function withWarnCapture<T>(fn: () => T): { result: T; warns: string[] } {
  const warns: string[] = [];
  const orig = console.warn;
  console.warn = (...args: unknown[]) => warns.push(args.join(" "));
  try {
    return { result: fn(), warns };
  } finally {
    console.warn = orig;
  }
}

test("D6 positive control: two AGREEING rows for one lookup still raise the alert", () => {
  const idx: CpicIndex = {
    testdrug: { CYP2D6: [syntheticEntry({}), syntheticEntry({})] },
  };
  const { result, warns } = withWarnCapture(() =>
    evaluate(syntheticPatient, "testdrug", "ord_d6a", idx),
  );
  assert.ok(result, "agreement must not be mistaken for conflict");
  assert.equal(result.severity, "critical");
  assert.equal(warns.length, 0);
});

test("D6 guard FIRES: two rows disagreeing on severity/text raise NO alert", () => {
  const idx: CpicIndex = {
    testdrug: {
      CYP2D6: [
        syntheticEntry({}),
        syntheticEntry({ recommendation: "Initiate standard dosing." }), // severity "none"
      ],
    },
  };
  const { result, warns } = withWarnCapture(() =>
    evaluate(syntheticPatient, "testdrug", "ord_d6b", idx),
  );
  // Null AND the conflict log — the log is what distinguishes "guard fired"
  // from "join found nothing", which produce identical return values.
  assert.equal(result, null);
  assert.equal(warns.length, 1);
  assert.match(warns[0], /CONFLICT \(D6\)/);
});

test("D6 sweep: EVERY real conflicting triple in the shipped cache raises no alert", () => {
  const index = getIndex();
  // Mirror evaluate()'s own matching discipline: exact after trim + case-fold.
  const conflicts: { drug: string; gene: string; lookup: string }[] = [];
  for (const [drug, byGene] of Object.entries(index)) {
    for (const [gene, entries] of Object.entries(byGene)) {
      const groups = new Map<string, CpicEntry[]>();
      for (const e of entries) {
        const k = String(e.lookup).trim().toLowerCase();
        groups.set(k, [...(groups.get(k) ?? []), e]);
      }
      for (const rows of groups.values()) {
        if (rows.length < 2) continue;
        const first = rows[0];
        const sev = severityOf(first.recommendation, first.classification);
        const disagree = rows.some(
          (r) =>
            r.recommendation !== first.recommendation ||
            severityOf(r.recommendation, r.classification) !== sev,
        );
        if (disagree) conflicts.push({ drug, gene, lookup: String(first.lookup) });
      }
    }
  }
  // The sweep itself must be non-vacuous: D6 measured ~146 disagreeing keys.
  assert.ok(conflicts.length > 100, `expected >100 real conflicts, found ${conflicts.length}`);

  const { warns } = withWarnCapture(() => {
    for (const c of conflicts) {
      const p: Patient = {
        ...syntheticPatient,
        results: [
          {
            gene: c.gene,
            diplotype: "sweep",
            lookup: c.lookup,
            phenotype: null,
            source: "sweep",
            reportedAt: "2026-08-13T00:00:00Z",
          },
        ],
      };
      // REAL evaluate(), REAL index (default parameter) — a helper-level
      // fixture would pass even if evaluate() took the first row.
      const alert = evaluate(p, c.drug, "ord_sweep");
      assert.equal(
        alert,
        null,
        `conflicting triple (${c.drug}, ${c.gene}, "${c.lookup}") must raise nothing`,
      );
    }
  });
  assert.equal(warns.length, conflicts.length, "every null must come from the guard, logged");
});

// ------------------------------------------------------------ severity rule

test("severityOf derives from CPIC text, never invents", () => {
  assert.equal(severityOf("Avoid use of 5-fluorouracil.", "Strong"), "critical");
  assert.equal(severityOf("Reduce starting dose by 50%.", "Strong"), "critical");
  assert.equal(severityOf("Reduce starting dose by 50%.", "Moderate"), "caution");
  assert.equal(severityOf("Initiate therapy with label-recommended dosing.", "Strong"), "none");
  assert.equal(severityOf("No recommendation.", null), "none");
  assert.equal(severityOf("Consider a clinically appropriate alternative.", "Optional"), "caution");
});

// ------------------------------------------------------- resolve, no LLM key

test("resolveDrug: brand name with dose noise reaches the CPIC key, no LLM", async () => {
  const r = await resolveDrug("Xeloda 1250 mg/m2 BID");
  assert.equal(r.drugName, "capecitabine");
  assert.equal(r.method, "exact");
  assert.equal(r.provenance, undefined, "no LLM key means no model call at all");
});

test("resolveDrug: generic with sig reaches the key", async () => {
  const r = await resolveDrug("codeine 30mg q6h prn");
  assert.equal(r.drugName, "codeine");
  assert.equal(r.method, "exact");
});

test("resolveDrug: unknown drug resolves to none, never a guess", async () => {
  const r = await resolveDrug("florblexin");
  assert.equal(r.drugName, null);
  assert.equal(r.method, "none");
});

test("llm wrapper returns null immediately with no key and never throws", async () => {
  assert.equal(await llm.resolveDrug("Xeloda", ["capecitabine"]), null);
  assert.equal(await llm.parseOrder("Xeloda 1250 mg/m2 BID"), null);
});
