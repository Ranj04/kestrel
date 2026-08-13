import { readFileSync, writeFileSync } from "node:fs";
import type { LedgerRecord } from "../contracts";
import { LEDGER_PATH, readAll } from "./store";
import {
  ephemeral,
  replaceMemoryRecord,
  useEphemeral,
} from "./state";

export interface TamperResult {
  seq: number;
  field: string;
  before: string;
  after: string;
}

type Scalar = string | number | boolean | null;
type LocatedValue = {
  container: Record<string, unknown> | unknown[];
  key: string | number;
  path: string;
  value: Scalar;
};

const PREFERRED_FIELDS = [
  "rationale",
  "status",
  "decision",
  "dose",
  "alertId",
  "orderId",
];

function isScalar(value: unknown): value is Scalar {
  return value === null || ["string", "number", "boolean"].includes(typeof value);
}

function findScalar(value: unknown, path = "payload"): LocatedValue | null {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      if (isScalar(value[index])) {
        return { container: value, key: index, path: `${path}[${index}]`, value: value[index] };
      }
      const nested = findScalar(value[index], `${path}[${index}]`);
      if (nested) return nested;
    }
    return null;
  }
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    const keys = Object.keys(object);
    keys.sort((a, b) => {
      const ai = PREFERRED_FIELDS.indexOf(a);
      const bi = PREFERRED_FIELDS.indexOf(b);
      return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi);
    });
    for (const key of keys) {
      if (isScalar(object[key])) {
        return { container: object, key, path: `${path}.${key}`, value: object[key] as Scalar };
      }
      const nested = findScalar(object[key], `${path}.${key}`);
      if (nested) return nested;
    }
  }
  return null;
}

function altered(value: Scalar): Scalar {
  if (typeof value === "string") return `${value} [altered]`;
  if (typeof value === "number") return value + 1;
  if (typeof value === "boolean") return !value;
  return "[altered]";
}

function alterRecord(record: LedgerRecord): TamperResult {
  let located = findScalar(record.payload);
  if (!located) {
    record.payload = { original: record.payload, altered: true };
    return {
      seq: record.seq,
      field: "payload",
      before:
        JSON.stringify((record.payload as Record<string, unknown>).original) ??
        "undefined",
      after: JSON.stringify(record.payload),
    };
  }

  const next = altered(located.value);
  located.container[located.key as never] = next as never;
  return {
    seq: record.seq,
    field: located.path,
    before: String(located.value),
    after: String(next),
  };
}

function chooseRecord(records: LedgerRecord[], requested?: number): LedgerRecord {
  if (records.length === 0) throw new Error("Cannot tamper with an empty ledger");
  if (requested !== undefined) {
    const match = records.find((record) => record.seq === requested);
    if (!match) throw new Error(`Ledger record ${requested} does not exist`);
    return match;
  }
  return (
    records.findLast((record) => record.type === "alert.overridden") ??
    records.findLast((record) => record.type === "alert.raised") ??
    records.at(-1)!
  );
}

export function tamper(seq?: number): TamperResult {
  if (ephemeral) {
    const record = chooseRecord(readAll(), seq);
    const result = alterRecord(record);
    replaceMemoryRecord(record.seq, record);
    return result;
  }

  const raw = readFileSync(LEDGER_PATH, "utf8");
  const trailingNewline = raw.endsWith("\n");
  const lines = raw.split("\n");
  if (trailingNewline) lines.pop();
  const records = lines.map((line) => JSON.parse(line) as LedgerRecord);
  const record = chooseRecord(records, seq);
  const lineIndex = records.findIndex((candidate) => candidate.seq === record.seq);
  const result = alterRecord(record);
  lines[lineIndex] = JSON.stringify(record); // Stored hash is deliberately untouched.

  try {
    writeFileSync(
      LEDGER_PATH,
      lines.join("\n") + (trailingNewline ? "\n" : ""),
      "utf8",
    );
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "EROFS" && code !== "EACCES") throw error;
    useEphemeral(records);
  }
  return result;
}
