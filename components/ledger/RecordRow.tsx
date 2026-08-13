"use client";

import { useState } from "react";
import type { LedgerRecord } from "@/lib/contracts";
import type { VerificationDetails } from "@/lib/ledger";
import { CLAUSE_LABELS } from "@/lib/ledger/clauses";

interface RecordRowProps {
  record: LedgerRecord;
  verification: VerificationDetails | null;
}

function objectPayload(record: LedgerRecord): Record<string, unknown> {
  return record.payload && typeof record.payload === "object"
    ? (record.payload as Record<string, unknown>)
    : {};
}

function hashShort(value: string): string {
  return value.replace(/^sha256:/, "").slice(0, 4);
}

function summary(record: LedgerRecord): string | null {
  const payload = objectPayload(record);
  if (record.type === "alert.overridden" && typeof payload.rationale === "string") {
    return `“${payload.rationale}”`;
  }
  if (record.type === "alert.raised") {
    return [payload.gene, payload.phenotype, payload.drugName, payload.severity]
      .filter((value) => typeof value === "string" && value !== "")
      .join(" · ");
  }
  if (record.type === "order.placed" && typeof payload.drugRaw === "string") {
    return payload.drugRaw;
  }
  if (record.type === "genotype.resolved" && Array.isArray(payload.results)) {
    return payload.results
      .map((result) => {
        if (!result || typeof result !== "object") return null;
        const value = result as Record<string, unknown>;
        return [value.gene, value.phenotype ?? value.lookup].filter(Boolean).join(" ");
      })
      .filter(Boolean)
      .join(" · ");
  }
  if (record.type === "alert.accepted") return "Recommendation accepted";
  if (record.type === "model.invoked" && typeof payload.purpose === "string") {
    return payload.purpose;
  }
  if (record.type === "export.generated") return "Human-readable + electronic inspection copies";
  return null;
}

export function RecordRow({ record, verification }: RecordRowProps) {
  const [expanded, setExpanded] = useState(false);
  const isBroken = verification?.brokenSeqs.includes(record.seq) ?? false;
  const isFirstBroken = verification?.firstBrokenSeq === record.seq;
  const isVerified = verification !== null;
  const payload = objectPayload(record);
  const signedMeaning =
    record.type === "alert.overridden" && typeof payload.signatureMeaning === "string"
      ? payload.signatureMeaning
      : null;

  return (
    <li
      className={`border-b py-1.5 pl-2 pr-1 font-mono text-[9px] leading-tight transition-colors ${
        isBroken
          ? "break-flash border-b-red-900/60 border-l-4 border-l-red-500 bg-red-950/35"
          : `border-b-white/10 border-l-4 ${isVerified ? "border-l-emerald-700/70" : "border-l-white/15"}`
      }`}
    >
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="w-full text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-white/40">#{record.seq}</span>
          <span className="font-semibold text-white">{record.type}</span>
          <time className="ml-auto text-white/40">
            {new Date(record.occurredAt).toLocaleTimeString([], {
              hour12: false,
              fractionalSecondDigits: 3,
            })}
          </time>
          <span className={isBroken ? "font-bold text-red-300" : isVerified ? "text-emerald-300" : "text-white/35"}>
            {isBroken ? "✗" : isVerified ? "✓" : "·"}
          </span>
        </div>

        <div className="mt-1 flex min-w-0 items-baseline gap-2">
          <span className="shrink-0 text-white/55">{record.actor.id} · {record.actor.role}</span>
          {summary(record) && <span className="truncate text-white/75">{summary(record)}</span>}
          {signedMeaning && <span className="shrink-0 text-emerald-300">signed — {signedMeaning}</span>}
        </div>

        <div className="mt-1 flex min-w-0 items-center gap-1.5 overflow-hidden text-[8px]">
          <span className="min-w-0 flex-1 truncate text-white/42">
            {record.clauses.map((clause) => `${clause} - ${CLAUSE_LABELS[clause] ?? "recorded control"}`).join("  ·  ")}
          </span>
          <span className="shrink-0 text-white/40">
            prev <span title={record.prevHash}>{hashShort(record.prevHash)}…</span> → sha256{" "}
            <span title={record.hash}>{hashShort(record.hash)}…</span>
          </span>
          <span className="shrink-0 text-white/35">{expanded ? "▴" : "▾"}</span>
        </div>
      </button>

      {isFirstBroken && verification && (
        <p className="mt-1 rounded bg-red-500/15 px-2 py-1 font-semibold text-red-200">
          expected sha256{" "}
          <span title={verification.expectedHash ?? undefined}>
            {verification.expectedHash ? `${hashShort(verification.expectedHash)}…` : "unreadable"}
          </span>{" "}
          · found{" "}
          <span title={verification.foundHash ?? undefined}>
            {verification.foundHash ? `${hashShort(verification.foundHash)}…` : "unreadable"}
          </span>
        </p>
      )}

      {expanded && (
        <div className="mt-2 max-h-56 overflow-auto rounded border border-white/15 bg-black/30 p-2 text-[9px] leading-relaxed text-white/70">
          <p className="mb-1 text-white/45">Full payload</p>
          <pre className="whitespace-pre-wrap break-words">{JSON.stringify(record.payload, null, 2)}</pre>

          {record.type === "model.invoked" && record.model && (
            <div className="mt-3 border-t border-white/15 pt-2">
              <p><span className="text-white/45">Model</span> {record.model.id}</p>
              <p><span className="text-white/45">Version</span> {record.model.version}</p>
              <p className="mt-1 text-white/45">Parameters</p>
              <pre className="whitespace-pre-wrap break-words">{JSON.stringify(record.model.params, null, 2)}</pre>
              <p className="mt-2 text-white/45">Exact prompt sent</p>
              <pre className="whitespace-pre-wrap break-words">{record.model.prompt}</pre>
              <p className="mt-2 font-semibold text-amber-200">
                ALCOA &quot;Original&quot; — unedited model output, retained separately from any human-edited version.
              </p>
              <pre className="mt-1 whitespace-pre-wrap break-words border-l-2 border-amber-400/50 pl-2">
                {record.model.rawOutput}
              </pre>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
