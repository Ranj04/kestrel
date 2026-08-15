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

export function demoControlsEnabled(): boolean {
  const demoEnabled =
    process.env.DEMO_MODE === "1" || process.env.NODE_ENV === "development";
  return demoEnabled;
}

/**
 * Serverless init. On Vercel the ledger CANNOT live on disk, for two independent
 * reasons: data/ledger.jsonl is gitignored so it is absent from the build, and
 * the filesystem is read-only outside /tmp so appendFileSync throws EROFS on the
 * first prescribe. Either one kills the deployed demo on its first click.
 *
 * lib/ledger/state.ts already carries the whole in-memory path; this only turns
 * it on. The store is otherwise untouched -- append/reset keep their existing
 * EROFS/EACCES fallbacks, which stay as the belt to this braces.
 */
(function initLedgerBackend() {
  if (ephemeral) return;
  if (process.env.VERCEL) {
    useEphemeral([]);
    return;
  }
  try {
    // Prove the file is actually appendable before trusting disk. A missing
    // file is fine locally (first run creates it); an unwritable one is not.
    mkdirSync(dirname(LEDGER_PATH), { recursive: true });
    appendFileSync(LEDGER_PATH, "", "utf8");
  } catch (error) {
    console.error("Ledger storage is unavailable; using non-durable process memory.", error);
    useEphemeral([]);
  }
})();

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
    console.error("Ledger append fell back to non-durable process memory.", error);
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
    console.error("Ledger reset fell back to non-durable process memory.", error);
    useEphemeral([]);
  }
}
