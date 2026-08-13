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

## Phase 0 — blocker. Nothing else works until this is green.

**`npm run verify` currently reports 7 failures.** The cache is keyed on the wrong
field. `scripts/cache_cpic.py::lookup_terms()` prefers `lookupkey`, which for DPYD and
CYP2D6 is the **activity score** (`"0.0"`, `"≥3.75"`), not the phenotype name. The
readable name is in `phenotypes` — present on 2,083 of 2,115 rows. The 32 without it
are HLA genes, which is the case the current order was written for.

```python
# scripts/cache_cpic.py, lookup_terms()
return rec.get("phenotypes") or rec.get("lookupkey") or {}   # was: lookupkey first
```

Also carry the score through in `build_index()`, it is needed below:

```python
"activityScore": (rec.get("activityscore") or {}).get(gene),
```

Then `python3 scripts/cache_cpic.py && npm run verify`. **Verified by in-memory
simulation against the real cache:** all three demo paths resolve with correct severity,
Level A true on each, and HLA still falls through correctly to `"*57:01 positive"`.

### The design decision this exposes — decide it before Fable writes `evaluate.ts`

Keying by phenotype is **one-to-many**. `"Poor Metabolizer"` matches 2 rows (activity
scores 0.5 and 0.0); `"Ultrarapid Metabolizer"` matches **11**. Every row in each group
agrees on severity here, so the demo is safe — but if `evaluate()` takes "the first one
encountered," the selection is insertion-order dependent. That is the same defect class
as template rule 2's heap-order-nondeterministic hold selection.

Pick one, record it in `DECISIONS.md`:

- **(a) Assert agreement.** If N rows match and they disagree on severity, throw. Cheap,
  and it converts a silent wrong answer into a loud failure.
- **(b) Disambiguate on activity score.** Add `activityScore` to `data/patients.json` —
  Okafor's `c.1905+1G>A` homozygote is complete deficiency, score `"0.0"` — and match on
  phenotype **and** score. More correct, and selects the exact row whose text is in the
  demo script.

(b) is better; (a) is fine if the clock is tight. **Doing neither is not fine.**

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
npx tsc --noEmit
npx next lint | grep -cE "^(app|lib|components)/"   # grep the count, never the tail
npm test                                             # name the tests for THIS phase
npm run verify
sh scripts/check-removals.sh
```

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
