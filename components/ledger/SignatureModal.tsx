"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { Actor, Alert, LedgerRecord } from "@/lib/contracts";

export interface SignatureModalProps {
  alert: Alert;
  actor: Actor;
  open?: boolean;
  onClose: () => void;
  onRecorded?: (record: LedgerRecord) => void;
}

type SignatureMeaning = "authorship" | "review" | "approval";

export function SignatureModal({
  alert,
  actor,
  open = true,
  onClose,
  onRecorded,
}: SignatureModalProps) {
  if (!open) return null;
  return (
    <SignatureModalForm
      alert={alert}
      actor={actor}
      onClose={onClose}
      onRecorded={onRecorded}
    />
  );
}

function SignatureModalForm({
  alert,
  actor,
  onClose,
  onRecorded,
}: Omit<SignatureModalProps, "open">) {
  const [printedName, setPrintedName] = useState(actor.name);
  const [meaning, setMeaning] = useState<SignatureMeaning>("approval");
  const [rationale, setRationale] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [busy, setBusy] = useState<"override" | "accept" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  async function record(path: "override" | "accept", body: object) {
    setBusy(path);
    setError(null);
    try {
      const response = await fetch(`/api/ledger/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as { record?: LedgerRecord; error?: string };
      if (!response.ok || !result.record) throw new Error(result.error ?? "Ledger write failed");
      onRecorded?.(result.record);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ledger write failed");
    } finally {
      setBusy(null);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (printedName.trim() === "" || rationale.trim().length < 20) return;
    await record("override", {
      alertId: alert.alertId,
      orderId: alert.orderId,
      actor,
      printedName,
      signatureMeaning: meaning,
      rationale,
      suggestedRationale: null,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4" role="dialog" aria-modal="true" aria-labelledby="signature-title">
      <form onSubmit={(event) => void submit(event)} className="w-full max-w-lg border border-line bg-paper-raised p-5 text-ink">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xs tracking-[0.18em] text-ink-soft">21 CFR PART 11 SIGNATURE</p>
            <h2 id="signature-title" className="mt-1 text-xl font-semibold">Override and sign</h2>
          </div>
          <button type="button" onClick={onClose} className="font-mono text-xs text-ink-soft hover:text-ink">Close</button>
        </div>

        <p className="mt-3 border-l-2 border-accent pl-3 text-sm leading-snug">
          You are overriding the CPIC recommendation for {alert.gene} · {alert.drugName}.
        </p>

        <label className="mt-4 block font-mono text-xs font-semibold">
          Printed name
          <input required value={printedName} onChange={(event) => setPrintedName(event.target.value)} className="mt-1 w-full border border-line bg-paper-raised px-3 py-2 font-display text-sm outline-none focus:border-ink" />
        </label>

        <label className="mt-3 block font-mono text-xs font-semibold">
          Meaning of signature
          <select value={meaning} onChange={(event) => setMeaning(event.target.value as SignatureMeaning)} className="mt-1 w-full border border-line bg-paper-raised px-3 py-2 font-display text-sm outline-none focus:border-ink">
            <option value="authorship">Authorship</option>
            <option value="review">Review</option>
            <option value="approval">Approval</option>
          </select>
        </label>

        <label className="mt-3 block font-mono text-xs font-semibold">
          Rationale <span className="font-normal text-ink-soft">— minimum 20 characters</span>
          <textarea required minLength={20} rows={3} value={rationale} onChange={(event) => setRationale(event.target.value)} className="mt-1 w-full resize-none border border-line bg-paper-raised px-3 py-2 font-display text-sm outline-none focus:border-ink" placeholder="Document the patient-specific reason for overriding this recommendation." />
        </label>

        <div className="mt-3 border border-line bg-paper px-3 py-2">
          <p className="font-mono text-xs text-ink-soft">Date/time · displayed live, set by the ledger on submit</p>
          <time className="font-mono text-xs font-semibold">{now.toISOString()}</time>
        </div>

        {error && <p className="mt-3 font-mono text-xs text-accent-deep">{error}</p>}

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void record("accept", { alertId: alert.alertId, orderId: alert.orderId, actor })}
            className="border border-seal px-3 py-2 font-mono text-xs text-seal hover:bg-seal/10 disabled:opacity-40"
          >
            {busy === "accept" ? "Recording…" : "Accept recommendation"}
          </button>
          <button
            type="submit"
            disabled={busy !== null || printedName.trim() === "" || rationale.trim().length < 20}
            className="bg-accent px-4 py-2 font-mono text-xs font-semibold text-paper-raised hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy === "override" ? "Signing…" : "Sign override"}
          </button>
        </div>
      </form>
    </div>
  );
}
