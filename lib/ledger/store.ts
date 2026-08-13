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

export const LEDGER_PATH = join(process.cwd(), "data", "ledger.jsonl");

export const CLAUSES_BY_EVENT: Record<LedgerEventType, readonly string[]> = {
  "order.placed": [
    "21CFR11.10(e)",
    "ALCOA+:Attributable",
    "ALCOA+:Contemporaneous",
  ],
  "genotype.resolved": ["21CFR11.10(e)", "ALCOA+:Original"],
  "model.invoked": [
    "21CFR11.10(e)",
    "ALCOA+:Original",
    "FDA-AI:model-provenance",
  ],
  "alert.raised": [
    "21CFR11.10(e)",
    "ALCOA+:Accurate",
    "ALCOA+:Traceable",
  ],
  "alert.accepted": ["21CFR11.10(e)", "ALCOA+:Attributable"],
  "alert.overridden": [
    "21CFR11.50",
    "21CFR11.70",
    "ALCOA+:Attributable",
    "ALCOA+:Enduring",
  ],
  "policy.revised": [
    "21CFR11.10(k)(2)",
    "ALCOA+:Traceable",
    "ALCOA+:Enduring",
  ],
  "export.generated": ["21CFR11.10(b)"],
};

export const CLAUSE_LABELS: Record<string, string> = {
  "21CFR11.10(e)": "secure, computer-generated, time-stamped audit trail",
  "21CFR11.10(k)(2)": "revision and change-control audit trail",
  "21CFR11.10(b)": "accurate and complete copies for inspection",
  "21CFR11.50": "signature name, date/time, and meaning",
  "21CFR11.70": "signature linked to its electronic record",
  "ALCOA+:Attributable": "attributable to the person responsible",
  "ALCOA+:Contemporaneous": "recorded when the activity occurred",
  "ALCOA+:Original": "original data retained",
  "ALCOA+:Accurate": "accurate representation of the activity",
  "ALCOA+:Traceable": "traceable through its full history",
  "ALCOA+:Enduring": "preserved for the required retention period",
  "FDA-AI:model-provenance": "model, version, parameters, prompt, and raw output retained",
};

export function clausesFor(type: LedgerEventType): string[] {
  return [...CLAUSES_BY_EVENT[type]];
}

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
