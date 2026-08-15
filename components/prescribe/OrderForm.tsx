"use client";

/**
 * Free-text order entry. Free text is deliberate: typing a brand name and
 * watching it resolve to the CPIC generic is a two-second proof that
 * something real is happening. The resolution line renders the route's own
 * answer — `drugRaw` exactly as typed, `drugName` exactly as resolved.
 */
import { useState, type FormEvent } from "react";
import type { PrescribeResponse } from "@/lib/contracts";

const METHOD_LABEL: Record<string, string> = {
  exact: "matched exact",
  // G-23: a BRAND_MAP substitution used to render "matched exact" — an
  // undisclosed two-entry demo dictionary is not an exact match and says so.
  "demo-alias": "matched demo alias",
  substring: "matched substring",
  llm: "via model",
};

export function OrderForm({
  onSubmit,
  pending,
  response,
}: {
  onSubmit: (drugRaw: string) => void;
  pending: boolean;
  response: PrescribeResponse | null;
}) {
  const [drugRaw, setDrugRaw] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    if (drugRaw.trim() === "" || pending) return;
    onSubmit(drugRaw);
  }

  return (
    <div>
      <form onSubmit={submit} className="flex items-stretch gap-2">
        <input
          value={drugRaw}
          onChange={(e) => setDrugRaw(e.target.value)}
          placeholder="Xeloda 1250 mg/m2 BID"
          aria-label="Drug order"
          className="min-w-0 flex-1 border border-line bg-paper-raised px-4 py-1.5 font-display text-base outline-none placeholder:text-ink-soft/60 focus:border-ink"
        />
        {/* the import's ONE button shape: 1px ink border, Fraunces step-0,
            invert on hover — no solid primary; nothing on this screen shouts
            except the alert. */}
        <button
          type="submit"
          disabled={pending || drugRaw.trim() === ""}
          className="shrink-0 border border-ink px-6 py-1.5 font-display text-base enabled:hover:bg-ink enabled:hover:text-paper-raised disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Checking…" : "Place order"}
        </button>
      </form>

      {response && (
        <p className="mt-0.5 font-mono text-xs text-ink-soft">
          {response.resolution.matched ? (
            <>
              {response.order.drugRaw} → <span className="font-semibold text-ink">{response.order.drugName}</span>{" "}
              · {METHOD_LABEL[response.resolution.method] ?? response.resolution.method}
            </>
          ) : (
            <>{response.order.drugRaw} → no CPIC match</>
          )}
        </p>
      )}
    </div>
  );
}
