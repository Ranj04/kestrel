import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomBytes } from "node:crypto";
import type {
  Actor,
  LedgerEventType,
  LedgerRecord,
  ModelProvenance,
} from "../contracts";
import { GENESIS_PREV_HASH, hashRecord } from "./hash";
import {
  appendMemory,
  ephemeral,
  readMemory,
  resetMemory,
  useEphemeral,
} from "./state";
export { ephemeral } from "./state";
export { clausesFor, CLAUSE_LABELS, CLAUSES_BY_EVENT } from "./clauses";

export const LEDGER_PATH = join(process.cwd(), "data", "ledger.jsonl");

export interface LedgerReadState {
  records: LedgerRecord[];
  totalLines: number;
  unreadableAt: number | null;
}

function isReadOnlyError(error: unknown): error is NodeJS.ErrnoException {
  return (
    error instanceof Error &&
    "code" in error &&
    (error.code === "EROFS" || error.code === "EACCES")
  );
}

export function readState(): LedgerReadState {
  if (ephemeral) {
    const records = readMemory();
    return { records, totalLines: records.length, unreadableAt: null };
  }

  let raw: string;
  try {
    raw = readFileSync(LEDGER_PATH, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { records: [], totalLines: 0, unreadableAt: null };
    }
    throw error;
  }

  const lines = raw.split("\n");
  if (lines.at(-1) === "") lines.pop();
  const records: LedgerRecord[] = [];
  let unreadableAt: number | null = null;

  for (const line of lines) {
    if (unreadableAt !== null) continue;
    try {
      records.push(JSON.parse(line) as LedgerRecord);
    } catch {
      // A torn final write is part of ledger state: callers can render it red.
      unreadableAt = records.length;
    }
  }

  return { records, totalLines: lines.length, unreadableAt };
}

export function readAll(): LedgerRecord[] {
  return readState().records;
}

export function append(
  type: LedgerEventType,
  payload: unknown,
  actor: Actor,
  clauses: string[],
  model?: ModelProvenance,
): LedgerRecord {
  const state = readState();
  if (state.unreadableAt !== null) {
    throw new Error(
      `Cannot append after unreadable ledger record ${state.unreadableAt}`,
    );
  }

  const previous = state.records.at(-1);
  const unhashed = {
    seq: state.records.length,
    recordId: randomBytes(8).toString("hex"),
    type,
    occurredAt: new Date().toISOString(),
    actor,
    payload,
    ...(model === undefined ? {} : { model }),
    clauses: [...clauses],
    prevHash: previous?.hash ?? GENESIS_PREV_HASH,
  };
  const record: LedgerRecord = { ...unhashed, hash: hashRecord(unhashed) };
  const line = JSON.stringify(record) + "\n";

  if (ephemeral) {
    appendMemory(record);
    return structuredClone(record);
  }

  try {
    mkdirSync(dirname(LEDGER_PATH), { recursive: true });
    appendFileSync(LEDGER_PATH, line, "utf8");
  } catch (error) {
    if (!isReadOnlyError(error)) throw error;
    useEphemeral(state.records);
    appendMemory(record);
  }

  return structuredClone(record);
}

export function reset(): void {
  if (ephemeral) {
    resetMemory();
    return;
  }

  try {
    mkdirSync(dirname(LEDGER_PATH), { recursive: true });
    writeFileSync(LEDGER_PATH, "", "utf8");
  } catch (error) {
    if (!isReadOnlyError(error)) throw error;
    useEphemeral([]);
  }
}
