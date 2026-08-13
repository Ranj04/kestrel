import type { Actor } from "@/lib/contracts";
import { recordAcceptance } from "@/lib/ledger";

function isActor(value: unknown): value is Actor {
  if (!value || typeof value !== "object") return false;
  const actor = value as Record<string, unknown>;
  return typeof actor.id === "string" && typeof actor.name === "string" && typeof actor.role === "string";
}

export async function POST(request: Request): Promise<Response> {
  let body: { alertId?: unknown; orderId?: unknown; actor?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (typeof body.alertId !== "string" || typeof body.orderId !== "string" || !isActor(body.actor)) {
    return Response.json({ error: "alertId, orderId, and actor are required" }, { status: 400 });
  }

  try {
    return Response.json({
      record: recordAcceptance({
        alertId: body.alertId,
        orderId: body.orderId,
        actor: body.actor,
      }),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Acceptance could not be recorded" },
      { status: 400 },
    );
  }
}
