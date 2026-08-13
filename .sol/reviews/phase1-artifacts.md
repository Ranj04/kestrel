# Phase 1 — artifacts, captured by Claude Code (the executing session)

Every line below was run in this session. **Neither builder produced any of it.**
Sol cannot run anything; Fable had no dev server. Criteria numbered per
`.sol/reviews/phase1-open.md`.

## Static gate

```
grep -c 'function severityOf' scripts/verify-setup.mjs   -> 0
grep -c 'avoid'               scripts/verify-setup.mjs   -> 0
test ! -f lib/pgx/ledger-shim.ts                         -> absent (correct)
npx tsc --noEmit                                         -> exit 0
npm run verify                                           -> exit 0
npm run verify:prove                                     -> exit 0
npm test                                                 -> 32/32 pass
sh scripts/check-removals.sh    -> compared 3 file(s), "no removals", exit 0
npx eslint .                    -> RUNS. 1 error: lib/ledger/tamper.ts:76 prefer-const (Sol's)
```

`check-removals` compared **3 files, not 0** — the instrument had something to
measure this time. `eslint` executes rather than crashing: R-17's second half is
closed. The one remaining error is real and is Sol's to fix.

## F4 — R-5 closed, proven by mutation not by absence

The function name disappearing is not the property. Mutating the rule at its new
single source must break the preflight:

```
sed 's|/avoid/i|/avo1d/i|' lib/pgx/evaluate.ts
grep -c 'avo1d' lib/pgx/evaluate.ts   -> 1        # 4a-bis-MUT: the mutation landed
npm run verify                        -> exit 1, "2 FAILURE(S)"
# restored
npm run verify                        -> exit 0
```

**Therefore** the preflight executes the same declaration `evaluate()` runs. R-5 CLOSED.

## X1 — the prescribe -> ledger seam (the overseer's P3, predicted 50% missing)

Reset, then **exactly one** curl:

```
POST /api/ledger/reset          -> ledger.jsonl = 0 lines
POST /api/prescribe (okafor)    -> HTTP 200
                                -> ledger.jsonl = 3 lines
jq -r .type data/ledger.jsonl   -> order.placed
                                   genotype.resolved
                                   alert.raised
POST /api/ledger/verify         -> {"ok":true,"firstBrokenSeq":null,"brokenSeqs":[],"total":3}
```

**Therefore** Fable's route writes through Sol's store and the chain it produces
verifies. **P3 FALSIFIED.** No shim was ever created.

## F1 / F2 — all three demo patients, one run

```
pt_okafor    + "Xeloda 1250 mg/m2 BID" -> capecitabine, exact, critical,  human-signature, not-covered
pt_lindqvist + "capecitabine"          -> capecitabine, exact, NULL,      auto,            covered
pt_reyes     + "codeine 30mg q6h prn"  -> codeine,      exact, critical,  human-signature, not-covered
```

`method: exact` on all three — **no model was in the path.**

Provenance, with its negative control:

```
grep -cF "<okafor recommendation>"              data/cpic/index.json -> 4
grep -cF "<same string, Avoid -> Avo1d>"        data/cpic/index.json -> 0   <- negative control
grep -cF "<reyes recommendation>"               data/cpic/index.json -> 11
reyes string != okafor string                                        -> YES
```

**Therefore** the strings are CPIC rows, not model prose, and the grep is capable
of returning 0 — without that control it proves nothing.

Isolating the patient variable (a null that is always null is a dead join):

```
lindqvist lookup="2.0"            -> null
lindqvist lookup="0.0" (swapped)  -> ALERT severity=critical
```

**Therefore** the null tracks the genotype, not a broken lookup.

## S1-S5 — the chain

External tamper, via the CLI, outside the app:

```
BEFORE  ok=true  firstBrokenSeq=null  brokenSeqs=[]
npx tsx scripts/tamper.ts -> seq 3, payload.rationale, "...monitoring." -> "...monitoring. [altered]"
grep -c '\[altered\]' data/ledger.jsonl -> 1          # 4a-bis-MUT: it landed
stored hash of seq 3 before == after    -> YES        # tamper did NOT re-hash
AFTER   ok=false firstBrokenSeq=3       brokenSeqs=[3,4]   records 0-2 green
```

S4 — the green check is computed per request, not memoized:

```
POST /api/ledger/verify                      -> ok:true
sed -i '' '2s/genotype.resolved/.../' ...    -> file tampered directly, server still running
grep -c 'resolvedX'                          -> 1
POST /api/ledger/verify   (FIRST call)       -> ok:false, firstBrokenSeq:1, cascade to end
checkedAt differs between two calls          -> YES
grep -c 'force-dynamic\|revalidate' app/api/ledger/route.ts -> 1
```

## D6 — the guard, and the sweep

`npm test` names it: test 19 positive control (agreeing rows still alert), test 20
the guard firing, test 21 the sweep of every real conflicting triple in the
shipped cache. Counts recomputed independently from `data/cpic/index.json`:
**940 distinct keys, 345 matching >1 row, 152 disagreeing on severity, 331 on text.**
Fable swept the 331 text-disagreement set, a superset of the 152.

## NOT verified

- `next build` — not run.
- The LLM-keyed path in `lib/llm.ts` — no `ANTHROPIC_API_KEY` present. Only the
  no-key path is exercised, which is the demo path.
- `npm test` leaves ~9 records in `data/ledger.jsonl`. **Reset before going on stage.**
