# phase6-fable report — the LEFT pane

Fable. Scope: `components/prescribe/`, `app/page.tsx`, `app/pipeline/`,
`app/globals.css`. Nothing outside it was touched — `git status` shows my diff
confined to those paths (Sol's parallel diff sits in `components/ledger/`, and
`components/ledger/index.tsx` in the status is his edit, not mine).

## 4a-bis — baseline echoed first, then the after-count

Echoed before any edit, reproduced the corrected baseline exactly:

```
$ grep -rc 'text-\[[0-9]' components/prescribe app/page.tsx | grep -v ':0$'
PatientCard 6 · WhyDrawer 13 · CoverageLine 3 · OrderForm 2 · CredibilityCard 4 · page.tsx 5
$ grep -ro 'text-\[[0-9]' components/prescribe app/page.tsx | wc -l   →  33
```

(The phase prompt's stated total of 31 is wrong; its own per-file list sums to 33.
I worked to the measurement.) `app/pipeline/page.tsx` and `AlertCard.tsx` measured
0 before and still measure 0.

**After: 0 occurrences, 0 files.** The instrument was then proven able to fail:
the identical grep form against the **HEAD** versions of the same files prints
13/5 (mine) and 7/5/4/3 (Sol's ledger files at HEAD, his phase6 baseline of 21).
So the zero is a measurement of removed literals, not a command that matched
nothing. Note: Sol's working-tree files also grep 0 now — he has landed his 6e in
parallel.

**4g:** the pixel-literal occurrence count went 33 → 0 and the same grep form
still prints 33 against HEAD, **therefore** every size in this pane resolves to
the five-step scale and the zero is real.

## What was done (6a–6d)

- **6a** — the critical alert is now an absolute overlay (`inset-x-0 top-16
  bottom-0`) carrying its own `--paper`/93% ground, replacing the phase5
  field-div + `-mt-14` flow hack. It starts 64px down — just under the tab row
  (8+20+4+28 = 60px, measured) — because **the patient tabs are the demo's only
  exit from a critical state**: the chart body and order form recede behind the
  frost, the tabs stay crisp. Hit-tested at 1280×720: all four tabs reachable
  through the takeover, a click on the order form lands on the hero blockquote,
  **therefore** the pane blocks the order and still lets the demo continue.
  D1 headline is Fraunces (was mono) in `--accent`; hero keeps 40px above/below
  at step-1; both actions use the import's one button shape at equal weight.
- **6b** — above. 33 → 0.
- **6c** — CredibilityCard leads with the conclusion at step-1
  (*"Signed human decision required."*), enum value right-aligned on the same row
  (still verbatim on screen — it is what `ui.test.ts` pins), axes on one mono
  line, grid demoted beside the rationale. Conclusion strings are display labels
  for the `requiredControl` enum, METHOD_LABEL's exact pattern — not new content.
  Deviation, stated in DESIGN.md: only `human-signature` speaks at step-1;
  `auto`/`review` at step-0, for the same restraint reason the green line is quiet.
- **6d** — my half is the token layer: `.rise` retimed to the design-notes Motion
  spec (200ms, cubic-bezier(0.2,0,0.2,1), 8px — was 700ms/14px), `.slide-in`
  becomes the same-curve 200ms slide-up for the drawer, `.rise` **removed from
  every AlertCard state** ("Only the ledger moves" — design notes). The stagger
  itself is in Sol's components (his 6f). `prefers-reduced-motion` block unchanged.

## ⚠ FOR SOL — shared-file changes he is reading

`app/globals.css`: **`.rise` timing/distance changed** (0.7s→200ms,
14px→8px, curve → `cubic-bezier(0.2,0,0.2,1)`), matching the 200ms spec his own
prompt cites. `.slide-in` likewise 200ms translateY. **No custom-property VALUE
changed** — steps, colours, spacing, shadows all untouched; no token added.

## Height and states — measured, not asserted

At a real-Chrome 1280×720 frame (main pinned), left-pane overflow is **0 in all
five demo states**: Okafor critical, Reyes codeine critical, Reyes paroxetine
caution, Lindqvist clear, Bhattacharya pended. The critical state was 80px over
mid-pass; the overlay restructure (not spacing surgery) is what paid for it.
After-screenshots: `docs/phase6-after-critical-1280x720.jpg`,
`docs/phase6-after-clear-1280x720.jpg`. The **before** pair cannot be reproduced
from this session without reverting a tree that carries Sol's uncommitted work —
the before evidence is Claude Code's capture at phase open (its baseline
screenshots), stated plainly rather than papered over.

