/**
 * The test that saves the demo. If a clean chain does not verify clean, the
 * ledger shows red before anyone tampers with anything and it looks exactly
 * like a real bug in the product.
 *
 *   npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalJson, stableHash, hashRecord, GENESIS_PREV_HASH } from "../lib/ledger/hash.ts";

test("key order does not affect the digest, at any depth", () => {
  const a = { b: 2, a: 1, nested: { z: 1, y: { q: 2, p: 1 } }, arr: [{ d: 4, c: 3 }] };
  const b = { arr: [{ c: 3, d: 4 }], nested: { y: { p: 1, q: 2 }, z: 1 }, a: 1, b: 2 };
  assert.equal(canonicalJson(a), canonicalJson(b));
});

test("integer-like keys sort as strings, not numerically", () => {
  assert.equal(canonicalJson({ "10": "a", "2": "b", z: "c" }), '{"10":"a","2":"b","z":"c"}');
});

test("undefined hashes the same as an absent key", () => {
  assert.equal(stableHash({ x: 1, model: undefined }), stableHash({ x: 1 }));
});

test("unicode, quotes and newlines survive a JSON round trip", () => {
  const v = { s: 'monitorinh — "quoted"\nnewline ünïcode' };
  assert.equal(stableHash(v), stableHash(JSON.parse(JSON.stringify(v))));
});

test("a record hashes identically after a JSONL round trip", () => {
  const rec = {
    seq: 0, recordId: "r1", type: "alert.raised",
    occurredAt: "2026-08-13T18:00:00Z",
    actor: { id: "dr_chen", name: "Dr. Chen", role: "Attending Oncology" },
    payload: { b: 1, a: 2 }, clauses: ["21CFR11.10(e)"], prevHash: GENESIS_PREV_HASH,
  };
  const h = hashRecord(rec);
  assert.equal(hashRecord(JSON.parse(JSON.stringify({ ...rec, hash: h }))), h);
});

test("a one-character payload change changes the digest", () => {
  const rec = {
    seq: 0, recordId: "r1", type: "alert.overridden",
    occurredAt: "2026-08-13T18:00:00Z",
    actor: { id: "dr_chen", name: "Dr. Chen", role: "Attending Oncology" },
    payload: { rationale: "weekly DPD monitoring." },
    clauses: ["21CFR11.50"], prevHash: GENESIS_PREV_HASH,
  };
  const before = hashRecord(rec);
  rec.payload.rationale = "weekly DPD monitorinh.";
  assert.notEqual(hashRecord(rec), before);
});
