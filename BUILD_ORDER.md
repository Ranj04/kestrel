# Build order

Four parties, per `.sol/prompts/_template.md`. **Whoever wrote it does not get to
certify it.**

| Party | Is | Owns |
|---|---|---|
| **Opus 5** | `Agent(model: "opus")` | Opens and closes phases. Arbitrates. Never writes code. |
| **Fable 5** | `Agent(model: "fable")` | `lib/pgx/`, `lib/credibility.ts`, `lib/llm.ts`, `app/api/prescribe/`, `components/prescribe/`, `app/page.tsx`, `data/patients.json`. Owns git. |
| **Sol** | `codex exec` via Bash | `lib/ledger/`, `lib/export/`, `app/api/ledger/`, `components/ledger/`, `scripts/tamper.ts`. Never runs git. |
| **Claude Code** | this session | Applies diffs, runs everything, captures artifacts. Never certifies its own evidence, never arbitrates. |

---

## Phase 0 — RESOLVED in commit 88265e7 and arbitrated. Do not re-apply the edit below.

> **Status: green. `npm run verify` exits 0.** This section originally read *"`npm run
> verify` currently reports 7 failures"* and prescribed a specific edit to
> `lookup_terms()`. **That was true when written and is now stale** — the same root
> cause was fixed in commit `88265e7`, in the opposite direction. This file was
> untracked on disk at the time and was swept into that commit by a `git add -A`
> without being read. **Do not apply the phenotypes-first edit. It would regress the
> demo.** Kept here rather than deleted, per rule 4i: a removal nobody can review is
> worse than a correction someone can.

### The diagnosis was right

`lookupkey` for DPYD and CYP2D6 is the **activity score** (`"0.0"`, `"≥3.75"`), not the
phenotype name; the readable name is in `phenotypes`, present on **2,083 of 2,115** rows,
the remainder HLA. Both counts confirmed exactly against the cache.

### The prescribed fix was backwards

The index now carries **both** fields — `lookup` (joins) and `phenotype` (displays) — and
`data/patients.json` carries both, copied verbatim from CPIC's `diplotype` table. Keying
on `phenotypes` first would make Okafor's join 1-to-2:

| activity score | recommendation text |
|---|---|
| `0.5` partial deficiency | "Avoid… **In the event alternative agents are not suitable, 5-FU should be administered at a strongly reduced dose with early therapeutic drug monitoring.**" |
| `0.0` complete deficiency | "Avoid use of 5-fluorouracil or 5-fluorouracil prodrug-based regimens." |

Okafor is a homozygous `c.1905+1G>A (*2A)` — complete deficiency, score `0.0`. The `0.5`
row offers a reduced-dose path that is clinically wrong for her, and "first row
encountered" would decide which one the demo quotes.

### The design decision it exposed was real, and both options were needed

Arbitrated by Ranjiv; recorded as **D6**. The register entry is **R-16**.

Neither key is unique in general — measured on the real cache:

| key | distinct keys | matching >1 row | of those, disagreeing on severity |
|---|---|---|---|
| `phenotype` | 609 | 274 | 105 |
| `lookup` | 940 | 345 | 152 |

Cause: multi-gene guidelines (amitriptyline on CYP2D6 × CYP2C19) flatten into per-gene
buckets. `lookup` is 1-to-1 for all three demo pairs, which is why the demo is safe — a
property of those three pairs, not of the key.

So **(b) and (a), not (b) or (a)**: join on `lookup` (that is (b), already implemented),
**and** assert the matched rows agree, raising nothing when they conflict (that is (a),
specified in `phase1-fable-engine.md` and owed a test that proves the guard can fire).

## Phase 0b — structure and environment

```bash
node -e '["lib/contracts.ts","lib/ledger/hash.ts","data/cpic/index.json","data/patients.json","data/policies.json","data/cds-hooks-example.json",".sol/prompts/_context.md","CLAUDE.md","AGENTS.md"].forEach(f=>{try{require("fs").statSync(f);console.log("ok   "+f)}catch{console.log("MISS "+f)}})'
npm test                     # 6 pass
npm run removals:prove       # must report SHRANK, then exit 0
npm run dev                  # ONCE, on good wifi -- warms the next/font cache. then stop it.
```

`git rm -r --cached .git/_stale 2>/dev/null; rm -rf .git/_stale` — dead lock files from
a bridge-mount `git init`. Harmless, but clear them.

---

## Phase 1 — parallel. Both start at the same moment.

`lib/contracts.ts` is written and frozen, so neither agent blocks the other.

**Fable** → `.sol/prompts/phase1-fable-engine.md`
`lib/pgx/` (index, resolve, evaluate), `lib/credibility.ts`, `lib/llm.ts`,
`app/api/prescribe/`. Ends with an API you can `curl`.

**Sol** → `.sol/prompts/phase1-sol-ledger.md`
`lib/ledger/` (store, verify, tamper, override), `app/api/ledger/`. `hash.ts` is given —
**do not let Sol rewrite it.** Ends with tests proving the chain detects tampering.

**Gate:** `curl` the three demo patients. Okafor red, Lindqvist **null**, Reyes red.
Grep each recommendation string out of `data/cpic/index.json` — the API echoing itself
is not evidence it came from CPIC.

## Phase 2 — parallel.

**Fable** → `phase2-fable-ui.md` — left pane, alert card, Why? drawer, credibility grid.
**Sol** → `phase2-sol-ui.md` — right pane, signature modal, verify/tamper/export.

**Gate at 1280×720, no scrolling on either pane.** Tamper → red cascade; earlier records
stay green.

## Phase 2b — Sol. The differentiator. Do not cut this.

→ `phase2b-sol-snapshot.md`. Snapshot-bound authorizations. Publish a policy revision →
the capecitabine authorization goes `SUPERSEDED`, the codeine one stays `VALID`, and the
**hash chain stays green**. Two red states meaning different things is the whole design;
if they collapse into one, the idea is lost.

## Phase 3 — Fable, 20 min, skippable.

→ `phase0-coverage-layer.md`. One coverage line under the clinical card. **Squint test:
from across the room it must still read as a clinical safety stop, not an insurance
denial.** If the payer line competes for attention, shrink it. If it makes the demo feel
like a prior-auth tool, delete it.

## Freeze — demo minus 75 minutes. Hard stop.

1. **Cross-review, no edits.** Fable → `review-fable-on-sol.md`, Sol →
   `review-sol-on-fable.md`. Findings to `.sol/reviews/`.
2. Opus 5 reads both independently and closes. Fix **severity-1 only**.
3. **Record the fallback video.** Non-negotiable.
4. Rehearse twice with a timer. Under 90 seconds, twice.

Solo builders lose by still coding at demo time.

## Stretch — only after the video exists

→ `phase3-fable-cdshooks.md`. A live CDS Hooks `order-sign` endpoint. 40 min cap.
Converts one pitch sentence from assertion to artifact — worth less than the thing it
decorates.

---

## Per-phase gate

```bash
npx tsc --noEmit;              echo "tsc exit=$?"
npx eslint . -f unix | tail -1; echo "eslint exit=${PIPESTATUS[0]}"   # see R-17
npm test                                             # name the tests for THIS phase
npm run verify;                echo "verify exit=$?"
sh scripts/check-removals.sh;  echo "removals exit=$?"
```

> **The lint line was changed because the old one could not fail — see R-17.** It read
> `npx next lint | grep -cE "^(app|lib|components)/"`. `next lint` was removed in Next 16,
> so that command errors and the grep prints `0`, which is exactly what a clean run
> prints. **Assert on the exit code, never on a piped count a missing binary can satisfy.**
> `eslint.config.mjs` currently crashes on load (Fable owns it). Until that is fixed,
> record the lint criterion as **NOT MEASURED**. Never as clean.
>
> Same trap in `check-removals.sh`: it compares only `tests/*.test.ts` against HEAD, so
> `exit=0` having compared **0 files** is not a pass. It prints its own file count — read it.

Plus: the artifact captured and **challenged by the party that did not produce it**, and
the exchange written to `.sol/reviews/`. That directory is this project's PR description.

## Two rules that will actually bite

**4a-quater — pin the call site.** `/api/prescribe` calls `ledger.append`. Delete that
line and every ledger test still passes, because they call the ledger directly. Delete
it, confirm something goes red, and if nothing does, assert on the call site before
restoring it.

**4a-bis-MUT — when a mutation produces no reds, suspect the mutation.** Echo
`grep -c '<changed text>' <file>` first and assert it is what you expect. A mutation that
never landed and a guard that does not work look identical.
