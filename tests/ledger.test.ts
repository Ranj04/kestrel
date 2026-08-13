import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import type { Actor, EvidenceSnapshot, LedgerEventType, LedgerRecord } from "../lib/contracts.ts";
import { hashRecord, stableHash } from "../lib/ledger/hash.ts";
import { recordOverride } from "../lib/ledger/override.ts";
import { LEDGER_PATH, append, clausesFor, readAll, reset } from "../lib/ledger/store.ts";
import { tamper } from "../lib/ledger/tamper.ts";
import { verify } from "../lib/ledger/verify.ts";
import { GET as ledgerGet } from "../app/api/ledger/route.ts";
import { POST as resetPost } from "../app/api/ledger/reset/route.ts";
import { POST as tamperPost } from "../app/api/ledger/tamper/route.ts";
import { POST as verifyPost } from "../app/api/ledger/verify/route.ts";

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

beforeEach(() => reset());
afterEach(() => reset());

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
