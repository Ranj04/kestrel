import type { AuthorizationView } from "@/lib/contracts";
import type { ActiveRevision } from "@/lib/ledger";

interface AuthorizationPanelProps {
  authorizations: AuthorizationView[];
  revision: ActiveRevision | null;
}

function shortHash(value: string): string {
  return value ? `${value.replace(/^sha256:/, "").slice(0, 4)}…` : "unavailable";
}

function evidenceLabel(authorization: AuthorizationView): string {
  return (
    authorization.boundTo.policyId ??
    authorization.boundTo.guidelineName ??
    authorization.boundTo.snapshotId
  );
}

export function AuthorizationPanel({ authorizations, revision }: AuthorizationPanelProps) {
  return (
    <section className="shrink-0 border-b border-white/15 bg-black/15 px-4 py-3 font-mono">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-[10px] font-semibold tracking-[0.2em] text-white/65">
          AUTHORIZATIONS
        </h2>
        {revision && (
          <span className="max-w-[68%] text-right text-[8px] leading-tight text-sky-200/75">
            SIMULATED POLICY REVISION · {revision.note}
          </span>
        )}
      </div>

      {authorizations.length === 0 ? (
        <p className="mt-2 text-[9px] text-white/35">No signed overrides yet.</p>
      ) : (
        <ol className="mt-2 space-y-2">
          {authorizations.map((authorization) => {
            const superseded = authorization.status === "superseded";
            const needsReview = authorization.status === "needs-review";
            const statusClass = superseded
              ? "border-red-400/45 bg-red-950/35 text-red-100"
              : needsReview
                ? "border-amber-400/45 bg-amber-950/25 text-amber-100"
                : "border-emerald-500/35 bg-emerald-950/15 text-emerald-100";
            return (
              <li
                key={`${authorization.seq}-${authorization.authorizationId}`}
                className={`rounded border px-2.5 py-2 text-[9px] leading-tight ${statusClass}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{superseded ? "⛔" : needsReview ? "!" : "✓"}</span>
                  <span className="font-bold">{authorization.authorizationId}</span>
                  <span>{authorization.drugName || "drug unavailable"} · {authorization.actor.id}</span>
                  <span className="ml-auto font-bold tracking-wide">
                    {authorization.status.toUpperCase()}
                  </span>
                </div>

                <div className="mt-1.5 grid grid-cols-[3.5rem_1fr_auto] gap-x-2 gap-y-1 pl-6 text-white/70">
                  <span className="text-white/40">bound to</span>
                  <span>
                    {evidenceLabel(authorization)}
                    {authorization.boundTo.policyVersion
                      ? ` v${authorization.boundTo.policyVersion}`
                      : ""}
                  </span>
                  <span title={authorization.boundTo.entryHash}>
                    sha256 {shortHash(authorization.boundTo.entryHash)}
                  </span>

                  {superseded && authorization.supersededBy && (
                    <>
                      <span className="text-white/40">current</span>
                      <span>{authorization.supersededBy.policyId} v{authorization.supersededBy.version}</span>
                      <span title={authorization.currentEntryHash}>
                        sha256 {shortHash(authorization.currentEntryHash)}
                      </span>
                    </>
                  )}
                </div>

                {superseded && authorization.supersededBy ? (
                  <div className="mt-1.5 space-y-1 pl-6">
                    <p className="font-semibold text-red-200">
                      scope collision: {authorization.intersectingScopes.join(", ")}
                    </p>
                    <p>
                      superseded by {authorization.supersededBy.policyId} v{authorization.supersededBy.version}
                      {revision?.clauseId ? ` · clause ${revision.clauseId}` : ""}
                      {revision ? " (simulated)" : ""}
                    </p>
                    <p className="text-white/55">{authorization.supersededBy.summary}</p>
                  </div>
                ) : revision && authorization.intersectingScopes.length === 0 ? (
                  <p className="mt-1.5 pl-6 font-semibold text-emerald-200">
                    evidence changed elsewhere; no scope collision with {revision.affectedScopes.join(", ")}
                  </p>
                ) : needsReview ? (
                  <p className="mt-1.5 pl-6 text-amber-200">
                    current evidence could not be recomputed; manual review required
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
