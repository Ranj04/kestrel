import { demoControlsEnabled, tamper } from "@/lib/ledger";

export async function POST(): Promise<Response> {
  if (!demoControlsEnabled()) return new Response(null, { status: 404 });
  try {
    return Response.json(tamper());
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Ledger tamper failed" },
      { status: 400 },
    );
  }
}
