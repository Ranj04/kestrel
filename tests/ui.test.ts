/**
 * UI render tests — the prescribe components, rendered with react-dom/server
 * against alerts produced by the REAL evaluate() over the REAL CPIC cache.
 * No dev server, no browser: what these pin is the verbatim pipeline —
 * evaluate() copies CPIC's strings onto the Alert, and the components copy
 * the Alert's strings into markup. Each clinical assertion also greps the
 * string back out of the data file, so "renders verbatim" is measured
 * against disk, not against the code under test.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { Alert, Patient, PrescribeResponse } from "../lib/contracts.ts";
import { assess } from "../lib/credibility.ts";
import { assessGenes, evaluate } from "../lib/pgx/evaluate.ts";
import { getPatient } from "../lib/pgx/index.ts";
import { coverageFor } from "../lib/pgx/policy.ts";
import { AlertCard } from "../components/prescribe/AlertCard.tsx";
import { CoverageLine } from "../components/prescribe/CoverageLine.tsx";
import { CredibilityCard } from "../components/prescribe/CredibilityCard.tsx";
import { WhyDrawer } from "../components/prescribe/WhyDrawer.tsx";

const CPIC_RAW = readFileSync(join(process.cwd(), "data", "cpic", "index.json"), "utf8");
const POLICY_RAW = readFileSync(join(process.cwd(), "data", "policies.json"), "utf8");
const FDA_RAW = readFileSync(join(process.cwd(), "data", "fda-pgx.json"), "utf8");

const patient = (id: string): Patient => {
  const p = getPatient(id);
  assert.ok(p, `${id} must exist in data/patients.json`);
  return p;
};

const noop = () => {};

/** Build the PrescribeResponse the page would hand the components. */
function respond(p: Patient, drugName: string): PrescribeResponse {
  const alert = evaluate(p, drugName, "ord_uitest");
  return {
    order: {
      orderId: "ord_uitest",
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
    // Same derivation the route uses — the component must receive these facts,
    // never re-derive them (the route-level call-site pin is prescribe.test.ts).
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

// ---------------------------------------------------------------- AlertCard

test("AlertCard critical: Okafor + capecitabine renders CPIC's recommendation verbatim, phenotype not lookup", () => {
  const p = patient("pt_okafor");
  const response = respond(p, "capecitabine");
  assert.ok(response.alert, "evaluate must raise the money-shot alert");
  const html = renderAlertCard(response, p);

  // The recommendation on screen is the alert's string, and the alert's
  // string exists character-for-character in data/cpic/index.json —
  // therefore the words on screen are CPIC's, not ours.
  assert.ok(html.includes(response.alert.recommendation), "recommendation renders verbatim");
  assert.ok(CPIC_RAW.includes(response.alert.recommendation), "recommendation exists in the cache");
  assert.ok(
    response.alert.recommendation.startsWith("Avoid use of 5-fluorouracil"),
    "and it is the demo string, not an empty pass-through",
  );
  assert.ok(response.alert.implication, "CPIC ships an implication for this row");
  assert.ok(html.includes(response.alert.implication), "implication renders verbatim");

  assert.ok(html.includes("DO NOT PRESCRIBE"), "critical header");
  assert.ok(html.includes("CPIC LEVEL A"), "level A badge");
  assert.ok(html.includes("Poor Metabolizer"), "phenotype renders");
  // lookup ("0.0") is the join key, never a display value. Assert on the
  // VISIBLE text (tags stripped) — class attributes like tracking-[0.06em]
  // legitimately contain "0.0" and are not on screen.
  const visible = html.replace(/<[^>]+>/g, " ");
  assert.ok(!visible.includes(response.alert.lookup), "lookup never goes on screen");
  assert.ok(visible.includes("Poor Metabolizer"), "the stripped text still carries the phenotype");
});

// PHASE6 FIX ROUND, disclosed: this test previously asserted the literal
// "No pharmacogenomic contraindication" — a clinical conclusion the app
// authored itself (severity-1 finding, phase6-sol-on-fable.md). The pin moved
// WITH the deliberate behaviour change: the green line now states what was
// checked and what was found, procedurally, and this test pins that instead.
test("AlertCard none: Lindqvist + capecitabine states what was checked — never a clinical conclusion of ours", () => {
  const p = patient("pt_lindqvist");
  const response = respond(p, "capecitabine");
  assert.equal(response.alert, null, "normal metabolizer must not alert");
  const html = renderAlertCard(response, p);

  assert.ok(html.includes("DPYD assessed"), "names the gene that was actually checked");
  assert.ok(html.includes("Normal Metabolizer"), "and the phenotype found (patients.json)");
  assert.ok(html.includes("No CPIC alert raised"), "what the engine did — procedural, checkable");
  assert.ok(
    !html.includes("No pharmacogenomic contraindication"),
    "the app never asserts a clinical conclusion in its own words (0 matches in any data file)",
  );
  assert.ok(!html.includes("DO NOT PRESCRIBE"), "no red card on the same drug");
  assert.ok(!html.includes("Override"), "nothing to override");
});

// THE test of this fix round: a patient with a result for a gene OTHER than
// the drug's gene must NOT produce a green clearance. pt_reyes + capecitabine
// is a real fixture exhibiting the live defect (docs/phase6/
// finding-reyes-false-clearance.png): only a CYP2D6 result, no DPYD result,
// evaluate() null — and the old branch rendered "✓ No pharmacogenomic
// contraindication. CYP2D6 Ultrarapid Metabolizer." Correct and buggy values
// differ on every assertion below (4a): the buggy render contains the
// forbidden phrase, the tick, the seal colour, and the irrelevant gene.
test("AlertCard: Reyes + capecitabine — a result for the WRONG gene must never render a clearance", () => {
  const p = patient("pt_reyes");
  const response = respond(p, "capecitabine");
  assert.equal(response.alert, null, "no DPYD result -> null alert, which is exactly the trap");
  assert.ok(response.genesAssessed, "the response carries the gene-coverage facts");
  assert.equal(response.genesAssessed[0].assessed, false);

  const html = renderAlertCard(response, p);
  const visible = html.replace(/<[^>]+>/g, " ");

  assert.ok(!html.includes("No pharmacogenomic contraindication"), "the fabricated clearance is gone");
  assert.ok(!html.includes("✓"), "no tick for a gene that was never assessed");
  assert.ok(!html.includes("text-seal"), "not painted in the clearance colour");
  assert.ok(html.includes("text-amber"), "rendered as an amber unknown, per the honest-absence lines");
  assert.ok(visible.includes("DPYD not assessed"), "the missing gene is named explicitly");
  assert.ok(visible.includes("no result on file"), "and the reason is stated");
  assert.ok(/incomplete/i.test(visible), "screening is stated incomplete, never clear");
  assert.ok(
    !visible.includes("CYP2D6"),
    "the gene irrelevant to this drug is not cited on this order",
  );
});

test("AlertCard critical: Reyes + codeine renders a DIFFERENT verbatim CPIC text", () => {
  const okafor = respond(patient("pt_okafor"), "capecitabine");
  const p = patient("pt_reyes");
  const response = respond(p, "codeine");
  assert.ok(response.alert, "ultrarapid metabolizer + codeine must alert");
  const html = renderAlertCard(response, p);

  assert.ok(html.includes(response.alert.recommendation), "recommendation renders verbatim");
  assert.ok(CPIC_RAW.includes(response.alert.recommendation), "recommendation exists in the cache");
  assert.notEqual(
    response.alert.recommendation,
    okafor.alert?.recommendation,
    "two demo alerts carry two different CPIC texts — not one hardcoded card",
  );
  assert.ok(html.includes("Ultrarapid Metabolizer"), "phenotype renders");
});

test("AlertCard absent genotype: Bhattacharya renders the honest amber line, not a clearance", () => {
  const p = patient("pt_bhattacharya");
  const response = respond(p, "capecitabine");
  assert.equal(response.alert, null);
  const html = renderAlertCard(response, p);

  assert.ok(html.includes("No genotype on file"), "absence is stated as absence");
  assert.ok(
    !html.includes("No pharmacogenomic contraindication"),
    "an unrun check must not render as a pass",
  );
});

// ------------------------------------------------------------- FDA badge
//
// THE RULE: the FDA table lists associations, not exclusions. A covered pair
// gets a badge carrying the FDA's verbatim text; an uncovered pair gets
// NOTHING — no badge, no grey pill, no "not FDA-labeled", no negative wording
// of any kind. Both halves are pinned below, because only the pair of them
// distinguishes "the rule holds" from "the feature never rendered".

test("AlertCard: FDA badge renders for Okafor, INLINE on the CPIC badge row (no new line)", () => {
  const p = patient("pt_okafor");
  const response = respond(p, "capecitabine");
  assert.ok(response.alert?.fdaLabeled, "the alert must carry the FDA association");
  const html = renderAlertCard(response, p);

  // PHASE 7.5, disclosed: this pinned the literal "FDA-labeled". G-10 renamed
  // the badge to the claim the evidence supports — inclusion in the FDA's
  // association table, not labeling. The pin moved WITH the rename and is
  // strictly stronger: it also asserts the old overclaim is GONE.
  assert.ok(html.includes("FDA association table"), "badge renders, table-inclusion wording");
  assert.ok(!html.includes("FDA-labeled"), "the labeling overclaim no longer renders");
  // Same row, not a new one: R-19 — the pane is height-constrained and the
  // badge must cost zero vertical height. If it moves out of the CPIC badge's
  // own <p>, this segment gains a </p> and the test goes red.
  const start = html.indexOf("CPIC LEVEL A");
  const end = html.indexOf("FDA association table");
  assert.ok(start >= 0 && end > start, "badge sits after the CPIC badge");
  assert.ok(
    !html.slice(start, end).includes("</p>"),
    "FDA badge shares the CPIC badge's line — no extra row of height",
  );
});

test("WhyDrawer: FDA text renders VERBATIM with section, source url, retrieval and route", () => {
  const alert = evaluate(patient("pt_okafor"), "capecitabine", "ord_uitest") as Alert;
  assert.ok(alert.fdaLabeled);
  const html = renderToStaticMarkup(createElement(WhyDrawer, { alert, onClose: noop }));

  for (const row of alert.fdaLabeled.rows) {
    // On screen == on the alert == on disk, character for character.
    assert.ok(html.includes(row.description), "description renders verbatim");
    assert.ok(FDA_RAW.includes(row.description), "and exists in data/fda-pgx.json");
    assert.ok(html.includes(row.affected_subgroups), "affected subgroups render verbatim");
    assert.ok(FDA_RAW.includes(row.affected_subgroups), "and exist in data/fda-pgx.json");
    assert.ok(html.includes(`section ${row.section}`), "the FDA's section number renders");
  }
  assert.ok(
    html.includes(`href="${alert.fdaLabeled.source_url}"`),
    "source_url rendered as the value",
  );
  assert.ok(html.includes(alert.fdaLabeled.retrieved_at), "retrieval timestamp renders");
  // Provenance comes from the file's own `via`, so the UI stays true whether
  // the page was fetched directly or through a proxy (REGISTER R-20).
  assert.ok(html.includes(`via ${alert.fdaLabeled.via}`), "retrieval route renders from the file");
  assert.ok(html.includes("scraped"), "scraped content is labelled as scraped, never as verified");
});

test("WhyDrawer: two FDA rows for CYP2D6/codeine both render — never one of two", () => {
  const alert = evaluate(patient("pt_reyes"), "codeine", "ord_uitest") as Alert;
  assert.ok(alert.fdaLabeled);
  assert.equal(alert.fdaLabeled.rows.length, 2);
  const html = renderToStaticMarkup(createElement(WhyDrawer, { alert, onClose: noop }));
  assert.ok(html.includes(alert.fdaLabeled.rows[0].description));
  assert.ok(html.includes(alert.fdaLabeled.rows[1].description));
});

/** A REAL critical alert for a pair the FDA has not published: G6PD +
 *  nitrofurantoin, through the real evaluate() over the real CPIC cache. */
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

test("ABSENCE IS NOT EVIDENCE: a pair absent from the FDA table renders NO badge, NO negative", () => {
  const response = respond(g6pdPatient, "nitrofurantoin");
  assert.ok(response.alert, "the fixture must raise a real alert, or this proves nothing");
  assert.equal(response.alert.fdaLabeled, null, "and the FDA has published nothing for it");

  const card = renderAlertCard(response, g6pdPatient);
  const drawer = renderToStaticMarkup(
    createElement(WhyDrawer, { alert: response.alert, onClose: noop }),
  );

  // Positive control first: the SAME components do render a badge when the FDA
  // has published one — so a green result here is the rule holding, not the
  // feature silently missing.
  const okaforCard = renderAlertCard(respond(patient("pt_okafor"), "capecitabine"), patient("pt_okafor"));
  // PHASE 7.5, disclosed: literal moved with the G-10 badge rename.
  assert.ok(okaforCard.includes("FDA association table"), "positive control: the badge CAN render");

  for (const [name, html] of [
    ["AlertCard", card],
    ["WhyDrawer", drawer],
  ] as const) {
    // No badge, and no negative claim in any wording — the whole point is that
    // the table lists associations, not exclusions. (PHASE 7.5: literal moved
    // with the G-10 rename; the /FDA/i sweep below covers both spellings.)
    assert.ok(!html.includes("FDA association table"), `${name}: no badge`);
    assert.ok(!/FDA/i.test(html), `${name}: the letters FDA do not appear at all`);
    assert.ok(!/not\s+labeled|no\s+FDA|unlabell?ed|not\s+listed/i.test(html), `${name}: no negative`);
  }
});

// ---------------------------------------------------------------- WhyDrawer

test("WhyDrawer: sourceUrl is the alert's own value, citations link to PubMed, comments verbatim", () => {
  const p = patient("pt_okafor");
  const alert = evaluate(p, "capecitabine", "ord_uitest") as Alert;
  assert.ok(alert);
  const html = renderToStaticMarkup(createElement(WhyDrawer, { alert, onClose: noop }));

  // The href is the exact value evaluate() copied from the entry's _source —
  // never a URL the UI rebuilt. Its presence in index.json proves provenance.
  assert.ok(html.includes(`href="${alert.sourceUrl}"`), "sourceUrl rendered as the value");
  assert.ok(html.includes(">source record<"), "labelled source record");
  assert.ok(CPIC_RAW.includes(alert.sourceUrl), "sourceUrl exists in the cache");

  assert.ok(alert.citations.length >= 1, "CPIC ships citations for this row");
  for (const c of alert.citations) {
    assert.ok(html.includes(`https://pubmed.ncbi.nlm.nih.gov/${c.pmid}/`), `PMID ${c.pmid} linked`);
    assert.ok(html.includes(String(c.year)), `citation year ${c.year} renders`);
  }
  assert.ok(alert.guidelineUrl && html.includes(`href="${alert.guidelineUrl}"`), "guideline linked");
  assert.ok(alert.comments && html.includes(alert.comments), "comments render verbatim (even 'n/a')");
  assert.ok(html.includes(alert.recommendation), "recommendation renders verbatim in the drawer");
});

// ---------------------------------------------------------------- Credibility

test("CredibilityCard: SIGNATURE cell lit for critical, absent for the no-alert assessment", () => {
  const p = patient("pt_okafor");
  const alert = evaluate(p, "capecitabine", "ord_uitest");
  const critical = renderToStaticMarkup(
    createElement(CredibilityCard, { credibility: assess(alert) }),
  );
  assert.ok(critical.includes("► SIGNATURE ◄"), "high x high lights the signature cell");
  assert.ok(critical.includes("human-signature"), "required control rendered from the response");

  const auto = renderToStaticMarkup(createElement(CredibilityCard, { credibility: assess(null) }));
  assert.ok(!auto.includes("► SIGNATURE ◄"), "no-alert assessment must not light SIGNATURE");
  assert.ok(auto.includes("auto"), "auto control rendered");
});

// ---------------------------------------------------------------- Coverage

test("CoverageLine: Bhattacharya pended — clause id, determination, clauseText verbatim from policies.json", () => {
  const coverage = coverageFor(patient("pt_bhattacharya"), "capecitabine");
  assert.ok(coverage, "genotype_required clause must pend this request");
  assert.equal(coverage.determination, "pended");
  const html = renderToStaticMarkup(createElement(CoverageLine, { coverage }));

  assert.ok(html.includes("pended"), "determination renders");
  assert.ok(html.includes("PA-ONC-014.1"), "clause id renders");
  assert.ok(html.includes(coverage.clauseText), "clauseText renders verbatim");
  assert.ok(POLICY_RAW.includes(coverage.clauseText), "clauseText exists in policies.json");
});

test("CoverageLine: Lindqvist covered — the green determination on the same drug", () => {
  const coverage = coverageFor(patient("pt_lindqvist"), "capecitabine");
  assert.ok(coverage);
  assert.equal(coverage.determination, "covered");
  const html = renderToStaticMarkup(createElement(CoverageLine, { coverage }));
  assert.ok(html.includes("covered"), "determination renders");
  assert.ok(html.includes(coverage.clauseId), "clause id renders");
});
