import type { LedgerEventType } from "../contracts";

export const CLAUSES_BY_EVENT: Record<LedgerEventType, readonly string[]> = {
  "order.placed": ["21CFR11.10(e)", "ALCOA+:Attributable", "ALCOA+:Contemporaneous"],
  "genotype.resolved": ["21CFR11.10(e)", "ALCOA+:Original"],
  "model.invoked": ["21CFR11.10(e)", "ALCOA+:Original", "FDA-AI:model-provenance"],
  "alert.raised": ["21CFR11.10(e)", "ALCOA+:Accurate", "ALCOA+:Traceable"],
  "alert.accepted": ["21CFR11.10(e)", "ALCOA+:Attributable"],
  "alert.overridden": ["21CFR11.50", "21CFR11.70", "ALCOA+:Attributable", "ALCOA+:Enduring"],
  "policy.revised": ["21CFR11.10(k)(2)", "ALCOA+:Traceable", "ALCOA+:Enduring"],
  "export.generated": ["21CFR11.10(b)"],
};

export const CLAUSE_LABELS: Record<string, string> = {
  "21CFR11.10(e)": "secure, computer-generated, time-stamped audit trail",
  "21CFR11.10(k)(2)": "revision and change-control audit trail",
  "21CFR11.10(b)": "accurate and complete copies for inspection",
  "21CFR11.50": "signature manifestation: name, date/time, meaning",
  "21CFR11.70": "signature linked to its electronic record",
  "ALCOA+:Attributable": "attributable to the person responsible",
  "ALCOA+:Contemporaneous": "recorded when the activity occurred",
  "ALCOA+:Original": "original data retained",
  "ALCOA+:Accurate": "accurate representation of the activity",
  "ALCOA+:Traceable": "traceable through its full history",
  "ALCOA+:Enduring": "preserved for the required retention period",
  "FDA-AI:model-provenance": "model, version, parameters, prompt, and raw output retained",
};

export function clausesFor(type: LedgerEventType): string[] {
  return [...CLAUSES_BY_EVENT[type]];
}
