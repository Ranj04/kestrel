"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { AuthorizationView, LedgerRecord } from "@/lib/contracts";
import type { ActiveRevision, VerificationDetails } from "@/lib/ledger";
import { AuthorizationPanel } from "./AuthorizationPanel";
import { ChainStatus, type TamperNotice } from "./ChainStatus";
import { RecordRow } from "./RecordRow";

const useBrowserLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

export interface LedgerResponse {
  records: LedgerRecord[];
  authorizations: AuthorizationView[];
  revision: ActiveRevision | null;
  verify: VerificationDetails;
  ephemeral: boolean;
  error?: string;
}

interface RequestToken {
  current: number;
}

interface RefreshCallbacks {
  apply: (body: LedgerResponse) => void;
  reject: (message: string) => void;
}

export function invalidateLedgerRequests(requestToken: RequestToken): number {
  requestToken.current += 1;
  return requestToken.current;
}

function isCurrentLedgerRequest(
  requestToken: RequestToken,
  dispatchedToken: number,
): boolean {
  return requestToken.current === dispatchedToken;
}

export async function refreshLedger(
  requestToken: RequestToken,
  callbacks: RefreshCallbacks,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  const dispatchedToken = invalidateLedgerRequests(requestToken);

  try {
    const response = await fetcher("/api/ledger", { cache: "no-store" });
    const body = (await response.json()) as LedgerResponse;
    if (!response.ok || body.error) throw new Error(body.error ?? "Ledger read failed");
    if (!isCurrentLedgerRequest(requestToken, dispatchedToken)) return false;
    callbacks.apply(body);
    return true;
  } catch (error) {
    if (!isCurrentLedgerRequest(requestToken, dispatchedToken)) return false;
    callbacks.reject(error instanceof Error ? error.message : "Ledger read failed");
    return false;
  }
}

export interface VisibleRecordPlan {
  visible: LedgerRecord[];
  elided: LedgerRecord[];
  elidedVerified: boolean;
}

export function planVisibleRecords(
  records: LedgerRecord[],
  verification: VerificationDetails | null,
  compactBrokenList: boolean,
): VisibleRecordPlan {
  const newestFirst = records.toReversed();
  if (!compactBrokenList || verification?.ok !== false) {
    return { visible: newestFirst, elided: [], elidedVerified: false };
  }

  const firstIntactIndex = newestFirst.findIndex(
    (record) => !verification.brokenSeqs.includes(record.seq),
  );
  const intactRowsAfterBoundary = newestFirst.length - firstIntactIndex;
  if (firstIntactIndex < 0 || intactRowsAfterBoundary <= 1) {
    return { visible: newestFirst, elided: [], elidedVerified: false };
  }

  const visible = newestFirst.slice(0, firstIntactIndex + 1);
  const elided = newestFirst.slice(firstIntactIndex + 1);
  return {
    visible,
    elided,
    elidedVerified: elided.every(
      (record) => !verification.brokenSeqs.includes(record.seq),
    ),
  };
}

export function elisionLabel(plan: VisibleRecordPlan): string | null {
  if (plan.elided.length === 0) return null;
  const sequences = plan.elided.map((record) => record.seq);
  const first = Math.min(...sequences);
  const last = Math.max(...sequences);
  const noun = plan.elided.length === 1 ? "record" : "records";
  const range = first === last ? `${first}` : `${first}–${last}`;
  const verified = plan.elidedVerified ? " · verified" : "";
  return `· ${plan.elided.length} ${noun} (${range}) unchanged${verified} · not shown ·`;
}