## 4i — REMOVED, enumerated

- `.rise` class off all five AlertCard states (motion, per design notes).
- AlertCard critical: chip border `border-paper-raised/60` off the CPIC badge
  (invisible on the paper ground it now sits on — it was drawn for the old
  vermilion field); FDA button's dashed border → dashed underline; root `pt-2`.
- AlertCard caution: the `⚠` glyph (phase5: one ⛔ and one ✓ are enough); the
  `border border-amber bg-amber/10` box → amber hairlines only (design-notes
  deviation 3 — the fill and side borders are gone); the inner `px-4 py-2.5`
  wrapper div (structure flattened).
- page.tsx: the standalone critical field div
  (`absolute inset-0 z-10 bg-paper/[0.93]`) — replaced by the overlay's own
  identical ground, one element instead of two; `relative z-20` off the patient
  wrapper (obsolete once the overlay stopped covering the tabs); the `-mt-14`
  reclaim hack.
- WhyDrawer: dead `shadow-2xl` (theme already rendered it as nothing);
  `border-l-2 border-accent pl-3` off the quote and `accent-deep` off the CPIC
  chip (colour discipline: `--accent` is the critical alert and a broken chain,
  nowhere else); the boxed Close → underlined mono label.
- CredibilityCard: the two-line side column collapsed into the conclusion row +
  axes line — **no field stopped rendering** (influence, consequence, risk,
  requiredControl, rationale, grid all still on screen); `py-0.5` off grid cells.
- **No test, assertion, branch, or error-handling path was deleted. No
  invariant-carrying comment was deleted** — the page.tsx/AlertCard geometry
  comments were rewritten in place to describe the new structure.

## 4e — the test that goes red

**For the pure paint changes — spacing, typefaces, the overlay geometry, motion —
the honest answer is: none.** No test renders page.tsx or asserts a class name,
and I did not add one that would pass either way.

What IS pinned constrained the redesign and stayed green for the right reasons:
moving `FDA-labeled` out of the CPIC badge's `<p>` turns
*"AlertCard: FDA badge … INLINE"* red (it asserts no `</p>` between them);
dropping the enum from CredibilityCard turns *"SIGNATURE cell lit"* red (it
asserts the literal `human-signature`); losing the `source record` label or the
`href={sourceUrl}` in the drawer turns *"sourceUrl is the alert's own value"*
red. I did **not** re-prove those pins by mutation in this run: rule 4b requires
a commit before mutation-testing and the tree carries BOTH agents' uncommitted
phase6 work — a named gap, deliberately taken, re-runnable the moment the phase
commit lands.

## Definition of done (CLAUDE.md adaptation 4)

- `npx tsc --noEmit` — **exit 0**.
- `npm test` — **52 pass / 0 fail**, identical to the pre-change baseline run.
  The prescribe-side tests specifically: all 5 AlertCard tests, both FDA-badge
  pins, both WhyDrawer verbatim/provenance tests, the G6PD absence test, the
  CredibilityCard pin, both CoverageLine tests — named in `tests/ui.test.ts`,
  all green before and after.
- `npm run verify` — **PASS**, exit 0.
- `sh scripts/check-removals.sh` — exit 0, **compared 0 files**, and its own
  output states that is "not a pass; nothing to look at". Correct: no test file
  changed in this diff.
- Lint: `npx eslint <my files>` — exit 0, and proven non-vacuous via
  `--format json`: **8 files examined, 0 errors, 0 warnings**. (`next lint` was
  not run — R-17.)

## Shims introduced

**None.** `CONTROL_LABEL` is a display mapping over a closed enum (METHOD_LABEL's
pattern), not a shim. The one magic number introduced — the overlay's `top-16` —
is documented in place and in DESIGN.md with its measured derivation. Surfaced to
`REGISTER.md` this run: **R-24** (OrderForm keeps typed text across patient
switches — pre-existing behaviour defect found while driving the demo states;
out of scope for a visual phase, one-line fix named).

## Not done / for the closer

- I did not commit — the cross-audit (Sol on this diff) is open and the tree
  holds both agents' work; the phase-close commit is Claude Code's.
- The before/after pair judged by Opus 5 should be Claude Code's captures; my
  after-shots in `docs/` are supplementary.
