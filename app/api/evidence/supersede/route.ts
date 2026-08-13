import {
  activeRevisionStatus,
  authorizationStatus,
  supersede,
  verifyDetailed,
  type SupersedeInput,
} from "@/lib/ledger";
import { getPolicyFile } from "@/lib/pgx/policy";

export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  try {
    // The canned demo change has one source: data/policies.json.revision.
    const source = getPolicyFile().revision;
    const input: SupersedeInput = {
      policyId: source.policyId,
      clauseId: source.clauseId,
      newVersion: source.newVersion,
      affectedScopes: [...source.affectedScopes],
      summary: source.summary,
    };
    const result = supersede(input);
    return Response.json({
      ...result,
      authorizations: authorizationStatus(),
      revision: activeRevisionStatus(),
      verify: verifyDetailed(),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Policy revision could not be published" },
      { status: 400 },
    );
  }
}
