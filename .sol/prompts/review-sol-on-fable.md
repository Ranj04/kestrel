> **Inherits `.sol/prompts/_template.md` in full**, plus the adaptations in `CLAUDE.md`.
> Read both before this file. Sol also reads `AGENTS.md` (a pointer, not a copy — rule 7).
> The deliverable clause at the bottom is inherited and not optional.

# TASK: review-sol-on-fable — attack the clinical correctness

You are **Sol**. Read `~/"biopharma hack"/.sol/prompts/_context.md` first.

**This is a review task. Do not edit any file.** Write findings only, to
`~/"biopharma hack"/.sol/reviews/sol-on-fable.md`. That is the single file you may create.

You have roughly fifteen minutes. Depth over coverage.

## What to review

Everything under `lib/pgx/`, plus `lib/credibility.ts`, `lib/llm.ts`,
`app/api/prescribe/route.ts`, `data/patients.json`, and `components/prescribe/`.

Read `DECISIONS.md` first. A finding that a recorded decision already covers is not a finding.

## What we want

**Correctness bugs, not style.** Ranked:

1. **Anything that puts a wrong clinical string on screen, or the right string on the wrong
   patient.** This project's entire claim is that every rendered recommendation is verbatim CPIC
   for the correct genotype. If that can be false, that is the finding we most want, above
   everything else.
2. **Anything that breaks the demo path**: order → alert → Why? drawer → override; and the clean
   pass on the normal metabolizer.
3. Everything else.

Do not report: formatting, naming, missing types, "consider extracting a helper", test coverage in
the abstract, accessibility, or anything `DECISIONS.md` explicitly justifies.

## Where to look hardest

**`lib/pgx/evaluate.ts` is the instrument.** Every clinical claim comes out of it. Attack:

- **Does it join on `lookup` or on `phenotype`?** It must be `lookup`. Joining on `phenotype` is
  a severity-1 finding: it is `null` for every HLA gene, and it is not unique — DPYD `"0.0"` and
  `"0.5"` are both `"Poor Metabolizer"`, so a phenotype join can return a different row than the
  one the patient's genotype actually maps to.
- **Can it ever match the wrong `lookup`?** Substring matching, `includes`, or numeric coercion
  that lets `"2.0"` match `"2.5"`, `"≥2.0"`, or `"0.0"` — the DPYD/CYP2D6 keys are activity-score
  *strings* and several are prefixes of each other (`"3.0"`, `"≥3.0"`, `"≥3.25"`). Try `"0.5"` and
  `"≥3.0"` against every capecitabine and codeine entry. If the match is not exact after trim and
  case-fold, that is a severity-1 finding.
- **Is `lookup` ever rendered to the user?** It is a join key. A card reading "DPYD 0.0" instead
  of "DPYD Poor Metabolizer" is a finding.
- **Can it raise an alert for a gene the patient does not have a result for?**
- **Can it return `null` when a real Level A alert exists?** A false negative here is the demo's
  worst failure — it is a system that silently misses the thing it is for.
- **Severity derivation.** The rule keys on the presence of "avoid" in CPIC text. Find a real
  entry in `data/cpic/index.json` where that produces a wrong severity — e.g. text containing
  "avoid" inside a recommendation that is not actually a contraindication, or a genuine
  contraindication phrased without the word. Grep the actual file; do not theorize.
- **Multi-gene ordering.** When two genes hit one drug, is the highest severity actually chosen,
  or the first encountered?
- Are the strings passed through **verbatim**? Any `slice`, `replace`, `toLowerCase`, truncation
  or ellipsis applied to `recommendation` or `implication` before render is a finding — including
  in the React components.

**Then `lib/pgx/resolve.ts`.** Can the LLM path return a drug name that is not an index key and
have it survive? Is the check `candidates.includes(result)` or something weaker? Can a
substring match on a short input pick the wrong drug — try `"cod"`, `"ace"`, `"pro"` against the
real index keys.

**Then `data/patients.json`.** Do the `lookup` strings match CPIC's `lookup` values **character
for character**? Compare them programmatically against `data/cpic/index.json`, do not eyeball it.
A single trailing space here silently disables an alert.

**Then `app/api/prescribe/route.ts`.** Is a ledger record written for every branch, including the
no-alert case? Does anything get written to the ledger *before* it is known to be true? Does the
route ever return an alert it did not log?

**Then the components.** Does `WhyDrawer` render `sourceUrl` as the actual value from the alert,
or a reconstructed URL? Reconstructing it is a finding — the point is that it is the row the
string came from.

## Format

