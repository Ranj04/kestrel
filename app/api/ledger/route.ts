import { ephemeral, readAll, verify } from "@/lib/ledger";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const records = readAll();
    return Response.json({ records, verify: verify(), ephemeral });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Ledger read failed" },
      { status: 500 },
    );
  }
}
