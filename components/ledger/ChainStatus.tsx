"use client";

import type { VerificationDetails } from "@/lib/ledger";

export interface TamperNotice {
  seq: number;
  field: string;
  before: string;
  after: string;
}

interface ChainStatusProps {
  verification: VerificationDetails | null;
  verificationError: string | null;
  ephemeral: boolean;
  tamperNotice: TamperNotice | null;
  busy: "verify" | "tamper" | "reset" | "export" | null;
  onVerify: () => void;
  onTamper: () => void;
  onReset: () => void;
  onExport: () => void;
}

function rangeLabel(first: number, total: number): string {
  return total - 1 === first ? `${first}` : `${first}-${total - 1}`;
}

export function ChainStatus({
  verification,
  verificationError,
  ephemeral,
  tamperNotice,
  busy,
  onVerify,
  onTamper,
  onReset,
  onExport,
}: ChainStatusProps) {
  const broken = verification?.ok === false && verification.firstBrokenSeq !== null;

  return (
    <div className={`border-b px-4 pb-3 pt-4 ${broken ? "border-red-500 bg-red-950/70" : "border-white/15"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-mono text-[11px] font-semibold tracking-[0.2em] text-white/65">
            AUDIT LEDGER
          </h2>
          {verificationError ? (
            <p className="mt-1 font-mono text-xs font-semibold text-amber-300">
              VERIFICATION UNAVAILABLE — STATUS UNKNOWN
            </p>
          ) : verification === null ? (
            <p className="mt-1 font-mono text-xs text-white/55">
              verification pending — no status assumed
            </p>
          ) : broken ? (
            <p className="mt-1 max-w-md font-mono text-sm font-bold leading-tight text-red-100">
              CHAIN BROKEN AT RECORD {verification.firstBrokenSeq} — RECORDS{" "}
              {rangeLabel(verification.firstBrokenSeq!, verification.total)} NOT TRUSTWORTHY
            </p>
          ) : (
            <p className="mt-1 font-mono text-sm font-semibold text-emerald-300">
              {verification.total} {verification.total === 1 ? "record" : "records"} · chain intact ✓
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {ephemeral && (
            <span className="rounded-full border border-amber-400/50 bg-amber-400/10 px-2 py-1 font-mono text-[9px] text-amber-200">
              in-memory ledger — file storage unavailable
            </span>
          )}
          <button
            type="button"
            onClick={onReset}
            disabled={busy !== null}
            className="font-mono text-[9px] text-white/35 underline-offset-2 hover:text-white/70 hover:underline disabled:opacity-40"
          >
            {busy === "reset" ? "resetting…" : "Reset demo"}
          </button>
        </div>
      </div>

      {tamperNotice && (
        <p className="break-flash mt-2 rounded border border-red-400/45 bg-red-500/10 px-2 py-1.5 font-mono text-[10px] leading-tight text-red-100">
          {tamperNotice.field} altered · “{tamperNotice.before}” → “{tamperNotice.after}”
        </p>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-[10px]">
        <button type="button" onClick={onVerify} disabled={busy !== null} className="rounded border border-white/25 px-2 py-2 text-white hover:bg-white/10 disabled:opacity-40">
          {busy === "verify" ? "Verifying…" : "Verify chain"}
        </button>
        <button type="button" onClick={onTamper} disabled={busy !== null || verification?.total === 0} className="rounded border border-red-400/50 px-2 py-2 text-red-200 hover:bg-red-500/15 disabled:opacity-40">
          {busy === "tamper" ? "Tampering…" : "Tamper a record"}
        </button>
        <button type="button" onClick={onExport} disabled={busy !== null} className="rounded border border-white/25 px-2 py-2 text-white hover:bg-white/10 disabled:opacity-40">
          {busy === "export" ? "Exporting…" : "Export package"}
        </button>
      </div>
    </div>
  );
}
