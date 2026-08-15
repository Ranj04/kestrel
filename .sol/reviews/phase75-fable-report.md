# Phase 7.5 — honesty pass, Fable half

**Author: Fable 5. This report is not self-certified — the cross-audit belongs to Sol,
and phase close belongs to Opus 5.**

Spec: `docs/PRODUCTION_GAP.md`, phase 7.5 table, rows 5, 6, 7, 8, 12, 13 + register.
Tree at start: `d6c1e90` plus Sol's in-flight phase-7.5 working-tree edits (not
touched). Sol's files were not modified by me; `REGISTER.md` was appended to after
re-reading Sol's R-27…R-34 so numbering does not collide (mine are R-35…R-40 plus
in-place updates to R-15, R-25, R-26).

---

## What changed, claim by claim (4g — evidence and claim in one sentence)

- **G-5 label.** `AlertCard` renders *"Highest-severity finding only; not an
  exhaustive screen."* on both alert branches, therefore the single-alert semantics
  of `evaluate()` (previously stated only in a source comment) are now stated where
  a judge reads them — verified in `tests/phase75.test.ts` against both real
  critical demo alerts and a synthetic caution.
- **G-5 / R-25 conflict.** `GeneAssessment` gained `conflict: boolean` (additive),
  computed by the same `rowsDisagree()` declaration the D6 guard executes — one
  declaration, not a copy (the R-5 lesson) — and `AlertCard` renders
  `assessed && conflict` as amber *"matched conflicting CPIC rows — no determination
  made … screening incomplete"*, therefore a determination the engine refused to
  make can no longer paint the green assessed line. The sweep test asserts
  `conflict: true` for **every** real conflicting triple in the shipped cache
  (asserted >100, non-vacuous), through the real `assessGenes()` and real index.
- **G-11 / R-26.** `lib/credibility.ts` exports `screeningIncomplete()`;
  `CredibilityCard` renders *"Not applicable — screening incomplete; see screening
  status above."* instead of any conclusion when it is true, and `app/page.tsx`
  passes it at both call sites, therefore "No human control required." can no longer
  render under the amber incomplete line — observed live for Reyes+capecitabine and
  Bhattacharya+capecitabine on the running dev server. A raised alert is deliberately
  NOT "incomplete": the card then demands review/signature, which is not the G-11
  overclaim.
- **G-9.** `CoverageLine` leads with *"DEMO — fictional payer; not a coverage
  determination"* and the clause text still greps verbatim out of
  `data/policies.json` in the same test, therefore the determination claim is
  withdrawn without touching one character of policy language.
- **G-10.** The badge and drawer say **"FDA association table"**, and the phase75
  test asserts the old literal is absent from both renders, therefore the screen now
  claims exactly what `data/fda-pgx.json` evidences — table inclusion, with source
  URL, retrieval time and route disclosed unchanged. The frozen contract's *field
  name* `fdaLabeled` is unchanged (renaming a frozen field needs a `.sol/requests`
  round; the on-screen word was the defect).
- **G-23.** A `BRAND_MAP` hit now returns `method: "demo-alias"` end-to-end
  (`curl`-equivalent through the running route returned
  `{"method":"demo-alias","drugName":"capecitabine","severity":"critical"}` for
  "Xeloda 1250 mg/m2 BID"), and `OrderForm` renders *"matched demo alias"*, therefore
  the two-entry demo dictionary discloses itself; a true index-key match still reads
  `exact` (positive control pinned: "codeine 30mg q6h prn" → `exact`).
- **G-17.** `/pipeline` heading is *"Has a guideline in the bundled CPIC snapshot
  (capture date unavailable)"* and the phase75 test asserts `/guideline today/` is
  gone, therefore the coverage claim is scoped to the artifact that supports it. No
  clinical string touched.
- **G-15.** `docs/INTEGRATION.md` opens with **STATUS: PLANNED — NOT IMPLEMENTED**
  and "sits on all three" became "is designed to sit on all three — none … is
  implemented today"; `data/cds-hooks-example.json`'s note no longer claims the file
  is "used by tests/ and by the /api/cds-services endpoint" (grep confirmed nothing
  consumes it — that claim was false twice). R-15 updated.
- **G-25.** Both Aetna clauses carry `truncated: true` and notes naming the mid-word
  cuts and adjacent-content bleed; the phase75 test pins the labels **and** that the
  captured text is unedited (still ends "…recep" / "…related to the", misspelling
  preserved), therefore the label moved and the quote did not.
- **Register.** R-25 CLOSED, R-26 closed at the claim level, R-15 updated; new
  R-35…R-40 for G-5/G-9/G-10/G-17/G-23/G-25, each pointing at the gap doc.

## 1. REMOVED (rule 4i)

- `data/payer-policies-scraped.json` — the words claiming the clause text was
  **"Verbatim"** (top-level note and clause note). This removal is the fix: the claim
  was false. The clause text itself is byte-identical, and a test now pins that.