export function LedgerPane() {
  const [records, setRecords] = useState<LedgerRecord[]>([]);
  const [authorizations, setAuthorizations] = useState<AuthorizationView[]>([]);
  const [revision, setRevision] = useState<ActiveRevision | null>(null);
  const [verification, setVerification] = useState<VerificationDetails | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [ephemeral, setEphemeral] = useState(false);
  const [tamperNotice, setTamperNotice] = useState<TamperNotice | null>(null);
  const [busy, setBusy] = useState<"verify" | "tamper" | "supersede" | "reset" | "export" | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const seenRecordIds = useRef(new Set<string>());
  const latestRequest = useRef(0);
  const actionInFlight = useRef(false);

  const refresh = useCallback(async (duringAction = false) => {
    if (actionInFlight.current && !duringAction) return false;
    return refreshLedger(latestRequest, {
      apply: (body) => {
        setRecords(body.records);
        setAuthorizations(body.authorizations);
        setRevision(body.revision);
        setVerification(body.verify);
        setEphemeral(body.ephemeral);
        setVerificationError(null);
      },
      reject: (message) => {
        setVerification(null);
        setVerificationError(message);
      },
    });
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => void refresh(), 1_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [refresh]);

  useBrowserLayoutEffect(() => {
    const rows = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>("[data-record-id]") ?? [],
    );
    const freshRows = rows.filter((row) => {
      const recordId = row.dataset.recordId;
      if (!recordId || seenRecordIds.current.has(recordId)) return false;
      seenRecordIds.current.add(recordId);
      return true;
    });

    if (
      freshRows.length === 0 ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    // The list is newest-first; reverse the fresh subset so the audit trail
    // writes in chronological order. Seen ids never animate on a later poll.
    freshRows.reverse().forEach((row, index) => {
      row.style.animationDelay = `${index * 60}ms`;
      row.style.animationDuration = "200ms";
      row.style.animationTimingFunction = "cubic-bezier(0.2, 0, 0.2, 1)";
      row.classList.add("rise");
    });
  }, [records]);

  function beginAction(
    action: "verify" | "tamper" | "supersede" | "reset" | "export",
  ): number {
    actionInFlight.current = true;
    const dispatchedToken = invalidateLedgerRequests(latestRequest);
    setBusy(action);
    setVerification(null);
    return dispatchedToken;
  }

  async function verifyNow() {
    const dispatchedToken = beginAction("verify");
    try {
      const response = await fetch("/api/ledger/verify", { method: "POST" });
      const body = (await response.json()) as VerificationDetails & { error?: string };
      if (!response.ok || body.error) throw new Error(body.error ?? "Ledger verification failed");
      if (!isCurrentLedgerRequest(latestRequest, dispatchedToken)) return;
      setVerification(body);
      setVerificationError(null);
      await refresh(true);
    } catch (error) {
      if (isCurrentLedgerRequest(latestRequest, dispatchedToken)) {
        setVerificationError(error instanceof Error ? error.message : "Ledger verification failed");
      }
    } finally {
      actionInFlight.current = false;
      setBusy(null);
    }
  }

  async function tamperNow() {
    const dispatchedToken = beginAction("tamper");
    try {
      const response = await fetch("/api/ledger/tamper", { method: "POST" });
      const body = (await response.json()) as TamperNotice & { error?: string };
      if (!response.ok || body.error) throw new Error(body.error ?? "Ledger tamper failed");
      if (!isCurrentLedgerRequest(latestRequest, dispatchedToken)) return;
      setTamperNotice(body);
      await refresh(true);
    } catch (error) {
      if (isCurrentLedgerRequest(latestRequest, dispatchedToken)) {
        setVerificationError(error instanceof Error ? error.message : "Ledger tamper failed");
      }
    } finally {
      actionInFlight.current = false;
      setBusy(null);
    }
  }

  async function resetNow() {
    const dispatchedToken = beginAction("reset");
    setTamperNotice(null);
    try {
      const response = await fetch("/api/ledger/reset", { method: "POST" });
      const body = (await response.json()) as { error?: string };
      if (!response.ok || body.error) throw new Error(body.error ?? "Ledger reset failed");
      if (!isCurrentLedgerRequest(latestRequest, dispatchedToken)) return;
      await refresh(true);
    } catch (error) {
      if (isCurrentLedgerRequest(latestRequest, dispatchedToken)) {
        setVerificationError(error instanceof Error ? error.message : "Ledger reset failed");
      }
    } finally {
      actionInFlight.current = false;
      setBusy(null);
    }
  }

  async function supersedeNow() {
    const dispatchedToken = beginAction("supersede");
    try {
      const response = await fetch("/api/evidence/supersede", { method: "POST" });
      const body = (await response.json()) as { error?: string };
      if (!response.ok || body.error) {
        throw new Error(body.error ?? "Policy revision could not be published");
      }
      if (!isCurrentLedgerRequest(latestRequest, dispatchedToken)) return;
      await refresh(true);
    } catch (error) {
      if (isCurrentLedgerRequest(latestRequest, dispatchedToken)) {
        setVerificationError(
          error instanceof Error ? error.message : "Policy revision could not be published",
        );
      }
    } finally {
      actionInFlight.current = false;
      setBusy(null);
    }
  }

  async function exportNow() {
    const dispatchedToken = beginAction("export");
    try {
      const response = await fetch("/api/ledger/export", { method: "POST" });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Ledger export failed");
      }
      if (!isCurrentLedgerRequest(latestRequest, dispatchedToken)) return;
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "kestrel-inspection-package.zip";
      anchor.click();
      URL.revokeObjectURL(url);
      await refresh(true);
    } catch (error) {
      if (isCurrentLedgerRequest(latestRequest, dispatchedToken)) {
        setVerificationError(error instanceof Error ? error.message : "Ledger export failed");
      }
    } finally {
      actionInFlight.current = false;
      setBusy(null);
    }
  }

  const compactBrokenList =
    verification?.ok === false &&
    authorizations.some((authorization) => authorization.status === "superseded");
  const visibleRecordPlan = planVisibleRecords(
    records,
    verification,
    compactBrokenList,
  );
  const hiddenRecordLabel = elisionLabel(visibleRecordPlan);

  return (
    <div className="flex h-full min-h-0 flex-col bg-void text-paper">
      <ChainStatus
        verification={verification}
        verificationError={verificationError}
        ephemeral={ephemeral}
        tamperNotice={tamperNotice}
        busy={busy}
        /* Deliberately NOT gated on verification.ok. A tampered chain and a
           revised policy are independent facts: a payer revises policy whether
           or not someone edited your audit log, and phase2b's whole point is
           that tamper-red ("did someone change the record") and superseded
           ("is this decision still warranted") must never collapse into one
           state. Gating publish on an intact chain conflated exactly those two
           and dead-ended the demo: once you tampered, the button greyed out
           until a reset threw the signed override away. The supersede route
           already appends correctly on a broken chain. */
        canSupersede={
          revision === null &&
          authorizations.some((authorization) =>
            authorization.boundTo.scopes.includes("dosing.capecitabine"),
          )
        }
        onVerify={() => void verifyNow()}
        onTamper={() => void tamperNow()}
        onSupersede={() => void supersedeNow()}
        onReset={() => void resetNow()}
        onExport={() => void exportNow()}
      />

      <AuthorizationPanel authorizations={authorizations} revision={revision} />

      <div className="min-h-0 flex-1 overflow-hidden px-4 py-2">
        {records.length === 0 ? (
          <div className="flex h-full items-center justify-center border border-dashed border-paper/15 text-center font-mono text-xs text-paper/35">
            No ledger records yet.
            <br />Place an order to begin the audit trail.
          </div>
        ) : (
          <ol ref={listRef} className="flex h-full flex-col justify-start overflow-hidden">
            {visibleRecordPlan.visible.map((record, index, visibleRecords) => {
              const previousRecord = visibleRecords[index - 1];
              const beginsIntactTail =
                previousRecord !== undefined &&
                (verification?.brokenSeqs.includes(previousRecord.seq) ?? false) &&
                !(verification?.brokenSeqs.includes(record.seq) ?? false);

              return (
                <Fragment key={record.recordId}>
                  {beginsIntactTail && <li aria-hidden="true" className="h-px shrink-0 bg-accent" />}
                  <RecordRow record={record} verification={verification} />
                </Fragment>
              );
            })}
            {hiddenRecordLabel && (
              <li className="shrink-0 border-t border-paper/15 py-2 text-center font-mono text-xs text-paper/45">
                {hiddenRecordLabel}
              </li>
            )}
          </ol>
        )}
      </div>
    </div>
  );
}

export { SignatureModal } from "./SignatureModal";
export type { SignatureModalProps } from "./SignatureModal";
