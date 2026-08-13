/**
 * Two-pane shell. LEFT is Fable's, RIGHT is Sol's. The ownership split and the
 * visual split are the same line -- see .sol/prompts/_context.md.
 *
 * Fable: replace the left placeholder with components/prescribe/.
 * Sol:   export <LedgerPane /> from components/ledger/index.tsx; it drops in here.
 *
 * Target 1280x720 with NO scrolling on either pane during the demo.
 */
export default function Home() {
  return (
    <main className="flex h-dvh flex-col">
      <div className="border-b border-line bg-paper-raised px-6 py-2 font-mono text-xs tracking-wide text-ink-soft">
        SYNTHETIC DATA — no real patient information
      </div>

      <div className="grid flex-1 grid-cols-[55fr_45fr] overflow-hidden">
        <section className="overflow-hidden border-r border-line p-6">
          <h1 className="font-mono text-xs tracking-[0.2em] text-ink-soft">PRESCRIBE</h1>
          <p className="mt-8 text-ink-soft">components/prescribe/ — Fable</p>
        </section>

        <section className="overflow-hidden bg-void p-6 text-paper">
          <h1 className="font-mono text-xs tracking-[0.2em] opacity-60">AUDIT LEDGER</h1>
          <p className="mt-8 opacity-60">components/ledger/ — Sol</p>
        </section>
      </div>
    </main>
  );
}