For each finding:

```
### N. <one-line claim>  [severity 1/2/3]

**File:** lib/pgx/evaluate.ts:LINE
**What is wrong:** …
**How it fails:** concrete inputs -> wrong output. Name a real patient, a real drug, and the real
string from data/cpic/index.json. Be specific.
**Suggested fix:** one or two sentences. Do not implement it.
```

If you cannot find a real bug in a module, say so explicitly rather than inventing something. An
honest "I attacked evaluate.ts along these five axes and it holds" is more useful than a padded
list — it tells Fable which ground is already covered, with under an hour left.

End with a one-paragraph verdict: what you would fix before demoing, in order. Assume only the top
two items will actually get fixed, and order accordingly.

## Rule 2 — the files that carry the invariants

Audit against these by name, not "the diff":

- `lib/pgx/evaluate.ts` — the instrument. Every clinical claim comes out of it.
- `lib/pgx/index.ts` — is there any runtime network call? There must not be.
- `data/patients.json` vs `data/cpic/index.json` — compare `lookup` strings
  **programmatically**, not by eye. See R-6 in `REGISTER.md`: they have never been
  checked against a generated cache.
- `data/policies.json` — clause text must reach the screen verbatim.
- `.sol/prompts/_context.md` — the standing rule the diff must not violate.
- `CLAUDE.md` — the project's own severity ordering of defects.

## Rule 1 — the precondition that kills the tempting option

The tempting fix for a non-firing alert is to loosen the `lookup` match — substring,
fuzzy, normalized, parsed-as-a-number. **Check `data/cpic/index.json` for near-miss strings on the
same gene before proposing it, and never loosen the match to make something pass.** For
capecitabine, DPYD carries `"0.0"`, `"0.5"`, `"1.0"`, `"1.5"` and `"2.0"` on one drug, spanning
Poor to Normal Metabolizer; codeine carries `"3.0"` alongside `"≥3.0"` and `"≥3.25"`. Any match
loose enough to be forgiving is loose enough to return the opposite recommendation. That is the
worst defect available in this codebase.

**This already happened once.** `patients.json` shipped with `lookup: "Poor Metabolizer"` — a
phenotype name where an activity score belongs — and every alert silently failed to fire. The
correct fix was to fix the data, not to loosen the match. Watch for anyone who did the latter.

## R-5 is open and it is yours to close

`scripts/verify-setup.mjs` re-derives severity with its own regex while
`lib/pgx/evaluate.ts` implements it independently — two declarations of a closed set
that can disagree while both still run (4a-ter, vocabulary kind). If Fable's diff did
not export `severityOf` and have the preflight import it, **that is a finding**, and
`REGISTER.md` R-5 says so in advance.

---

## Reviewer clause — inherited from `_template.md`

**You edit nothing.** Findings only, to the named file.

**Do not be agreeable.** A demo shipped describing shimmed providers as "live," and
catching exactly that is the job. If you cannot find a real bug in a module, say so
explicitly — an honest *"I attacked `evaluate.ts` along these five axes and it holds"*
tells the other party which ground is covered. An invented finding wastes the only
resource that matters.

**Judge each claim against its artifact, not its summary (rule 4g).** A claim broader
than the check supporting it is itself a finding. `curl` output echoing a string is not
evidence the string came from CPIC — `grep -F` against `data/cpic/index.json` is.

**A vacuous check is a severity-1 finding (rule 4a / 4a-bis).** A test whose expected
value is reachable by the buggy code proves nothing however precise it looks. A command
that returns empty for reasons unrelated to the claim is not evidence.

**Cap the argument at 3 rounds (rule 8).** If you and the other party have not
converged, stop and hand both positions to Opus 5. Never average. If it takes three
rounds, the task was too big (rule 9) — say so.

**If you both independently flag the same line, it goes to the top of the fix list**
ahead of anything either raised alone (rule 10).

---

## What your agreement with the other auditor is worth

**Sol runs on `codex exec`** (verified at Phase 0: `which codex` → present,
`codex login status` → authenticated). Fable runs on `Agent(model: "fable")`.
These are **genuinely different models**, not two instances of one.

So template **rule 10 applies at full weight here**: where you and the other
auditor independently reach the same finding, that agreement is strong evidence.
Where you disagree, say so plainly and do not soften it — Opus 5 arbitrates, and
a disagreement surfaced is worth more than a consensus manufactured.

Had Sol fallen back to a same-model subagent, rule 10 would have been downweighted
(two instances of one model agreeing is much weaker than two models agreeing). It
did not. Nothing here is downweighted.
