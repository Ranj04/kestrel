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

**Update 2 — the trigger had no carrier.** The closure plan above lived only in this
register. `phase1-fable-engine.md`, the file Fable actually reads, never named
`severityOf` and never mentioned rewiring the preflight, so the "natural trigger" would
never have fired. Worse, the two copies were still not identical: the preflight's `none`
branch is a four-alternative regex, while the prompt carried one vague English sentence
("text indicates no change to therapy") that an implementer would have rendered
differently. The prompt now carries the literal rule and an explicit instruction to
**move it, not copy it**, with this entry cited. Still OPEN until Fable does it — but the
instruction is now in the path of the agent who has to act on it.

## R-6 · CLOSED · `data/patients.json` lookup strings were wrong — every alert silently failed

Recorded as unverified because the authoring environment could not reach
`api.cpicpgx.org`. On the first real run against a generated `data/cpic/index.json`,
**all four were wrong**, and the failure mode was exactly the silent one this project
was most afraid of: no error, no warning, the alert simply never fires.

The values were phenotype names (`"Poor Metabolizer"`). CPIC's `lookupkey` — the join
key — is an **activity score** for DPYD and CYP2D6:

| gene | actual `lookup` | `phenotype` |
|---|---|---|
| DPYD | `"0.0"` | Poor Metabolizer |
| CYP2D6 | `"3.0"` | Ultrarapid Metabolizer |
| DPYD | `"2.0"` | Normal Metabolizer |
| HLA-B | `"*57:01 positive"` | `null` |

D3 had the shape of this right ("`lookup` is the join key, not `phenotype`") but drew the
wrong conclusion from it — it assumed `lookupkey` *was* the phenotype for non-HLA genes
and that HLA was the only special case. The real rule is that `lookupkey` is a different
vocabulary per gene family, and a phenotype name is never a safe join key.

**Fixed:** the index now carries `lookup` **and** `phenotype`; `patients.json` carries
both, copied verbatim from CPIC's `diplotype` table (`c.1905+1G>A (*2A)/c.1905+1G>A (*2A)`
→ `0.0` → Poor Metabolizer); `contracts.ts` gained `phenotype` on `GeneResult` and `Alert`
(additive, legal under the freeze); `policies.json` criteria were renamed `lookup` →
`phenotype`, because payers genuinely do write policy in phenotype language and that is now
the single documented exception. `npm run verify` and `npm run verify:prove` both pass.

**Read this before loosening any match.** The correct fix was to fix the data. A fuzzy or
substring `lookup` match would also have made the alert fire — and would have made DPYD
`"2.0"` (Normal) reachable from `"0.0"` (Poor), i.e. the opposite recommendation.

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

## R-8 · CLOSED · `check-removals.sh --prove` left a `.provebak` in the changed set

Visible in the prove output: `new  tests/hash.test.ts.provebak`. Harmless — the file is
restored and the backup removed — but the checker sees it mid-run and reports it. Cosmetic
noise in an instrument whose whole value is that its output is unambiguous.

**Fixed:** the backup goes to `mktemp` outside the repo, with a `trap` restoring the file
on interrupt as well as on the normal path — the old version would have left the test file
truncated if `--prove` was killed mid-run. Re-proved: `PROVE OK`, `assert.' 6 -> 0`, no
`.provebak` in `git status`, all 6 assertions back in `tests/hash.test.ts`.

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

## R-15 · OPEN, STRETCH ONLY · no live EHR integration surface

**Question raised:** how does this reach a hospital's patient data?

**Answer, recorded in `docs/INTEGRATION.md`:** it never touches their database. Three
standard surfaces — CDS Hooks `order-sign` (the EHR calls us), FHIR Genomics Reporting
Observations for the genotype, SMART App Launch for any UI. The integration is a solved
standard; the binding constraint is that **most PGx results are still unstructured PDFs**
(Penn: 627 discrete results vs ~21,500 documents).

**Built:** the documentation, and `data/cds-hooks-example.json` — a real `order-sign`
request whose DPYD Observation uses verified LOINC `79719-1` / `LA9657-3` and whose
patient id and lookup string already agree with `data/patients.json`.

**Not built:** `.sol/prompts/phase3-fable-cdshooks.md` specifies the live endpoints and
is marked **stretch only — do not start before the fallback video is recorded.** 40
minute cap. This converts one pitch sentence from assertion to artifact; it is strictly
less valuable than the thing it decorates.

**UNVERIFIED, carried forward deliberately:** Epic's 2026 CDS Hooks card-model support.
Available statements are 2021–2022 (Epic staff, HL7 chat archive) and `fhir.epic.com` is
login-gated. **Do not claim Epic honours `overrideReasons`, `suggestions`, or the
feedback endpoint.** The safe and true form is "the standard defines them and we
implement them." Also unverified: any figure for US hospital Genomics Module adoption —
none was found, treat any number heard as unsourced.

## R-16 · OPEN (guard specified, not yet written) · neither CPIC key is unique; multi-gene guidelines flatten

Surfaced while checking `BUILD_ORDER.md` Phase 0 against the real cache rather than
against its own description. Both candidate join keys are one-to-many:

| key | distinct keys | matching >1 row | disagreeing on severity |
|---|---|---|---|
| `phenotype` | 609 | 274 | 105 |
| `lookup` | 934 | 339 | 146 |

Cause: a multi-gene recommendation (amitriptyline is keyed on CYP2D6 **and** CYP2C19)
becomes several rows under each single-gene key, differing by the *other* gene.
`amitriptyline/CYP2D6/Normal Metabolizer` alone spans `{none, caution, critical}`.

**This corrects an understatement of mine.** D3 warned that `phenotype` is non-unique and
did not warn that `lookup` is too — more so, in fact. The demo is unaffected because
`lookup` is 1-to-1 for all three demo pairs, but that is a property of those pairs.

**Open because the guard is specified, not implemented.** D6 and
`phase1-fable-engine.md` require `evaluate()` to assert row agreement and raise nothing
on conflict. Fable writes it in Phase 1. It is owed a test that constructs a synthetic
two-row disagreement and proves the guard fires — a guard never observed to trigger is
rule 4a-bis's vacuous instrument, which is how R-7 got caught.

**Not fixed by widening the key.** Adding the second gene to the join would resolve
amitriptyline and is the correct long-term model, but it changes `GeneResult` shape and
every call site for a case no demo patient reaches. Recorded rather than built.
