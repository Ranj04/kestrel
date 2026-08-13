> **Inherits `.sol/prompts/_template.md` in full**, plus the adaptations in `CLAUDE.md`.
> Read both before this file. Sol also reads `AGENTS.md` (a pointer, not a copy — rule 7).
> The deliverable clause at the bottom is inherited and not optional.

# TASK: phase0-coverage-layer — add coverage as a layer, keep the clinical stop as the hero

**Read this before every other prompt. It is ADDITIVE. It renames nothing and removes nothing.**
Both Fable and Sol read this.

## Why

The event published five problem statements. #4 is:

> *"...an agent that simulates the payer-side prior-authorization/claims adjudication process —
> reading a prescription and a plan's coverage policy to determine and explain an approve/deny
> decision in real time, versus today's slow manual review."*

Our engine already does that shape — read a prescription, check it against an authoritative
document, explain the decision, record it defensibly. We are **not** becoming a prior-auth tool.
We are showing that the same engine answers the payer's question, and letting one line on screen
and one sentence on stage make that point.

**The clinical stop remains the hero.** A room feels a preventable death. It does not feel a
claim. Do not let the payer framing take the top of the card.

## What to add — and only this

`data/policies.json` is committed: synthetic, fictional payer, labelled as such in the file.
Two policies (fluoropyrimidines, codeine), six clauses, each with `criterion` and `scopes`.

### Fable

**`lib/pgx/policy.ts`** — ~50 lines, no more.

```ts
export interface Coverage {
  policyId: string; policyVersion: string; payer: string;
  clauseId: string; clauseText: string;         // VERBATIM from policies.json
  determination: "covered" | "covered-with-conditions" | "not-covered" | "pended";
  alternative: string | null;
  scopes: string[];
}
export function coverageFor(patient: Patient, drugName: string): Coverage | null;
```

Find the policy whose `drugs` includes the drug. Walk `clauses` in order, match `criterion`
against the patient's `results` on `lookup` (same exact-match discipline as `evaluate.ts`):

- `genotype_required` and no result for that gene → `pended`
- `phenotype_restriction` with a matching `lookup` → apply its `outcome`
- No policy for the drug → return `null`. Render nothing. **Do not invent "no PA required"** —
  absence of a policy in a synthetic file is not evidence of anything.

Add `coverage: Coverage | null` to `Adjudication`... no — **keep the type named `Alert`**. Add one
field: `coverage: Coverage | null`. Nothing else in `contracts.ts` changes.

**Standing rule now covers two sources:** never fabricate a clinical recommendation, and never
fabricate policy language. Every clause string on screen is verbatim from `data/policies.json`.

### The card

Clinical block is unchanged and stays on top, at full weight. Below it, one collapsed line:

```
⛔  DO NOT PRESCRIBE
    DPYD · Poor Metabolizer · capecitabine
    "Avoid use of 5-fluorouracil or 5-fluorouracil prodrug-based regimens."
    CPIC Level A · Strong

    ── COVERAGE ─────────────────────────────────────────────────
    Meridian PA-ONC-014.2 · not covered at standard dose        ▸
    reduced dose covered with documented therapeutic monitoring
```

Expanding `▸` shows the clause verbatim, policy version, and effective date. That's it. No second
pane, no tab, no separate view.

For Lindqvist (normal metabolizer) the coverage line reads `covered · PA-ONC-014.4` under the
green clinical line. Same drug, same policy, covered — and now that contrast proves *two* things
at once.

### Sol

`snapshot.entryHash` becomes `stableHash({ cpicEntry, clause })` and `snapshot.scopes` becomes the
union of the CPIC-derived scopes and the clause's scopes. **That is the only change to your code.**

It buys a stronger claim: the authorization is bound to the clinical evidence *and* the coverage
policy, so a revision to either supersedes it. Say that in the authorization panel header:
`bound to 2 sources`.

Use the `revision` block in `data/policies.json` as the supersede trigger instead of a CPIC
revision — policy revisions are far more frequent in real life, which makes the beat feel like
ordinary operations rather than a contrived event. It affects scope `dosing.capecitabine`, so the
capecitabine exception dies and the codeine one lives, exactly as before.

## Budget

**20 minutes, Fable. 5 minutes, Sol.** If Fable is over 20, ship `coverageFor` returning the
clause and skip the expand interaction — the one line is what matters.

If you are behind on the core build when you reach this, **skip this task entirely.** A working
clinical stop with a signed, supersedable, tamper-evident authorization is a complete project.
This layer is worth exactly one sentence on stage and should never cost more than it returns.

## Acceptance

1. Okafor + capecitabine → clinical red card **on top, unchanged**; coverage line below reads
   `not covered at standard dose` with the alternative
2. Lindqvist + capecitabine → green clinical line, coverage `covered · PA-ONC-014.4`
3. Reyes + codeine → red clinical card, coverage `not covered · PA-PAIN-007.1`, non-codeine
   alternative shown
4. A patient with no DPYD result → coverage `pended · PA-ONC-014.1`. New, nearly free, and it is
   the most common real prior-auth outcome — anyone who knows this space will notice you handled it
5. Publish the policy revision → capecitabine exception `SUPERSEDED`, codeine `VALID`, chain green
6. **Squint test:** from across the room, the card still reads as a clinical safety stop, not as an
   insurance denial. If the payer line is competing for attention, shrink it.

Test 6 is the one that matters. If this layer makes the demo feel like a prior-auth tool, it has
failed at its job and you should delete it.

---

## Deliverable clause — inherited from `_template.md`, not optional

**1. Enumerate what you REMOVED (rule 4i).** Separately and always: every test,
assertion, branch, error handler, or comment carrying an invariant that you deleted.
**If nothing was removed, say so in those words.** A removal leaves no line to review
and no test to fail — it is invisible by construction. `sh scripts/check-removals.sh`
runs before your diff is read.

**2. Name the test that goes RED when you revert THAT LINE (rule 4e).** Not the
subsystem — the line. If the suite passes identically with and without your change,
there is no coverage of it, whatever the number next to the slash. If you cannot name
the test, you have found a gap, not a formality.

**3. Pin the CALL SITE, not just the implementation (rule 4a-quater).** For every
capability you add, name the one line that invokes it in production code, delete that
line, and run the tests that claim to cover the feature. If they stay green, the wiring
is untested — add an assertion on the call site before restoring the line.
**The live instance in this codebase:** `/api/prescribe` calls `ledger.append`. Delete
that call and every ledger test still passes, because they call the ledger directly.

**4. Before trusting a check that passed, confirm it CAN fail (rule 4a-bis).** Echo the
applied-count first (`grep -c '<changed text>' <file>`) and assert it is what you
expect. A mutation that never landed and a guard that does not work produce the
identical observation. If you cannot state what your command would print if the
property were false, you have not verified the property.

**5. Put the evidence and the claim in the same sentence (rule 4g).** *"`evaluate.ts`
copies `entry.recommendation` through untouched, therefore the string on screen is
CPIC's."* If the sentence has no *therefore*, there is no evidence in it.

**6. Surface every shim, stub, hardcoded value or synthetic id you introduce** —
unprompted, even when inconvenient. Anything surfaced and deliberately not fixed goes
to `REGISTER.md` **in the same run** (rule 5), not into a summary nobody reads twice.

**You do not certify your own work.** Hand over the diff and the reasoning; the other
agent audits it and Opus 5 closes the phase against a named artifact.
