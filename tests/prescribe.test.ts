/**
 * Route acceptance + the cross-owner call-site pin Sol's ledger tests cannot
 * do (.sol/requests/phase1-sol-lint.md): /api/prescribe MUST append to the
 * ledger. Delete any append() call in the route and "prescribe writes the
 * ledger" here goes red — the ledger tests alone stay green because they call
 * the ledger directly.
 *
 * NOTE: this file appends real records to data/ledger.jsonl (that is the
 * point of the pin). Reset the ledger before a demo run.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

delete process.env.ANTHROPIC_API_KEY; // the no-LLM path is the acceptance path

import { POST } from "../app/api/prescribe/route.ts";
import { readAll } from "../lib/ledger/store.ts";
import type { PrescribeResponse } from "../lib/contracts.ts";

function post(body: unknown): Promise<Response> {
  return POST(
    new Request("http://test.local/api/prescribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

test("unknown patient -> 404", async () => {
  const res = await post({ patientId: "pt_nobody", drugRaw: "codeine", orderedBy: "dr_chen" });
  assert.equal(res.status, 404);
});

test("malformed body -> 400", async () => {
  const res = await post({ drugRaw: "codeine" });
  assert.equal(res.status, 400);
});

test("money shot: pt_okafor + Xeloda -> critical, signature, PRESCRIBE WRITES THE LEDGER", async () => {
  const res = await post({
    patientId: "pt_okafor",
    drugRaw: "Xeloda 1250 mg/m2 BID",
    orderedBy: "dr_chen",
  });
  assert.equal(res.status, 200);
  const body = (await res.json()) as PrescribeResponse;

  assert.ok(body.alert);
  assert.equal(body.alert.severity, "critical");
  assert.match(body.alert.recommendation, /Avoid use of 5-fluorouracil/);
  assert.ok(body.alert.citations.length > 0);
  assert.equal(body.credibility.requiredControl, "human-signature");
  assert.equal(body.resolution.matched, true);
  assert.equal(body.resolution.method, "exact");
  assert.equal(body.order.dose, "1250 mg/m2");
  assert.ok(body.coverage);
  assert.equal(body.coverage.determination, "not-covered");

  // THE CALL-SITE PIN (rule 4a-quater): the route, not the test, must have
  // appended these records. Filter by this response's own orderId.
  const orderId = body.order.orderId;
  const types = readAll()
    .filter((r) => (r.payload as { orderId?: string } | null)?.orderId === orderId)
    .map((r) => r.type);
  assert.ok(types.includes("order.placed"), "route must append order.placed");
  assert.ok(types.includes("genotype.resolved"), "route must append genotype.resolved");
  assert.ok(types.includes("alert.raised"), "route must append alert.raised");
  // No LLM key: consulting the model must NOT have been logged, because it
  // never happened. A model.invoked here would be a fabricated provenance.
  assert.ok(!types.includes("model.invoked"));
});

test("clean pass: pt_lindqvist + capecitabine -> alert null, coverage still renders", async () => {
  const res = await post({ patientId: "pt_lindqvist", drugRaw: "capecitabine", orderedBy: "dr_chen" });
  assert.equal(res.status, 200);
  const body = (await res.json()) as PrescribeResponse;
  assert.equal(body.alert, null, "flagging the normal metabolizer is worse than useless");
  assert.ok(body.coverage);
  assert.equal(body.coverage.clauseId, "PA-ONC-014.4");
  assert.equal(body.coverage.determination, "covered");
  assert.equal(body.credibility.requiredControl, "auto");
});

test("no genotype: pt_bhattacharya + capecitabine -> alert null, coverage pended", async () => {
  const res = await post({ patientId: "pt_bhattacharya", drugRaw: "capecitabine", orderedBy: "dr_chen" });
  const body = (await res.json()) as PrescribeResponse;
  assert.equal(body.alert, null);
  assert.ok(body.coverage);
  assert.equal(body.coverage.clauseId, "PA-ONC-014.1");
  assert.equal(body.coverage.determination, "pended");
});

// Phase6 fix round — the 4a-quater call-site pin for gene coverage: the ROUTE
// must carry assessGenes() through the response. Delete the `genesAssessed:`
// line in route.ts and this goes red while every engine test stays green.
test("prescribe carries gene coverage: Reyes DPYD not assessed, Lindqvist assessed, same run", async () => {
  // The defect fixture: a CYP2D6 result, no DPYD result, on a DPYD drug.
  const reyes = (await (
    await post({ patientId: "pt_reyes", drugRaw: "Xeloda 1250 mg/m2 BID", orderedBy: "dr_chen" })
  ).json()) as PrescribeResponse;
  assert.equal(reyes.alert, null, "null alert is the ambiguity the field exists to resolve");
  assert.ok(reyes.genesAssessed, "the route must carry the gene-coverage facts");
  assert.deepEqual(
    reyes.genesAssessed.map((g) => ({ gene: g.gene, assessed: g.assessed, onFile: g.resultOnFile })),
    [{ gene: "DPYD", assessed: false, onFile: false }],
  );

  // The genuine negative in the SAME run — a null field alone is
  // indistinguishable from a broken lookup (ADAPTATION 3's pairing rule).
  const lindqvist = (await (
    await post({ patientId: "pt_lindqvist", drugRaw: "capecitabine", orderedBy: "dr_chen" })
  ).json()) as PrescribeResponse;
  assert.ok(lindqvist.genesAssessed);
  assert.equal(lindqvist.genesAssessed[0].gene, "DPYD");
  assert.equal(lindqvist.genesAssessed[0].assessed, true, "the instrument can say yes as well as no");

  // No CPIC guideline -> no gene list, mirroring coverage/alert.
  const none = (await (
    await post({ patientId: "pt_reyes", drugRaw: "florblexin", orderedBy: "dr_chen" })
  ).json()) as PrescribeResponse;
  assert.equal(none.genesAssessed, null);
});

test("unresolvable drug: honest none, no alert, no invented coverage", async () => {
  const res = await post({ patientId: "pt_okafor", drugRaw: "florblexin", orderedBy: "dr_chen" });
  const body = (await res.json()) as PrescribeResponse;
  assert.equal(body.resolution.matched, false);
  assert.equal(body.resolution.method, "none");
  assert.equal(body.order.drugName, "");
  assert.equal(body.alert, null);
  assert.equal(body.coverage, null);
});
