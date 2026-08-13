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
too. Measured against the shipped index: `lookup` has 345 keys matching more than one
row, 152 of which disagree on severity — *more* ambiguous than `phenotype`, because
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

**Implemented and observed to fire (Phase 1).** `tests/pgx.test.ts` proves it three
ways: a synthetic two-row agreement still alerts (positive control), a synthetic
two-row disagreement returns null AND logs the conflict (the log is what separates
"guard fired" from "join found nothing" — the return values are identical), and a
sweep of every real conflicting triple in the shipped cache — 331 of them, counted
at runtime and asserted >100 so the sweep itself cannot go vacuous — through the
REAL `evaluate()` and the REAL index returns null for all, with one logged conflict
each.

## D7 — `severityOf` has exactly one declaration, and the preflight runs under tsx

The rule lives in `lib/pgx/evaluate.ts` and nowhere else. `scripts/verify-setup.mjs`
imports it — dynamically, AFTER its cache-existence check, so the friendly
"run cache_cpic.py" message still wins when the cache is missing (a top-level import
would hit `lib/pgx/index.ts`'s load-time throw first). Plain `node` on v20.19.6
cannot import a `.ts` module, so `npm run verify` and `verify:prove` are now
`node --import tsx scripts/verify-setup.mjs` (package.json; `tsx` was already a
devDependency for `npm test`). Probe evidence: mutating `/avoid/i` to `/avo1d/i` in
`evaluate.ts` makes `npm run verify` report 2 FAILURE(S); restoring makes it PASS —
therefore the preflight is reading the same declaration `evaluate()` runs, not a copy.

## D8 — the snapshot hash recipe is a two-key contract with Sol

`snapshot.entryHash = stableHash({ cpicEntry, clause })` — those exact key names,
where `cpicEntry` is the matched `data/cpic/index.json` entry object verbatim and
`clause` is the matched clause object from `data/policies.json` verbatim
(`{ clauseId, text, criterion, scopes }`), or `null` when no clause matched.
Sol's phase 2b recomputes the identical object to detect drift, so renaming either
key silently breaks the supersede beat. `snapshotId` year is the newest citation's
year ("undated" if CPIC ships none). `scopes` = `dosing.<drug>` +
`monitoring.<gene>` when CPIC's own recommendation/comments text mentions
monitoring, unioned with the matched clause's scopes.

## D9 — supersede overlays are registered hooks, not edits to Fable's files

`lib/pgx/index.ts` exports `setIndexOverlay()` and `lib/pgx/policy.ts` exports
`setPolicyOverlay()`. Phase 2b's revision happens in memory only — the JSON files
on disk are sources of truth and a demo button must never mutate them. Sol
registers a transform instead of editing Fable-owned files, which inverts the
dependency direction the phase2b prompt sketched ("have Fable's getIndex() consult
Sol's overlay") without either agent touching the other's code.

## D10 — the prescribe route imports Sol's ledger directly; no shim ever shipped

`lib/ledger/store.ts` landed before the route was written, so the planned
`ledger-shim.ts` was never created: the route imports `append` and `clausesFor`
from `lib/ledger`, which also means the clause-tag table has exactly one
declaration (Sol's). Ledger append failures propagate as a 500 by design —
prescribing off the record is worse than failing loudly. Consequences:
`tests/prescribe.test.ts` appends real records to `data/ledger.jsonl` (that is the
point — it pins the route's `append` call sites, the pin Sol's ledger tests cannot
reach; deleting the `alert.raised` append line turns the named "money shot" test
red, observed), so reset the ledger before a demo run. And `npm test` now runs
with `--test-concurrency=1`: Sol's ledger tests reset/tamper the same file, and
parallel test-file processes would race on it.

## D11 — small honest shims in the engine, all labelled in-source

`BRAND_MAP` in `lib/pgx/resolve.ts` (xeloda→capecitabine, adrucil→fluorouracil) so
the demo works with no LLM key; `DEMO_ACTORS` in the prescribe route (dr_chen's
display identity — unknown ids pass through as themselves, never inventing a
person); `Order.dose`/`Order.route` are regex ECHOES of the prescriber's own text,
not clinical values; an unresolvable drug returns 200 with `drugName: ""` and
`resolution.matched: false` — "no CPIC guidance found" is an honest, renderable
state, not an error. The LLM's drug answer is discarded unless it equals an index
key character for character.

## D12 — LLM provider is selected by key presence; no provider is mandatory

`lib/llm.ts` picks one provider per call, in order: Bedrock (`AWS_REGION` +
either `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` or `AWS_PROFILE`), then
OpenAI (`OPENAI_API_KEY`), then Anthropic (`ANTHROPIC_API_KEY`), then null.
Bedrock first because venue creds, if they materialize, are the intended demo
path; OpenAI next because that key actually exists in `.env` today. Null stays a
first-class outcome — the deterministic steps in `lib/pgx/resolve.ts` carry the
whole demo with every key unset, so this file never throws and no provider is
required. The Bedrock SDK (`@aws-sdk/client-bedrock-runtime`) is deliberately
NOT a dependency and SigV4 is not hand-rolled: the branch does a dynamic
`import()` in a try/catch (specifier kept in a runtime variable so neither tsc
nor a bundler resolves the uninstalled package) and falls through to the next
provider when the SDK is absent — inert and harmless until both the creds and
the SDK exist. `ModelProvenance` stays frozen: the serving provider is recorded
inside the existing fields, prefixed on `id` (`openai:gpt-4.1-nano`) and
repeated in `params.provider`. The OpenAI default is `gpt-4.1-nano` because the
venue's project key 403s on `gpt-4o-mini` — its model list is {gpt-4-turbo,
gpt-4.1-nano, gpt-5.3-codex, gpt-5.4} and the gpt-5.x reasoning models reject
`max_tokens`/`temperature: 0` (`ATTEST_OPENAI_MODEL` overrides it;
`ATTEST_BEDROCK_MODEL` and `ATTEST_LLM_MODEL` cover the other two branches).

## D13 — phase 2 UI: the components render the response, never restate it

The left pane is five components under `components/prescribe/`. All of them are
props-in, markup-out — no fetching, no derivation of clinical values. The one
fetch lives in `app/page.tsx`, and the objects it hands down render verbatim:
`recommendation`, `implication`, `comments`, and `clauseText` pass through with
no slice/replace/case-change/truncation (a long string grows the card), and the
`WhyDrawer` "source record" href is `alert.sourceUrl` — the value on the alert,
never a rebuilt URL. `phenotype` renders; `lookup` never goes on screen.
`tests/ui.test.ts` pins all of this with react-dom/server against alerts from
the real `evaluate()` over the real cache, and each clinical assertion greps the
string back out of the data file — so "renders verbatim" is measured against
disk, not against the code under test. Both directions were mutation-probed:
truncating the recommendation and rebuilding the sourceUrl each turned exactly
the named test red.

Three UI states for "no alert", because their meanings differ and only one is a
clearance: green "No pharmacogenomic contraindication" only when a genotype on
file went through the check; amber "No genotype on file" for Bhattacharya (an
unrun check must not render as a pass); grey "No CPIC guideline found" when the
drug never resolved. Headers like "DO NOT PRESCRIBE" are Fable-authored severity
labels — UI chrome, not clinical text; every clinical sentence is CPIC's.

The FDA credibility grid lights cells by `requiredControl` mapped back onto the
2x2: auto -> low/low, human-signature -> high/high, and human-review lights BOTH
review cells — a medium x medium assessment collapses onto the review
anti-diagonal, and picking one corner would claim an axis value the assessment
did not make.

The right pane is Sol's `<LedgerPane />` imported from `components/ledger` — it
polls `/api/ledger` every 1s, so ledger-affecting actions on the left appear on
the right with no event bus and no key-bumping. Override goes through Sol's
`SignatureModal` (21 CFR 11 fields), never a plain dismiss; switching patients
clears the response so one patient's card can never sit over another's chart.
