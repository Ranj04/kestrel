/**
 * Phase 7.5 — the honesty pass, Fable half. Every test here pins a label or a
 * render condition whose absence let the screen claim more than the system did:
 *
 *   G-5   single-highest-severity label + suppressed D6 conflict renders amber
 *   G-11  credibility card must not conclude under an incomplete screen
 *   G-9   fictional payer labelled, "determination" claim removed
 *   G-10  FDA badge renamed to the association-table claim the evidence supports
 *   G-23  demo-alias resolution says "demo alias", never "exact"
 *   G-17  pipeline page cites the bundled snapshot, never "today"
 *   G-25  truncated Aetna captures labelled truncated, never "Verbatim"
 *
 * docs/PRODUCTION_GAP.md (phase 7.5 table) is the spec. Per 4a-bis, this file
 * was run against the pre-7.5 tree FIRST and every test failed for its stated
 * reason — the before/after outputs are in .sol/reviews/phase75-fable-report.md.
 *
 * None of the labels pinned here is clinical language: each states what the
 * system did or did not do, or the provenance of what it shows.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

delete process.env.ANTHROPIC_API_KEY; // deterministic paths only, as everywhere

import type { Coverage, Patient, PrescribeResponse } from "../lib/contracts.ts";
import { assess } from "../lib/credibility.ts";
import { assessGenes, evaluate, severityOf } from "../lib/pgx/evaluate.ts";
import { getIndex, getPatient, type CpicEntry, type CpicIndex } from "../lib/pgx/index.ts";
import { coverageFor } from "../lib/pgx/policy.ts";
import { resolveDrug } from "../lib/pgx/resolve.ts";
import { AlertCard } from "../components/prescribe/AlertCard.tsx";
import { CoverageLine } from "../components/prescribe/CoverageLine.tsx";
import { CredibilityCard } from "../components/prescribe/CredibilityCard.tsx";
import { OrderForm } from "../components/prescribe/OrderForm.tsx";
import { WhyDrawer } from "../components/prescribe/WhyDrawer.tsx";
import PipelinePage from "../app/pipeline/page.tsx";

const POLICY_RAW = readFileSync(join(process.cwd(), "data", "policies.json"), "utf8");

const patient = (id: string): Patient => {
  const p = getPatient(id);
  assert.ok(p, `${id} must exist in data/patients.json`);
  return p;
};

const noop = () => {};

/** Same shape ui.test.ts builds — the response the page hands the components. */
function respond(p: Patient, drugName: string): PrescribeResponse {
  const alert = evaluate(p, drugName, "ord_p75");
  return {
    order: {
      orderId: "ord_p75",
      patientId: p.patientId,
      drugRaw: drugName,
      drugName,
      dose: null,
      route: null,
      orderedBy: "dr_chen",
      orderedAt: new Date().toISOString(),
    },
    alert,
    coverage: coverageFor(p, drugName),
    genesAssessed: assessGenes(p, drugName),
    credibility: assess(alert),
    resolution: { matched: true, method: "exact", candidates: [] },
  };
}

function renderAlertCard(response: PrescribeResponse, p: Patient): string {
  return renderToStaticMarkup(
    createElement(AlertCard, { response, patient: p, onWhy: noop, onOverride: noop, recorded: null }),
  );
}

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

// ------------------------------------------------- synthetic D6-conflict rig

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
    _source: "synthetic://p75-test",
    ...overrides,
  };
}

const syntheticPatient: Patient = {
  patientId: "pt_synth_p75",
  displayName: "Synthetic Patient",
  mrn: "0000-2",
  age: 50,
  sex: "X",
  indication: "phase 7.5 conflict test",
  results: [
    {
      gene: "CYP2D6",
      diplotype: "synthetic",
      lookup: "1.0",
      phenotype: "Normal Metabolizer",
      source: "synthetic",
      reportedAt: "2026-08-14T00:00:00Z",
    },
  ],
};

const CONFLICT_IDX: CpicIndex = {
  testdrug: {
    CYP2D6: [
      syntheticEntry({}),
      syntheticEntry({ recommendation: "Initiate standard dosing." }), // severity "none"
    ],
  },
};

const AGREE_IDX: CpicIndex = {
  testdrug: { CYP2D6: [syntheticEntry({}), syntheticEntry({})] },
};

// ------------------------------------------ G-5 / R-25: conflict is an unknown

