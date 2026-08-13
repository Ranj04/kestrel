"use client";

/**
 * Two-pane shell. LEFT is Fable's (components/prescribe/), RIGHT is Sol's
 * <LedgerPane /> — imported, never reimplemented. Sol's pane polls /api/ledger
 * every 1s, so ledger-affecting actions on the left show up on the right with
 * no event bus and no key-bumping.
 *
 * Target: 1280x720, NO scrolling on either pane during the demo.
 */
import { useState } from "react";
import { LedgerPane, SignatureModal } from "@/components/ledger";
import { AlertCard } from "@/components/prescribe/AlertCard";
import { CoverageLine } from "@/components/prescribe/CoverageLine";
import { CredibilityCard } from "@/components/prescribe/CredibilityCard";
import { OrderForm } from "@/components/prescribe/OrderForm";
import { PatientCard } from "@/components/prescribe/PatientCard";
import { WhyDrawer } from "@/components/prescribe/WhyDrawer";
import patientFile from "@/data/patients.json";
import type { Actor, LedgerRecord, Patient, PrescribeResponse } from "@/lib/contracts";

const PATIENTS: Patient[] = patientFile.patients;

/** DEMO SHIM — mirrors DEMO_ACTORS in app/api/prescribe/route.ts. */
const PRESCRIBER: Actor = { id: "dr_chen", name: "Dr. Chen", role: "Attending, Oncology" };

export default function Home() {
  const [patientId, setPatientId] = useState(PATIENTS[0].patientId);
  const [response, setResponse] = useState<PrescribeResponse | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [whyOpen, setWhyOpen] = useState(false);
  const [signOpen, setSignOpen] = useState(false);
  const [recorded, setRecorded] = useState<LedgerRecord | null>(null);

  const patient = PATIENTS.find((p) => p.patientId === patientId) ?? PATIENTS[0];

  function selectPatient(id: string) {
    // A response belongs to exactly one patient — switching MUST clear it, or
    // Okafor's red card could sit on screen over Lindqvist's chart.
    setPatientId(id);
    setResponse(null);
    setRecorded(null);
    setError(null);
    setWhyOpen(false);
    setSignOpen(false);
  }

  async function placeOrder(drugRaw: string) {
    setPending(true);
    setError(null);
    setWhyOpen(false);
    setRecorded(null);
    try {
      const res = await fetch("/api/prescribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ patientId, drugRaw, orderedBy: PRESCRIBER.id }),
      });
      const body = (await res.json()) as PrescribeResponse & { error?: string };
      if (!res.ok || body.error) throw new Error(body.error ?? "prescribe failed");
      setResponse(body);
    } catch (e) {
      setResponse(null);
      setError(e instanceof Error ? e.message : "prescribe failed");
    } finally {
      setPending(false);
    }
  }

  // Coverage sits on PrescribeResponse as well as on Alert: two demo patients
  // have NO alert and their determination must still render. Under, never above.
  const coverage = response ? (response.alert ? response.alert.coverage : response.coverage) : null;

  // phase5 stage 2a: a critical alert owns the ENTIRE prescribing pane. The
  // vermilion field below is absolute inset-0 (z-10); the patient card rides
  // ABOVE it dimmed (z-20) so its tabs remain the demo's way out of the state,
  // the order form stays mounted BENEATH it — visibly blocked; and the alert
  // content (z-20) reclaims the covered form's flow height via -mt-14.
  const critical = response?.alert?.severity === "critical";

  return (
    <main className="flex h-dvh flex-col">
      <div className="border-b border-line bg-paper-raised px-6 py-1 text-center font-mono text-[11px] tracking-wide text-ink-soft">
        SYNTHETIC DATA — no real patient information
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[55fr_45fr]">
        {/* ------------------------------------------------ left: prescribe */}
        {/* R-19: the prescriber pane overflowed 1280x720 by 150px with Okafor's card up.
            Vertical rhythm tightened here and in every prescribe component; the
            recommendation blockquote (19px) was deliberately NOT shrunk. */}
        <section className="relative flex min-h-0 flex-col gap-1.5 overflow-hidden border-r border-line px-5 py-2.5">
          <div className="flex items-baseline justify-between leading-none">
            <h1 className="font-mono text-[10px] tracking-[0.2em] text-ink-soft">PRESCRIBE</h1>
            <span className="font-display text-[12px] text-ink-soft">
              Kestrel · pharmacogenomic check
            </span>
          </div>

          {/* recedes behind the field when critical — dimmed, NOT unmounted; kept
              above the field (z-20) so the patient tabs stay clickable: switching
              patients is the only exit from a critical state and must survive it. */}
          <div className={critical ? "relative z-20 opacity-40" : undefined}>
            <PatientCard patients={PATIENTS} selectedId={patientId} onSelect={selectPatient} />
          </div>

          {/* recedes BENEATH the field when critical: still mounted, still dimmed,
              physically unreachable — the software blocking the order is the point. */}
          <div className={critical ? "opacity-40" : undefined}>
            <OrderForm onSubmit={(raw) => void placeOrder(raw)} pending={pending} response={response} />
          </div>

          {/* amber, not vermilion: a fetch failure is a caution, and --accent is reserved
              for the critical alert and a broken chain (phase5 stage 1). */}
          {error && <p className="font-mono text-[12px] text-amber">{error}</p>}

          {/* the vermilion field: edge to edge, instant — no easing, nothing appended
              below a form. AlertCard's critical branch is the content that sits on it. */}
          {critical && <div aria-hidden className="absolute inset-0 z-10 bg-accent/95" />}

          {response ? (
            <div
              className={
                critical
                  ? "relative z-20 -mt-14 flex min-h-0 flex-1 flex-col"
                  : "flex min-h-0 flex-col gap-1.5"
              }
            >
              <AlertCard
                response={response}
                patient={patient}
                onWhy={() => setWhyOpen(true)}
                onOverride={() => setSignOpen(true)}
                recorded={recorded}
              />
              {critical ? (
                // Coverage stays UNDER the clinical block, by contract. On the
                // field it needs its own paper ground to stay legible.
                <div className="mt-auto flex min-h-0 flex-col gap-1.5 pt-1">
                  {coverage && (
                    <div className="border border-line bg-paper-raised px-4 py-0.5">
                      <CoverageLine coverage={coverage} />
                    </div>
                  )}
                  <CredibilityCard credibility={response.credibility} />
                </div>
              ) : (
                <>
                  {coverage && <CoverageLine coverage={coverage} />}
                  <CredibilityCard credibility={response.credibility} />
                </>
              )}
            </div>
          ) : (
            !error && (
              <p className="font-mono text-[12px] text-ink-soft/70">
                Select a patient and place an order to run the check.
              </p>
            )
          )}

          {whyOpen && response?.alert && (
            <WhyDrawer alert={response.alert} onClose={() => setWhyOpen(false)} />
          )}
        </section>

        {/* ------------------------------------------------ right: Sol's ledger */}
        <section className="min-h-0 overflow-hidden">
          <LedgerPane />
        </section>
      </div>

      {signOpen && response?.alert && (
        <SignatureModal
          alert={response.alert}
          actor={PRESCRIBER}
          onClose={() => setSignOpen(false)}
          onRecorded={(record) => setRecorded(record)}
        />
      )}
    </main>
  );
}
