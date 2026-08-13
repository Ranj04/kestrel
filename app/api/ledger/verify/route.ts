import { verifyDetailed } from "@/lib/ledger";

export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  try {
    return Response.json(verifyDetailed());
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Ledger verification failed" },
      { status: 500 },
    );
  }
}
