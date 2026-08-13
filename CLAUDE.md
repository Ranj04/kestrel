# CLAUDE.md — Attest ground rules

**Read `.sol/prompts/_template.md` first. It is inherited in full.** This file states
only what this project adapts, and why. Every adaptation below is written down rather
than silently dropped, per rule 6: accepted limitations must be stated as limitations,
with the reason and the follow-up that would fix them.

Then read `.sol/prompts/_context.md` and your phase prompt.

---

## The four parties, mapped to this project

| Party | Is | Owns | Cannot |
|---|---|---|---|
| **Opus 5 — overseer** | `Agent(model: "opus")` | Phase order, phase completion, arbitration, judging whether a claim is supported | Write the code it judges. Reach the machine. |
| **Sol** | `codex exec` via Bash | `lib/ledger/`, `lib/export/`, `app/api/ledger/`, `components/ledger/`, `scripts/tamper.ts` | Run anything. Must never claim to have tested. |
| **Fable 5** | `Agent(model: "fable")` | `lib/contracts.ts`, `lib/pgx/`, `lib/credibility.ts`, `lib/llm.ts`, `app/api/prescribe/`, `components/prescribe/`, `app/page.tsx`, `data/patients.json` | Certify work it wrote itself. |
| **Claude Code** | Ranjiv's session | Execution. Applying diffs, `npm run dev`, `npm test`, curl, capturing artifacts. The only party with machine + network. | Certify its own evidence. Arbitrate a Sol/Fable disagreement. |

**Whoever wrote it does not get to certify it.** That rule is unchanged and is the
reason for every adaptation below.

---

## ADAPTATION 1 — both agents write, and each audits only the other

**Conflict.** The template's topology is *Sol writes → Fable audits*. This project's
build splits the codebase into two independently-owned halves so a solo builder gets
two workstreams. Naively inheriting the template would serialise the build; naively
keeping the split would leave both halves uncertified by anyone but their author.

**Resolution.** The template already permits this — *"Steps 1 and 2 may run in
parallel with any independent unit of work — Sol building phase N+1 while Fable
audits phase N is fine, and is the point of having two builders."* So:

- Each agent writes only inside its own directories (`.sol/prompts/_context.md`).
- Each agent audits **only the other's** diff. Never its own.
- `lib/contracts.ts` is the entire interface and is frozen before either starts, so
  neither is ever blocked and neither can be nudged into editing the other's files.
- **What must not overlap is a phase closing while its audit is still open.**

The core rule survives intact: the certifier is never the author.

## ADAPTATION 2 — the full six-step loop runs on two units, not all of them

**Limitation, stated as one.** There are roughly five hours between build start and
demo, and one builder driving all four parties. Running the full open → write →
audit → execute → adversarial-audit → close loop on every unit would not finish.

**What gets the full loop, non-negotiable:**

1. **`lib/pgx/evaluate.ts`** — every clinical claim on screen comes out of it. If it
   can put the wrong recommendation on the wrong patient, that is the worst defect
   this codebase can have.
2. **`lib/ledger/hash.ts` + `verify.ts`** — the measurement instrument. A clean chain
   that verifies broken kills the demo on stage; a tampered chain that verifies clean
   kills the product's entire claim.

**What gets the light loop** (write → cross-audit at feature freeze only): all UI
components, `lib/export/`, `lib/credibility.ts`, `lib/llm.ts`.

**The follow-up that would fix it:** more wall-clock, or a second human. Recorded in
`REGISTER.md` rather than left implicit — per rule 5, anything surfaced and
deliberately not fixed gets written to the register in the same run.

## ADAPTATION 3 — evidence standard, project-specific

The template's artifact table is for on-chain movement, provider ids, and webhooks.
None exist here. **The standard itself is unchanged: nothing is "working" without an
external artifact a third party can independently verify.** Only the table changes.

