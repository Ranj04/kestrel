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
      <p className="font-mono text-xs">
        <span className={`mr-2 border px-1.5 py-0.5 font-semibold uppercase ${TONE[coverage.determination]}`}>
          {coverage.determination}
        </span>
        <span className="text-ink-soft">
          {coverage.payer} · {coverage.policyId} v{coverage.policyVersion} · clause {coverage.clauseId}
        </span>
      </p>
      {/* clause text is the R-19 reserve lever: verbatim always, but it gives up
          leading before anything clinical gives up anything (phase5 stage 2). */}
      <p className="mt-0.5 text-xs leading-tight text-ink-soft">{coverage.clauseText}</p>
      {coverage.alternative && (
        <p className="mt-0.5 font-mono text-xs text-ink">Alternative: {coverage.alternative}</p>
      )}
    </div>
  );
}
