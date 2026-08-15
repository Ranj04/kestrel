import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import JSZip from "jszip";
import type { Actor, EvidenceSnapshot, LedgerEventType, LedgerRecord } from "../lib/contracts.ts";
import type { VerificationDetails } from "../lib/ledger/verify.ts";
import { hashRecord, stableHash } from "../lib/ledger/hash.ts";
import { recordOverride } from "../lib/ledger/override.ts";
import { activeRevisionStatus, authorizationStatus, resetSnapshotState } from "../lib/ledger/snapshot.ts";
import { LEDGER_PATH, append, clausesFor, readAll, reset } from "../lib/ledger/store.ts";
import { tamper } from "../lib/ledger/tamper.ts";
import { verify } from "../lib/ledger/verify.ts";
import { evaluate } from "../lib/pgx/evaluate.ts";
import { getPatient } from "../lib/pgx/index.ts";
import { AuthorizationPanel } from "../components/ledger/AuthorizationPanel.tsx";
import { ChainStatus } from "../components/ledger/ChainStatus.tsx";
import { RecordRow } from "../components/ledger/RecordRow.tsx";
import {
  elisionLabel,
  invalidateLedgerRequests,
  planVisibleRecords,
  refreshLedger,
  type LedgerResponse,
} from "../components/ledger/index.tsx";
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

function uiVerification(
  values: Partial<VerificationDetails> = {},
): VerificationDetails {
  return {
    ok: true,
    total: 1,
    firstBrokenSeq: null,
    brokenSeqs: [],
    checkedAt: "2026-08-14T23:00:00.000Z",
    expectedHash: null,
    foundHash: null,
    ...values,
  };
}

function uiLedgerResponse(verify: VerificationDetails): LedgerResponse {
  return {
    records: [],
    authorizations: [],
    revision: null,
    verify,
    ephemeral: false,
  };
}

function fetchResponse(body: LedgerResponse): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

test("ledger refresh discards an older response that resolves after the latest request", async () => {
  const pending: Array<(response: Response) => void> = [];
  const fetcher = (() =>
    new Promise<Response>((resolve) => {
      pending.push(resolve);
    })) as typeof fetch;
  const applied: VerificationDetails[] = [];
  const errors: string[] = [];
  const requestToken = { current: 0 };
  const callbacks = {
    apply: (body: LedgerResponse) => applied.push(body.verify),
    reject: (message: string) => errors.push(message),
  };

  const stale = refreshLedger(requestToken, callbacks, fetcher);
  const latest = refreshLedger(requestToken, callbacks, fetcher);
  assert.equal(pending.length, 2, "the fixture must overlap two dispatched requests");

  const broken = uiVerification({
    ok: false,
    firstBrokenSeq: 0,
    brokenSeqs: [0],
    expectedHash: "sha256:expected",
    foundHash: "sha256:found",
  });
  pending[1](fetchResponse(uiLedgerResponse(broken)));
  await latest;
  pending[0](fetchResponse(uiLedgerResponse(uiVerification())));
  await stale;

  assert.deepEqual(applied, [broken]);
  assert.deepEqual(errors, []);
});

test("an action dispatch invalidates an already-running ledger poll", async () => {
  let resolvePoll!: (response: Response) => void;
  const fetcher = (() =>
    new Promise<Response>((resolve) => {
      resolvePoll = resolve;
    })) as typeof fetch;
  const applied: LedgerResponse[] = [];
  const errors: string[] = [];
  const requestToken = { current: 0 };
  const poll = refreshLedger(
    requestToken,
    {
      apply: (body) => applied.push(body),
      reject: (message) => errors.push(message),
    },
    fetcher,
  );

  invalidateLedgerRequests(requestToken);
  resolvePoll(fetchResponse(uiLedgerResponse(uiVerification())));
  await poll;

  assert.deepEqual(applied, []);
  assert.deepEqual(errors, []);
});

test("RecordRow renders a complete millisecond timestamp", () => {
  const record: LedgerRecord = {
    seq: 0,
    recordId: "rec_timestamp",
    type: "order.placed",
    occurredAt: "2026-08-14T16:27:28.581Z",
    actor: { id: "dr_test", name: "Dr. Test", role: "Attending" },
    payload: {},
    clauses: [],
    prevHash: "sha256:previous",
    hash: "sha256:current",
  };
  const html = renderToStaticMarkup(
    createElement(RecordRow, { record, verification: uiVerification() }),
  );
  const rendered = html.match(/<time[^>]*>([^<]+)<\/time>/)?.[1];

  assert.ok(rendered, "the row must render a time element");
  assert.match(rendered, /^\d{2}:\d{2}:\d{2}\.\d{3}$/);
});

