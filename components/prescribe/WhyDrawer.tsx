"use client";

/**
 * The evidence view. Everything in here is the Alert's own fields, rendered
 * verbatim — this must look like evidence, not a tooltip. The last line is
 * the whole product: `sourceUrl` is the exact CPIC API row the alert came
 * from, rendered AS THE VALUE ON THE ALERT — never a reconstructed URL.
 */
import type { Alert } from "@/lib/contracts";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">{label}</p>
      <div className="mt-0.5 text-[13px] leading-snug">{children}</div>
    </div>
  );
}

export function WhyDrawer({ alert, onClose }: { alert: Alert; onClose: () => void }) {
  return (
    <div className="slide-in absolute inset-0 z-20 flex flex-col overflow-hidden border-r border-line bg-paper-raised shadow-2xl">
      <div className="flex items-start justify-between border-b border-line px-5 py-3">
        <div>
          <p className="font-mono text-[10px] tracking-[0.2em] text-ink-soft">EVIDENCE</p>
          <h2 className="font-display text-lg">
            {alert.gene} · {alert.phenotype ?? alert.diplotype} · {alert.drugName}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="border border-line px-3 py-1.5 font-mono text-[11px] text-ink-soft hover:border-ink hover:text-ink"
        >
          Close
        </button>
      </div>

      {/* internal scroll only if a long CPIC string demands it; the pane itself never scrolls */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
        {/* VERBATIM from data/cpic/index.json — text-lg resolves to --step-1, the same
            step the recommendation carries on the card (phase5 stage 1). */}
        <blockquote className="mt-3 border-l-2 border-accent pl-3 font-display text-lg leading-snug">
          &ldquo;{alert.recommendation}&rdquo;
        </blockquote>

        <p className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[11px]">
          {alert.cpicLevelA && (
            <span className="border border-accent-deep px-1.5 py-0.5 font-semibold text-accent-deep">
              CPIC LEVEL A
            </span>
          )}
          {alert.classification && <span>{alert.classification} recommendation</span>}
          {alert.population && <span className="text-ink-soft">population: {alert.population}</span>}
        </p>

        {alert.implication && <Field label="Implication">{alert.implication}</Field>}
        {alert.comments && <Field label="Comments">{alert.comments}</Field>}

        {/* The FDA badge expands HERE — the drawer overlays the pane, so the
            expansion costs the card no height (R-19).
            SCRAPED, not cached-and-verified like CPIC: dashed rule and its own
            label, so it can never read as verified content (_context.md).
            Every string below is verbatim cell text from data/fda-pgx.json, and
            source/retrieval/route are the FILE's own fields — nothing here
            asserts how the page was fetched. ABSENCE IS NOT EVIDENCE: when
            fdaLabeled is null this whole block is absent, with no note in its
            place. */}
        {alert.fdaLabeled && (
          <div className="mt-3 border border-dashed border-line px-3 py-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
              FDA-labeled · scraped source
            </p>
            <p className="mt-0.5 font-mono text-[11px]">
              {alert.fdaLabeled.gene} · {alert.fdaLabeled.drug}
            </p>
            {alert.fdaLabeled.rows.map((row) => (
              <div key={`${row.section}:${row.affected_subgroups}`} className="mt-1.5">
                <p className="font-mono text-[10px] text-ink-soft">
                  section {row.section} · affected subgroups: {row.affected_subgroups}
                </p>
                <p className="mt-0.5 text-[12px] leading-snug">{row.description}</p>
              </div>
            ))}
            <a
              href={alert.fdaLabeled.source_url}
              target="_blank"
              rel="noreferrer"
              className="mt-1.5 block break-all font-mono text-[10px] text-ink-soft underline decoration-line underline-offset-2 hover:text-ink"
            >
              {alert.fdaLabeled.source_url}
            </a>
            <p className="font-mono text-[10px] text-ink-soft">
              retrieved {alert.fdaLabeled.retrieved_at} · via {alert.fdaLabeled.via}
            </p>
          </div>
        )}

        {alert.guidelineName && (
          <Field label="Guideline">
            {alert.guidelineUrl ? (
              <a
                href={alert.guidelineUrl}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-line underline-offset-2 hover:decoration-ink"
              >
                {alert.guidelineName}
              </a>
            ) : (
              alert.guidelineName
            )}
          </Field>
        )}

        {alert.citations.length > 0 && (
          <Field label="Citations">
            <ul className="space-y-1">
              {alert.citations.map((c) => (
                <li key={c.pmid}>
                  <a
                    href={`https://pubmed.ncbi.nlm.nih.gov/${c.pmid}/`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline decoration-line underline-offset-2 hover:decoration-ink"
                  >
                    <span className="font-mono text-[11px]">PMID {c.pmid}</span> · {c.title} ·{" "}
                    {c.year}
                  </a>
                </li>
              ))}
            </ul>
          </Field>
        )}

        <Field label="source record">
          {/* the exact CPIC API row this alert came from — the value itself, never rebuilt */}
          <a
            href={alert.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="break-all font-mono text-[11px] text-ink-soft underline decoration-line underline-offset-2 hover:text-ink"
          >
            {alert.sourceUrl}
          </a>
        </Field>
      </div>
    </div>
  );
}
