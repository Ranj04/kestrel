/**
 * /pipeline — a SEPARATE route, deliberately not on the prescribing screen.
 *
 * The demo screen is frozen by phase5 and must stay two panes with no chrome;
 * this is pipeline intelligence, not clinical evidence, so mixing it into the
 * alert path would be exactly the "scraped text in the clinical path" the
 * standing constraint forbids.
 *
 * Server component. Reads the cached Convoke capture. There is no runtime call
 * to Convoke, per the same cache-once rule as CPIC and FDA.
 */
import convoke from "@/data/convoke-pipeline.json";

export const metadata = { title: "Kestrel · Pipeline coverage" };

export default function PipelinePage() {
  const { counts } = convoke.join;

  return (
    <main className="min-h-screen bg-paper px-10 py-10 text-ink">
      <div className="mx-auto max-w-[68rem]">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-soft">
          Kestrel · pipeline coverage
        </p>

        <h1 className="mt-6 font-display text-3xl leading-none tracking-tight">
          {counts.covered} of {counts.total}
        </h1>

        <p className="mt-4 max-w-[60ch] text-lg leading-relaxed">
          Active Phase&nbsp;3 programs on the Convoke Program Tracker that have an
          exact-name match to a CPIC Level&nbsp;A drug entry in Kestrel&apos;s evidence
          cache.
        </p>

        <p className="mt-6 max-w-[60ch] text-base leading-relaxed text-ink-soft">
          Kestrel&apos;s cache covers {convoke.join.cpic_drug_count} drugs across 19 genes.
          The pipeline does not wait for the guideline. That is the reason every
          authorization here is bound to the evidence snapshot it was signed against —
          a guideline that lands after the prescription still has to be reconcilable
          with what was known at signing time.
        </p>

        <section className="mt-10 border-t border-line pt-6">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-soft">
            Has a guideline today
          </p>
          {convoke.covered.map((c) => (
            <p key={c.program} className="mt-3 text-lg">
              <span className="font-display">{c.program}</span>
              <span className="ml-3 font-mono text-xs uppercase tracking-wider text-seal">
                CPIC · {c.cpicGenes.join(", ")}
              </span>
            </p>
          ))}
        </section>

        <section className="mt-10 border-t border-line pt-6">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-soft">
            No exact match · {counts.uncovered} programs
          </p>
          <p className="mt-4 columns-4 gap-6 font-mono text-xs leading-relaxed text-ink-soft">
            {convoke.uncovered.join(" · ")}
          </p>
        </section>

        <section className="mt-10 border-t border-line pt-6 font-mono text-xs leading-relaxed text-ink-soft">
          <p>
            Source: {convoke.source} · filters {JSON.stringify(convoke.filters_applied)} ·
            retrieved {convoke.retrieved_at}
          </p>
          <p className="mt-3 max-w-[80ch] text-ink">
            <span className="uppercase tracking-wider">Lower bound, not a clinical claim.</span>{" "}
            {convoke.join.LIMITATION}
          </p>
        </section>
      </div>
    </main>
  );
}
