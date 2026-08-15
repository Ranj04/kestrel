/**
 * FDA draft guidance on AI in regulatory decision-making, applied literally:
 * model risk = model influence x decision consequence, and the risk level
 * dictates the required human control. No alert -> the system is a bystander;
 * a critical alert -> nothing less than a signature dismisses it.
 */
import type { Alert, Credibility, GeneAssessment } from "./contracts";

const CONTEXT_OF_USE =
  "Pre-prescription pharmacogenomic contraindication screening for a single order.";

/**
 * G-11 / R-26: did the screening actually complete? assess(null) is
 * procedurally correct input for every null alert, but "No human control
 * required." rendered under an amber "screening incomplete" line reads as
 * permission to proceed unscreened. The page uses this to render the
 * credibility card as NOT APPLICABLE whenever the system did not positively
 * complete the screen:
 *
 *   - the drug matched no CPIC guideline (no check performed at all), or
 *   - any relevant gene was not assessed (no result on file / lookup matched
 *     no row), or
 *   - a matched gene's CPIC rows conflicted and the D6 guard suppressed it —
 *     a refused determination is an unknown, not a clearance.
 *
 * A raised alert is NOT incomplete for this purpose: the system made a
 * determination and the card's conclusion is review/signature, not the "auto"
 * overclaim this guard exists to remove. Facts only — nothing clinical.
 */
export function screeningIncomplete(r: {
  alert: Alert | null;
  genesAssessed: GeneAssessment[] | null;
  resolution: { matched: boolean };
}): boolean {
  if (r.alert) return false;
  if (!r.resolution.matched) return true;
  const genes = r.genesAssessed ?? [];
  return genes.length === 0 || genes.some((g) => !g.assessed || g.conflict);
}

export function assess(alert: Alert | null): Credibility {
  if (!alert) {
    return {
      contextOfUse: CONTEXT_OF_USE,
      modelInfluence: "low",
      decisionConsequence: "low",
      risk: "low",
      requiredControl: "auto",
      rationale:
        "No CPIC-actionable finding was raised, so the system contributes nothing to this decision. " +
        "The order proceeds exactly as the prescriber wrote it, so the decision at stake is routine.",
    };
  }

  if (alert.severity === "caution") {
    return {
      contextOfUse: CONTEXT_OF_USE,
      modelInfluence: "medium",
      decisionConsequence: "medium",
      risk: "medium",
      requiredControl: "human-review",
      rationale:
        "The alert shapes the dosing decision but does not demand stopping therapy. " +
        "Acting on it or setting it aside changes treatment within accepted ranges, so a documented human review is required.",
    };
  }

  // critical — evaluate() never emits a "none" alert, so this is the only other branch.
  return {
    contextOfUse: CONTEXT_OF_USE,
    modelInfluence: "high",
    decisionConsequence: "high",
    risk: "high",
    requiredControl: "human-signature",
    rationale:
      "The alert recommends against the ordered therapy outright, so it directly steers the prescribing decision. " +
      "Overriding it accepts a risk of severe or fatal toxicity, so dismissal requires a signed, recorded human decision.",
  };
}
