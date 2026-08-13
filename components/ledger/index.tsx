"use client";

import { useCallback, useEffect, useState } from "react";
import type { LedgerRecord } from "@/lib/contracts";
import type { VerificationDetails } from "@/lib/ledger";
import { ChainStatus, type TamperNotice } from "./ChainStatus";
import { RecordRow } from "./RecordRow";

interface LedgerResponse {
  records: LedgerRecord[];
  verify: VerificationDetails;
  ephemeral: boolean;
  error?: string;
}

export function LedgerPane() {
  const [records, setRecords] = useState<LedgerRecord[]>([]);
  const [verification, setVerification] = useState<VerificationDetails | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [ephemeral, setEphemeral] = useState(false);
  const [tamperNotice, setTamperNotice] = useState<TamperNotice | null>(null);
  const [busy, setBusy] = useState<"verify" | "tamper" | "reset" | "export" | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/ledger", { cache: "no-store" });
      const body = (await response.json()) as LedgerResponse;
      if (!response.ok || body.error) throw new Error(body.error ?? "Ledger read failed");
      setRecords(body.records);
      setVerification(body.verify);
      setEphemeral(body.ephemeral);
      setVerificationError(null);
    } catch (error) {
      setVerification(null);
      setVerificationError(error instanceof Error ? error.message : "Ledger read failed");
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => void refresh(), 1_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [refresh]);

  async function verifyNow() {
    setBusy("verify");
    setVerification(null);
    try {
      const response = await fetch("/api/ledger/verify", { method: "POST" });
      const body = (await response.json()) as VerificationDetails & { error?: string };
      if (!response.ok || body.error) throw new Error(body.error ?? "Ledger verification failed");
      setVerification(body);
      setVerificationError(null);
      await refresh();
    } catch (error) {
      setVerificationError(error instanceof Error ? error.message : "Ledger verification failed");
    } finally {
      setBusy(null);
    }
  }

  async function tamperNow() {
    setBusy("tamper");
    setVerification(null);
    try {
      const response = await fetch("/api/ledger/tamper", { method: "POST" });
      const body = (await response.json()) as TamperNotice & { error?: string };
      if (!response.ok || body.error) throw new Error(body.error ?? "Ledger tamper failed");
      setTamperNotice(body);
      await refresh();
    } catch (error) {
      setVerificationError(error instanceof Error ? error.message : "Ledger tamper failed");
    } finally {
      setBusy(null);
    }
  }

  async function resetNow() {
    setBusy("reset");
    setVerification(null);
    setTamperNotice(null);
    try {
      const response = await fetch("/api/ledger/reset", { method: "POST" });
      const body = (await response.json()) as { error?: string };
      if (!response.ok || body.error) throw new Error(body.error ?? "Ledger reset failed");
      await refresh();
    } catch (error) {
      setVerificationError(error instanceof Error ? error.message : "Ledger reset failed");
    } finally {
      setBusy(null);
    }
  }

  async function exportNow() {
    setBusy("export");
    setVerification(null);
    try {
      const response = await fetch("/api/ledger/export", { method: "POST" });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Ledger export failed");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "attest-inspection-package.zip";
      anchor.click();
      URL.revokeObjectURL(url);
      await refresh();
    } catch (error) {
      setVerificationError(error instanceof Error ? error.message : "Ledger export failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#1a1512] text-[#f3ece0]">
      <ChainStatus
        verification={verification}
        verificationError={verificationError}
        ephemeral={ephemeral}
        tamperNotice={tamperNotice}
        busy={busy}
        onVerify={() => void verifyNow()}
        onTamper={() => void tamperNow()}
        onReset={() => void resetNow()}
        onExport={() => void exportNow()}
      />

      <div className="min-h-0 flex-1 overflow-hidden px-4 py-2">
        {records.length === 0 ? (
          <div className="flex h-full items-center justify-center border border-dashed border-white/15 text-center font-mono text-xs text-white/35">
            No ledger records yet.
            <br />Place an order to begin the audit trail.
          </div>
        ) : (
          <ol className="flex h-full flex-col justify-start overflow-hidden">
            {records.toReversed().map((record) => (
              <RecordRow key={record.recordId} record={record} verification={verification} />
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

export { SignatureModal } from "./SignatureModal";
export type { SignatureModalProps } from "./SignatureModal";
