import { actorFor } from "@/lib/actors";
import { recordOverride } from "@/lib/ledger";

interface OverrideRequest {
  alertId?: unknown;
  orderId?: unknown;
  actorId?: unknown;
  printedName?: unknown;
  signatureMeaning?: unknown;
  rationale?: unknown;
  suggestedRationale?: unknown;
}

export async function POST(request: Request): Promise<Response> {
  let body: OverrideRequest;
  try {
    body = (await request.json()) as OverrideRequest;
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (
    typeof body.alertId !== "string" ||
    typeof body.orderId !== "string" ||
    typeof body.actorId !== "string" ||
    typeof body.printedName !== "string" ||
    body.printedName.trim() === "" ||
    !["authorship", "review", "approval"].includes(String(body.signatureMeaning)) ||
    typeof body.rationale !== "string" ||
    body.rationale.trim().length < 20
  ) {
    return Response.json(
      { error: "alert, actorId, printed name, signature meaning, and a 20-character rationale are required" },
      { status: 400 },
    );
  }

  try {
    const record = recordOverride({
      alertId: body.alertId,
      orderId: body.orderId,
      actor: actorFor(body.actorId),
      printedName: body.printedName.trim(),
      signatureMeaning: body.signatureMeaning as "authorship" | "review" | "approval",
      rationale: body.rationale.trim(),
      suggestedRationale:
        typeof body.suggestedRationale === "string" ? body.suggestedRationale : null,
    });
    return Response.json({ record });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Override could not be recorded" },
      { status: 400 },
    );
  }
}
