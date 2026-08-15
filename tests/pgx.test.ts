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
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Deterministic paths only: the whole demo must work with no key and no
// network, so the tests run exactly that configuration.
delete process.env.ANTHROPIC_API_KEY;

import type { Patient } from "../lib/contracts.ts";
import { fdaAssociation, loadFdaTable } from "../lib/pgx/fda.ts";
import * as llm from "../lib/llm.ts";
import { assess } from "../lib/credibility.ts";
import { assessGenes, evaluate, severityOf } from "../lib/pgx/evaluate.ts";
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

// ------------------------------------------- gene coverage (phase6 fix round)
//
// evaluate() returning null is ambiguous: "assessed, nothing raised" and "the
// relevant gene was never tested" are the identical null. assessGenes() carries
// the disambiguating facts. The fixture that matters is pt_reyes + capecitabine
// — a real patient with a result for the WRONG gene, which the phase6 review
// caught rendering as a green clearance.

test("assessGenes: Reyes + capecitabine — DPYD not assessed; his CYP2D6 result does not count", () => {
  const genes = assessGenes(patient("pt_reyes"), "capecitabine");
  assert.ok(genes, "capecitabine has a CPIC bucket, so the answer is a list, not null");
  // The list is the DRUG's genes, not the patient's: CYP2D6 (which Reyes has)
  // is irrelevant to capecitabine and must not appear at all.
  assert.deepEqual(
    genes.map((g) => g.gene),
    ["DPYD"],
  );
  assert.equal(genes[0].assessed, false, "no DPYD result -> not assessed, never a pass");
  assert.equal(genes[0].resultOnFile, false);
  assert.equal(genes[0].phenotype, null);
});

test("assessGenes: Lindqvist + capecitabine — DPYD genuinely assessed, display fields carried", () => {
  const p = patient("pt_lindqvist");
  const genes = assessGenes(p, "capecitabine");
  assert.ok(genes);
  assert.equal(genes.length, 1);
  const dpyd = p.results.find((r) => r.gene === "DPYD");
  assert.ok(dpyd);
  assert.deepEqual(genes[0], {
    gene: "DPYD",
    assessed: true,
    resultOnFile: true,
    phenotype: dpyd.phenotype, // "Normal Metabolizer", from patients.json itself
    diplotype: dpyd.diplotype,
  });
});

test("assessGenes: a result whose lookup matches no CPIC row is NOT assessed (R-6's silent join)", () => {
  // The exact historical defect shape: phenotype name written where the
  // activity-score join key belongs. The join finds nothing, and that absence
  // must surface as assessed:false + resultOnFile:true — never as a pass.
  const p: Patient = {
    ...syntheticPatient,
    results: [
      {
        gene: "DPYD",
        diplotype: "synthetic",
        lookup: "Poor Metabolizer", // matches nothing; the key is "0.0"
        phenotype: "Poor Metabolizer",
        source: "synthetic",
        reportedAt: "2026-08-13T00:00:00Z",
      },
    ],
  };
  const genes = assessGenes(p, "capecitabine");
  assert.ok(genes);
  assert.equal(genes[0].gene, "DPYD");
  assert.equal(genes[0].assessed, false, "an unmatched lookup must not count as assessed");
  assert.equal(genes[0].resultOnFile, true, "…but the result's existence is stated honestly");
});

