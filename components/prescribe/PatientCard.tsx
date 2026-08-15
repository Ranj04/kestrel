"use client";

/**
 * Patient selector + chart header. Every value here is copied from
 * data/patients.json (synthetic, and the file says so). Gene chips render
 * `phenotype` — the human name — never `lookup`, which is CPIC's
 * activity-score join key ("0.0") and means nothing to a clinician.
 */
import type { Patient } from "@/lib/contracts";

export function PatientCard({
  patients,
  selectedId,
  onSelect,
}: {
  patients: Patient[];
  selectedId: string;
  onSelect: (patientId: string) => void;
}) {
  const patient = patients.find((p) => p.patientId === selectedId) ?? patients[0];

  return (
    <div className="border border-line bg-paper-raised">
      <div className="flex border-b border-line">
        {patients.map((p) => (
          <button
            key={p.patientId}
            onClick={() => onSelect(p.patientId)}
            className={`flex-1 truncate px-2 py-1 font-mono text-xs ${
              p.patientId === patient.patientId
                ? "bg-ink font-semibold text-paper"
                : "text-ink-soft hover:bg-line/40"
            }`}
          >
            {p.displayName}
          </button>
        ))}
      </div>

      <div className="px-4 py-2">
        <p className="font-display text-base font-semibold leading-tight">
          {patient.displayName}
          <span className="ml-3 font-mono text-xs font-normal text-ink-soft">
            MRN {patient.mrn} · {patient.age} {patient.sex}
          </span>
        </p>
        {/* patient.meta per the import: mono, uppercase, wide-tracked — an
            uppercase TRANSFORM only; the indication string itself is untouched. */}
        <p className="mt-0.5 font-mono text-xs uppercase tracking-[0.1em] text-ink-soft">
          {patient.indication}
        </p>

        {patient.results.length === 0 ? (
          <p className="mt-2 font-mono text-xs text-amber">No genotype on file.</p>
        ) : (
          <>
            {/* R-19: the provenance rides IN the chip row rather than on its own
                line below it — same string, verbatim, one line of height less. */}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {patient.results.map((r) => (
                <span
                  key={r.gene}
                  className="border border-line bg-paper px-2 py-0.5 font-mono text-xs"
                >
                  <span className="font-semibold">{r.gene}</span> {r.diplotype}{" "}
                  {/* display name only; diplotype already shown covers HLA-style null phenotypes.
                      Weight, not colour: vermilion is reserved for the critical alert and a broken
                      chain (phase5 stage 1) — a chart chip is neither, and a NORMAL metabolizer
                      rendered red would be a false signal. */}
                  {r.phenotype && <span className="font-semibold">· {r.phenotype}</span>}
                </span>
              ))}
              <span className="font-mono text-xs text-ink-soft">
                {/* provenance, verbatim from patients.json `source` */}
                {[...new Set(patient.results.map((r) => r.source))].join(" · ")}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
