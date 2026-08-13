import type { LedgerRecord } from "../contracts";

export let ephemeral = false;
let memoryRecords: LedgerRecord[] = [];

export function useEphemeral(records: LedgerRecord[]): void {
  ephemeral = true;
  memoryRecords = structuredClone(records);
}

export function readMemory(): LedgerRecord[] {
  return structuredClone(memoryRecords);
}

export function appendMemory(record: LedgerRecord): void {
  memoryRecords.push(structuredClone(record));
}

export function resetMemory(): void {
  memoryRecords = [];
}

export function replaceMemoryRecord(seq: number, record: LedgerRecord): void {
  const index = memoryRecords.findIndex((candidate) => candidate.seq === seq);
  if (index === -1) throw new Error(`Ledger record ${seq} does not exist`);
  memoryRecords[index] = structuredClone(record);
}
