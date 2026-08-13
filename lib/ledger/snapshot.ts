import type {
  Alert,
  AuthorizationView,
  EvidenceSnapshot,
  LedgerRecord,
  OverridePayload,
} from "../contracts";
import { getIndex, setIndexOverlay, type CpicEntry } from "../pgx";
import {
  getPolicyFile,
  setPolicyOverlay,
  type PolicyClause,
  type PolicyFile,
} from "../pgx/policy";
import { stableHash } from "./hash";
import { append, clausesFor, readAll } from "./store";
import { verify } from "./verify";

/** The source shape is data/policies.json.revision. Do not duplicate its values. */
export interface SupersedeInput {
  policyId: string;
  clauseId: string;
  newVersion: string;
  affectedScopes: string[];
  summary: string;
}

export interface ActiveRevision extends SupersedeInput {
  note: string;
}

interface SupersedeResult {
  policyId: string;
  versionBefore: string;
  versionAfter: string;
  entryHashBefore: string;
  entryHashAfter: string;
  record: LedgerRecord;
}

interface RevisionPayload extends SupersedeInput {
  versionBefore: string;
  versionAfter: string;
  entryHashBefore: string;
  entryHashAfter: string;
  note: string;
  simulated: true;
}

let activeRevision: ActiveRevision | null = null;
let publishedResult: SupersedeResult | null = null;

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function alertFromRecord(record: LedgerRecord): Alert | null {
  if (record.type !== "alert.raised") return null;
  const payload = objectValue(record.payload);
  if (!payload) return null;
  const candidate = objectValue(payload.alert) ?? payload;
  return typeof candidate.alertId === "string" && typeof candidate.orderId === "string"
    ? (candidate as unknown as Alert)
    : null;
}

function overrideFromRecord(record: LedgerRecord): OverridePayload | null {
  if (record.type !== "alert.overridden") return null;
  const payload = objectValue(record.payload);
  if (
    !payload ||
    typeof payload.alertId !== "string" ||
    typeof payload.orderId !== "string" ||
    !objectValue(payload.boundTo)
  ) {
    return null;
  }
  return payload as unknown as OverridePayload;
}

function sameText(left: unknown, right: unknown): boolean {
  return String(left ?? "").trim().toLowerCase() === String(right ?? "").trim().toLowerCase();
}

function currentEntry(alert: Alert): CpicEntry | null {
  const entries = getIndex()[alert.drugName.trim().toLowerCase()]?.[alert.gene] ?? [];
  const exact = entries.filter(
    (entry) =>
      sameText(entry.lookup, alert.lookup) &&
      entry.recommendation === alert.recommendation &&
      entry._source === alert.sourceUrl,
  );
  return exact.length === 1 ? exact[0] : null;
}

function currentClause(alert: Alert, file: PolicyFile): PolicyClause | null | undefined {
  if (alert.snapshot.policyId === null) return null;
  const coverage = alert.coverage;
  if (!coverage) return undefined;
  const policy = file.policies.find((candidate) => candidate.policyId === alert.snapshot.policyId);
  return policy?.clauses.find((candidate) => candidate.clauseId === coverage.clauseId);
}

function currentHash(alert: Alert): string | null {
  const entry = currentEntry(alert);
  const clause = currentClause(alert, getPolicyFile());
  if (!entry || clause === undefined) return null;
  return stableHash({ cpicEntry: entry, clause });
}

function intersections(left: string[], right: string[]): string[] {
  const affected = new Set(right);
  return [...new Set(left.filter((scope) => affected.has(scope)))];
}

function sourceRevision(): ActiveRevision {
  const revision = getPolicyFile().revision as PolicyFile["revision"] & { note?: unknown };
  if (typeof revision.note !== "string" || revision.note.trim() === "") {
    throw new Error("Policy revision is missing its required simulated-revision note");
  }
  return {
    policyId: revision.policyId,
    clauseId: revision.clauseId,
    newVersion: revision.newVersion,
    affectedScopes: [...revision.affectedScopes],
    summary: revision.summary,
    note: revision.note,
  };
}

