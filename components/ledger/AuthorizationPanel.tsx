import type { AuthorizationView } from "@/lib/contracts";
import type { ActiveRevision } from "@/lib/ledger";

interface AuthorizationPanelProps {
  authorizations: AuthorizationView[];
  revision: ActiveRevision | null;
}

function shortHash(value: string): string {
  return value ? `${value.replace(/^sha256:/, "").slice(0, 6)}…` : "unavailable";
}

function evidenceLabel(authorization: AuthorizationView): string {
  return (
    authorization.boundTo.policyId ??
    authorization.boundTo.guidelineName ??
    authorization.boundTo.snapshotId
  );
}

export function AuthorizationPanel({ authorizations, revision }: AuthorizationPanelProps) {
  const hasSuperseded = authorizations.some(
    (authorization) => authorization.status === "superseded",
  );
  const panelText = hasSuperseded ? "text-ink" : "text-paper";
  const secondaryText = hasSuperseded ? "text-ink-soft" : "text-paper/55";

  return (
    <section
      className={`shrink-0 border-b px-4 py-3 font-mono ${
        hasSuperseded
          ? "border-line bg-paper text-ink"
          : "border-paper/15 bg-black/15 text-paper"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className={`text-xs font-semibold tracking-[0.16em] ${hasSuperseded ? "text-ink" : "text-paper/65"}`}>
          {hasSuperseded ? "AUTHORIZATION SUPERSEDED · EVIDENCE REVISED" : "AUTHORIZATIONS"}
        </h2>
        {revision && (
          <span className={`max-w-sm text-right text-xs leading-tight ${secondaryText}`}>
            SIMULATED POLICY REVISION · {revision.note}
          </span>
        )}
      </div>

      {authorizations.length === 0 ? (
        <p className={`mt-2 text-xs ${hasSuperseded ? "text-ink-soft" : "text-paper/35"}`}>
          No signed overrides yet.
        </p>
      ) : (
        <ol className="mt-2">
          {authorizations.map((authorization) => {
            const superseded = authorization.status === "superseded";
            const needsReview = authorization.status === "needs-review";
            const statusClass = superseded
              ? hasSuperseded
                ? "text-ink line-through"
                : "text-paper line-through"
              : needsReview
                ? "text-amber"
                : hasSuperseded
                  ? "text-seal"
                  : "text-seal-void";
            return (
              <li
                key={`${authorization.seq}-${authorization.authorizationId}`}
                className={`border-b py-2 text-xs leading-snug last:border-b-0 ${
                  hasSuperseded ? "border-line" : "border-paper/15"
                } ${panelText}`}
              >
                <div className="flex items-baseline gap-2">
                  <span className="font-bold">{authorization.authorizationId}</span>
                  <span>{authorization.drugName || "drug unavailable"} · {authorization.actor.id}</span>
                  <span className={`ml-auto font-bold tracking-[0.12em] ${statusClass}`}>
                    {authorization.status.toUpperCase()}
                  </span>
                </div>

                <div className={`mt-1.5 grid grid-cols-[3.5rem_1fr_auto] gap-x-2 gap-y-1 ${secondaryText}`}>
                  <span className={hasSuperseded ? "text-ink-soft" : "text-paper/40"}>bound to</span>
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
                      <span className={hasSuperseded ? "text-ink-soft" : "text-paper/40"}>current</span>
                      <span>{authorization.supersededBy.policyId} v{authorization.supersededBy.version}</span>
                      <span title={authorization.currentEntryHash}>
                        sha256 {shortHash(authorization.currentEntryHash)}
                      </span>
                    </>
                  )}
                </div>

                {superseded && authorization.supersededBy ? (
                  <div className="mt-1.5 space-y-1 font-display text-base">
                    <p className="font-semibold text-ink">
                      scope collision: {authorization.intersectingScopes.join(", ")}
                    </p>
                    <p>
                      superseded by {authorization.supersededBy.policyId} v{authorization.supersededBy.version}
                      {revision?.clauseId ? ` · clause ${revision.clauseId}` : ""}
                      {revision ? " (simulated)" : ""}
                    </p>
                    <p className="text-ink-soft">{authorization.supersededBy.summary}</p>
                  </div>
                ) : revision && authorization.intersectingScopes.length === 0 ? (
                  <p className={`mt-1.5 font-semibold ${hasSuperseded ? "text-seal" : "text-seal-void"}`}>
                    evidence changed elsewhere; no scope collision with {revision.affectedScopes.join(", ")}
                  </p>
                ) : needsReview ? (
                  <p className="mt-1.5 text-amber">
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
