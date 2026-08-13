/**
 * Canonical hashing — ported from writ.ai `backend/writai/hashing.py::stable_hash`.
 *
 * DO NOT "simplify" this to JSON.stringify. The whole chain depends on a record
 * hashing identically before it is written and after it is re-read from disk.
 * JSON.stringify preserves insertion order, so a record whose keys arrive in a
 * different order the second time produces a different digest, the chain shows
 * red before anyone tampers with anything, and it looks exactly like a real bug
 * in the product while you are standing on stage.
 *
 * Two things this does that the obvious implementation does not:
 *
 *  1. Serializes objects by hand rather than relying on key insertion order.
 *     JS reorders integer-like string keys ("2" before "10" before "a") no matter
 *     what order you insert them in, so building a sorted object and stringifying
 *     it is NOT sufficient.
 *  2. Drops `undefined` values entirely, so a record appended with
 *     `model: undefined` hashes the same as the same record re-read from JSONL
 *     with the `model` key simply absent.
 */
import { createHash } from "node:crypto";

function serialize(value: unknown): string {
  if (value === null || value === undefined) return "null";

  const t = typeof value;
  if (t === "string" || t === "boolean") return JSON.stringify(value);
  if (t === "number") {
    // NaN / Infinity are not representable in JSON; normalize both sides to null.
    return Number.isFinite(value as number) ? JSON.stringify(value) : "null";
  }
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return "[" + value.map(serialize).join(",") + "]";

  // Sets are unordered; sort their serialized members so membership, not
  // iteration order, determines the digest. (writ.ai does the same.)
  if (value instanceof Set) {
    return "[" + [...value].map(serialize).sort().join(",") + "]";
  }

  if (t === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort();
    return (
      "{" +
      keys.map((k) => JSON.stringify(k) + ":" + serialize(obj[k])).join(",") +
      "}"
    );
  }

  return "null";
}

export function canonicalJson(value: unknown): string {
  return serialize(value);
}

/** "sha256:<hex>" — prefixed like writ.ai's, so a digest is self-describing in the UI. */
export function stableHash(value: unknown): string {
  return "sha256:" + createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

export const GENESIS_PREV_HASH = "sha256:" + "0".repeat(64);

/** Hash of a ledger record. `hash` is excluded from its own input. */
export function hashRecord(r: {
  seq: number;
  recordId: string;
  type: string;
  occurredAt: string;
  actor: unknown;
  payload: unknown;
  model?: unknown;
  clauses: string[];
  prevHash: string;
}): string {
  return stableHash({
    seq: r.seq,
    recordId: r.recordId,
    type: r.type,
    occurredAt: r.occurredAt,
    actor: r.actor,
    payload: r.payload,
    model: r.model,
    clauses: r.clauses,
    prevHash: r.prevHash,
  });
}
