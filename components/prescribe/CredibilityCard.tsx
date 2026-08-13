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

export function CredibilityCard({ credibility }: { credibility: Credibility }) {
  return (
    <div className="border border-line bg-paper-raised px-3 py-1">
      {/* R-19: label and context share one line — both render in full, the card
          just stopped spending a second line on the pair. */}
      <p className="font-mono text-[10px] uppercase leading-tight tracking-[0.1em] text-ink-soft">
        FDA credibility assessment
        <span className="ml-1.5 normal-case tracking-normal">
          context of use: {credibility.contextOfUse}
        </span>
      </p>

      <div className="mt-1.5 flex items-start gap-4">
        <table className="shrink-0 border-collapse font-mono text-[10px] leading-tight">
          <thead>
            <tr>
              <th />
              <th className="px-2 pb-0.5 font-normal text-ink-soft">cons. low</th>
              <th className="px-2 pb-0.5 font-normal text-ink-soft">cons. high</th>
            </tr>
          </thead>
          <tbody>
            {[0, 1].map((row) => (
              <tr key={row}>
                <td className="pr-2 text-right text-ink-soft">
                  {row === 0 ? "infl. low" : "infl. high"}
                </td>
                {[0, 1].map((col) => {
                  const cell = CELLS[row * 2 + col];
                  const lit = cell.control === credibility.requiredControl;
                  return (
                    <td
                      key={col}
                      className={`border border-line px-2 py-0.5 text-center ${
                        lit
                          ? cell.control === "human-signature"
                            ? "bg-accent font-semibold text-paper-raised"
                            : "bg-ink font-semibold text-paper"
                          : "text-ink-soft"
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

        <div className="min-w-0 text-[11px] leading-snug">
          <p className="font-mono">
            model influence: <span className="font-semibold">{credibility.modelInfluence}</span> ·
            decision consequence:{" "}
            <span className="font-semibold">{credibility.decisionConsequence}</span> · risk:{" "}
            <span className="font-semibold">{credibility.risk}</span>
          </p>
          <p className="mt-0.5 font-mono">
            Required control:{" "}
            <span
              className={`font-semibold ${
                credibility.requiredControl === "human-signature" ? "text-accent-deep" : ""
              }`}
            >
              {credibility.requiredControl}
            </span>
          </p>
        </div>
      </div>

      {/* R-19: the rationale renders in full, but across the WHOLE card instead of
          in the narrow column beside the grid — same words, ~40px fewer. */}
      <p className="mt-0.5 text-[11px] leading-tight text-ink-soft">{credibility.rationale}</p>
    </div>
  );
}
