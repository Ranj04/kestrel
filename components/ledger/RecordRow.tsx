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
  return value.replace(/^sha256:/, "").slice(0, 6);
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
  const recordSummary = summary(record);
  const signedMeaning =
    record.type === "alert.overridden" && typeof payload.signatureMeaning === "string"
      ? payload.signatureMeaning
      : null;

  return (
    <li
      /* Design handoff: a broken row is a 4px vermilion rule plus reduced
         opacity — no red wash. The 4px rule keeps the EXACT palette value
         (--accent); only text lifts to --accent-void for legibility on --void.
         No transition: tampering must be instant or it reads as loading. */
      data-record-id={record.recordId}
      className={`border-b border-l-4 py-1.5 pl-4 pr-1 font-mono text-xs leading-snug ${
        isBroken
          ? "border-b-paper/10 border-l-accent"
          : "border-b-paper/10 border-l-transparent"
      }`}
    >
      <div className={isBroken ? "opacity-60" : undefined}>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="w-full text-left"
        >
          <div className="flex items-baseline gap-2">
            <span className="text-paper/40">#{record.seq}</span>
            <span className="font-semibold text-paper/90">{record.type}</span>
            {/* Fixed widths plus tabular numerals make one calibrated time column. */}
            <time className="ml-auto w-24 shrink-0 text-right tabular-nums text-paper/55">
              {new Date(record.occurredAt).toLocaleTimeString([], {
                hour12: false,
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                fractionalSecondDigits: 3,
              })}
            </time>
            {/* MISMATCH replaces the tick rather than adding a second icon. */}
            <span
              className={`w-20 shrink-0 text-right ${
                isBroken
                  ? "font-medium tracking-[0.12em] text-accent-void"
                  : isVerified
                    ? "text-seal-void"
                    : "text-paper/35"
              }`}
            >
              {isBroken ? "MISMATCH" : isVerified ? "✓" : "·"}
            </span>
          </div>

          <div className="mt-1 flex min-w-0 items-baseline gap-2 text-paper/55">
            <span className="shrink-0">{record.actor.id} · {record.actor.role}</span>
            <span className="min-w-0 flex-1 truncate">
              clauses addressed by this record type: {" "}
              {record.clauses.map((clause) => `${clause} - ${CLAUSE_LABELS[clause] ?? "recorded control"}`).join("  ·  ")}
            </span>
          </div>

          {recordSummary && (
            <div
              className={
                record.type === "alert.overridden"
                  ? "mt-1 truncate font-display text-base text-paper/85"
                  : "mt-1 truncate text-paper/40"
              }
            >
              {recordSummary}
            </div>
          )}
          {signedMeaning && <div className="mt-1 text-paper/55">signed — {signedMeaning}</div>}
          {record.type === "alert.overridden" && (
            <div className="mt-1 font-semibold text-amber">
              DEMO — unauthenticated signature; the signer is a fixture
            </div>
          )}

          <div className="mt-1 flex min-w-0 items-baseline gap-2 overflow-hidden text-paper/40">
            <span className="min-w-0 flex-1 truncate">
              prev <span title={record.prevHash}>{hashShort(record.prevHash)}…</span> → sha256{" "}
              <span title={record.hash}>{hashShort(record.hash)}…</span>
            </span>
            <span className="shrink-0 text-paper/35">{expanded ? "▴" : "▾"}</span>
          </div>
        </button>

        {isFirstBroken && verification && (
          <p className="mt-1 border-t border-accent pt-1 font-semibold text-accent-void">
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
          <div className="mt-2 max-h-56 overflow-auto rounded-sm border border-paper/15 bg-black/30 p-2 text-xs leading-relaxed text-paper/70">
            <p className="mb-1 text-paper/45">Full payload</p>
            <pre className="whitespace-pre-wrap break-words">{JSON.stringify(record.payload, null, 2)}</pre>

            {record.type === "model.invoked" && record.model && (
              <div className="mt-3 border-t border-paper/15 pt-2">
                <p><span className="text-paper/45">Model</span> {record.model.id}</p>
                <p><span className="text-paper/45">Version</span> {record.model.version}</p>
                <p className="mt-1 text-paper/45">Parameters</p>
                <pre className="whitespace-pre-wrap break-words">{JSON.stringify(record.model.params, null, 2)}</pre>
                <p className="mt-2 text-paper/45">Exact prompt sent</p>
                <pre className="whitespace-pre-wrap break-words">{record.model.prompt}</pre>
                <p className="mt-2 font-semibold text-amber">
                  ALCOA &quot;Original&quot; — unedited model output, retained separately from any human-edited version.
                </p>
                <pre className="mt-1 whitespace-pre-wrap break-words border-l-2 border-amber/50 pl-2">
                  {record.model.rawOutput}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
