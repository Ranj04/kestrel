"use client";

/**
 * The outcome renderer — the demo. Three states, one component:
 *
 *   critical  -> full-pane red card. Unmissable at distance.
 *   caution   -> amber card, same structure, smaller.
 *   no alert  -> ONE quiet line, never a card. Green only when a genotype on
 *                file actually cleared the check; grey/amber for "no genotype"
 *                and "no CPIC match", which are honest absences, not clearances.
 *
 * Every clinical string ({recommendation}, {implication}) renders VERBATIM —
 * no slice, replace, case change, truncation, or ellipsis. A long string grows
 * the card. `phenotype` is what renders; `lookup` (CPIC's activity-score join
 * key, e.g. "0.0") never goes on screen — see _context.md.
 */
import type { LedgerRecord, Patient, PrescribeResponse } from "@/lib/contracts";

export function AlertCard({
  response,
  patient,
  onWhy,
  onOverride,
  recorded,
}: {
  response: PrescribeResponse;
  patient: Patient;
  onWhy: () => void;
  onOverride: () => void;
  /** set once Sol's signature modal has written alert.accepted / alert.overridden */
  recorded: LedgerRecord | null;
}) {
  const { alert, resolution } = response;

  // ---- no alert: one quiet line. The Lindqvist/Okafor contrast on the same
  // drug is what proves the lookup is real, so this line stays understated.
  // phase5 stage 2: QUIETER, not more designed — the left rules came OFF
  // (emphasis removed, never added; the green state's restraint is what makes
  // the red one land), and the sizes snapped onto the scale (12px -> step--1).
  if (!alert) {
    if (!resolution.matched) {
      return (
        <p className="rise py-1 font-mono text-sm text-ink-soft">
          No CPIC guideline found for &ldquo;{response.order.drugRaw}&rdquo; — no
          pharmacogenomic check performed.
        </p>
      );
    }
    if (patient.results.length === 0) {
      return (
        <p className="rise py-1 font-mono text-sm text-amber">
          No genotype on file — pharmacogenomic screening did not run.
        </p>
      );
    }
    return (
      <p className="rise py-1 font-mono text-sm text-seal">
        ✓ No pharmacogenomic contraindication.{" "}
        {/* phenotype is the display name (patients.json); diplotype fallback covers HLA-style null phenotypes */}
        {patient.results.map((r) => `${r.gene} ${r.phenotype ?? r.diplotype}`).join(" · ")}.
      </p>
    );
  }

  const critical = alert.severity === "critical";

  // ---- critical: the alert owns the whole prescribing pane. The vermilion
  // field itself is painted by app/page.tsx (absolute inset-0, so it reaches
  // the pane edges the way a flow child cannot); this branch is the content
  // that sits on it. Patient card and order form stay mounted behind, dimmed.
  if (critical) {
    return (
      <div className="rise flex min-h-0 flex-col px-3 pt-2 text-paper-raised">
        <p className="font-mono text-3xl font-semibold tracking-tight">⛔ DO NOT PRESCRIBE</p>

        <p className="mt-1 font-mono text-sm uppercase tracking-[0.2em] text-paper-raised/85">
          {alert.gene} · {alert.phenotype ?? alert.diplotype} · {alert.drugName}
        </p>

        {/* VERBATIM from data/cpic/index.json — THE hero line. 40px of air above
            and below, measure capped near 60ch, nothing beside it. text-lg is
            --step-1: the read-from-twenty-feet size, NOT negotiable for height —
            R-19 names CoverageLine clause text as the reserve lever, never this. */}
        <blockquote className="my-10 max-w-[60ch] font-display text-lg leading-normal">
          &ldquo;{alert.recommendation}&rdquo;
        </blockquote>

        {/* ONE row: CPIC's badge, its classification, and — only when the FDA has
            published an association for this exact (gene, drug) — the FDA badge
            INLINE beside them. ABSENCE IS NOT EVIDENCE: no association renders
            nothing here, never "not FDA-labeled" and never a greyed-out pill. */}
        <p className="flex flex-wrap items-center gap-2 font-mono text-sm">
          {alert.cpicLevelA && (
            <span className="border border-paper-raised/60 px-1.5 py-0.5 font-semibold">
              CPIC LEVEL A
            </span>
          )}
          {alert.classification && <span>{alert.classification} recommendation</span>}
          {alert.fdaLabeled && (
            <button
              type="button"
              onClick={onWhy}
              title="FDA Table of Pharmacogenetic Associations — open the verbatim entry"
              className="border border-dashed border-paper-raised/60 px-1.5 py-0.5 font-semibold hover:bg-paper-raised/10"
            >
              FDA-labeled ⓘ
            </button>
          )}
        </p>

        {alert.implication && (
          <p className="mt-1 max-w-[70ch] text-sm leading-snug text-paper-raised/85">
            {alert.implication}
          </p>
        )}

        {/* Equal weight, neither primary — two hairline ghosts on the field. */}
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={onWhy}
            className="border border-paper-raised/70 px-4 py-1.5 font-mono text-sm hover:bg-paper-raised/10"
          >
            Why this?
          </button>
          <button
            onClick={onOverride}
            disabled={recorded !== null}
            className="border border-paper-raised/70 px-4 py-1.5 font-mono text-sm hover:bg-paper-raised/10 disabled:opacity-50"
          >
            {/* human-signature gates the dismissal behind Sol's 21 CFR 11 modal — never a plain dismiss */}
            Override and sign
          </button>
          {recorded && (
            <span className="font-mono text-xs opacity-90">
              {recorded.type} recorded — seq {recorded.seq}
            </span>
          )}
        </div>
      </div>
    );
  }

  // ---- caution: the same hierarchy at --step-1, in --amber, NOT full-pane.
  return (
    <div className="rise border border-amber bg-amber/10 text-ink">
      <div className="px-4 py-2.5">
        <p className="font-mono text-lg font-semibold tracking-[0.06em] text-amber">
          ⚠ REVIEW BEFORE PRESCRIBING
        </p>

        <p className="mt-1 font-mono text-sm uppercase tracking-[0.2em] text-ink-soft">
          {alert.gene} · {alert.phenotype ?? alert.diplotype} · {alert.drugName}
        </p>

        {/* VERBATIM from data/cpic/index.json — surrounding quotes are chrome, the
            string is untouched. text-lg resolves to --step-1 (phase5 stage 1). */}
        <blockquote className="mt-2.5 max-w-[60ch] font-display text-lg leading-snug">
          &ldquo;{alert.recommendation}&rdquo;
        </blockquote>

        {/* Same one-row badge contract as the critical branch (see above):
            FDA badge inline, absence renders nothing. */}
        <p className="mt-2 flex flex-wrap items-center gap-2 font-mono text-sm">
          {alert.cpicLevelA && (
            <span className="border border-amber px-1.5 py-0.5 font-semibold text-amber">
              CPIC LEVEL A
            </span>
          )}
          {alert.classification && <span>{alert.classification} recommendation</span>}
          {alert.fdaLabeled && (
            <button
              type="button"
              onClick={onWhy}
              title="FDA Table of Pharmacogenetic Associations — open the verbatim entry"
              className="border border-dashed border-ink/40 px-1.5 py-0.5 font-semibold hover:bg-ink/5"
            >
              FDA-labeled ⓘ
            </button>
          )}
        </p>

        {alert.implication && (
          <p className="mt-2 text-sm leading-snug text-ink-soft">{alert.implication}</p>
        )}

        <div className="mt-2 flex items-center gap-3">
          <button
            onClick={onWhy}
            className="border border-ink/40 px-3 py-1 font-mono text-sm hover:bg-ink/5"
          >
            Why this?
          </button>
          <button
            onClick={onOverride}
            disabled={recorded !== null}
            className="border border-ink/40 px-3 py-1 font-mono text-sm hover:bg-ink/5 disabled:opacity-50"
          >
            {/* human-signature gates the dismissal behind Sol's 21 CFR 11 modal — never a plain dismiss */}
            Override and sign
          </button>
          {recorded && (
            <span className="font-mono text-xs opacity-90">
              {recorded.type} recorded — seq {recorded.seq}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