const noop = () => {};

test("ChainStatus uses singular copy when only one record is untrustworthy", () => {
  const html = renderToStaticMarkup(
    createElement(ChainStatus, {
      verification: uiVerification({
        ok: false,
        total: 3,
        firstBrokenSeq: 2,
        brokenSeqs: [2],
      }),
      verificationError: null,
      ephemeral: false,
      tamperNotice: null,
      busy: null,
      canSupersede: false,
      onVerify: noop,
      onTamper: noop,
      onSupersede: noop,
      onReset: noop,
      onExport: noop,
    }),
  );

  assert.match(html, /RECORD 2 NOT TRUSTWORTHY/);
  assert.doesNotMatch(html, /RECORDS 2 NOT TRUSTWORTHY/);
});

test("ChainStatus keeps plural range copy when multiple records are untrustworthy", () => {
  const html = renderToStaticMarkup(
    createElement(ChainStatus, {
      verification: uiVerification({
        ok: false,
        total: 5,
        firstBrokenSeq: 2,
        brokenSeqs: [2, 3, 4],
      }),
      verificationError: null,
      ephemeral: false,
      tamperNotice: null,
      busy: null,
      canSupersede: false,
      onVerify: noop,
      onTamper: noop,
      onSupersede: noop,
      onReset: noop,
      onExport: noop,
    }),
  );

  assert.match(html, /RECORDS 2–4 NOT TRUSTWORTHY/);
});

test("supersede-then-tamper keeps the cascade, boundary row, and verified elision count", () => {
  const records = Array.from({ length: 7 }, (_, seq): LedgerRecord => ({
    seq,
    recordId: `rec_${seq}`,
    type: "order.placed",
    occurredAt: "2026-08-14T16:27:28.581Z",
    actor: { id: "dr_test", name: "Dr. Test", role: "Attending" },
    payload: {},
    clauses: [],
    prevHash: `sha256:previous_${seq}`,
    hash: `sha256:current_${seq}`,
  }));
  const result = uiVerification({
    ok: false,
    total: 7,
    firstBrokenSeq: 4,
    brokenSeqs: [4, 5, 6],
  });
  const plan = planVisibleRecords(records, result, true);

  assert.deepEqual(plan.visible.map((record) => record.seq), [6, 5, 4, 3]);
  assert.deepEqual(plan.elided.map((record) => record.seq), [2, 1, 0]);
  assert.equal(plan.elidedVerified, true);
  assert.equal(
    elisionLabel(plan),
    "· 3 records (0–2) unchanged · verified · not shown ·",
  );
});

test("the elision label never claims verified without a current verification", () => {
  const record: LedgerRecord = {
    seq: 0,
    recordId: "rec_unknown",
    type: "order.placed",
    occurredAt: "2026-08-14T16:27:28.581Z",
    actor: { id: "dr_test", name: "Dr. Test", role: "Attending" },
    payload: {},
    clauses: [],
    prevHash: "sha256:previous",
    hash: "sha256:current",
  };
  const label = elisionLabel({
    visible: [],
    elided: [record],
    elidedVerified: false,
  });

  assert.ok(label);
  assert.doesNotMatch(label, /verified/);
});

test("LedgerPane applies fresh-row stagger in a layout effect", () => {
  const source = readFileSync(
    join(process.cwd(), "components", "ledger", "index.tsx"),
    "utf8",
  );

  assert.match(
    source,
    /typeof window === "undefined" \? useEffect : useLayoutEffect/,
  );
  assert.match(
    source,
    /useBrowserLayoutEffect\(\(\) => \{\s+const rows = Array\.from/,
  );
});

test("every ledger action invalidates old polls and interval polls pause during actions", () => {
  const source = readFileSync(
    join(process.cwd(), "components", "ledger", "index.tsx"),
    "utf8",
  );

  assert.match(
    source,
    /if \(actionInFlight\.current && !duringAction\) return false;/,
  );
  for (const action of ["verify", "tamper", "reset", "supersede", "export"]) {
    assert.match(source, new RegExp(`beginAction\\("${action}"\\)`));
  }
  assert.match(
    source,
    /const dispatchedToken = invalidateLedgerRequests\(latestRequest\);/,
  );
});