| Claim | Required artifact |
|---|---|
| "The alert fires" | `curl` output of `/api/prescribe` showing `severity` **and** the recommendation string — *and* `grep -F "<that exact string>" data/cpic/index.json` returning a line. The API echoing itself is not evidence the string came from CPIC. |
| "No alert for the normal metabolizer" | `alert: null` for `pt_lindqvist`, **plus** the red result for `pt_okafor` on the same drug captured in the same run. A null alone is indistinguishable from a broken lookup. |
| "The chain detects tampering" | `verify` output before (`ok:true`) and after (`ok:false`, `firstBrokenSeq`, `brokenSeqs`) where the tamper was performed by `npx tsx scripts/tamper.ts` **outside the running app** |
| "A clean chain verifies clean" | `npm test` output naming the round-trip test specifically, not the total |
| "This test pins that behaviour" | `grep -c '<the changed text>' <file>` returning ≥1 **first**, then the named test going red. Rule 4a-bis-MUT: a green suite after a mutation means suspect the mutation, not the guard. |
| "Coverage clause X applied" | the clause id in the response **and** `grep -F "<clauseText>" data/policies.json` |
| "The authorization superseded correctly" | both authorizations' statuses in one output — the superseded one **and** the surviving one. One alone proves a flag was set, not that a scope check ran. |
| "Typecheck / lint clean" | the count line or exit code, never the tail (rule 4h) |
| "The export is independently verifiable" | the HTML opened **with the dev server stopped** |

No artifact means the status is not working. No softer wording, no partial credit.

## ADAPTATION 4 — definition of done

The template's gate assumes real Postgres, migrations, and a PR. This project has no
database, no migrations, and no review branch. Replacement, applied per phase:

```
npx tsc --noEmit          # typecheck
npx next lint             # grep the count, do not eyeball the tail (4h)
npm test                  # name the tests that cover this phase, not the total
npm run verify            # data layer consistency
sh scripts/check-removals.sh   # rule 4i, mechanical
```

plus: the artifact captured and independently challenged by the party that did not
produce it, and the cross-check exchange written to `.sol/reviews/`.

**`.sol/reviews/` is this project's PR description.** The exchange is a deliverable,
not a formality.

## ADAPTATION 5 — no `git`-based mutation loop before first commit

Rule 4b says commit before mutation-testing, because `git checkout` restores from
HEAD and will destroy uncommitted work. This repo starts with **no commits at all**.

**Claude Code commits the scaffold before either agent writes a line**, and commits
at the close of every phase. If you are about to mutate and `git log` is empty, stop
and commit first.

---

## Rules that apply here with unusual force

Not a re-listing — the template is inherited whole. These three have a live trigger
in this codebase and are worth naming:

**Rule 4a — a fixture must make correct and buggy values differ.** The live instance:
`data/patients.json` `lookup` strings. If one is off by a character the alert silently
never fires — no error, no warning. `npm run verify` exists solely to catch that, and
`npm run verify -- --prove` demonstrates the checker can fail, per 4a-bis.

**Rule 4a-quater — testing a capability is not testing that anything uses it.** The
live instance: Fable's `/api/prescribe` calls Sol's `ledger.append`. Delete that call
and every ledger test still passes, because they call the ledger directly. **Pin the
call site.** This is the exact defect shape — the implementation is present and
correct and the absence is in a different file.

**Rule 4g — put the evidence and the claim in the same sentence.** "The alert is
CPIC's wording, therefore it is citable" is a claim you can check while writing it.
"The alert works" is not. If the sentence has no *therefore*, there is no evidence
in it.

## Standing constraints, project-specific

- **Never fabricate a clinical recommendation or policy language.** Every clinical
  string comes verbatim from `data/cpic/index.json`; every clause verbatim from
  `data/policies.json`. This supersedes the template's "do not weaken guards" as the
  invariant with the highest severity here.
- **Never fabricate a hash or a verification result.** If verify cannot run, render an
  error state. Never a green check you did not compute this request.
- Never present a simulated guideline or policy revision as a real one. Label it.
- The app must be fully demoable with **no network and no LLM key**. Build the
  deterministic fallback first, then the model call.
- Synthetic patients only, labelled on screen.
- Minimum code. No speculative abstraction. There is no second day for this codebase.
