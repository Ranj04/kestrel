import { verify } from "@/lib/ledger";

export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  try {
    return Response.json(verify());
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Ledger verification failed" },
      { status: 500 },
    );
  }
}