function sameRevision(left: SupersedeInput, right: SupersedeInput): boolean {
  return (
    left.policyId === right.policyId &&
    left.clauseId === right.clauseId &&
    left.newVersion === right.newVersion &&
    left.summary === right.summary &&
    left.affectedScopes.length === right.affectedScopes.length &&
    left.affectedScopes.every((scope, index) => scope === right.affectedScopes[index])
  );
}

function affectedAlert(input: SupersedeInput): Alert {
  const match = readAll()
    .map(alertFromRecord)
    .filter((alert): alert is Alert => alert !== null)
    .findLast(
      (alert) =>
        alert.coverage?.policyId === input.policyId &&
        alert.coverage.clauseId === input.clauseId &&
        intersections(alert.snapshot.scopes, input.affectedScopes).length > 0,
    );
  if (!match) {
    throw new Error("Publish requires an affected alert with a captured evidence snapshot");
  }
  return match;
}

function installOverlays(input: SupersedeInput): void {
  // This is a policy-only revision. Register the clinical overlay hook while
  // deliberately leaving every CPIC entry untouched.
  setIndexOverlay((index) => index);
  setPolicyOverlay((file) => ({
    ...file,
    policies: file.policies.map((policy) =>
      policy.policyId !== input.policyId
        ? policy
        : {
            ...policy,
            version: input.newVersion,
            clauses: policy.clauses.map((clause) =>
              clause.clauseId !== input.clauseId
                ? clause
                : {
                    ...clause,
                    revision: {
                      policyId: input.policyId,
                      clauseId: input.clauseId,
                      version: input.newVersion,
                      affectedScopes: [...input.affectedScopes],
                      summary: input.summary,
                    },
                  },
            ),
          },
    ),
  }));
}

function restoreRevisionState(records: LedgerRecord[]): void {
  if (activeRevision || records.length === 0 || !verify(records).ok) return;
  const record = records.findLast((candidate) => candidate.type === "policy.revised");
  const payload = record ? objectValue(record.payload) : null;
  if (
    !record ||
    !payload ||
    typeof payload.policyId !== "string" ||
    typeof payload.clauseId !== "string" ||
    typeof payload.newVersion !== "string" ||
    !Array.isArray(payload.affectedScopes) ||
    !payload.affectedScopes.every((scope) => typeof scope === "string") ||
    typeof payload.summary !== "string" ||
    typeof payload.note !== "string" ||
    typeof payload.versionBefore !== "string" ||
    typeof payload.versionAfter !== "string" ||
    typeof payload.entryHashBefore !== "string" ||
    typeof payload.entryHashAfter !== "string" ||
    payload.simulated !== true
  ) {
    return;
  }
  const declared = sourceRevision();
  const restored: ActiveRevision = {
    policyId: payload.policyId,
    clauseId: payload.clauseId,
    newVersion: payload.newVersion,
    affectedScopes: payload.affectedScopes as string[],
    summary: payload.summary,
    note: payload.note,
  };
  if (!sameRevision(restored, declared) || restored.note !== declared.note) return;

  installOverlays(restored);
  activeRevision = structuredClone(restored);
  publishedResult = {
    policyId: restored.policyId,
    versionBefore: payload.versionBefore,
    versionAfter: payload.versionAfter,
    entryHashBefore: payload.entryHashBefore,
    entryHashAfter: payload.entryHashAfter,
    record,
  };
}

