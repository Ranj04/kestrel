"use client";

/**
 * FDA draft guidance on AI credibility, rendered as the actual 2x2:
 * risk = model influence x decision consequence, and the lit cell is the
 * required human control. Every value shown is a field of the Credibility
 * object from /api/prescribe (lib/credibility.ts) — nothing is restated.
 *
 * Cell lighting maps `requiredControl` back onto the grid: "auto" is the
 * low/low cell, "human-signature" the high/high cell, and "human-review"
 * lights BOTH review cells — a medium x medium assessment collapses onto the
 * review anti-diagonal of a 2x2, and picking one corner would claim an axis
 * value the assessment did not make.
 */
import type { Credibility } from "@/lib/contracts";

const CELLS: { control: Credibility["requiredControl"]; label: string }[] = [
  { control: "auto", label: "auto" },
  { control: "human-review", label: "review" },
  { control: "human-review", label: "review" },
  { control: "human-signature", label: "SIGNATURE" },
];

/**
 * phase6 6c: the conclusion leads, the grid supports. These are DISPLAY LABELS
 * for the `requiredControl` enum (exactly like OrderForm's METHOD_LABEL) —
 * never new content: the enum value itself still renders beside the grid, so
 * every word here is traceable to a field of the response.
 */
const CONTROL_LABEL: Record<Credibility["requiredControl"], string> = {
  auto: "No human control required.",
  "human-review": "Human review required.",
  "human-signature": "Signed human decision required.",
};

export function CredibilityCard({ credibility }: { credibility: Credibility }) {
  const signature = credibility.requiredControl === "human-signature";
  return (
    // phase6 fix round: was a bordered bg-paper-raised box — visually identical
    // to the coverage slip above it, so at quarter-screen the pane's bottom
    // third read as one uniform band. Now a hairline-top open block: coverage
    // keeps the one raised slip, credibility anchors on its serif conclusion.
    <div className="border-t border-line pt-1">
      {/* R-19: label and context share one line — both render in full, the card
          just stopped spending a second line on the pair. */}
      <p className="font-mono text-xs uppercase leading-tight tracking-[0.1em] text-ink-soft">
        FDA credibility assessment
        <span className="ml-1.5 normal-case tracking-normal">
          context of use: {credibility.contextOfUse}
        </span>
      </p>

      {/* THE CONCLUSION — a judge gets the answer without reading a cell.
          step-1 only for the signature case: if the routine states also spoke
          at step-1, the signature case would mean nothing (the same restraint
          argument as the green alert line). The enum value itself sits at the
          row's right, from the response — also what pins this card in ui.test.ts. */}
      <p className="mt-0.5 flex flex-wrap items-baseline justify-between gap-2">
        <span className={`font-display leading-tight ${signature ? "text-lg" : "text-base"}`}>
          {CONTROL_LABEL[credibility.requiredControl]}
        </span>
        <span className="font-mono text-xs text-ink-soft">
          required control{" "}
          {/* phase6 fix round: ink for every control — vermilion appears twice
              in the product (blocking headline, broken chain), never here. */}
          <span className="font-semibold text-ink">{credibility.requiredControl}</span>
        </span>
      </p>
      <p className="font-mono text-xs text-ink-soft">
        {credibility.modelInfluence} model influence · {credibility.decisionConsequence} decision
        consequence · {credibility.risk} risk
      </p>

      {/* the 2x2, demoted to supporting evidence beneath the conclusion */}
      <div className="mt-1 flex items-start gap-4">
        <table className="shrink-0 border-collapse font-mono text-xs leading-tight">
          <thead>
            <tr>
              <th />
              <th className="px-1.5 font-normal text-ink-soft">cons. low</th>
              <th className="px-1.5 font-normal text-ink-soft">cons. high</th>
            </tr>
          </thead>
          <tbody>
            {[0, 1].map((row) => (
              <tr key={row}>
                <td className="pr-1.5 text-right text-ink-soft">
                  {row === 0 ? "infl. low" : "infl. high"}
                </td>
                {[0, 1].map((col) => {
                  const cell = CELLS[row * 2 + col];
                  const lit = cell.control === credibility.requiredControl;
                  return (
                    <td
                      key={col}
                      /* phase6 fix round: the lit SIGNATURE cell was bg-accent —
                         a second vermilion element competing with DO NOT
                         PRESCRIBE at a squint (design notes: vermilion twice
                         only). One lit-cell treatment now; the ► SIGNATURE ◄
                         literal still distinguishes it, and stays test-pinned. */
                      className={`border border-line px-1.5 text-center ${
                        lit ? "bg-ink font-semibold text-paper" : "text-ink-soft"
                      }`}
                    >
                      {lit && cell.control === "human-signature" ? "► SIGNATURE ◄" : cell.label}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {/* R-19: the rationale renders in full beside the demoted grid. */}
        <p className="min-w-0 text-xs leading-tight text-ink-soft">{credibility.rationale}</p>
      </div>
    </div>
  );
}
