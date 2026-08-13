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
            className={`flex-1 truncate px-2 py-1.5 font-mono text-[11px] ${
              p.patientId === patient.patientId
                ? "bg-ink font-semibold text-paper"
                : "text-ink-soft hover:bg-line/40"
            }`}
          >
            {p.displayName}
          </button>
        ))}
      </div>

      <div className="px-4 py-2.5">
        <p className="font-display text-lg leading-tight">
          {patient.displayName}
          <span className="ml-3 font-mono text-[11px] text-ink-soft">
            MRN {patient.mrn} · {patient.age} {patient.sex}
          </span>
        </p>
        <p className="mt-0.5 text-[12px] text-ink-soft">{patient.indication}</p>

        {patient.results.length === 0 ? (
          <p className="mt-2 font-mono text-[11px] text-amber">No genotype on file.</p>
        ) : (
          <>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {patient.results.map((r) => (
                <span
                  key={r.gene}
                  className="border border-line bg-paper px-2 py-0.5 font-mono text-[11px]"
                >
                  <span className="font-semibold">{r.gene}</span> {r.diplotype}{" "}
                  {/* display name only; diplotype already shown covers HLA-style null phenotypes */}
                  {r.phenotype && <span className="text-accent-deep">· {r.phenotype}</span>}
                </span>
              ))}
            </div>
            <p className="mt-1.5 font-mono text-[10px] text-ink-soft">
              {/* provenance line, verbatim from patients.json `source` */}
              {[...new Set(patient.results.map((r) => r.source))].join(" · ")}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
