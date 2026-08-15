import { append, authorizationStatus, clausesFor, readAll, verify } from "@/lib/ledger";
import { buildInspectionPackage } from "@/lib/export";

export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  try {
    const generatedAt = new Date().toISOString();
    append(
      "export.generated",
      { generatedAt, forms: ["human-readable HTML", "electronic JSONL"] },
      { id: "kestrel_system", name: "Kestrel", role: "Automated export" },
      clausesFor("export.generated"),
    );
    const records = readAll();
    const verification = verify(records);
    const authorizations = authorizationStatus();
    const zip = await buildInspectionPackage({ records, authorizations, verification, generatedAt });
    const body = zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength) as ArrayBuffer;
    return new Response(body, {
      headers: {
        "content-type": "application/zip",
        "content-disposition": 'attachment; filename="kestrel-inspection-package.zip"',
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Inspection package could not be generated" },
      { status: 500 },
    );
  }
}
