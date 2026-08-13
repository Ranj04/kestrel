# Decisions

One short paragraph per non-obvious choice. **The cross-review reads this first —
a decision recorded here is not a finding.** Append as you go; it costs 30 seconds
and saves an argument at 2:30.

## D1 — the model never writes clinical or policy text

Every recommendation, implication, evidence level and citation is verbatim from
`data/cpic/index.json`. Every clause string is verbatim from `data/policies.json`.
The LLM only parses free-text orders, maps brand names to generics, and drafts an
override rationale a human then edits and signs. This is what makes the provenance
claim true rather than decorative — and it is the same principle as Paperwork
Advocate's "LLM writes prose, deterministic code does the math."

## D2 — the ledger is a JSONL file, not a database

So it can be edited by hand on stage, in front of a skeptical judge, in ten
seconds. A Postgres table cannot be shown that way.

## D3 — `lookup` is the join key, `phenotype` is for display

CPIC's `lookupkey` is an **activity score** for DPYD and CYP2D6 (`"0.0"`, `"3.0"`)
and **allele status** for HLA (`"*57:01 positive"`, where `phenotypes` is `{}`).
It is almost never a phenotype name. The index therefore carries both fields:
join on `lookup`, render `phenotype`.

Joining on `phenotype` instead fails two ways — it is `null` for every HLA gene,
and it is not unique, so DPYD `"0.0"` and `"0.5"` both being `"Poor Metabolizer"`
means a phenotype join can pick the wrong row and cite the wrong recommendation.

**Neither key is unique in general, and my earlier framing here understated that.**
This entry warned that `phenotype` is non-unique and did not warn that `lookup` is
too. Measured against the real cache: `lookup` has 339 keys matching more than one
row, 146 of which disagree on severity — *more* ambiguous than `phenotype`, because
multi-gene recommendations (amitriptyline on CYP2D6 × CYP2C19) flatten into several
rows per single-gene key. `lookup` is 1-to-1 for all three demo pairs, which is why
the demo is safe, but that is a property of these three pairs, not of the key. See D6.

**This was not theoretical.** `data/patients.json` shipped with
`lookup: "Poor Metabolizer"`, which matches nothing, so every alert silently
failed to fire — the exact silent failure the preflight was built for. It was
caught by `npm run verify` on the first real run against the cache, not by
review. `data/policies.json` is the one deliberate exception: its criteria match
`phenotype`, because payer policy is written in phenotype language.

## D4 — hashing is ported from writ.ai, not written fresh

`lib/ledger/hash.ts` is a TypeScript port of `writai/hashing.py::stable_hash`,
with tests for the recursive-sort and integer-like-key cases. Given as finished
code so no agent is blocked on it.

## D5 — coverage is a layer, not a frame

The clinical stop stays the hero; the payer clause renders as one line beneath
it. A room feels a preventable death, not a claim. If the coverage line ever
competes for attention, shrink it.

## D6 — `evaluate()` asserts row agreement; it never takes the first match

A `(drug, gene, lookup)` triple can match more than one CPIC recommendation row,
because multi-gene guidelines flatten into per-gene buckets. Taking "the first one
encountered" makes the clinical answer depend on insertion order — template rule 2's
nondeterministic-selection defect, applied to the one output that must never be wrong.

So: match all rows for the triple. One row, use it. Several rows that agree on
severity and recommendation text, use it. **Several rows that disagree — raise no
alert and log the conflict.** Rendering one of two conflicting recommendations is
worse than rendering none, and a `pended`-style silence is honest where a coin-flip
is not.

This is BUILD_ORDER's option (a) applied on top of its option (b), not instead of it.
The two were offered as alternatives; the measurement says both are needed, because
(b) fixes which vocabulary you join on and (a) fixes what you do when the join is
still ambiguous. Verified 1-to-1 for all three demo pairs, so the guard is expected
never to fire during the demo — it exists for the case that is not on the script.
