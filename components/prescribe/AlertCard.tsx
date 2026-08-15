"use client";

/**
 * The outcome renderer — the demo. Four states, one component:
 *
 *   critical  -> full-pane red card. Unmissable at distance.
 *   caution   -> amber card, same structure, smaller.
 *   no alert  -> ONE quiet line, never a card — and WHICH line depends on
 *                response.genesAssessed. Green ONLY when every gene CPIC
 *                associates with this drug was actually assessed (result on
 *                file, lookup matched); any relevant gene without that is an
 *                amber unknown naming the gene. Absence of a result is never
 *                evidence of safety (phase6 fix round, severity-1 finding:
 *                pt_reyes + capecitabine rendered green citing CYP2D6, a gene
 *                irrelevant to the drug, with no DPYD result on file).
 *
 * The green line asserts NO clinical conclusion in the app's own words — it
 * states what was checked and what the engine did ("assessed", "no CPIC alert
 * raised"), which are procedural facts, checkable against the response.
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
  // phase6: the clear line rises to step-0 serif in --seal above a hairline,
  // per the design import's clear state — composed, not merely small. The two
  // honest-absence lines stay mono step--1: they are not clearances. Motion is
  // OFF here (design notes: "Only the ledger moves").
  if (!alert) {
    if (!resolution.matched) {
      return (
        <p className="py-1 font-mono text-sm text-ink-soft">
          No CPIC guideline found for &ldquo;{response.order.drugRaw}&rdquo; — no
          pharmacogenomic check performed.
        </p>
      );
    }
    if (patient.results.length === 0) {
      return (
        <p className="py-1 font-mono text-sm text-amber">
          No genotype on file — pharmacogenomic screening did not run.
        </p>
      );
    }

    // Which of THIS DRUG's genes were assessed, carried on the response by
    // /api/prescribe (assessGenes over the CPIC index — never re-derived
    // here). Genes the patient carries that are irrelevant to the drug are
    // not in this list and are deliberately not cited on this order.
    const genes = response.genesAssessed ?? [];
    const notAssessed = genes.filter((g) => !g.assessed);

    // Any relevant gene without a matched result is an UNKNOWN, not a
    // clearance — same honest-absence treatment as the two lines above, and
    // visually nothing like the green state (mono amber vs serif seal).
    // A response with no gene facts at all falls in here too: a clearance is
    // only ever rendered off positive evidence of assessment.
    if (genes.length === 0 || notAssessed.length > 0) {
      const missing = notAssessed.map((g) =>
        g.resultOnFile
          ? `${g.gene} result on file matched no CPIC row`
          : `${g.gene} not assessed — no result on file`,
      );
      return (
        <p className="py-1 font-mono text-sm text-amber">
          {missing.length > 0 ? missing.join("; ") : "Gene coverage unknown"}. Pharmacogenomic
          screening incomplete for {response.order.drugName}.
        </p>
      );
    }

    // Every relevant gene assessed, none raised an alert. Say what was checked
    // and what was found — never a clinical conclusion in our own words.
    return (
      <div className="mt-4 border-t border-line pt-6">
        <p className="font-display text-base text-seal">
          {/* phenotype is the display name (patients.json); diplotype fallback covers HLA-style null phenotypes */}
          ✓ {genes.map((g) => `${g.gene} assessed — ${g.phenotype ?? g.diplotype}`).join(" · ")}.
          No CPIC alert raised for {response.order.drugName}.
        </p>
      </div>
    );
  }

  const critical = alert.severity === "critical";

  // ---- critical: the alert owns the whole prescribing pane. The vermilion
  // field itself is painted by app/page.tsx (absolute inset-0, so it reaches
  // the pane edges the way a flow child cannot); this branch is the content
  // that sits on it. Patient card and order form stay mounted behind, dimmed.
  if (critical) {
    return (
      <div className="flex min-h-0 flex-col px-3 text-ink">
        {/* D1: Fraunces, not mono — the one huge red thing in the product
            (design import; mockup line 79). Appears instantly: only the ledger moves. */}
        <p className="font-display text-3xl font-semibold tracking-tight text-accent">
          ⛔ DO NOT PRESCRIBE
        </p>

        <p className="mt-4 font-mono text-sm uppercase tracking-[0.18em] text-ink">
          {alert.gene} · {alert.phenotype ?? alert.diplotype} · {alert.drugName}
        </p>

        {/* VERBATIM from data/cpic/index.json — THE hero line. 40px of air above
            and below, measure capped near 60ch (at step-1 the ~624px pane content
            width is the real cap — design-notes deviation 1), nothing beside it.
            text-lg is --step-1: the read-from-twenty-feet size, NOT negotiable for
            height — R-19 names CoverageLine clause text as the reserve lever, never this. */}
        <blockquote className="my-10 max-w-[60ch] text-pretty font-display text-lg leading-normal">
          &ldquo;{alert.recommendation}&rdquo;
        </blockquote>

        {/* ONE row: CPIC's badge, its classification, and — only when the FDA has
            published an association for this exact (gene, drug) — the FDA badge
            INLINE beside them. ABSENCE IS NOT EVIDENCE: no association renders
            nothing here, never "not FDA-labeled" and never a greyed-out pill.
            Plain mono per the mockup — the old chip border (paper-raised/60) was
            invisible on the paper field it now sits on. */}
        <p className="flex flex-wrap items-center gap-2 font-mono text-sm uppercase tracking-[0.16em] text-ink-soft">
          {alert.cpicLevelA && <span className="font-semibold text-ink">CPIC LEVEL A</span>}
          {alert.classification && <span>{alert.classification} recommendation</span>}
          {alert.fdaLabeled && (
            <button
              type="button"
              onClick={onWhy}
              title="FDA Table of Pharmacogenetic Associations — open the verbatim entry"
              className="font-semibold text-ink underline decoration-line decoration-dashed underline-offset-4 hover:decoration-ink"
            >
              FDA-labeled ⓘ
            </button>
          )}
        </p>

        {alert.implication && (
          <p className="mt-2 max-w-[60ch] text-pretty text-base leading-relaxed text-ink-soft">
            {alert.implication}
          </p>
        )}

        {/* Equal weight, neither primary — the import's ONE button shape:
            1px ink border, Fraunces at step-0, invert on hover. */}
        <div className="mt-4 flex items-center gap-4">
          <button
            onClick={onWhy}
            className="border border-ink px-6 py-1.5 font-display text-base hover:bg-ink hover:text-paper-raised"
          >
            Why this?
          </button>
          <button
            onClick={onOverride}
            disabled={recorded !== null}
            className="border border-ink px-6 py-1.5 font-display text-base enabled:hover:bg-ink enabled:hover:text-paper-raised disabled:opacity-50"
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

  // ---- caution: the same hierarchy in --amber, NOT full-pane. Design-notes
  // deviation 3: amber HAIRLINES above and below, never a 4px rule (that means
  // broken chain) and no fill. Deviation 2: the headline is step-1, not step-3 —
  // at a blur exactly one thing in the product is huge and red. The headline is
  // a fixed UI label, NEVER a paraphrase of the recommendation (the mockup's
  // derived headline would be a fabricated clinical summary — not taken).
  return (
    <div className="border-y border-amber py-4 text-ink">
      <p className="font-mono text-sm uppercase tracking-[0.18em] text-amber">
        {alert.gene} · {alert.phenotype ?? alert.diplotype} · {alert.drugName}
      </p>

      <p className="mt-1 font-display text-lg font-semibold text-amber">
        REVIEW BEFORE PRESCRIBING
      </p>

      {/* VERBATIM from data/cpic/index.json — surrounding quotes are chrome, the
          string is untouched. step-0 here: the caution quote sits one step under
          the critical hero (import mapping, B -> step-0). Caution shares the
          pane with the chart in flow, so its rhythm is the compact half-steps —
      the 24px ceremony belongs to the critical takeover alone (R-19). */}
      <blockquote className="mt-2 max-w-[60ch] text-pretty font-display text-base leading-snug">
        &ldquo;{alert.recommendation}&rdquo;
      </blockquote>

      {/* Same one-row badge contract as the critical branch (see above):
          FDA badge inline, absence renders nothing. */}
      <p className="mt-1.5 flex flex-wrap items-center gap-2 font-mono text-sm uppercase tracking-[0.06em] text-ink-soft">
        {alert.cpicLevelA && <span className="font-semibold text-ink">CPIC LEVEL A</span>}
        {alert.classification && <span>{alert.classification} recommendation</span>}
        {alert.fdaLabeled && (
          <button
            type="button"
            onClick={onWhy}
            title="FDA Table of Pharmacogenetic Associations — open the verbatim entry"
            className="font-semibold text-ink underline decoration-line decoration-dashed underline-offset-4 hover:decoration-ink"
          >
            FDA-labeled ⓘ
          </button>
        )}
      </p>

      {alert.implication && (
        <p className="mt-1.5 text-sm leading-snug text-ink-soft">{alert.implication}</p>
      )}

      <div className="mt-2 flex items-center gap-4">
        <button
          onClick={onWhy}
          className="border border-ink px-6 py-1 font-display text-base hover:bg-ink hover:text-paper-raised"
        >
          Why this?
        </button>
        <button
          onClick={onOverride}
          disabled={recorded !== null}
          className="border border-ink px-6 py-1 font-display text-base enabled:hover:bg-ink enabled:hover:text-paper-raised disabled:opacity-50"
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
