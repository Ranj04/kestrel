# Open items register

Rule 5: anything surfaced and deliberately not fixed gets written here, **in the same
run**. Not the PR description, which nobody reads twice.

Format: `R-n · status · one-line claim` then what was found, why it wasn't fixed, and
what would fix it.

---

## R-1 · OPEN · `4a-ter` is used for two different rules in `_template.md`

The template flags this itself: once for *"can you break it without breaking a
compile"* and once for *"annotate a service method's return type before a client is
written against it."* Citing `4a-ter` is therefore ambiguous.

**Not fixed here deliberately.** The template's own instruction: *"Whoever renames them
owns moving every citation in the same commit."* Renaming inside a hackathon build,
where the citations live in another repo, would create exactly the drift rule 7 warns
about. Preserved verbatim with an inline pointer to this entry.

**Fix:** rename in the source of record, and move every citation in the same commit.

## R-2 · OPEN · duplicated three-condition block in `4c-bis`

The source text carries two "Three conditions, all mandatory" blocks — an older
three-condition version and a newer four-condition version, with the older one
appearing after the newer. It reads as an editing artifact rather than intent.

**Not fixed here deliberately.** Silently deleting text from an inherited standard is
the removal-without-a-line-to-review failure that rule 4i exists to catch, and I am not
the author. The newer four-condition block (which adds the pure-merge proof and
condition 4) is retained inline as the operative one; the older block is noted here.

**Fix:** confirm with Ranjiv which is operative, delete the other in the source.

## R-3 · ACCEPTED LIMITATION · the full six-step loop runs on two units, not all

See `CLAUDE.md` ADAPTATION 2. Roughly five hours, one human driving four parties.
Full loop on `lib/pgx/evaluate.ts` and `lib/ledger/{hash,verify}.ts`; light loop
(write → cross-audit at freeze) everywhere else.

**Empirical basis:** none. This is a wall-clock judgement, not a measurement — stated
as such per rule 6 rather than dressed as an analysis.

**Fix:** more wall-clock, or a second human.

## R-4 · ACCEPTED LIMITATION · definition of done cannot be inherited literally

The template's gate assumes real Postgres, migrations, provider sandboxes, a chain, and
a PR. This project has none. Replacement gate in `CLAUDE.md` ADAPTATION 4;
project-specific evidence table in ADAPTATION 3. **The standard is unchanged — only the
artifact table is.** No claim is downgraded to "probably fine."

## R-5 · OPEN (content reconciled, duplication remains) · two severity implementations

**Update:** an independent audit found the two copies did not merely duplicate, they
**disagreed** — the preflight tested `/avoid/i` only, while the spec adds
`classification === "Strong"` + `"reduce"`/`"not recommended"`. So `npm run verify`
could print PASS while `evaluate.ts` classified differently, which defeats the entire
point of the preflight. The rule text is now identical in both, extracted as an exported
`severityOf(text, classification)`.

**Still open, because identical-today is not the same as single-source.**

`scripts/verify-setup.mjs` derives severity with its own copy of the rule. `lib/pgx/evaluate.ts` will implement the same rule
independently. **That is two declarations of a closed set that can disagree while both
still run** — mistype one and nothing fails to compile, the two simply stop agreeing.
Exactly the discriminator in 4a-ter clause 1.

It shipped this way because `evaluate.ts` did not exist when the preflight was written,
so there was nothing on an importable path to import — which is 4a-ter's own "the
finding is the missing declaration, not the copy."

**Fix, and it has a natural trigger:** the moment `lib/pgx/severityOf()` exists, export
it and have `verify-setup.mjs` import it instead of re-deriving. **Fable does this in
Phase 1 or the duplication is permanent.**

## R-6 · OPEN · `data/patients.json` lookup strings are unverified against the real cache

The four genotype `lookup` values were authored from CPIC API responses read during
planning, not compared against a generated `data/cpic/index.json` — the authoring
environment could not reach `api.cpicpgx.org`.

**This is a claim broader than its check** (rule 4g) and it is recorded rather than
asserted away. `npm run verify` is the instrument that closes it, and it must be run
before any feature code. If it reports a mismatch, the finding is in `patients.json`,
not in CPIC.

## R-7 · CLOSED · `check-removals.sh` counted tokens this project does not use

Found by its own `--prove` positive control on first run. The token list
(`it( test( describe( expect( skipIf`) was carried from a vitest codebase; this project
uses `node:test` + `node:assert`, so the checker would have reported "no removals"
regardless of what was deleted — a vacuous instrument sitting inside the rule that
exists to prevent vacuous instruments.

