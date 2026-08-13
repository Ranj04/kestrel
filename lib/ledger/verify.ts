import type { LedgerRecord, VerifyResult } from "../contracts";
import { GENESIS_PREV_HASH, hashRecord } from "./hash";
import { readState, type LedgerReadState } from "./store";

export interface VerificationDetails extends VerifyResult {
  expectedHash: string | null;
  foundHash: string | null;
}

function verifyState(state: LedgerReadState): VerifyResult {
  let firstBroken: number | null = null;

  for (let index = 0; index < state.records.length; index += 1) {
    const record = state.records[index];
    const expectedPrev =
      index === 0 ? GENESIS_PREV_HASH : state.records[index - 1].hash;
    if (
      firstBroken === null &&
      (record.prevHash !== expectedPrev || hashRecord(record) !== record.hash)
    ) {
      firstBroken = index;
    }
  }

  if (
    state.unreadableAt !== null &&
    (firstBroken === null || state.unreadableAt < firstBroken)
  ) {
    firstBroken = state.unreadableAt;
  }

  const brokenSeqs =
    firstBroken === null
      ? []
      : Array.from(
          { length: state.totalLines - firstBroken },
          (_, offset) => firstBroken + offset,
        );

  return {
    ok: firstBroken === null,
    total: state.totalLines,
    firstBrokenSeq: firstBroken,
    brokenSeqs,
    checkedAt: new Date().toISOString(),
  };
}

export function verify(records?: LedgerRecord[]): VerifyResult {
  // Always touch current storage on this call; callers may still supply an explicit chain.
  const freshState = readState();
  const state = records
    ? { records, totalLines: records.length, unreadableAt: null }
    : freshState;
  return verifyState(state);
}

/** Fresh verification plus the stored and recomputed digests for the UI's first break. */
export function verifyDetailed(): VerificationDetails {
  const state = readState();
  const result = verifyState(state);
  const first =
    result.firstBrokenSeq === null
      ? undefined
      : state.records.find((record) => record.seq === result.firstBrokenSeq);
  return {
    ...result,
    expectedHash: first ? hashRecord(first) : null,
    foundHash: first?.hash ?? null,
  };
}
