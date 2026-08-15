import { actorFor } from "@/lib/actors";
import { recordAcceptance } from "@/lib/ledger";

export async function POST(request: Request): Promise<Response> {
  let body: { alertId?: unknown; orderId?: unknown; actorId?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (typeof body.alertId !== "string" || typeof body.orderId !== "string" || typeof body.actorId !== "string") {
    return Response.json({ error: "alertId, orderId, and actorId are required" }, { status: 400 });
  }

  try {
    return Response.json({
      record: recordAcceptance({
        alertId: body.alertId,
        orderId: body.orderId,
        actor: actorFor(body.actorId),
      }),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Acceptance could not be recorded" },
      { status: 400 },
    );
  }
}