- `docs/DESIGN.md` carries the full decision log and every deviation, per 4i.

---

## Fix round

Scope: the four fixes assigned to Fable after cross-review
(`phase6-sol-on-fable.md`, `phase6-artifacts.md`). Behaviour changes were
explicitly in-scope this round, unlike phase 6 proper.

### Fix 1 — the fabricated clinical clearance [severity 1] — FIXED

`"No pharmacogenomic contraindication."` was a literal in `AlertCard.tsx` with
0 matches in any data file — the app authoring a clinical conclusion, and
rendering it green for `pt_reyes` + capecitabine off a CYP2D6 result while the
drug's gene (DPYD) had no result on file.

**The mechanism, per the brief:** `index[drug]`'s keys ARE the genes CPIC
associates with the drug, so the fix is derived entirely from data on disk.

- `lib/pgx/evaluate.ts` — new `assessGenes(patient, drug, index?)`: one
  `GeneAssessment` per relevant gene; `assessed` true ONLY when a result is on
  file AND its `lookup` matched a CPIC row (exact after trim + case-fold,
  evaluate()'s own discipline). An on-file result that matches no row is NOT
  assessed — R-6's silent-join failure must never read as a pass.
- `lib/contracts.ts` — `GeneAssessment` + `PrescribeResponse.genesAssessed`
  (additive; legal under the freeze).
- `app/api/prescribe/route.ts` — carries `assessGenes()` through the response.
- `components/prescribe/AlertCard.tsx` — the no-alert branch now has the three
  required outcomes: (1) all relevant genes assessed → serif seal line stating
  what was checked and found, procedurally ("✓ DPYD assessed — Normal
  Metabolizer. No CPIC alert raised for capecitabine."), (2) any relevant gene
  unassessed → mono amber unknown naming the gene ("DPYD not assessed — no
  result on file. Pharmacogenomic screening incomplete for capecitabine."),
  visually nothing like the green state, (3) `!resolution.matched` unchanged.
  A response with no gene facts also refuses to render a clearance.

**No clinical string was fabricated (4g):** every sentence the new states render
is procedural — it names a gene, a phenotype already on the response, and what
the engine did — *therefore* nothing on that line is a clinical conclusion, and
nothing on it claims CPIC authorship.

**4a-bis — the tests were seen RED first.** Plumbing was landed with the
component untouched; the new tests then ran against the old render:

```
not ok 56 - AlertCard none: Lindqvist … states what was checked   ("names the gene that was actually checked": false)
not ok 57 - AlertCard: Reyes + capecitabine … never render a clearance   ("the fabricated clearance is gone": false)
# tests 67 / pass 65 / fail 2
```

Red for the defect itself, not for a broken harness. After the component fix:
67/67.

**4e — the test that goes red when the line is reverted, proven by mutation**
(edit + reverse-edit, never `git checkout` — the tree carries both agents'
uncommitted work, rule 4b; applied-count grep before every read, 4a-bis-MUT):

| mutation | applied-count | red test |
|---|---|---|
| route `genesAssessed:` → `null` (call-site delete, 4a-quater) | 1 | `prescribe carries gene coverage: Reyes DPYD not assessed, Lindqvist assessed, same run` — alone; 6 others stayed green |
| engine `assessed: matched` → `result !== null` (the buggy on-file=assessed shape) | 1 | `assessGenes: a result whose lookup matches no CPIC row is NOT assessed` |
| AlertCard guard → `if (false)` (the original defect shape) | 1 | `AlertCard: Reyes + capecitabine — a result for the WRONG gene must never render a clearance` |

All three restored; `grep -c MUTATION-DEMO` = 0 in all three files; suite 67/67.

**Live, in the browser on localhost:3000, pt_reyes specifically:** Daniel Reyes
tab → `Xeloda 1250 mg/m2 BID` → the pane renders the amber line "DPYD not
assessed — no result on file. Pharmacogenomic screening incomplete for
capecitabine." with the PENDED DPYD-documentation clause directly beneath it —
the clinical and payer layers now agree on the same screen, and CYP2D6 is not
cited anywhere on the order. Same session: Lindqvist + capecitabine renders the
new green procedural line; Okafor + Xeloda renders the unchanged critical
takeover. Same-run API triple (ADAPTATION 3 pairing):

```
pt_reyes:     alert null | DPYD NOT-assessed, no-result | coverage pended
pt_okafor:    critical   | DPYD assessed, on-file       | not-covered  ("Avoid use of 5-fluorouracil…")
pt_lindqvist: alert null | DPYD assessed, on-file       | covered
```

**DISCLOSED — one existing test's assertions moved with the behaviour.**
`tests/ui.test.ts` "AlertCard none: Lindqvist…" pinned the defect's own literal
(`html.includes("No pharmacogenomic contraindication")` — Sol's review: "Test 42
pins the literal's presence; it does not prove a CPIC source"). Keeping that
assertion green and executing this fix are mutually exclusive, so that ONE
test's assertions were rewritten to pin the new sanctioned wording — including
the inverse pin that the old literal is gone. Every other pre-existing test
passes unmodified. The `respond()` helper in `ui.test.ts` also gained the
`genesAssessed` field (type-forced by the contract addition). `check-removals`
compared 4 files, no removals.

### Fix 2 — orphaned CSS in `app/globals.css` — FIXED

Grep at deletion time: 0 consumers of `break-flash` and `shadow-2xl` outside
`globals.css`; positive control: the identical grep form finds `.slide-in` (1)
and `.rise` (1) in use, so the zeros are measurements.

### Fix 3 — squint residual — reduced, one judgment stated

Lit `► SIGNATURE ◄` cell `bg-accent` → `bg-ink` (one lit-cell treatment; the
test-pinned literal untouched and verified still green); `required control`
enum value `text-accent-deep` → `text-ink`; `CredibilityCard` de-boxed to a
hairline-top open block so the pane's bottom third is one raised slip + one
open block instead of two identical rectangles. Verified in the browser on the
Okafor critical state: the only filled vermilion on screen is the headline.
**Judgment, recorded in `docs/DESIGN.md`:** `CoverageLine`'s `not-covered`
outline chip keeps `--accent-deep` — different weight class from the block that
competed, and flattening it collapses the payer determination scale.

### Fix 4 — cropped screenshots — REMOVED

`docs/phase6-after-critical-1280x720.jpg` and
`docs/phase6-after-clear-1280x720.jpg` deleted; superseded by Claude Code's
full-frame pair in `docs/phase6/`. `docs/DESIGN.md`'s reference updated so it
no longer points at deleted files.

### 4i — everything REMOVED this round

1. The `"No pharmacogenomic contraindication."` literal and the old green-line
   render over `patient.results` (replaced by the three-outcome branch).
2. `tests/ui.test.ts`: the two assertions pinning the old wording in the
   Lindqvist test (replaced by six pinning the new wording + the inverse pin).
3. `app/globals.css`: `@keyframes break-flash`, `.break-flash`, its
   `prefers-reduced-motion` line, the false "Used once" comment, the
   `--shadow-2xl` token and its stale two-line comment.
4. `CredibilityCard.tsx`: the `bg-accent` lit-cell branch, the `accent-deep`
   enum tint, the bordered `bg-paper-raised` container.
5. `app/api/prescribe/route.ts`: the unused `Actor` type import (the one
   standing eslint warning, in a file I own and edited this round; repo-wide
   lint is now 0/0).
6. The two cropped JPGs.

Nothing else was removed — no test, no assertion outside item 2, no branch, no
guard.

### Definition of done (fix round)

- `npx tsc --noEmit` — exit **0**.
- `npm test` — **67 pass / 0 fail / 67 total**. All pre-existing tests pass
  (with the single disclosed assertion move above). My additions: 4×
  `assessGenes` engine tests, 1 route carry pin, 1 Reyes component pin. The
  total exceeds 52+6 because Sol's parallel fix round is adding its own tests
  in the same tree; all green at every run I made.
- `npm run verify` — **PASS**.
- `sh scripts/check-removals.sh` — exit 0, **compared 4 file(s)** (non-zero:
  the instrument measured something), no removals.
- `npx eslint . --format json` — **53 files examined, 0 errors, 0 warnings**
  (was 0/1; the warning was the `Actor` import, removed). `next lint` not run
  (R-17).

### Shims introduced

**None.** Surfaced to `REGISTER.md` this run: **R-25** (a D6-conflict-suppressed
gene renders as the "assessed" procedural line — wording chosen to stay
literally true; the honest fix is carrying conflict state through the response)
and **R-26** (the credibility card's `assess(null)` says "No human control
required." beneath an incomplete-screening line — procedurally true, but the
narration must not lean on it for an unscreened patient).

I do not certify this work. The cross-audit is Sol's; the arbitration is Opus 5's.