export function supersede(input: SupersedeInput): SupersedeResult {
  restoreRevisionState(readAll());
  const declared = sourceRevision();
  if (!sameRevision(input, declared)) {
    throw new Error("Supersede input must exactly match data/policies.json.revision");
  }
  if (activeRevision && publishedResult) {
    if (!sameRevision(activeRevision, input)) {
      throw new Error("A different policy revision is already active in memory");
    }
    return publishedResult;
  }

  const fileBefore = getPolicyFile();
  const policyBefore = fileBefore.policies.find((policy) => policy.policyId === input.policyId);
  if (!policyBefore) throw new Error(`Policy ${input.policyId} does not exist`);
  if (!policyBefore.clauses.some((clause) => clause.clauseId === input.clauseId)) {
    throw new Error(`Clause ${input.clauseId} does not exist in ${input.policyId}`);
  }

  const alert = affectedAlert(input);
  const entryHashBefore = currentHash(alert);
  if (!entryHashBefore) throw new Error("Affected evidence could not be recomputed before revision");

  installOverlays(input);
  const entryHashAfter = currentHash(alert);
  if (!entryHashAfter || entryHashAfter === entryHashBefore) {
    setIndexOverlay(null);
    setPolicyOverlay(null);
    throw new Error("Policy revision did not change the affected evidence hash");
  }

  const payload: RevisionPayload = {
    policyId: input.policyId,
    clauseId: input.clauseId,
    newVersion: input.newVersion,
    affectedScopes: [...input.affectedScopes],
    summary: input.summary,
    versionBefore: policyBefore.version,
    versionAfter: input.newVersion,
    entryHashBefore,
    entryHashAfter,
    note: declared.note,
    simulated: true,
  };
  let record: LedgerRecord;
  try {
    record = append(
      "policy.revised",
      payload,
      {
        id: "attest_policy_registry",
        name: "Attest policy registry",
        role: "Automated change control",
      },
      clausesFor("policy.revised"),
    );
  } catch (error) {
    setIndexOverlay(null);
    setPolicyOverlay(null);
    throw error;
  }

  activeRevision = structuredClone(declared);
  publishedResult = {
    policyId: input.policyId,
    versionBefore: policyBefore.version,
    versionAfter: input.newVersion,
    entryHashBefore,
    entryHashAfter,
    record,
  };
  return structuredClone(publishedResult);
}

export function authorizationStatus(): AuthorizationView[] {
  const records = readAll();
  restoreRevisionState(records);
  const alerts = records.map(alertFromRecord).filter((alert): alert is Alert => alert !== null);

  return records.flatMap((record): AuthorizationView[] => {
    const override = overrideFromRecord(record);
    if (!override) return [];
    const alert = alerts.findLast(
      (candidate) =>
        candidate.alertId === override.alertId && candidate.orderId === override.orderId,
    );
    const hash = alert ? currentHash(alert) : null;
    const intersectingScopes = activeRevision
      ? intersections(override.boundTo.scopes, activeRevision.affectedScopes)
      : [];
    const hashChanged = hash !== null && hash !== override.boundTo.entryHash;
    const status: AuthorizationView["status"] =
      hash === null
        ? "needs-review"
        : hashChanged && activeRevision === null
          ? "needs-review"
          : hashChanged && intersectingScopes.length > 0
            ? "superseded"
            : "valid";

    return [
      {
        seq: record.seq,
        authorizationId: `AUTH-${record.hash.replace(/^sha256:/, "").slice(0, 4).toUpperCase()}`,
        alertId: override.alertId,
        drugName: alert?.drugName ?? "",
        actor: record.actor,
        status,
        boundTo: override.boundTo as EvidenceSnapshot,
        currentEntryHash: hash ?? "",
        intersectingScopes,
        supersededBy:
          status === "superseded" && activeRevision
            ? {
                policyId: activeRevision.policyId,
                version: activeRevision.newVersion,
                summary: activeRevision.summary,
              }
            : null,
      },
    ];
  });
}

export function activeRevisionStatus(): ActiveRevision | null {
  restoreRevisionState(readAll());
  return activeRevision ? structuredClone(activeRevision) : null;
}

export function resetSnapshotState(): void {
  activeRevision = null;
  publishedResult = null;
  setIndexOverlay(null);
  setPolicyOverlay(null);
}
