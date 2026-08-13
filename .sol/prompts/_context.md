> **Inherits `.sol/prompts/_template.md` in full**, plus the adaptations in `CLAUDE.md`.
> Read both before this file. Sol also reads `AGENTS.md` (a pointer, not a copy — rule 7).
> The deliverable clause at the bottom is inherited and not optional.

# SHARED CONTEXT — read this before every task

You are one of two agents building **Attest** in `~/"biopharma hack"` during a one-day hackathon.
The other agent is working in parallel in the same repo right now. Your task prompt says which
one you are. **Nobody is watching. Do not ask questions.** When something is ambiguous, pick the
option that keeps the demo working, note it in a one-line comment, and keep moving. Finish the
whole task.

There are roughly five hours between the start and the demo. Wall-clock is the binding constraint,
not elegance.

## THE REPO PATH CONTAINS A SPACE

`~/biopharma hack`. Quote it in **every** shell command, every time:

```sh
cd ~/"biopharma hack"          # correct
cd ~/biopharma hack            # runs `cd ~/biopharma` and silently succeeds elsewhere
```

Unquoted, it word-splits and your command runs in the wrong directory — and often
*succeeds there*, which is the failure mode rule 4a-bis is about: a command producing
no error while measuring nothing. `sh scripts/check-removals.sh` and `npm run verify`
both resolve paths relative to cwd, so a bad `cd` makes them report on nothing.

## What we are building and why

**Attest** — a pharmacogenomic prescribing check with a regulator-legible audit trail under it.

A clinician places a drug order. The patient's genotype is already on file. If the gene–drug pair
is one CPIC has a guideline for, the order is interrupted with CPIC's recommendation. The
clinician can override, but the override is captured as a signed, hash-chained record that cannot
be quietly altered afterwards.

Two halves, and they need each other:

1. **The alert.** Roughly a third of people carry a variant that changes how they handle a common
   drug. A DPYD poor metabolizer given capecitabine can die from the first cycle. The science is
   settled and the data is free — and almost no US hospital does this check.
2. **The receipt.** Existing pharmacogenomic alerts get overridden because they look like every
   other pop-up. An alert that shows its exact source, and that records the dismissal as a signed
   permanent record, is a different object. That layer is what nobody has built, and it is the
   reason this is a project and not a re-skin of an existing product.

## THE RULE THAT DEFINES THIS PROJECT

**The model never writes the clinical recommendation. It routes to it.**

Every word of medical advice rendered on screen is a verbatim string read out of
`data/cpic/index.json`, carried with its evidence classification, guideline URL, and PMIDs.

The LLM is permitted exactly three jobs, none of them clinical:

1. Parse free-text prescriber input into a structured order
2. Resolve a brand name or typo to a CPIC drug name (`"Xeloda"` → `capecitabine`)
3. Draft a *suggested* override rationale that a human then edits and signs

**Never fabricate a clinical recommendation.** Any recommendation, implication, evidence level, or
citation string that did not come out of `data/cpic/index.json` is a correctness bug of the highest
severity — not a style issue. If you cannot find a real string for a case, render nothing and log
it. Do not write plausible-sounding medical text. Do not let an LLM write it either.

Synthetic patients only. Say so in the UI.

## The data

`data/cpic/index.json` was cached before the event from `https://api.cpicpgx.org/v1` and is
committed to the repo. **It is the only source of clinical truth and the app must never make a
network call to CPIC at runtime.** Conference wifi is assumed hostile.

Shape: `{ [drugNameLowercase]: { [gene]: Alert[] } }` where each entry has `gene`, `lookup`,
`phenotype`, `drug`, `recommendation`, `classification`, `implication`, `comments`, `population`,
`cpic_level_a`, `guideline_name`, `guideline_url`, `citations[]`, `_source`.

### `lookup` joins. `phenotype` displays. Do not confuse them.

**`lookup` is the join key and it is usually NOT a phenotype name.** Its shape varies by gene:

| gene | `lookup` | `phenotype` |
|---|---|---|
| DPYD | `"0.0"` | `"Poor Metabolizer"` |
| CYP2D6 | `"3.0"` | `"Ultrarapid Metabolizer"` |
| HLA-B | `"*57:01 positive"` | `null` |

