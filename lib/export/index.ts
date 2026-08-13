import JSZip from "jszip";
import type { AuthorizationView, LedgerRecord, VerifyResult } from "../contracts";
import { CLAUSE_LABELS } from "../ledger";

export interface InspectionPackageInput {
  records: LedgerRecord[];
  authorizations: AuthorizationView[];
  verification: VerifyResult;
  generatedAt: string;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function payloadObject(record: LedgerRecord): Record<string, unknown> {
  return record.payload && typeof record.payload === "object"
    ? (record.payload as Record<string, unknown>)
    : {};
}

function alertPayload(record: LedgerRecord): Record<string, unknown> | null {
  if (record.type !== "alert.raised") return null;
  const payload = payloadObject(record);
  return payload.alert && typeof payload.alert === "object"
    ? (payload.alert as Record<string, unknown>)
    : payload;
}

function clauseList(record: LedgerRecord): string {
  return record.clauses
    .map(
      (clause) =>
        `<li><strong>${escapeHtml(clause)}</strong> — ${escapeHtml(CLAUSE_LABELS[clause] ?? "Recorded control")}</li>`,
    )
    .join("");
}

function signatureBlock(record: LedgerRecord): string {
  if (record.type !== "alert.overridden") return "";
  const payload = payloadObject(record);
  return `<section class="signature">
    <h3>§11.50 signature manifestation</h3>
    <dl>
      <dt>Printed name</dt><dd>${escapeHtml(payload.printedName)}</dd>
      <dt>Date/time signed</dt><dd>${escapeHtml(payload.signedAt)}</dd>
      <dt>Meaning of signature</dt><dd>${escapeHtml(payload.signatureMeaning)}</dd>
    </dl>
  </section>`;
}

function recordHtml(record: LedgerRecord, broken: boolean): string {
  return `<article class="record ${broken ? "broken" : "intact"}">
    <header><strong>#${record.seq} · ${escapeHtml(record.type)}</strong><time>${escapeHtml(record.occurredAt)}</time></header>
    <p><strong>Actor:</strong> ${escapeHtml(record.actor.name)} (${escapeHtml(record.actor.id)}) · ${escapeHtml(record.actor.role)}</p>
    <ul class="clauses">${clauseList(record)}</ul>
    ${signatureBlock(record)}
    <h3>Payload</h3>
    <pre>${escapeHtml(JSON.stringify(record.payload, null, 2))}</pre>
    ${record.model ? `<h3>Model provenance</h3><p><strong>Model:</strong> ${escapeHtml(record.model.id)} · <strong>Version:</strong> ${escapeHtml(record.model.version)}</p><p><strong>Exact prompt sent</strong></p><pre>${escapeHtml(record.model.prompt)}</pre><p><strong>ALCOA &quot;Original&quot; — unedited model output, retained separately from any human-edited version.</strong></p><pre>${escapeHtml(record.model.rawOutput)}</pre>` : ""}
    <p class="hash"><strong>Previous:</strong> ${escapeHtml(record.prevHash)}<br><strong>Record:</strong> ${escapeHtml(record.hash)}</p>
  </article>`;
}

function clinicalEvidenceHtml(records: LedgerRecord[]): string {
  const alerts = records.map(alertPayload).filter((alert): alert is Record<string, unknown> => alert !== null);
  if (alerts.length === 0) return "<p>No clinical alert strings are present in this ledger.</p>";

  return alerts
    .map((alert) => {
      const citations = Array.isArray(alert.citations)
        ? alert.citations
            .map((citation) =>
              citation && typeof citation === "object"
                ? (citation as Record<string, unknown>).pmid
                : null,
            )
            .filter(Boolean)
            .join(", ")
        : "";
      return `<article class="evidence">
        <h3>${escapeHtml(alert.gene)} · ${escapeHtml(alert.drugName)}</h3>
        <p><strong>Recommendation:</strong> ${escapeHtml(alert.recommendation)}</p>
        ${alert.implication ? `<p><strong>Implication:</strong> ${escapeHtml(alert.implication)}</p>` : ""}
        ${alert.classification ? `<p><strong>Classification:</strong> ${escapeHtml(alert.classification)}</p>` : ""}
        ${alert.comments ? `<p><strong>Comments:</strong> ${escapeHtml(alert.comments)}</p>` : ""}
        ${alert.population ? `<p><strong>Population:</strong> ${escapeHtml(alert.population)}</p>` : ""}
        <p><strong>CPIC guideline:</strong> ${escapeHtml(alert.guidelineName)}${alert.guidelineUrl ? ` · ${escapeHtml(alert.guidelineUrl)}` : ""}</p>
        <p><strong>PMIDs:</strong> ${escapeHtml(citations || "None recorded")}</p>
      </article>`;
    })
    .join("");
}

function authorizationHtml(input: InspectionPackageInput): string {
  if (input.authorizations.length === 0) {
    return "<p>No signed override authorizations are present in this ledger.</p>";
  }
  const revision = input.records
    .filter((record) => record.type === "policy.revised")
    .map(payloadObject)
    .at(-1);
  const affectedScopes = Array.isArray(revision?.affectedScopes)
    ? revision.affectedScopes.map(String)
    : [];

  return input.authorizations
    .map((authorization) => {
      const superseded = authorization.status === "superseded" && authorization.supersededBy;
      const reason = superseded
        ? `<p><strong>Scope collision:</strong> ${escapeHtml(authorization.intersectingScopes.join(", "))}</p>
           <p><strong>Superseded by:</strong> ${escapeHtml(authorization.supersededBy?.policyId)} v${escapeHtml(authorization.supersededBy?.version)}${revision?.clauseId ? ` · clause ${escapeHtml(revision.clauseId)}` : ""}${revision?.simulated === true ? " · SIMULATED POLICY REVISION" : ""}</p>
           <p>${escapeHtml(authorization.supersededBy?.summary)}</p>`
        : revision && authorization.intersectingScopes.length === 0
          ? `<p><strong>Authorization unaffected:</strong> evidence changed elsewhere; no scope collision with ${escapeHtml(affectedScopes.join(", "))}</p>`
          : "";
      return `<article class="authorization ${superseded ? "broken" : "intact"}">
        <h3>${escapeHtml(authorization.authorizationId)} · ${escapeHtml(authorization.drugName)} · ${escapeHtml(authorization.status.toUpperCase())}</h3>
        <p><strong>Actor:</strong> ${escapeHtml(authorization.actor.name)} (${escapeHtml(authorization.actor.id)})</p>
        <p><strong>Bound to:</strong> ${escapeHtml(authorization.boundTo.policyId ?? authorization.boundTo.snapshotId)}${authorization.boundTo.policyVersion ? ` v${escapeHtml(authorization.boundTo.policyVersion)}` : ""} · ${escapeHtml(authorization.boundTo.entryHash)}</p>
        <p><strong>Current evidence hash:</strong> ${escapeHtml(authorization.currentEntryHash || "unavailable")}</p>
        ${reason}
      </article>`;
    })
    .join("");
}

export function inspectionReportHtml(input: InspectionPackageInput): string {
  const status = input.verification.ok
    ? "CHAIN INTACT"
    : `CHAIN BROKEN AT RECORD ${input.verification.firstBrokenSeq}`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Kestrel inspection report</title>
<style>
  *{box-sizing:border-box}body{max-width:980px;margin:0 auto;padding:36px;color:#211c18;background:#fff;font:15px/1.45 Georgia,serif}h1,h2,h3{margin:.3em 0}h1{font-size:28px}h2{border-bottom:2px solid #211c18;padding-bottom:8px}.meta{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:22px 0}.meta div,.record,.evidence,.authorization{border:1px solid #cfc6b8;padding:14px}.status-ok{color:#1f5d4c}.status-bad,.broken{border-color:#cf4520!important;color:#7f260e}.record,.authorization{margin:14px 0;break-inside:avoid}.record header{display:flex;justify-content:space-between;gap:16px}.record time,.hash{font:12px ui-monospace,monospace;overflow-wrap:anywhere}.clauses{font-size:13px}.signature{background:#f3ece0;padding:10px}.signature dl{display:grid;grid-template-columns:180px 1fr;margin:0}.signature dt{font-weight:bold}.signature dd{margin:0}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f7f4ef;padding:10px;font:11px/1.4 ui-monospace,monospace}.evidence{margin:12px 0}.clinical{break-before:page}@media print{body{padding:0}.record,.evidence,.authorization{page-break-inside:avoid}}
</style></head><body>
<header><p>KESTREL · REGULATORY INSPECTION PACKAGE</p><h1>Electronic audit ledger</h1></header>
<section class="meta"><div><strong>Generated</strong><br>${escapeHtml(input.generatedAt)}</div><div><strong>Records</strong><br>${input.records.length}</div><div class="${input.verification.ok ? "status-ok" : "status-bad"}"><strong>Verification</strong><br>${escapeHtml(status)}<br><small>Checked ${escapeHtml(input.verification.checkedAt)}</small></div></section>
<p>§11.10(b) inspection copies are included in both human-readable form (this report) and electronic form (<code>ledger.jsonl</code>).</p>
<h2>Snapshot-bound authorizations</h2>
${authorizationHtml(input)}
<h2>Chronological ledger</h2>
${input.records.map((record) => recordHtml(record, input.verification.brokenSeqs.includes(record.seq))).join("")}
<section class="clinical"><h2>Clinical strings and source evidence</h2>${clinicalEvidenceHtml(input.records)}</section>
</body></html>`;
}

function readme(input: InspectionPackageInput): string {
  return `KESTREL INSPECTION PACKAGE
Generated: ${input.generatedAt}

CONTENTS
- ledger.jsonl: complete machine-readable electronic ledger
- inspection-report.html: complete self-contained human-readable copy
- verification.json: chain verification result at export time
- README.txt: this independent verification procedure

INDEPENDENT VERIFICATION
Each line in ledger.jsonl is one JSON record in chronological order.

1. Parse each line as JSON.
2. For record 0, require prevHash to equal sha256: followed by 64 zeroes.
   For every later record, require prevHash to equal the preceding record's stored hash.
3. Remove the record's hash field from its own hash input.
4. Canonicalize the remaining object as JSON with object keys recursively sorted
   lexicographically at every depth. Preserve array order. Omit object properties whose
   value is undefined. Encode strings with normal JSON escaping and no extra whitespace.
5. SHA-256 hash the UTF-8 canonical JSON bytes and prefix the lowercase hexadecimal
   digest with "sha256:".
6. Compare the computed value with the record's stored hash. The first mismatch and
   every record after it are not trustworthy because the chain link has been broken.

Verification at export: ${input.verification.ok ? "intact" : `broken at record ${input.verification.firstBrokenSeq}`}
Records checked: ${input.verification.total}
Checked at: ${input.verification.checkedAt}
`;
}

export async function buildInspectionPackage(input: InspectionPackageInput): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file("ledger.jsonl", input.records.map((record) => JSON.stringify(record)).join("\n") + (input.records.length ? "\n" : ""));
  zip.file("inspection-report.html", inspectionReportHtml(input));
  zip.file("verification.json", JSON.stringify(input.verification, null, 2) + "\n");
  zip.file("README.txt", readme(input));
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } });
}
