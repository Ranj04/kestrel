# Phase 1 — OPENED by Opus 5 (overseer)

Written **before** either diff is read. I deliberately did not open any file under
`lib/ledger/store.ts`, `lib/ledger/tamper.ts` or `app/api/ledger/**`, which had already
landed while I was reading — the predictions in §4 are worthless if I look at the answer
first. Everything measured below comes from the frozen inputs: `lib/contracts.ts`,
`data/cpic/index.json`, `data/patients.json`, `scripts/verify-setup.mjs`, `lib/ledger/hash.ts`.

Inputs read: `BUILD_ORDER.md`, `CLAUDE.md`, `_template.md`, `_context.md`, both phase-1
prompts, `DECISIONS.md` D3/D6, `REGISTER.md` R-5/R-6/R-16, `.sol/requests/phase1-sol-lint.md`.

---

## 0. Two things that are already broken, before either agent reports a gate

**(a) The lint step of the per-phase gate measures nothing. CONFIRMED INDEPENDENTLY —
Sol raised it in `.sol/requests/phase1-sol-lint.md` and I found it separately; rule 10,
so it goes to the top of the list.**

Measured, in this repo, just now:

```
npx next lint            -> "Invalid project directory provided, no such directory: …/lint"
                            (Next 16.2.9 removed `next lint`; it is parsed as a directory arg)
npx next lint | grep -cE "^(app|lib|components)/"   -> 0        # reads exactly like "lint clean"
npx eslint app lib       -> TypeError: Converting circular structure to JSON
                            (@eslint/eslintrc FlatCompat + eslint-config-next 16 on ESLint 9.39.5)
```

Both instruments print zero findings while linting zero files. That is the template's own
"a lint grep anchored away from the directory just written" failure, sitting inside the
gate in `BUILD_ORDER.md` and `CLAUDE.md` ADAPTATION 4. **No party may report "lint clean"
this phase using either command.**

Working replacement, measured: `eslint-config-next@16.2.9` ships flat configs, so
`eslint.config.mjs` becomes

```js
import cwv from "eslint-config-next/core-web-vitals";
import ts  from "eslint-config-next/typescript";
export default [...cwv, ...ts];
```

With that config `npx eslint .` lints **21 files and reports 8 problems right now** — i.e.
the replacement instrument is demonstrably not stuck at zero. **Arbitration: `eslint.config.mjs`
is unassigned in `_context.md`'s ownership lists; I assign it to Fable**, who owns
`package.json`, `tsconfig.json` and `next.config.*`. Sol does not touch it. Until it is
fixed, the gate line is `npx eslint . -f json | <count>`, and if it still crashes the phase
closes with the lint criterion recorded as **NOT MEASURED**, never as passed.

**(b) `npm run verify` cannot import a `.ts` file, so R-5 has a mechanical blocker.**
Measured on this machine (Node v20.19.6): `node probe.mjs` importing a `.ts` module throws
`ERR_UNKNOWN_FILE_EXTENSION`. `npm run verify` is plain `node scripts/verify-setup.mjs`.
So "move `severityOf` to `lib/pgx/evaluate.ts` and have the preflight import it" also
requires Fable to change the script to `node --import tsx scripts/verify-setup.mjs`.
I verified that form loads a repo `.ts` module *and* resolves the `@/` alias. This is the
supported path, not a workaround — and Sol independently hit the same `tsx`-launcher issue
from the other direction (`npx tsx` fails in its sandbox, `node --import tsx` works).

---

## 1. Acceptance criteria — Fable

Each is one sentence and carries its own evidence. No criterion is met by a description of it.

- **F1.** `curl` on `pt_okafor` + `"Xeloda 1250 mg/m2 BID"` returns `severity:"critical"` and a
  `recommendation` that `grep -F` finds in `data/cpic/index.json`, **therefore** the sentence on
  screen is CPIC's row and not the model's prose.
- **F2.** In the same run, on the same drug string, `pt_lindqvist` returns `alert:null` while
  `pt_okafor` returns critical, **therefore** the null is a decision about a genotype and not a
  lookup that resolves nothing.
- **F3.** `evaluate()` returns `null` for every `(drug,gene,lookup)` triple in the shipped cache
  whose matched rows disagree on derived severity, **therefore** D6's agreement assertion is
  executing on real data rather than only on a hand-built pair of objects.
- **F4.** `grep -c 'function severityOf' scripts/verify-setup.mjs` returns `0` while
  `npm run verify` still exits `0`, **therefore** R-5's second declaration is gone rather than
  shadowed by a still-present copy.
