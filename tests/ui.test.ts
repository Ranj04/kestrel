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
import { evaluate } from "../lib/pgx/evaluate.ts";
import { getPatient } from "../lib/pgx/index.ts";
import { coverageFor } from "../lib/pgx/policy.ts";
import { AlertCard } from "../components/prescribe/AlertCard.tsx";
import { CoverageLine } from "../components/prescribe/CoverageLine.tsx";
import { CredibilityCard } from "../components/prescribe/CredibilityCard.tsx";
import { WhyDrawer } from "../components/prescribe/WhyDrawer.tsx";

const CPIC_RAW = readFileSync(join(process.cwd(), "data", "cpic", "index.json"), "utf8");
const POLICY_RAW = readFileSync(join(process.cwd(), "data", "policies.json"), "utf8");

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

test("AlertCard none: Lindqvist + capecitabine renders the quiet green line, NO card", () => {
  const p = patient("pt_lindqvist");
  const response = respond(p, "capecitabine");
  assert.equal(response.alert, null, "normal metabolizer must not alert");
  const html = renderAlertCard(response, p);

  assert.ok(html.includes("No pharmacogenomic contraindication"), "green line renders");
  assert.ok(html.includes("DPYD Normal Metabolizer"), "gene + phenotype from patients.json");
  assert.ok(!html.includes("DO NOT PRESCRIBE"), "no red card on the same drug");
  assert.ok(!html.includes("Override"), "nothing to override");
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
