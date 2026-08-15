"use client";

/**
 * Coverage determination — secondary to the clinical finding by contract, so
 * it renders UNDER the clinical block, never above it (the caller enforces
 * placement; this file keeps it visually subordinate). `clauseText` is
 * VERBATIM from data/policies.json — payer language is under the same
 * no-rewriting rule as clinical language.
 */
import type { Coverage } from "@/lib/contracts";

const TONE: Record<Coverage["determination"], string> = {
  covered: "text-seal border-seal",
  "covered-with-conditions": "text-amber border-amber",
  pended: "text-amber border-amber",
  "not-covered": "text-accent-deep border-accent-deep",
};

export function CoverageLine({ coverage }: { coverage: Coverage }) {
  return (
    <div className="border-t border-line pt-0.5">
      {/* G-9: the payer is fictional and the patient carries no plan, member
          or benefit context — what renders below is an illustrative clause
          match, and the screen must not call it a determination. Compact: the
          critical takeover's height budget is exact (R-19), and this line plus
          the clause-text size below are paid for by R-19's named reserve. */}
      <p className="font-mono text-[10px] uppercase leading-tight tracking-[0.08em] text-ink-soft">
        DEMO — fictional payer; not a coverage determination
      </p>
      <p className="font-mono text-xs">
        <span className={`mr-2 border px-1.5 py-0.5 font-semibold uppercase ${TONE[coverage.determination]}`}>
          {coverage.determination}
        </span>
        <span className="text-ink-soft">
          {coverage.payer} · {coverage.policyId} v{coverage.policyVersion} · clause {coverage.clauseId}
        </span>
      </p>
      {/* clause text is the R-19 reserve lever: verbatim always, but it gives up
          leading before anything clinical gives up anything (phase5 stage 2).
          phase 7.5: the lever is SPENT — 12px -> 11px pays for the G-9 label
          line above, exactly the trade R-19 prescribed. Text untouched. */}
      <p className="mt-0.5 text-[11px] leading-tight text-ink-soft">{coverage.clauseText}</p>
      {coverage.alternative && (
        <p className="mt-0.5 font-mono text-xs text-ink">Alternative: {coverage.alternative}</p>
      )}
    </div>
  );
}