**Fixed:** added `assert.` and `assert(`. Re-proved: removing every `assert.` from
`tests/hash.test.ts` now reports `'assert.' 6 -> 0` and exits 1; a single-assertion
removal reports `6 -> 5`.

**Kept as the argument for 4a-bis:** the checker was written *by someone reading the
rule that says to build a positive control*, and still shipped blind. The control
caught it in under a minute. Reviewing the script would not have.

## R-8 · OPEN · `check-removals.sh --prove` leaves a `.provebak` in the changed set

Visible in the prove output: `new  tests/hash.test.ts.provebak`. Harmless — the file is
restored and the backup removed — but the checker sees it mid-run and reports it. Cosmetic
noise in an instrument whose whole value is that its output is unambiguous.

**Fix:** write the backup outside the repo (`/tmp`) rather than alongside the file.
Not done now: it costs a line and the demo clock is the binding constraint. Recorded so
it is not mistaken for a real finding when someone runs `--prove` later.

---

## R-9 · CLOSED · `PrescribeResponse` had no `coverage`, so two of four demo patients could not render one

`Coverage` hung only off `Alert.coverage`, but `evaluate()` returns `null` when severity
is `none`. Lindqvist (`covered · PA-ONC-014.4`) and Bhattacharya (`pended ·
PA-ONC-014.1`) therefore had no path to the screen — and Bhattacharya's `pended` is a row
in the README demo table *and* phase0 acceptance test #4.

**Fixed additively** (legal under the freeze rule): `coverage: Coverage | null` added to
`PrescribeResponse`. `Alert.coverage` stays as the copy rendered inside the alert card.

Found by an independent audit of the tree, not by review of the prompts. Neither the
prompts nor the contract read wrong on their own — the gap was between them.

## R-10 · CLOSED · three separate copies of the contract had drifted

1. `phase2b-sol-snapshot.md` told Sol to log `evidence.superseded`; `contracts.ts` has
   `policy.revised`. Sol would have hit a type error around 2pm, on the differentiator
   feature, with no slack.
2. `phase1-fable-engine.md` carried an **inline restatement of the whole of
   `contracts.ts`**, and that copy had already drifted the same way.
3. `phase2b`'s `authorizationStatus()` return omitted `authorizationId`, `drugName` and
   `actor`; its `supersededBy` was `{pmid,title,year}` against contracts'
   `{policyId,version,summary}`; and `SupersedeInput` predated phase0 moving the
   supersede trigger from a guideline revision to a policy revision.

**Fixed by deletion, not correction.** The inline copy in phase1 is gone and replaced
with "read the file." A corrected copy drifts again — this is rule 4a-ter's vocabulary
case, and the file is on an importable path, so the second copy was never legitimate.

## R-11 · CLOSED · `cache_cpic.py` PASS was weaker than `npm run verify` PASS

`find()` substring-matched, so `"Ultrarapid"` passed while telling you nothing about
`"Ultrarapid Metabolizer"` in `patients.json`. Two checks reporting success in the same
word while measuring different strictness is the failure 4a-bis names. Now exact-match,
and the self-test uses full lookup strings.

## R-12 · CLOSED · `npm test` could not execute

`--experimental-strip-types` requires Node 22.6+; the active runtime was 20.19.6, so the
script failed with `bad option` — "the test that saves the demo" did not run at all.
Switched to `node --import tsx --test`, which works on 20.6+ and needs only the `tsx`
devDependency that `npm install` already brings. `.nvmrc` (24) kept as belt-and-braces.

**Verified on Node 22 only** — the 20.6+ claim is from the `--import` flag's documented
availability, not from a run. Stated per rule 4g rather than asserted.

## R-13 · CLOSED · every prompt pointed at `~/pgx`; the repo is `~/biopharma hack`

14 references across the prompts and `ARCHITECTURE.md`. Both agents would have failed on
instruction one. Rewritten to `~/"biopharma hack"` — quoted, because the space is a live
hazard: unquoted, `cd ~/biopharma hack` runs `cd ~/biopharma` and often **succeeds
elsewhere**, which makes every subsequent check report on nothing. Warning added to
`_context.md`.

## R-14 · OPEN · `next/font/google` fetches at build time

Violates "no network at runtime" if `.next` was never warmed. Mitigated two ways: a real
fallback stack in `globals.css` (a failure changes the typeface, never the layout), and
an explicit warm step in the README. **Not fully fixed** — self-hosting the two fonts
would close it properly and costs ~10 minutes. Recorded rather than done, because the
mitigation is adequate and the clock is not.