For DPYD and CYP2D6, CPIC's `lookupkey` is an **activity score**. For HLA it is allele status and
`phenotypes` is `{}` entirely. So:

- Match on `lookup`, exact after trim and case-fold. Never fuzzy, never substring.
- Render `phenotype` to the user — an activity score of `0.0` means nothing to a clinician.
- Never join on `phenotype`: it is `null` for HLA, and it is **not unique** — DPYD `"0.0"` and
  `"0.5"` are both `"Poor Metabolizer"`, and their recommendations genuinely differ (the `0.5`
  text offers a reduced-dose path; the `0.0` text does not). A phenotype join can therefore put
  a clinically wrong recommendation on screen.

### Neither key is unique in general. Assert, do not assume.

`lookup` is 1-to-1 for all three demo pairs, but **it is not unique across the cache**:

| key | distinct keys | keys matching >1 row | of those, disagreeing on severity |
|---|---|---|---|
| `phenotype` | 609 | 274 | 105 |
| `lookup` | 940 | 345 | 152 |

The cause is **multi-gene recommendations**: amitriptyline is keyed on CYP2D6 *and* CYP2C19
jointly, so any single-gene lookup returns several rows that differ by the other gene.

So `evaluate()` must not take "the first row encountered" — that is insertion-order dependent,
which is template rule 2's nondeterministic-selection defect. **If more than one row matches,
assert they agree on severity and recommendation text; if they disagree, raise nothing and log
it.** Rendering one of two conflicting clinical answers is the worst defect available here.

The one deliberate exception is `data/policies.json`, whose `criterion.phenotype` matches the
phenotype name, because payers write coverage policy in phenotype language. That file says so.

This cost a real failure: `data/patients.json` originally carried `lookup: "Poor Metabolizer"` and
**every alert silently failed to fire**. `npm run verify` is what caught it. Run it.

## DIRECTORY OWNERSHIP — HARD RULE

Your task prompt names your role. Find your role below. **You may read anything in the repo. You
may create or edit files only inside your own list.**

**Fable owns:**

```
lib/contracts.ts        the shared interface — written first, then FROZEN
lib/pgx/                index loading, drug resolution, alert evaluation
lib/credibility.ts      the FDA influence x consequence risk grid
lib/llm.ts              provider wrapper + stubbed fallback
app/api/prescribe/
components/prescribe/
app/page.tsx            the two-pane shell
app/layout.tsx  app/globals.css
data/patients.json
README.md  DECISIONS.md  package.json  tsconfig.json  next.config.*
```

**Sol owns:**

```
lib/ledger/             record shape, canonical hashing, append, verify, tamper
lib/export/             inspection package builder
app/api/ledger/
components/ledger/
scripts/tamper.ts
```

Sol may also write ledger data into `data/ledger.jsonl`.

**Fable owns git.** Sol runs no git command — not `add`, not `commit`, not `checkout`. Sol leaves
files on disk and Fable commits them.

`lib/contracts.ts` is the entire interface between you. Fable writes it in the first ten minutes
and then does not change it. **If Sol needs a change to anything Fable owns, Sol writes the request
to `.sol/requests/<task-name>.md` and keeps working.** Sol does not edit it and does not wait.
Fable reads `.sol/requests/` at the start of each phase.

## Standing rules

- **Never fabricate a clinical recommendation.** See above. This is the one that matters.
- **Never fabricate a hash or a verification result.** If verification cannot run, show an error
  state. Do not render a green check you did not compute.
- **The demo must survive with no network and no LLM key.** Every LLM call needs a deterministic
  fallback path that keeps the core flow working. Build the fallback first, then the LLM call.
- **Simplicity.** Minimum code that solves the problem. No speculative abstractions, no settings
  pages, no configurability nobody asked for. If a file is 200 lines and could be 50, rewrite it.
  There is no second day for this codebase.
- **Do not stop.** If something fails, write what you tried into `.sol/requests/<task>.md` and
  move to the next part of the task. A half-finished task with a note beats a blocked agent.
- **Every visible number, string, and badge must be traceable to a file on disk.** If you cannot
  point at where a value came from, it does not go on screen.

## Environment

Next.js 15 App Router, TypeScript, Tailwind. Node 20+. `npm run dev` on port 3000.
Node's built-in `crypto` for SHA-256 — do not add a hashing dependency.
If you need a package, install it and note it in your final message.
