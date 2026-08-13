import type {
  Actor,
  EvidenceSnapshot,
  LedgerRecord,
  OverridePayload,
} from "../contracts";
import { append, clausesFor, readAll } from "./store";

interface OverrideInput {
  alertId: string;
  orderId: string;
  actor: Actor;
  printedName?: string;
  rationale: string;
  signatureMeaning: "authorship" | "review" | "approval";
  suggestedRationale?: string | null;
  boundTo?: EvidenceSnapshot;
}

interface AcceptanceInput {
  alertId: string;
  orderId: string;
  actor: Actor;
}

function snapshotFromLedger(alertId: string, orderId: string): EvidenceSnapshot | undefined {
  for (const record of readAll().toReversed()) {
    if (record.type !== "alert.raised" || !record.payload || typeof record.payload !== "object") {
      continue;
    }
    const payload = record.payload as Record<string, unknown>;
    const alert =
      payload.alert && typeof payload.alert === "object"
        ? (payload.alert as Record<string, unknown>)
        : payload;
    if (alert.alertId === alertId && alert.orderId === orderId && alert.snapshot) {
      return alert.snapshot as EvidenceSnapshot;
    }
  }
  return undefined;
}

export function recordOverride(input: OverrideInput): LedgerRecord {
  const boundTo = input.boundTo ?? snapshotFromLedger(input.alertId, input.orderId);
  if (!boundTo) {
    throw new Error("Override cannot be recorded without its evidence snapshot");
  }
  const payload: OverridePayload = {
    alertId: input.alertId,
    orderId: input.orderId,
    printedName: input.printedName ?? input.actor.name,
    signedAt: new Date().toISOString(),
    signatureMeaning: input.signatureMeaning,
    rationale: input.rationale,
    suggestedRationale: input.suggestedRationale ?? null,
    boundTo,
  };

  // §11.70 linkage is supplied by append: the signature becomes part of the hash chain.
  return append(
    "alert.overridden",
    payload,
    input.actor,
    clausesFor("alert.overridden"),
  );
}

export function recordAcceptance(input: AcceptanceInput): LedgerRecord {
  return append(
    "alert.accepted",
    { alertId: input.alertId, orderId: input.orderId },
    input.actor,
    clausesFor("alert.accepted"),
  );
}