test("assessGenes: disagreeing CPIC rows -> conflict:true — the D6 suppression is carried, not hidden", () => {
  const genes = assessGenes(syntheticPatient, "testdrug", CONFLICT_IDX);
  assert.ok(genes);
  assert.equal(genes[0].gene, "CYP2D6");
  assert.equal(genes[0].assessed, true, "the join genuinely matched");
  assert.equal(genes[0].conflict, true, "…and the disagreement is a carried fact, not a silent null");
});

test("assessGenes: agreeing rows -> conflict:false (positive control, same rig)", () => {
  const genes = assessGenes(syntheticPatient, "testdrug", AGREE_IDX);
  assert.ok(genes);
  assert.equal(genes[0].assessed, true);
  assert.equal(genes[0].conflict, false, "agreement must not be mistaken for conflict");
});

test("assessGenes: EVERY real conflicting triple in the shipped cache reports conflict:true", () => {
  // Mirror of the pgx.test.ts D6 sweep — the same triples evaluate() suppresses
  // must surface as conflict:true, or a suppressed conflict renders as a pass.
  const index = getIndex();
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
  assert.ok(conflicts.length > 100, `sweep must be non-vacuous; found ${conflicts.length}`);

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
          reportedAt: "2026-08-14T00:00:00Z",
        },
      ],
    };
    const genes = assessGenes(p, c.drug);
    assert.ok(genes);
    const g = genes.find((x) => x.gene === c.gene);
    assert.ok(g, `${c.gene} must be in ${c.drug}'s assessment list`);
    assert.equal(g.assessed, true, `(${c.drug}, ${c.gene}) matched — assessed`);
    assert.equal(g.conflict, true, `(${c.drug}, ${c.gene}, "${c.lookup}") must carry conflict:true`);
  }
});

test("AlertCard: a suppressed D6 conflict renders AMBER — an unknown, never the assessed pass", () => {
  // The same fixture drives the guard and the render: evaluate() must suppress
  // (with the logged conflict), and the null it returns must NOT paint green.
  const { result: alert, warns } = withWarnCapture(() =>
    evaluate(syntheticPatient, "testdrug", "ord_p75c", CONFLICT_IDX),
  );
  assert.equal(alert, null, "the D6 guard suppresses the conflicting triple");
  assert.equal(warns.length, 1, "…and logs it");

  const response: PrescribeResponse = {
    ...respond(syntheticPatient, "testdrug"),
    alert: null,
    coverage: null,
    genesAssessed: assessGenes(syntheticPatient, "testdrug", CONFLICT_IDX),
  };
  const html = renderAlertCard(response, syntheticPatient);
  const visible = html.replace(/<[^>]+>/g, " ");

  assert.ok(!html.includes("✓"), "no tick for a determination the engine refused to make");
  assert.ok(!html.includes("text-seal"), "not painted in the clearance colour");
  assert.ok(html.includes("text-amber"), "rendered amber, like every honest-absence state");
  assert.ok(
    visible.includes("conflicting CPIC rows"),
    "the conflict is named — procedurally, as what the data did",
  );
  assert.ok(visible.includes("no determination"), "and the non-answer is stated as one");
  assert.ok(/incomplete/i.test(visible), "screening is stated incomplete, never clear");
  assert.ok(!visible.includes("No CPIC alert raised"), "the assessed-pass line must not render");
});

test("AlertCard critical: labelled 'highest-severity finding only; not an exhaustive screen'", () => {
  for (const [pid, drug] of [
    ["pt_okafor", "capecitabine"],
    ["pt_reyes", "codeine"],
  ] as const) {
    const p = patient(pid);
    const response = respond(p, drug);
    assert.ok(response.alert, `${pid} + ${drug} must alert`);
    const html = renderAlertCard(response, p);
    assert.ok(
      html.includes("Highest-severity finding only; not an exhaustive screen."),
      `${pid}: the single-finding semantics of evaluate() are stated on screen`,
    );
  }
});

test("AlertCard caution: the same label rides the amber card", () => {
  const idx: CpicIndex = {
    testdrug: {
      CYP2D6: [
        syntheticEntry({ recommendation: "Reduce starting dose by 50%.", classification: "Moderate" }),
      ],
    },
  };
  const alert = evaluate(syntheticPatient, "testdrug", "ord_p75d", idx);
  assert.ok(alert, "the synthetic caution must raise");
  assert.equal(alert.severity, "caution");
  const response: PrescribeResponse = {
    ...respond(syntheticPatient, "testdrug"),
    alert,
    coverage: null,
    genesAssessed: assessGenes(syntheticPatient, "testdrug", idx),
  };
  const html = renderAlertCard(response, syntheticPatient);
  assert.ok(html.includes("REVIEW BEFORE PRESCRIBING"), "it is the caution branch");
  assert.ok(html.includes("Highest-severity finding only; not an exhaustive screen."));
});