- `docs/INTEGRATION.md` — the claim **"this system sits on all three"** (replaced
  with designed-but-not-implemented wording).
- `data/cds-hooks-example.json` — the false claim **"Used by tests/ and by the
  /api/cds-services endpoint's example"**.
- **No test, assertion, branch, or error-handling path was removed anywhere.**
  `check-removals.sh` compared **5 file(s)** against HEAD: no removals (it also names
  `tests/phase75.test.ts` as new). Two refactors moved code without removing
  behaviour: the D6 disagree expression moved from inline in `evaluate()` into
  `rowsDisagree()` (same strings, now shared), and `resolve.ts` step 1 split the
  `BRAND_MAP[c] ?? c` expression into two explicit branches so the alias route can
  name itself.
- Style values spent deliberately inside the critical takeover's height budget
  (see incident 2): CoverageLine clause text `text-xs`→`text-[11px]` (R-19's
  **named** reserve lever), coverage slip `py-0.5`→`py-0` in `app/page.tsx`. No text
  removed, nothing clinical resized; the 19px recommendation blockquote untouched.

## 2. The test that goes RED when each line is reverted (4e) — each demonstrated, not asserted

Every row below was actually performed: mutation applied, **applied-count echoed
first** (4a-bis-MUT), named test run RED, restored, test run GREEN.

| reverted line | red test |
|---|---|
| `assessGenes` `conflict:` computation → `false` | `phase75` "assessGenes: disagreeing CPIC rows -> conflict:true…" AND "…EVERY real conflicting triple…" |
| `AlertCard` filter `!g.assessed \|\| g.conflict` → `!g.assessed` | `phase75` "AlertCard: a suppressed D6 conflict renders AMBER…" |
| exhaustive-screen label (both branches) | `phase75` "AlertCard critical: labelled…" and "AlertCard caution: the same label…" (one per branch) |
| `CredibilityCard` `if (screeningIncomplete)` | `phase75` "CredibilityCard: incomplete screening renders not-applicable…" |
| `screeningIncomplete()` final return → `false` | `phase75` "screeningIncomplete: incomplete states are true…" |
| `app/page.tsx` one `screeningIncomplete={incomplete}` prop | `phase75` "app/page.tsx call site…" (source-level pin — 4a-quater; the render tests cannot see a deleted prop, and the page does not run under node:test) |
| `CoverageLine` DEMO label | `phase75` "CoverageLine: 'DEMO — fictional payer…'" |
| badge → `FDA-labeled ⓘ` | `phase75` "FDA badge: says 'FDA association table'…" AND `ui.test` "AlertCard: FDA badge renders for Okafor…" |
| `resolve.ts` map branch → `method: "exact"` | `phase75` "resolveDrug: a BRAND_MAP hit…" AND `pgx.test` "resolveDrug: brand name with dose noise…" (and the prescribe route pin) |
| `OrderForm` `"demo-alias"` label entry | `phase75` "OrderForm: 'matched demo alias'…" |
| pipeline heading → "today" | `phase75` "pipeline page: …never 'today'" |
| one `"truncated": true` → `false` | `phase75` "payer-policies-scraped: …never 'Verbatim'" |

**Honest "none" rows:** `docs/INTEGRATION.md`'s status banner and
`data/cds-hooks-example.json`'s note have **no test** — they are prose in a docs file
and a fixture note; a test would pin a paragraph nobody executes. The REGISTER.md
entries likewise. Everything else in this phase is pinned above.

## 3. 4a-bis — every new test shown failing against the old code first

`tests/phase75.test.ts` (14 tests at the time) was written **before** any
implementation change and run against the pre-7.5 tree:
**14/14 `not ok`, every one `AssertionError` for its stated reason** — no import
crashes (the `screeningIncomplete` import is dynamic inside its test precisely so a
missing export fails that test rather than killing the file; its failure message was
"lib/credibility.ts must export screeningIncomplete"). Raw output saved at
`scratchpad/phase75-before.txt` during the run. The 15th test (the page call-site
pin) was added after implementation; its ability to fail was demonstrated by the M4
mutation (deleting one prop pass → red, restore → green).

**A live 4a-bis-MUT instance worth recording:** the first attempt at the
truncated-flag mutation used a line-number-guarded perl edit whose guard missed —
applied-count printed **0** and the suite stayed green. Per the rule, the green was
read as "the mutation missed", not "the pin is worthless"; the mutation was redone
with a working anchor (applied-count 1) and the test went red. The applied-count
habit caught it immediately.

## 4. Gate (definition of done)

```
npx tsc --noEmit          exit 0
npm test                  86 tests, 86 pass, 0 fail
npm run verify            PASS — data layer is consistent
sh scripts/check-removals.sh   compared 5 file(s) against HEAD — no removals (FILE COUNT read, not exit code)
npx eslint . --format json     exit 0 · FILES EXAMINED: 54 · 0 errors · 0 warnings
```