- **F5.** Deleting the `ledger.append("alert.raised", …)` line from `app/api/prescribe/route.ts`
  turns a **named** test red, **therefore** the seam is pinned and not merely the capability
  (4a-quater; Sol has correctly disclaimed this pin as Fable's — I agree, it is Fable's).

## 2. Acceptance criteria — Sol

- **S1.** Five appended records, re-read from `data/ledger.jsonl` **in a fresh process**, recompute
  to the same digests, **therefore** a clean chain verifies clean after the round trip that kills
  demos, not merely inside the process that wrote it.
- **S2.** After `tamper(2)` on a six-record chain, `verify()` returns
  `ok:false, firstBrokenSeq:2, brokenSeqs:[2,3,4,5]`, **therefore** what the UI will render is the
  cascade rather than a single red line.
- **S3.** Tampering record 2 *and* recomputing record 2's own hash still fails, with
  `firstBrokenSeq:3`, **therefore** the instrument verifies the chain and not a per-row digest.
- **S4.** `POST /api/ledger/verify` returns `ok:false` for a file tampered on disk while the server
  keeps running, with `checkedAt` advancing between two consecutive calls, **therefore** the green
  check is computed this request and cannot be a memoized one.
- **S5.** An override record's stored JSONL line carries `printedName`, `signedAt` and
  `signatureMeaning` as three literal keys, **therefore** §11.50's manifestation is stored data
  rather than something derived at render time.

## 2b. The one criterion neither side can satisfy alone

- **X1.** After `POST /api/ledger/reset` and exactly one `POST /api/prescribe` for `pt_okafor`,
  `data/ledger.jsonl` on disk contains ≥3 lines whose `.type` sequence is
  `order.placed, genotype.resolved, alert.raised`, and `POST /api/ledger/verify` returns `ok:true`,
  **therefore** Fable's route writes through Sol's store and the chain it produces verifies.
  **This is the artifact I most want and the one most likely to be missing.** Every ledger test can
  pass and every prescribe curl can look perfect with this file at zero lines.

---

## 3. For each criterion, the check most likely to EMBARRASS it