// -------------------------------------- G-11 / R-26: credibility under an
// incomplete screen

test("screeningIncomplete: incomplete states are true, completed and alerted states are false", async () => {
  // Dynamic import so this test fails (rather than crashing the file) against
  // a tree where the export does not exist yet — the 4a-bis before-run.
  const mod = await import("../lib/credibility.ts");
  const fn = (mod as Record<string, unknown>).screeningIncomplete as
    | ((r: Pick<PrescribeResponse, "alert" | "genesAssessed" | "resolution">) => boolean)
    | undefined;
  assert.equal(typeof fn, "function", "lib/credibility.ts must export screeningIncomplete");

  // Reyes + capecitabine: relevant gene not assessed -> incomplete.
  assert.equal(fn!(respond(patient("pt_reyes"), "capecitabine")), true);
  // Bhattacharya: no genotype on file -> incomplete.
  assert.equal(fn!(respond(patient("pt_bhattacharya"), "capecitabine")), true);
  // Unmatched drug: no check performed at all -> incomplete.
  assert.equal(
    fn!({ alert: null, genesAssessed: null, resolution: { matched: false, method: "none", candidates: [] } }),
    true,
  );
  // Suppressed conflict -> incomplete (a conflict is an unknown, not a clearance).
  assert.equal(
    fn!({
      alert: null,
      genesAssessed: assessGenes(syntheticPatient, "testdrug", CONFLICT_IDX),
      resolution: { matched: true, method: "exact", candidates: [] },
    }),
    true,
  );
  // Lindqvist: every relevant gene assessed, no conflict -> complete.
  assert.equal(fn!(respond(patient("pt_lindqvist"), "capecitabine")), false);
  // Okafor: an alert was raised — the system made a determination, and the
  // card's conclusion is review/signature, not the G-11 "auto" overclaim.
  assert.equal(fn!(respond(patient("pt_okafor"), "capecitabine")), false);
});

test("CredibilityCard: incomplete screening renders not-applicable, never 'No human control required.'", () => {
  const incomplete = renderToStaticMarkup(
    createElement(CredibilityCard, { credibility: assess(null), screeningIncomplete: true }),
  );
  assert.ok(incomplete.includes("Not applicable"), "the card states it is not applicable");
  assert.ok(/incomplete/i.test(incomplete), "…because screening is incomplete");
  assert.ok(
    !incomplete.includes("No human control required."),
    "the confident conclusion must not render under an incomplete screen",
  );
  assert.ok(!incomplete.includes("required control"), "no control row for a non-assessment");

  // Positive control: the completed no-alert state still renders the assessment.
  const complete = renderToStaticMarkup(
    createElement(CredibilityCard, { credibility: assess(null) }),
  );
  assert.ok(complete.includes("No human control required."), "the card CAN still conclude");
});

test("app/page.tsx call site: the page passes screeningIncomplete to CredibilityCard (4a-quater)", () => {
  // The component tests above call CredibilityCard directly, so deleting the
  // page's prop would leave every render test green while the screen regressed
  // — 4a-quater's exact shape. The page cannot be rendered under node:test (it
  // fetches), so the call site is pinned at the source, which the template
  // names as the honest instrument for an absent-call defect.
  const src = readFileSync(join(process.cwd(), "app", "page.tsx"), "utf8");
  assert.ok(
    src.includes('import { screeningIncomplete } from "@/lib/credibility"'),
    "the page imports the computation",
  );
  const passes = src.match(/screeningIncomplete=\{incomplete\}/g) ?? [];
  assert.equal(passes.length, 2, "both CredibilityCard call sites carry the flag");
});

// --------------------------------------------------- G-9: the coverage label

test("CoverageLine: 'DEMO — fictional payer; not a coverage determination', clause still verbatim", () => {
  const coverage = coverageFor(patient("pt_bhattacharya"), "capecitabine") as Coverage;
  assert.ok(coverage);
  const html = renderToStaticMarkup(createElement(CoverageLine, { coverage }));
  assert.ok(
    html.includes("DEMO — fictional payer; not a coverage determination"),
    "the determination claim is withdrawn on screen",
  );
  // The label is procedural; the clause text stays untouched and verbatim.
  assert.ok(html.includes(coverage.clauseText), "clauseText renders verbatim");
  assert.ok(POLICY_RAW.includes(coverage.clauseText), "clauseText exists in policies.json");
});

// ---------------------------------------------------- G-10: FDA badge rename

