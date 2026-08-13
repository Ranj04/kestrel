import {
  activeRevisionStatus,
  authorizationStatus,
  ephemeral,
  readAll,
  verifyDetailed,
} from "@/lib/ledger";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const records = readAll();
    return Response.json({
      records,
      authorizations: authorizationStatus(),
      revision: activeRevisionStatus(),
      verify: verifyDetailed(),
      ephemeral,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Ledger read failed" },
      { status: 500 },
    );
  }
}
