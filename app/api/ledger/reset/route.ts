import { ephemeral, reset, resetSnapshotState } from "@/lib/ledger";

export async function POST(): Promise<Response> {
  try {
    reset();
    resetSnapshotState();
    return Response.json({ ok: true, ephemeral });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Ledger reset failed" },
      { status: 500 },
    );
  }
}
