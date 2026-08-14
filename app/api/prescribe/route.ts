/**
 * POST /api/prescribe — { patientId, drugRaw, orderedBy } -> PrescribeResponse.
 *
 * Every step that matters is appended to the ledger BEFORE the response goes
 * out: the order, any model invocation (full provenance), the genotype used,
 * and the alert exactly as raised — citations included, so the exported
 * package reads without the app. If the ledger cannot be written this route
 * fails loudly rather than prescribing off the record.
 *
 * Uses plain Response.json (not NextResponse) so tests can invoke POST()
 * directly under node:test and pin the ledger.append call sites.
 */
import { randomBytes } from "node:crypto";
import type { Actor, Order, PrescribeResponse } from "../../../lib/contracts";
import { assess } from "../../../lib/credibility";
import { append, clausesFor } from "../../../lib/ledger";
import { getPatient } from "../../../lib/pgx";
import { evaluate } from "../../../lib/pgx/evaluate";
import { coverageFor } from "../../../lib/pgx/policy";
import { resolveDrug } from "../../../lib/pgx/resolve";
import { actorFor } from "../../../lib/actors";

// actorFor is imported from lib/actors — ONE declaration (R-18).

// Dose/route are ECHOES of the prescriber's own text (regex extraction), not
// clinical values — clinical strings only ever come from data/cpic/index.json.
function extractDose(raw: string): string | null {
  const m = raw.match(/\d+(?:\.\d+)?\s*(?:mg\/m2|mg|mcg|g|ml)(?:\s*\/\s*m2)?/i);
  return m ? m[0] : null;
}

function extractRoute(raw: string): string | null {
  const m = raw.match(/\b(po|iv|im|sc|subq|oral|topical)\b/i);
  return m ? m[0] : null;
}

export async function POST(req: Request): Promise<Response> {
  let body: { patientId?: unknown; drugRaw?: unknown; orderedBy?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const { patientId, drugRaw, orderedBy } = body;
  if (typeof patientId !== "string" || typeof drugRaw !== "string" || typeof orderedBy !== "string") {
    return Response.json(
      { error: "patientId, drugRaw and orderedBy are required strings" },
      { status: 400 },
    );
  }

  const patient = getPatient(patientId);
  if (!patient) {
    return Response.json({ error: `unknown patient: ${patientId}` }, { status: 404 });
  }

  const actor = actorFor(orderedBy);
  const orderId = "ord_" + randomBytes(4).toString("hex");

  append("order.placed", { orderId, patientId, drugRaw }, actor, clausesFor("order.placed"));

  const resolution = await resolveDrug(drugRaw);
  if (resolution.provenance) {
    // The LLM was consulted (even if its answer was discarded): log it with
    // full provenance — model id, params, exact prompt, raw unedited output.
    append(
      "model.invoked",
      {
        orderId,
        purpose: "drug-name resolution",
        accepted: resolution.method === "llm",
        drugName: resolution.drugName,
      },
      actor,
      clausesFor("model.invoked"),
      resolution.provenance,
    );
  }

  append(
    "genotype.resolved",
    { orderId, patientId, results: patient.results },
    actor,
    clausesFor("genotype.resolved"),
  );

  const drugName = resolution.drugName;
  const order: Order = {
    orderId,
    patientId,
    drugRaw, // exactly what the prescriber typed
    // Unresolved drug: empty string, and resolution.matched=false says why.
    // Not an error — "no CPIC guidance found" is an honest, renderable state.
    drugName: drugName ?? "",
    dose: extractDose(drugRaw),
    route: extractRoute(drugRaw),
    orderedBy,
    orderedAt: new Date().toISOString(),
  };

  const alert = drugName ? evaluate(patient, drugName, orderId) : null;
  if (alert) {
    // The FULL alert object, citations and snapshot included — the exported
    // inspection package must be readable without the app.
    append("alert.raised", alert, actor, clausesFor("alert.raised"));
  }

  const response: PrescribeResponse = {
    order,
    alert,
    // Also at top level (contracts.ts): two demo patients have NO alert and
    // their coverage determination must still render.
    coverage: drugName ? coverageFor(patient, drugName) : null,
    credibility: assess(alert),
    resolution: {
      matched: drugName !== null,
      method: resolution.method,
      candidates: resolution.candidates,
    },
  };
  return Response.json(response);
}