test("FDA badge: says 'FDA association table', never 'FDA-labeled' — the claim the evidence supports", () => {
  const p = patient("pt_okafor");
  const response = respond(p, "capecitabine");
  assert.ok(response.alert?.fdaLabeled, "the alert carries the association");
  const card = renderAlertCard(response, p);
  const drawer = renderToStaticMarkup(
    createElement(WhyDrawer, { alert: response.alert, onClose: noop }),
  );

  for (const [name, html] of [
    ["AlertCard", card],
    ["WhyDrawer", drawer],
  ] as const) {
    assert.ok(html.includes("FDA association table"), `${name}: table-inclusion wording renders`);
    assert.ok(
      !html.includes("FDA-labeled"),
      `${name}: the labeling overclaim is gone (G-10 — inclusion in the association table is not labeling)`,
    );
  }
});

// --------------------------------------------------- G-23: demo alias, named

test("resolveDrug: a BRAND_MAP hit says method 'demo-alias'; a genuine key match stays 'exact'", async () => {
  const brand = await resolveDrug("Xeloda 1250 mg/m2 BID");
  assert.equal(brand.drugName, "capecitabine", "the substitution itself is unchanged");
  assert.equal(brand.method, "demo-alias", "…but it is disclosed as the demo alias map");

  const generic = await resolveDrug("codeine 30mg q6h prn");
  assert.equal(generic.drugName, "codeine");
  assert.equal(generic.method, "exact", "a true index-key match still reads exact");
});

test("OrderForm: 'matched demo alias' for the alias route, 'matched exact' only for a real key", () => {
  const base = respond(patient("pt_okafor"), "capecitabine");
  const aliasResponse: PrescribeResponse = {
    ...base,
    order: { ...base.order, drugRaw: "Xeloda 1250 mg/m2 BID" },
    resolution: { matched: true, method: "demo-alias", candidates: [] },
  };
  const aliasHtml = renderToStaticMarkup(
    createElement(OrderForm, { onSubmit: noop, pending: false, response: aliasResponse }),
  );
  assert.ok(aliasHtml.includes("matched demo alias"), "the alias resolution names itself");
  assert.ok(!aliasHtml.includes("matched exact"), "and never claims exact");

  const exactHtml = renderToStaticMarkup(
    createElement(OrderForm, { onSubmit: noop, pending: false, response: base }),
  );
  assert.ok(exactHtml.includes("matched exact"), "positive control: exact still renders exact");
});

// ------------------------------------------------ G-17: the snapshot wording

test("pipeline page: coverage is claimed against the bundled snapshot, never 'today'", () => {
  const html = renderToStaticMarkup(createElement(PipelinePage));
  assert.ok(
    html.includes("Has a guideline in the bundled CPIC snapshot"),
    "the claim is scoped to the artifact that supports it",
  );
  assert.ok(html.includes("capture date unavailable"), "and its missing provenance is stated");
  assert.ok(!/guideline today/i.test(html), "the present-tense claim is gone");
});

// -------------------------------------------- G-25: truncated capture labels

test("payer-policies-scraped: clauses are labelled truncated captures, never 'Verbatim'", () => {
  const raw = readFileSync(join(process.cwd(), "data", "payer-policies-scraped.json"), "utf8");
  const file = JSON.parse(raw) as {
    note: string;
    clauses: { clauseId: string; text: string; truncated?: boolean; note?: string }[];
  };

  assert.ok(/truncated/i.test(file.note), "the file-level note discloses the truncation");
  for (const c of file.clauses) {
    assert.equal(c.truncated, true, `${c.clauseId} must carry truncated:true`);
    if (c.note) {
      assert.ok(
        !/^\s*Verbatim/.test(c.note),
        `${c.clauseId}: a truncated quote is not verbatim — the note must not open with the word`,
      );
    }
  }

  // The honest fix is the LABEL, not the quote: the captured text — cuts,
  // adjacent-content bleed, Aetna's own misspelling — must be byte-identical
  // to what the scrape wrote. Reverting to prettier text reddens this.
  const dpyd = file.clauses.find((c) => c.clauseId === "AETNA-0715.dpyd-testing");
  const cpt = file.clauses.find((c) => c.clauseId === "AETNA-0715.cpt-81232");
  assert.ok(dpyd && cpt, "both captured clauses are present");
  assert.ok(dpyd.text.endsWith("Epidermal growth factor recep"), "mid-word cut preserved untouched");
  assert.ok(dpyd.text.includes("fluoropymidine"), "Aetna's own misspelling preserved untouched");
  assert.ok(cpt.text.endsWith("Other CPT codes related to the"), "mid-phrase cut preserved untouched");
});
