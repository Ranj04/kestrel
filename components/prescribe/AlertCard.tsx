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
  if (!alert) {
    if (!resolution.matched) {
      return (
        <p className="rise border-l-2 border-line py-1 pl-3 font-mono text-[12px] text-ink-soft">
          No CPIC guideline found for &ldquo;{response.order.drugRaw}&rdquo; — no
          pharmacogenomic check performed.
        </p>
      );
    }
    if (patient.results.length === 0) {
      return (
        <p className="rise border-l-2 border-amber py-1 pl-3 font-mono text-[12px] text-amber">
          No genotype on file — pharmacogenomic screening did not run.
        </p>
      );
    }
    return (
      <p className="rise border-l-2 border-seal py-1 pl-3 font-mono text-[12px] text-seal">
        ✓ No pharmacogenomic contraindication.{" "}
        {/* phenotype is the display name (patients.json); diplotype fallback covers HLA-style null phenotypes */}
        {patient.results.map((r) => `${r.gene} ${r.phenotype ?? r.diplotype}`).join(" · ")}.
      </p>
    );
  }

  const critical = alert.severity === "critical";

  return (
    <div
      className={
        critical
          ? "rise border-2 border-accent-deep bg-accent text-paper-raised shadow-[0_10px_30px_rgba(168,53,15,0.35)]"
          : "rise border border-amber bg-amber/10 text-ink"
      }
    >
      <div className={critical ? "px-5 py-3" : "px-4 py-2.5"}>
        <p
          className={
            critical
              ? "font-mono text-lg font-semibold tracking-[0.06em]"
              : "font-mono text-sm font-semibold tracking-[0.06em] text-amber"
          }
        >
          {critical ? "⛔ DO NOT PRESCRIBE" : "⚠ REVIEW BEFORE PRESCRIBING"}
        </p>

        <p
          className={`mt-1 font-mono text-[12px] ${critical ? "text-paper-raised/85" : "text-ink-soft"}`}
        >
          {alert.gene} · {alert.phenotype ?? alert.diplotype} · {alert.drugName}
        </p>

        {/* VERBATIM from data/cpic/index.json — surrounding quotes are chrome, the string is
            untouched. 19px is the read-from-twenty-feet size and is NOT negotiable for height:
            everything around it shrank instead (R-19). */}
        <blockquote
          className={`mt-2.5 font-display leading-snug ${critical ? "text-[19px]" : "text-[16px]"}`}
        >
          &ldquo;{alert.recommendation}&rdquo;
        </blockquote>

        {/* ONE row: CPIC's own badge, its classification, and — only when the FDA has
            published an association for this exact (gene, drug) — the FDA badge INLINE
            beside them. It costs no vertical height and it expands into WhyDrawer, which
            overlays. ABSENCE IS NOT EVIDENCE: no association means nothing renders here,
            never "not FDA-labeled" and never a greyed-out pill. */}
        <p className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[11px]">
          {alert.cpicLevelA && (
            <span
              className={
                critical
                  ? "border border-paper-raised/60 px-1.5 py-0.5 font-semibold"
                  : "border border-amber px-1.5 py-0.5 font-semibold text-amber"
              }
            >
              CPIC LEVEL A
            </span>
          )}
          {alert.classification && <span>{alert.classification} recommendation</span>}
          {alert.fdaLabeled && (
            <button
              type="button"
              onClick={onWhy}
              title="FDA Table of Pharmacogenetic Associations — open the verbatim entry"
              className={
                critical
                  ? "border border-dashed border-paper-raised/60 px-1.5 py-0.5 font-semibold hover:bg-paper-raised/10"
                  : "border border-dashed border-ink/40 px-1.5 py-0.5 font-semibold hover:bg-ink/5"
              }
            >
              FDA-labeled ⓘ
            </button>
          )}
        </p>

        {alert.implication && (
          <p
            className={`mt-2 text-[13px] leading-snug ${critical ? "text-paper-raised/90" : "text-ink-soft"}`}
          >
            {alert.implication}
          </p>
        )}

        <div className="mt-2 flex items-center gap-3">
          <button
            onClick={onWhy}
            className={
              critical
                ? "border border-paper-raised/70 px-3 py-1 font-mono text-[12px] hover:bg-paper-raised/10"
                : "border border-ink/40 px-3 py-1 font-mono text-[12px] hover:bg-ink/5"
            }
          >
            Why this?
          </button>
          <button
            onClick={onOverride}
            disabled={recorded !== null}
            className={
              critical
                ? "bg-paper-raised px-3 py-1 font-mono text-[12px] font-semibold text-accent-deep hover:bg-paper disabled:opacity-50"
                : "bg-ink px-3 py-1 font-mono text-[12px] font-semibold text-paper hover:bg-ink/80 disabled:opacity-50"
            }
          >
            {/* human-signature gates the dismissal behind Sol's 21 CFR 11 modal — never a plain dismiss */}
            Override and sign
          </button>
          {recorded && (
            <span className="font-mono text-[11px] opacity-90">
              {recorded.type} recorded — seq {recorded.seq}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