test("assessGenes: no CPIC guideline for the drug -> null, mirroring evaluate()", () => {
  assert.equal(assessGenes(patient("pt_reyes"), "florblexin"), null);
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

// ------------------------------------------------- FDA table: presence only
//
// ABSENCE IS NOT EVIDENCE. Every assertion below is either "the FDA's verbatim
// text came through" or "the answer is null". There is deliberately no test
// asserting a negative claim, because the code must never be able to make one.

const FDA_RAW = readFileSync(join(process.cwd(), "data", "fda-pgx.json"), "utf8");

test("fdaAssociation: DPYD/capecitabine — case-insensitive on drug, verbatim from disk", () => {
  // CPIC writes "capecitabine", the FDA writes "Capecitabine". The fold is on
  // the QUERY only: what comes back is the FDA's own spelling.
  const hit = fdaAssociation("DPYD", "capecitabine");
  assert.ok(hit, "the FDA publishes a DPYD/capecitabine association");
  assert.equal(hit.drug, "Capecitabine", "the FDA's own spelling is preserved");
  assert.equal(hit.gene, "DPYD");
  assert.equal(hit.rows.length, 1);

  // Verbatim proof measured against the file, not against the code under test.
  assert.ok(FDA_RAW.includes(hit.rows[0].description), "description exists in data/fda-pgx.json");
  assert.ok(
    FDA_RAW.includes(hit.rows[0].affected_subgroups),
    "affected_subgroups exists in data/fda-pgx.json",
  );
  assert.match(hit.rows[0].description, /^Results in higher adverse reaction risk/);
  assert.equal(hit.rows[0].affected_subgroups, "intermediate or poor metabolizers");
  assert.equal(hit.rows[0].section, 1);

  // Provenance is read out of the file, never asserted in code (R-20): the
  // scrape can be re-run through a proxy and only `via` moves.
  assert.equal(hit.source_url, JSON.parse(FDA_RAW).source_url);
  assert.equal(hit.retrieved_at, JSON.parse(FDA_RAW).retrieved_at);
  assert.equal(hit.via, JSON.parse(FDA_RAW).via);

  // Same answer whatever case the caller supplies.
  assert.deepEqual(fdaAssociation("DPYD", "Capecitabine"), hit);
  assert.deepEqual(fdaAssociation("DPYD", "  CAPECITABINE  "), hit);
});

test("fdaAssociation: CYP2D6/codeine carries BOTH FDA rows — never one picked from two", () => {
  const hit = fdaAssociation("CYP2D6", "codeine");
  assert.ok(hit);
  // The FDA publishes an ultrarapid row (section 1) and a poor-metabolizer row
  // (section 2). Returning "the first" would make the citation depend on file
  // order — the same defect the D6 guard exists for.
  assert.equal(hit.rows.length, 2);
  assert.deepEqual(
    hit.rows.map((r) => r.section),
    [1, 2],
  );
  for (const row of hit.rows) {
    assert.ok(FDA_RAW.includes(row.description), "each description exists in data/fda-pgx.json");
    assert.ok(FDA_RAW.includes(row.affected_subgroups), "each subgroup exists on disk");
  }
  assert.match(hit.rows[0].affected_subgroups, /ultrarapid/);
  assert.match(hit.rows[1].affected_subgroups, /poor/);
  assert.notEqual(hit.rows[0].description, hit.rows[1].description);
});

test("fdaAssociation: absent pair -> null. The table lists associations, not exclusions", () => {
  // Neither the gene nor the drug of this pair is in the table.
  assert.equal(fdaAssociation("G6PD", "nitrofurantoin"), null);
  assert.ok(!FDA_RAW.includes('"gene": "G6PD"'), "G6PD is genuinely absent from the table");

  // The join is on the PAIR, not on either half: CYP2C19 has rows, capecitabine
  // has a row, and the FDA publishes no association between the two. A gene-only
  // or drug-only match would put a badge on a pair the FDA never published.
  assert.ok(FDA_RAW.includes('"gene": "CYP2C19"'), "CYP2C19 does appear in the table");
  assert.ok(FDA_RAW.includes('"drug": "Capecitabine"'), "Capecitabine does appear in the table");
  assert.equal(fdaAssociation("CYP2C19", "capecitabine"), null);

  assert.equal(fdaAssociation("DPYD", "florblexin"), null);
});

test("loadFdaTable: a missing file yields null and never throws — the demo survives without it", () => {
  assert.equal(loadFdaTable("/nonexistent/fda-pgx.json"), null);
  assert.ok(loadFdaTable(), "and the real file does load, so the null above is not vacuous");
});

test("evaluate: fdaLabeled populated for both demo pairs, verbatim", () => {
  const okafor = evaluate(patient("pt_okafor"), "capecitabine", "ord_fda1");
  assert.ok(okafor?.fdaLabeled, "Okafor's alert carries the FDA association");
  assert.equal(okafor.fdaLabeled.gene, "DPYD");
  assert.equal(okafor.fdaLabeled.drug, "Capecitabine");
  assert.ok(FDA_RAW.includes(okafor.fdaLabeled.rows[0].description));

  const reyes = evaluate(patient("pt_reyes"), "codeine", "ord_fda2");
  assert.ok(reyes?.fdaLabeled, "Reyes's alert carries the FDA association");
  assert.equal(reyes.fdaLabeled.rows.length, 2);
  assert.notEqual(
    reyes.fdaLabeled.rows[0].description,
    okafor.fdaLabeled.rows[0].description,
    "two alerts carry two different FDA texts — not one hardcoded badge",
  );
});

/** A REAL CPIC alert whose (gene, drug) the FDA has not published: G6PD +
 *  nitrofurantoin, raised through the real evaluate() over the real cache. */
const g6pdPatient: Patient = {
  patientId: "pt_synth_g6pd",
  displayName: "Synthetic G6PD Patient",
  mrn: "0000-1",
  age: 50,
  sex: "X",
  indication: "FDA absence test",
  results: [
    {
      gene: "G6PD",
      diplotype: "synthetic",
      lookup: "Deficient with CNSHA",
      phenotype: "Deficient with CNSHA",
      source: "synthetic",
      reportedAt: "2026-08-13T00:00:00Z",
    },
  ],
};

test("evaluate: an alert the FDA table does not cover gets fdaLabeled null, not a negative", () => {
  const alert = evaluate(g6pdPatient, "nitrofurantoin", "ord_fda3");
  assert.ok(alert, "the fixture must actually raise an alert, or it proves nothing");
  assert.equal(alert.severity, "critical");
  assert.equal(alert.fdaLabeled, null);
  // And the pair really is absent from the file, measured against disk.
  assert.ok(!FDA_RAW.toLowerCase().includes("nitrofurantoin"));
});
