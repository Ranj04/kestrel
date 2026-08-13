import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import JSZip from "jszip";
import type { Actor, EvidenceSnapshot, LedgerEventType, LedgerRecord } from "../lib/contracts.ts";
import { hashRecord, stableHash } from "../lib/ledger/hash.ts";
import { recordOverride } from "../lib/ledger/override.ts";
import { activeRevisionStatus, authorizationStatus, resetSnapshotState } from "../lib/ledger/snapshot.ts";
import { LEDGER_PATH, append, clausesFor, readAll, reset } from "../lib/ledger/store.ts";
import { tamper } from "../lib/ledger/tamper.ts";
import { verify } from "../lib/ledger/verify.ts";
import { evaluate } from "../lib/pgx/evaluate.ts";
import { getPatient } from "../lib/pgx/index.ts";
import { AuthorizationPanel } from "../components/ledger/AuthorizationPanel.tsx";
import { GET as ledgerGet } from "../app/api/ledger/route.ts";
import { POST as exportPost } from "../app/api/ledger/export/route.ts";
import { POST as resetPost } from "../app/api/ledger/reset/route.ts";
import { POST as tamperPost } from "../app/api/ledger/tamper/route.ts";
import { POST as verifyPost } from "../app/api/ledger/verify/route.ts";
import { POST as supersedePost } from "../app/api/evidence/supersede/route.ts";

const actor: Actor = {
  id: "dr_chen",
  name: "Dr. Maya Chen",
  role: "Attending Oncology",
};

const eventTypes: LedgerEventType[] = [
  "order.placed",
  "genotype.resolved",
  "model.invoked",
  "alert.raised",
  "alert.accepted",
  "alert.overridden",
];

const snapshot: EvidenceSnapshot = {
  snapshotId: "cpic:DPYD:capecitabine:2017",
  entryHash: stableHash({ fixture: "evidence snapshot" }),
  guidelineName: null,
  policyId: null,
  policyVersion: null,
  scopes: ["DPYD", "capecitabine"],
  capturedAt: "2026-08-13T18:00:00.000Z",
};

function appendRecords(count: number): LedgerRecord[] {
  return Array.from({ length: count }, (_, index) =>
    append(
      eventTypes[index % eventTypes.length],
      { index, detail: { z: "last", a: "first" } },
      actor,
      clausesFor(eventTypes[index % eventTypes.length]),
    ),
  );
}

beforeEach(() => {
  reset();
  resetSnapshotState();
});
afterEach(() => {
  reset();
  resetSnapshotState();
});

test("round-trip stability: five appended records retain every hash", () => {
  append(
    "order.placed",
    { z: 3, a: 1, nested: { zebra: true, alpha: { y: 2, b: 1 } } },
    actor,
    clausesFor("order.placed"),
  );
  appendRecords(4);

  const records = readAll();
  assert.equal(records.length, 5);
  for (const record of records) assert.equal(hashRecord(record), record.hash);
});

test("clean chain verifies", () => {
  appendRecords(5);
  const result = verify();
  assert.equal(result.ok, true);
  assert.equal(result.firstBrokenSeq, null);
  assert.deepEqual(result.brokenSeqs, []);
});

test("tamper is detected and invalidates every downstream record", () => {
  appendRecords(6);
  tamper(2);
  const result = verify();
  assert.equal(result.ok, false);
  assert.equal(result.firstBrokenSeq, 2);
  assert.deepEqual(result.brokenSeqs, [2, 3, 4, 5]);
});

test("tampering the last record is detected", () => {
  appendRecords(4);
  tamper(3);
  const result = verify();
  assert.equal(result.ok, false);
  assert.equal(result.firstBrokenSeq, 3);
  assert.deepEqual(result.brokenSeqs, [3]);
});

test("re-hashing the tampered record cannot repair its downstream link", () => {
  appendRecords(6);
  tamper(2);

  const lines = readFileSync(LEDGER_PATH, "utf8").trimEnd().split("\n");
  const record = JSON.parse(lines[2]) as LedgerRecord;
  record.hash = hashRecord(record);
  lines[2] = JSON.stringify(record);
  writeFileSync(LEDGER_PATH, lines.join("\n") + "\n", "utf8");

  const result = verify();
  assert.equal(result.ok, false);
  assert.equal(result.firstBrokenSeq, 3);
  assert.deepEqual(result.brokenSeqs, [3, 4, 5]);
});

test("override manifestation fields survive the JSONL round trip", () => {
  append(
    "alert.raised",
    { alertId: "alert-1", orderId: "order-1", snapshot },
    actor,
    clausesFor("alert.raised"),
  );
  const override = recordOverride({
    alertId: "alert-1",
    orderId: "order-1",
    actor,
    rationale: "Patient-specific rationale entered by the clinician.",
    signatureMeaning: "approval",
  });

  const roundTripped = readAll().find((record) => record.seq === override.seq)!;
  const payload = roundTripped.payload as Record<string, unknown>;
  assert.equal(payload.printedName, actor.name);
  assert.equal(typeof payload.signedAt, "string");
  assert.doesNotThrow(() => new Date(payload.signedAt as string).toISOString());
  assert.equal(payload.signatureMeaning, "approval");
  assert.deepEqual(payload.boundTo, snapshot);
});