| # | The check that would expose a hollow pass |
|---|---|
| **F1** | Not the grep — the grep's **negative control**. Run `grep -cF "<returned string>" data/cpic/index.json` (measured: `4` for Okafor's, `11` for Reyes'), then run it again with one character changed and require `0`. A `grep -F` that matches an arbitrary string is not evidence of provenance. Then re-run the whole curl with `ANTHROPIC_API_KEY` and `AWS_ACCESS_KEY_ID` unset: if the same string comes back, no model was in the path at all. |
| **F2** | A `null` that is *always* null is indistinguishable from a dead join, and Okafor-on-the-same-drug (already required by ADAPTATION 3) only proves the *drug* row is reachable. **Isolate the patient variable:** copy Lindqvist, change her `lookup` from `"2.0"` to `"0.0"`, call `evaluate()` — she must go `critical`. If she stays null under a genotype swap, the null is the R-6 silent failure returning. |
| **F3** | **Refuse the synthetic fixture as sufficient.** The cache contains **345** multi-row `(drug,gene,lookup)` triples and **152** whose rows disagree on derived severity — I measured both. `amitriptyline / CYP2D6 / "1.0"` has **9** real rows spanning `caution` and `critical`; `amitriptyline / CYP2D6 / "2.0"` spans `none`, `caution` **and** `critical`. Sweep all 152 through the real `evaluate()` via the real `getIndex()` and require 152 nulls. A test that builds two objects and calls a helper never proves `evaluate()` uses `.filter()` rather than `.find()`. Then mutate the agreement assertion to `rows[0]`, prove the edit landed with `grep -c` **before** reading the suite (4a-bis-MUT), and confirm the sweep goes red. |
| **F4** | The function name disappearing is not the property. **Mutate the rule at its new single source:** change `/avoid/i` to `/avo1d/i` in `lib/pgx/evaluate.ts`, echo `grep -c 'avo1d' lib/pgx/evaluate.ts` = 1, then run `npm run verify`. **It must now FAIL.** If the preflight still prints PASS, it is reading its own copy and R-5 is not closed regardless of what the diff says. Also require `grep -c 'avoid' scripts/verify-setup.mjs` = 0 — the regex must be gone, not just the wrapper. |
| **F5** | Delete the line, then run the **whole** suite (both agents' files), not Fable's alone. And the harder half: after one `curl`, `wc -l data/ledger.jsonl`. A green suite with a zero-line ledger is the exact shape of this defect — implementation present, tests present, call absent, nothing wrong on screen. |
| **S1** | The in-process round trip proves serialization, not the medium. **Scramble the file's key order and re-verify:** `cat data/ledger.jsonl \| jq -cS .` (sorts keys on every line) piped into `verify()` must still return `ok:true`. If it goes red, `canonicalJson` is not doing the one job it exists for and the chain will show red on stage before anyone touches it. Run `readAll()` from a separate process so no module state can be inherited. |
| **S2** | **Prove the tamper landed before reading verify.** Capture `jq -r 'select(.seq==2).hash'` and the target payload value *before*, run the tamper, then `grep -c "<the new value>" data/ledger.jsonl` = 1 and confirm the stored `hash` is byte-identical to the captured one. A tamper that missed and a verify that does not work produce the same observation — this is the project's own 4a-bis-MUT, and the tamper script is its live instance. |
| **S3** | Require `firstBrokenSeq === 3`, not just `ok:false`. Asserting only `ok:false` also passes on an implementation that breaks for the wrong reason, which is how a re-hash test ends up proving nothing. |
| **S4** | Tamper the file with `jq`/`sed` **outside the app** while the server is up, then `POST /api/ledger/verify` twice — the **first** call must already be `ok:false`, and the two `checkedAt` values must differ. Separately, `grep -c 'force-dynamic\|revalidate' app/api/ledger/route.ts` must be ≥1: a `GET` route handler with no dynamic marker is a candidate for prerendering, and a green check baked at build time is the worst bug available in this codebase. |
| **S5** | A test that passes three fields in and reads three fields out proves JSON round-trips. `recordOverride`'s input signature has **no** `signedAt`, so require that the stored `signedAt` was generated at append time (within seconds of now, not a caller value) and grep the three keys out of the raw JSONL line rather than out of the returned object. Contemporaneous means the store set it. |
| **X1** | Do this on a **reset** ledger with exactly one curl, and read the file with `jq -r .type` rather than trusting the API's own echo of what it thinks it wrote. |

---

## 4. Named artifacts and the certified SHA (rule 4c)

Two files, pasted output only — no summaries, no "as expected".

**`.sol/reviews/phase1-fable-artifacts.txt`** must contain, in one run:

```sh
npm run verify; echo "verify exit=$?"
npx tsc --noEmit; echo "tsc exit=$?"
npx eslint . -f json | node -e '…count…'            # after §0(a) is fixed; else record NOT MEASURED
npm test 2>&1 | grep -E "evaluate|severity|conflict|call-site|prescribe"   # NAME the phase-1 tests
# F1
curl -s localhost:3000/api/prescribe -H 'content-type: application/json' \
  -d '{"patientId":"pt_okafor","drugRaw":"Xeloda 1250 mg/m2 BID","orderedBy":"dr_chen"}' \
  | jq '{sev:.alert.severity, rec:.alert.recommendation, ctrl:.credibility.requiredControl, cites:(.alert.citations|length), method:.resolution.method}'
grep -cF "<that exact rec>" data/cpic/index.json         # EXPECT 4
grep -cF "<that rec, one char changed>" data/cpic/index.json   # EXPECT 0   <- the negative control
# F2 (same run) lindqvist -> null ; okafor -> critical ; plus the 2.0 -> 0.0 genotype swap
# F3
node --import tsx scripts/…d6-sweep…                     # EXPECT "152 disagreeing triples, 152 null"
# F4
grep -c 'function severityOf' scripts/verify-setup.mjs   # EXPECT 0
grep -c 'avoid' scripts/verify-setup.mjs                 # EXPECT 0
#   then: mutate /avoid/i -> /avo1d/i in lib/pgx/evaluate.ts, grep -c 'avo1d' = 1,
#   npm run verify -> NONZERO exit, revert, npm run verify -> exit 0
# F5
#   delete the ledger.append line -> named test red (paste the test name), restore
wc -l data/ledger.jsonl                                  # after one curl. EXPECT >= 3
sh scripts/check-removals.sh; echo "removals exit=$?"
```

**`.sol/reviews/phase1-sol-artifacts.txt`** must contain:

```sh
npm test 2>&1                        # all 7 ledger tests NAMED individually, not a total
cat data/ledger.jsonl | jq -cS . | node --import tsx -e '…verify(records)…'   # EXPECT ok:true
jq -r 'select(.seq==2).hash' data/ledger.jsonl           # before AND after tamper: identical
node --import tsx scripts/tamper.ts                      # (npx tsx fails in Sol's sandbox)
grep -c "<the altered payload value>" data/ledger.jsonl  # EXPECT 1  <- the tamper landed
curl -s -XPOST localhost:3000/api/ledger/verify | jq '{ok,firstBrokenSeq,brokenSeqs,checkedAt}'   # x2
jq -c 'select(.type=="alert.overridden")' data/ledger.jsonl   # the raw line, all three §11.50 keys
grep -c 'force-dynamic\|revalidate' app/api/ledger/route.ts
```

**Files that must exist for me to close**, and this is the path list the certification is
scoped to (4c-bis condition 2 — recorded here, not reconstructed later):

```
lib/pgx/index.ts  lib/pgx/resolve.ts  lib/pgx/evaluate.ts  lib/credibility.ts  lib/llm.ts
app/api/prescribe/route.ts  scripts/verify-setup.mjs  package.json  eslint.config.mjs
lib/ledger/store.ts  lib/ledger/verify.ts  lib/ledger/tamper.ts  lib/ledger/override.ts
lib/ledger/hash.ts  scripts/tamper.ts  app/api/ledger/  tests/
```

and **`lib/pgx/ledger-shim.ts` must NOT exist** (`test ! -f`, pasted).

**SHA.** I cannot run git. Fable commits both halves; the executing session pastes
`git rev-parse HEAD` and `git status --short` (must be clean) into the close request. I certify
**that** SHA, and any amend or force-push after it voids the certification (4c).

---

## 5. Where I predict this phase actually fails

Ranked, with my reasoning, and I am willing to be wrong on all three.

**P1 — R-5 closes on paper, not in the instrument. (~75%.)** The blocker is measured, not
guessed: plain `node` on 20.19.6 cannot import a `.ts` file, and `npm run verify` is plain
`node`. Fable will hit `ERR_UNKNOWN_FILE_EXTENSION` mid-task, and the cheap escapes — keep the
local copy "for now", or extract to a `.mjs` and import *that* into `evaluate.ts` — both leave
`grep -c 'function severityOf' scripts/verify-setup.mjs` at 1 while `DECISIONS.md` says the
duplication is closed. R-5's own history is this exact shape twice already ("the trigger had no
carrier"). The F4 mutation probe is the only thing that separates the two outcomes.

**P2 — the D6 guard ships proven only against a synthetic fixture. (~60%.)** The prompt asks for
"a synthetic two-row disagreement", so the literal instruction is satisfiable without the real
index ever being consulted. An `evaluate()` that used `.find()` instead of `.filter()` would pass
a helper-level synthetic test and still cite the wrong row on `amitriptyline/CYP2D6/"1.0"`. The
honest test costs nothing because the cache already contains 152 disagreeing triples — I measured
them — so if the sweep is absent from the artifact, the guard is unproven on the path that
matters. R-16 says this in advance; my prediction is that it happens anyway.

**P3 — the prescribe→ledger seam is what is actually missing at the end. (~50%.)** Fable is told
to shim behind a `try/catch` import and delete the shim "the moment `lib/ledger/append.ts`
exists" — but Sol was told to write `lib/ledger/store.ts`, so the literal trigger condition
never becomes true. A `try/catch` dynamic import that falls back is invisible by construction:
ledger tests pass (they call `append` directly), prescribe curls return correct JSON, the UI has
nothing wrong on it, and `data/ledger.jsonl` stays at 0 lines. This is 4a-quater with the absence
in a third file. `wc -l data/ledger.jsonl` after one curl is the whole check, and it is exactly
the check nobody runs because nothing looks broken.

**Also watching, ranked lower (~40%):** `store.ts` holds `seq` in module state while
`scripts/tamper.ts` and `POST /api/ledger/reset` mutate the file from other processes / other
module instances, so a CLI reset or tamper followed by a live append writes a duplicate or
non-monotonic `seq` and `verify()` goes red for a reason that is not tampering. On stage that is
indistinguishable from a real chain break. Cheap probe: reset via CLI, curl once, `verify` — must
be `ok:true`.

---

## 6. Standing instructions for this phase

1. **Nobody certifies their own half.** Fable audits Sol's diff, Sol audits Fable's evidence and
   is explicitly instructed to argue the opposite case. I read both independently and never a
   summary of one from the other.
2. **Sol never claims to have tested anything.** Its sandbox cannot bind :3000 and its `npx tsx`
   launcher fails; every curl and every `npm test` line in Sol's artifact file must have been run
   by the executing session, and Sol's own text must say so.
3. **A criterion with no pasted artifact closes as NOT MET**, not as "probably fine". That
   includes the lint line if §0(a) is unresolved.
4. Anything surfaced and not fixed goes to `REGISTER.md` **in the same run** (rule 5).
   R-5 and R-16 both close this phase or are re-stated as OPEN with a reason.
