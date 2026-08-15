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
  busy: "verify" | "tamper" | "supersede" | "reset" | "export" | null;
  canSupersede: boolean;
  onVerify: () => void;
  onTamper: () => void;
  onSupersede: () => void;
  onReset: () => void;
  onExport: () => void;
}

function rangeLabel(first: number, total: number): string {
  return total - 1 === first ? `${first}` : `${first}–${total - 1}`;
}

export function ChainStatus({
  verification,
  verificationError,
  ephemeral,
  tamperNotice,
  busy,
  canSupersede,
  onVerify,
  onTamper,
  onSupersede,
  onReset,
  onExport,
}: ChainStatusProps) {
  const broken = verification?.ok === false && verification.firstBrokenSeq !== null;

  return (
    <div className={`border-b px-4 pb-3 pt-4 ${broken ? "border-accent" : "border-paper/15"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-mono text-xs font-semibold tracking-[0.2em] text-paper/65">
            AUDIT LEDGER
          </h2>
          {verificationError ? (
            <p className="mt-1 font-mono text-xs font-semibold text-amber">
              VERIFICATION UNAVAILABLE — STATUS UNKNOWN
            </p>
          ) : verification === null ? (
            <p className="mt-1 font-mono text-xs text-paper/55">
              verification pending — no status assumed
            </p>
          ) : broken ? (
            <p className="mt-1 font-mono text-lg font-semibold leading-tight text-accent-void">
              CHAIN BROKEN AT RECORD {verification.firstBrokenSeq} — {verification.total - 1 === verification.firstBrokenSeq ? "RECORD" : "RECORDS"}{" "}
              {rangeLabel(verification.firstBrokenSeq!, verification.total)} NOT TRUSTWORTHY
            </p>
          ) : (
            <p className="mt-1 font-mono text-sm font-semibold text-seal-void">
              {verification.total} {verification.total === 1 ? "record" : "records"} · chain intact ✓
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {ephemeral && (
            <span className="border border-amber/50 px-2 py-1 font-mono text-xs text-amber">
              in-memory ledger — file storage unavailable
            </span>
          )}
          <button
            type="button"
            onClick={onReset}
            disabled={busy !== null}
            className="font-mono text-xs text-paper/35 underline-offset-2 hover:text-paper/70 hover:underline disabled:opacity-40"
          >
            {busy === "reset" ? "resetting…" : "Reset demo"}
          </button>
        </div>
      </div>

      {tamperNotice && (
        <p className="mt-2 border border-accent/45 px-2 py-1.5 font-mono text-xs leading-tight text-accent-void">
          {tamperNotice.field} altered · “{tamperNotice.before}” → “{tamperNotice.after}”
        </p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-xs">
        <button type="button" onClick={onVerify} disabled={busy !== null} className="rounded-sm border border-paper/25 px-2 py-2 text-paper hover:bg-paper/10 disabled:opacity-40">
          {busy === "verify" ? "Verifying…" : "Verify chain"}
        </button>
        <button type="button" onClick={onExport} disabled={busy !== null} className="rounded-sm border border-paper/25 px-2 py-2 text-paper hover:bg-paper/10 disabled:opacity-40">
          {busy === "export" ? "Exporting…" : "Export package"}
        </button>
        <button type="button" onClick={onTamper} disabled={busy !== null || verification?.total === 0}
          // neutral, NOT vermilion. phase5 reserves --accent for the critical
          // alert and a broken chain; a red button pre-announces the break and
          // spends the colour that is supposed to mean "this is what went wrong".
          className="rounded-sm border border-paper/25 px-2 py-2 text-paper hover:bg-paper/10 disabled:opacity-40">
          {busy === "tamper" ? "Tampering…" : "Tamper a record"}
        </button>
        <button type="button" onClick={onSupersede} disabled={busy !== null || !canSupersede} // superseding is ordinary operations, not an attack — so it gets no alarm
          // colour at all. sky-* was outside the palette; phase5 allows no colour
          // that is not already in globals.css.
          className="rounded-sm border border-paper/25 px-2 py-2 text-paper hover:bg-paper/10 disabled:opacity-40">
          {busy === "supersede" ? "Publishing…" : "Publish policy revision"}
        </button>
      </div>
    </div>
  );
}