**Test arithmetic, stated precisely:** the phase opened at 67. Sol's parallel half
added 4 tests to `tests/ledger.test.ts` (now 23) — 71 prior tests, **all green**,
none edited by me beyond the disclosed pin moves below. My half adds 15
(`tests/phase75.test.ts`). Total **86**.

**Eslint files examined is 54, not the briefed 53** — the +1 is
`tests/phase75.test.ts` itself. Counted from `--format json` array length, never a
piped tail (R-17).

## 5. Disclosed pin moves (the phase-6 situation, per the brief)

Five assertions pinned literals this phase deliberately changed. Each moved WITH the
change, is commented `PHASE 7.5, disclosed` at the site, and is strictly stronger:

1. `pgx.test.ts` Lindqvist `assessGenes` deepEqual — shape grew `conflict`; now also
   pins `conflict: false` (rows do not conflict) for the real fixture.
2. `pgx.test.ts` "brand name with dose noise" — `method` "exact"→"demo-alias"; the
   companion generic test still pins that a true key match reads "exact", so the
   pair now distinguishes the two routes, which "exact" for both never could.
3. `prescribe.test.ts` money shot — same rename, pinned end-to-end through the route.
4. `ui.test.ts` FDA badge test — literal renamed AND a new assertion that the old
   overclaim literal is absent.
5. `ui.test.ts` FDA-absence test — badge literal updated so the no-badge assertion
   cannot go vacuous under the rename; the `!/FDA/i` sweep it sits beside covers both
   spellings regardless.

## 6. Demo beats — verified in the running app (localhost:3000, existing dev server)

All four beats driven in a real browser, `main` pinned to exactly 1280×720:

- **Okafor + Xeloda** → DO NOT PRESCRIBE, verbatim CPIC quote, `FDA association
  table ⓘ`, exhaustive-screen label, DEMO payer label on the NOT-COVERED slip,
  signature credibility → Why drawer (renamed FDA block, verbatim row, provenance) →
  Override and sign → `alert.overridden recorded — seq 18`, AUTH-6C24 VALID, chain
  verifies consistent. (The modal showed Sol's new fixture-signer line — Sol's half
  is live in the same tree.)
- **Lindqvist + capecitabine** → `matched exact`, green "DPYD assessed…" line,
  COVERED + DEMO label, credibility card still concludes (screening completed — the
  suppression must not fire here, and does not).
- **Reyes + capecitabine** → amber "DPYD not assessed… screening incomplete", PENDED
  + DEMO label, credibility **"Not applicable — screening incomplete…"**.
- **Bhattacharya + capecitabine** → "No genotype on file — screening did not run",
  PENDED + DEMO label, credibility not-applicable.

**Incident 1 (height budget), found by measurement and fixed:** the first label pass
overflowed the critical takeover by 6px at 1280×720 (it CLIPS, not scrolls — R-19's
exact warning; the recorded 4px headroom predated these lines). Fixed by spending
R-19's named reserve (clause text 12→11px, slip py-0.5→0, my labels at 11px/10px
tight leading) — re-measured: **0 overflow, ~6px headroom**, blockquote untouched at
19px. An intermediate attempt to fold the payer label into the slip's badge row was
measured (the row wrapped, saving nothing) and reverted.

**Incident 2 (R-24 observed live):** switching patients keeps the typed order text —
during the run a click that missed the input left beat 2 stale exactly as R-24
predicts for a presenter. Out of scope this phase (register already carries it);
noting that the trap is real on the demo machine.

**Ledger state:** the verification run and the test suite appended real records
(including the seq-18 signed override with a rationale explicitly labelled a
verification run, and records from `npm test`, which writes by design — see
`tests/prescribe.test.ts` header). Per the standing convention, **Reset demo before
recording/presenting.** No tamper endpoint was invoked; the chain verifies
consistent.

## 7. Standing-constraint compliance

Every string added this phase is procedural — what the system did, did not do, or
where its content came from. No clinical string, policy string, or captured quote was
edited, and the phase75 tests grep the clinical/policy strings back out of their data
files to prove it. No new dependency; no subsystem; the engine's return shape grew
one boolean and one union member, both additive under the freeze rule.

## 8. Residuals, stated

- `README.md:95` still lists the scraped Aetna file as "Real, scraped" with no
  truncation note — README is outside my ownership rows; one line fixes it (noted in
  R-40).
- The deep fixes remain owned by later phases and are not claimed here: result
  collection (10), `assess()` taking coverage facts (10/13), payer ingestion
  (unowned — flagged in R-36), labeling source (13), CPIC refresh (10), CDS Hooks
  (11), re-capture of the Aetna excerpts (10).
