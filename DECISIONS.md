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

## D3 — `lookup` is the join key, not `phenotype`

CPIC keys most genes by phenotype but HLA genes by allele status, and
`phenotypes` is `{}` for those. `npm run verify` cross-checks every patient
lookup against the cache because this failure is silent.

## D4 — hashing is ported from writ.ai, not written fresh

`lib/ledger/hash.ts` is a TypeScript port of `writai/hashing.py::stable_hash`,
with tests for the recursive-sort and integer-like-key cases. Given as finished
code so no agent is blocked on it.

## D5 — coverage is a layer, not a frame

The clinical stop stays the hero; the payer clause renders as one line beneath
it. A room feels a preventable death, not a claim. If the coverage line ever
competes for attention, shrink it.