test("a torn final JSONL line does not make readAll throw", () => {
  appendRecords(3);
  const raw = readFileSync(LEDGER_PATH, "utf8");
  const finalStart = raw.lastIndexOf("\n", raw.length - 2) + 1;
  const torn = raw.slice(0, finalStart) + raw.slice(finalStart, finalStart + 20);
  writeFileSync(LEDGER_PATH, torn, "utf8");

  assert.doesNotThrow(() => readAll());
  assert.equal(readAll().length, 2);
  assert.equal(verify().ok, false);
  assert.equal(verify().firstBrokenSeq, 2);
});

test("ledger API routes invoke fresh verification, tamper, and reset", async () => {
  appendRecords(4);
  const before = await (await ledgerGet()).json();
  assert.equal(before.records.length, 4);
  assert.equal(before.verify.ok, true);

  const changed = await (await tamperPost()).json();
  assert.equal(changed.seq, 3);
  const after = await (await verifyPost()).json();
  assert.equal(after.ok, false);
  assert.deepEqual(after.brokenSeqs, [3]);

  const resetResult = await (await resetPost()).json();
  assert.equal(resetResult.ok, true);
  const empty = await (await ledgerGet()).json();
  assert.equal(empty.records.length, 0);
  assert.equal(empty.verify.ok, true);
});

test("policy revision selectively supersedes capecitabine, preserves codeine, and keeps the chain intact", async () => {
  const cpicBefore = readFileSync(join(process.cwd(), "data", "cpic", "index.json"));
  const policiesBefore = readFileSync(join(process.cwd(), "data", "policies.json"));

  for (const [patientId, drugName, orderId] of [
    ["pt_okafor", "capecitabine", "order-cap"],
    ["pt_reyes", "codeine", "order-codeine"],
  ] as const) {
    const patient = getPatient(patientId);
    assert.ok(patient);
    const alert = evaluate(patient, drugName, orderId);
    assert.ok(alert);
    append("alert.raised", alert, actor, clausesFor("alert.raised"));
    recordOverride({
      alertId: alert.alertId,
      orderId,
      actor,
      rationale: "Patient-specific clinical rationale entered by the clinician.",
      signatureMeaning: "approval",
    });
  }

  assert.deepEqual(
    authorizationStatus().map((authorization) => [authorization.drugName, authorization.status]),
    [["capecitabine", "valid"], ["codeine", "valid"]],
  );

  const response = await supersedePost();
  const publication = await response.json();
  assert.equal(response.ok, true);
  assert.equal(publication.record.type, "policy.revised");
  assert.notEqual(publication.entryHashBefore, publication.entryHashAfter);

  // Simulate a separate route bundle/process losing module globals. The valid
  // appended revision record must rehydrate the overlays for GET /api/ledger.
  resetSnapshotState();
  const ledgerResponse = await (await ledgerGet()).json();
  assert.equal(ledgerResponse.verify.ok, true, "ordinary revision appends; it never edits ledger history");
  assert.deepEqual(
    ledgerResponse.authorizations.map(
      (authorization: { drugName: string; status: string; intersectingScopes: string[] }) => [
        authorization.drugName,
        authorization.status,
        authorization.intersectingScopes,
      ],
    ),
    [
      ["capecitabine", "superseded", ["dosing.capecitabine"]],
      ["codeine", "valid", []],
    ],
  );

  assert.deepEqual(readFileSync(join(process.cwd(), "data", "cpic", "index.json")), cpicBefore);
  assert.deepEqual(readFileSync(join(process.cwd(), "data", "policies.json")), policiesBefore);

  const panel = renderToStaticMarkup(
    createElement(AuthorizationPanel, {
      authorizations: authorizationStatus(),
      revision: activeRevisionStatus(),
    }),
  );
  assert.match(panel, /capecitabine/);
  assert.match(panel, /SUPERSEDED/);
  assert.match(panel, /codeine/);
  assert.match(panel, /evidence changed elsewhere; no scope collision with dosing\.capecitabine/);
  assert.match(panel, /SIMULATED POLICY REVISION/);

  const exported = await exportPost();
  assert.equal(exported.status, 200);
  const zip = await JSZip.loadAsync(await exported.arrayBuffer());
  const report = zip.file("inspection-report.html");
  assert.ok(report);
  const reportHtml = await report.async("string");
  assert.match(reportHtml, /SUPERSEDED/);
  assert.match(reportHtml, /evidence changed elsewhere; no scope collision with dosing\.capecitabine/);
});

test("ledger UI publishes through the evidence supersede API call site", () => {
  const source = readFileSync(join(process.cwd(), "components", "ledger", "index.tsx"), "utf8");
  assert.match(source, /fetch\("\/api\/evidence\/supersede", \{ method: "POST" \}\)/);
});
