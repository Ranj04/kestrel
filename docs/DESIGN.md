# DESIGN — phase5 decisions

## Stage 1 (tokens) — SHIPPED

**Type scale.** Five steps in `:root` (`--step--1: 0.833rem` … `--step-3: 2.369rem`,
perfect fourth). The named Tailwind text utilities are remapped onto them in the
`@theme` block: `xs`/`sm` → step −1, `base` → step 0, `lg`/`xl` → step 1,
`2xl` → step 2, `3xl`/`4xl` → step 3. Collapsing xs/sm and lg/xl is deliberate —
a size between two steps does not exist. The CPIC recommendation now renders at
`--step-1` (21.33px, up from 19px) via `text-lg` in `AlertCard` and `WhyDrawer`.
`font-optical-sizing: auto` is explicit on `body`; Fraunces carries an opsz axis.

**Spacing rhythm.** 8px base, menu `8 / 16 / 24 / 40 / 64`. Off-menu integer keys
snapped in `@theme` (`--spacing-3` → 8px, `--spacing-5` → 16px); fractional keys
(1.5 → 4px, 2.5 → 8px) snapped in an appended `@layer utilities` block because a
dot is not a valid custom-property ident.
**Deviation, stated:** 2px and 4px survive as intra-block half-steps (label→value
leading). Pushing them to 8px costs ~30px of height on the money-shot card at
1280×720 (R-19 budget) and was not worth it. Say the word and they snap up.

**Colour discipline.** Vermilion: critical alert + broken chain. Removed from the
PatientCard phenotype chip (a NORMAL metabolizer rendered red was a false signal —
now weight, not colour) and from the page-level error line (amber). The ambient
vermilion/forest radial washes under the page (`body::before`) are gone.
**Left in place, deliberately:** `CoverageLine`'s `not-covered` badge and
`CredibilityCard`'s SIGNATURE cell stay `--accent` — both only ever co-occur with
a critical alert, and re-toning them is semantics churn, not discipline.

**Shadows.** None. `--shadow-2xl` renders nothing via the theme (reaches Sol's
`SignatureModal` without touching his file); the one arbitrary-value shadow
(AlertCard) was deleted. Separation is a 1px `--line` rule and whitespace.

**Panes.** Left `--paper` with the ruled texture (re-pitched 34px → 32px, onto the
rhythm); right `--void`; the seam is the existing single hairline.

**Measured at 1280×720** (main pinned, real Chrome, dev server): all four demo
patients, left pane overflow 0, headroom — Okafor 31px (was 4px pre-pass:
the spacing snap paid for the bigger recommendation), Reyes 64px, Lindqvist
284px, Bhattacharya 285px. WhyDrawer inner 635/635, no internal scroll.
Not on the scale yet: the arbitrary `text-[8px…13px]` metadata sizes in both
panes — that is stage-2/3 component work, not token work.

## Stage 2 (the two moments) — SHIPPED

**2a — critical owns the pane.** The vermilion field is painted by `page.tsx`
(`absolute inset-0 z-10 bg-accent/95` — a flow child cannot reach the pane
edges); `AlertCard`'s critical branch is the content that sits on it. Hierarchy
exactly per spec: step-3 mono headline, step−1 mono uppercase wide-tracked
kicker, the CPIC sentence at step-1 with **40px above and below** (`my-10`) and
a 60ch measure cap, badge row at step−1 with the FDA badge inline (test-pinned),
implication subordinate, two equal-weight ghost buttons.

**Deviation, stated:** the patient card recedes at `opacity-40` but sits ABOVE
the field (`z-20`), not beneath it — its tabs are the demo's only exit from a
critical state and had to stay clickable. At 40% over the red it still reads as
behind glass. The order form recedes BENEATH the field: mounted, dimmed, and
physically unreachable (a click on it lands on the headline — verified by
hit-test). The alert content reclaims the covered form's flow height with
`-mt-14` (56px = form + gap), which is also what lets Okafor fit.

**Height (R-19).** The reserve lever was pulled as named: `CoverageLine` clause
text and `CredibilityCard` rationale went `leading-snug → leading-tight`,
CredibilityCard `py-2 → py-1`. The hero's 40px and the recommendation size were
not touched. Coverage renders under the clinical block on its own paper slip
(ink-soft on vermilion is illegible); credibility sits below it, bottom-pinned.

**caution** keeps the card, headline raised to step-1 in `--amber`; buttons
equalized; arbitrary px sizes snapped onto the scale. **none** got QUIETER: the
left rules came off all three no-alert lines (emphasis removed, never added)
and 12px snapped up to step−1.

**2b — the chain breaking** ended up in `components/ledger/` itself (Sol's
design import): 4px `--accent` left rule at full strength, row content at 0.6
opacity, no transition, MISMATCH replacing the tick, broken header at step-1 in
`--accent-void`. The global-CSS hook block written here first was superseded by
that import and deleted rather than left looking load-bearing. Verified in
Chrome post-import: rule `rgb(207,69,32)` 4px, opacity 0.6, header 21.33px.

**Measured at 1280×720** (main pinned, real Chrome, dev server), left/right
pane overflow and the critical states' real slack (the `mt-auto` air between
the buttons row and the coverage slip): Okafor 0/0 overflow, +18px slack;
Reyes 0/0, +50px; Lindqvist 0/0, 293px headroom; Bhattacharya 0/0, 295px.
Patient tabs hit-testable through the field; order form blocked. Right-pane
figures predate Sol's ledger restyle by minutes; his list scrolls internally.

## Phase 6 — the left pane rebuilt around the tokens (Fable)

Stage 1's tokens existed; the components were never rebuilt around them. This pass
finishes it. Baseline echoed before starting (4a-bis): `grep -o 'text-\[[0-9]'`
over `components/prescribe` + `app/page.tsx` counted **33 occurrences / 6 files**
(the phase prompt's stated total of 31 was wrong; its own per-file list sums to 33).
After: **0**, and the identical grep form prints 33 against the HEAD versions of the
same files, so the zero is a measurement, not a broken instrument.

**Design import mapping applied as written** (`docs/design-import/README.md`):
52→step-3, 30→step-1, 19/15→step-0, 13→step−1. No sixth size exists. All arbitrary
`text-[Npx]` classes resolved to the named utilities (`xs`/`sm`→step−1,
`base`→step-0, `lg`→step-1, `3xl`→step-3), which the `@theme` block maps onto the
scale.

### 6a — the takeover, restructured

The critical alert is now an **absolute overlay** (`inset-x-0 top-16 bottom-0`)
carrying its own `--paper`/93% ground, replacing the phase5 pair of
(inset-0 field + in-flow alert with a `-mt-14` reclaim hack). This is the import's
`inset:0` overlay adapted to one constraint the mockup doesn't have: **the patient
tabs are the demo's only exit from a critical state**, so the overlay starts at
64px — just under the tab row (8 pt + 20 header + 4 gap + 28 tabs = 60px, measured)
— leaving the tabs crisp and clickable while the chart body and order form recede
behind the frost. Verified by hit-test at 1280×720: all four tabs reachable, a
click on the order form lands on the hero blockquote.

D1 headline is now **Fraunces** semibold tight in `--accent` (was mono), kicker
mono step−1 at 0.18em, hero at step-1 with its 40px above/below intact, badge row
plain mono (the old chip border was `paper-raised/60` — designed for the vermilion
field, invisible on paper), implication at step-0 `--ink-soft`, and both actions
in the import's ONE button shape (1px ink border, Fraunces step-0, invert on
hover) at equal weight.

### 6b — pixel literals

33 → 0, therefore every size on this pane resolves to the five-step scale.
`app/pipeline` and `AlertCard` measured 0 before and still do.

### 6c — credibility as a statement

The conclusion leads at step-1 — **"Signed human decision required."** — with the
`requiredControl` enum value right-aligned on the same row (still on screen, still
verbatim from the response, still test-pinned), axes on one mono line beneath, and
the 2×2 demoted to supporting evidence with the rationale beside it. The
conclusion strings are display labels for the enum (exactly METHOD_LABEL's
pattern), never new content.

**Deviation, stated:** the conclusion renders at step-1 only for
`human-signature`; `auto`/`human-review` speak at step-0. If the routine states
also led at step-1, the signature case would mean nothing — the same restraint
argument the spec makes for the green alert line.

### 6d — motion

`.rise` retimed to the design-notes Motion spec: **200ms,
cubic-bezier(0.2,0,0.2,1), 8px translate** (was 700ms/14px). **Token value
change — Sol reads this file** and his prompt cites the same 200ms spec.
`.slide-in` (WhyDrawer) now slides up 16px at the same 200ms curve — one motion
voice. `.rise` was REMOVED from all AlertCard states: per the design notes,
**"Only the ledger moves"** — the alert appears instantly. The
`prefers-reduced-motion` block is unchanged and still disables all three
keyframes. The stagger itself lives in Sol's components (his 6f), not here.

### Other decisions

- **Clear state** raised to the import's form: hairline, then the ✓ line in
  `--seal` Fraunces at step-0. The two honest-absence lines (no match / no
  genotype) stay mono step−1 — they are not clearances. No fabricated metadata
  line: the mockup's "checked 14:31:02.118" has no source field in the response,
  so it does not render (the OrderForm resolution line already carries provenance).
- **Caution** adopts deviations 2 and 3 from the design notes: amber hairlines
  above/below (never a 4px rule — that means broken chain; the `bg-amber/10` fill
  removed), headline at step-1, quote at step-0. The mockup's derived headline
  ("Reduce starting dose 50%") is a paraphrase of clinical text and was NOT
  taken — the fixed label REVIEW BEFORE PRESCRIBING stays. The ⚠ glyph came off
  (phase5: one ⛔ and one ✓ are enough). Caution shares the pane with the chart in
  flow, so it keeps the compact half-step rhythm; the 24px ceremony is the
  critical takeover's.
- **WhyDrawer**: quote loses its vermilion left rule (colour discipline — --accent
  is the critical alert and a broken chain, nowhere else; CPIC chip likewise
  ink, not accent-deep). Provenance (`source record` + exact CPIC URL) pinned to
  the drawer floor outside the scroll region. Close is the import's underlined
  mono label. Dead `shadow-2xl` class removed (it already rendered nothing).
- **Hero measure:** kept `max-w-[60ch]`; at step-1 the ~624px pane content width
  is the binding cap, which is deviation 1's own resolution at our scale — the
  sentence sets in two lines, type size untouched.
- **Corner radius:** the import's 2px radius was not adopted; existing square
  corners kept everywhere (within the ≤4px rule, avoids churn).
- **Banner** and pane header snapped to step−1 with menu tracking (0.16em/0.18em).
- **Height, measured at 1280×720** (main pinned, real Chrome, dev server):
  left-pane overflow **0 in all five states** — Okafor critical, Reyes codeine
  critical, Reyes paroxetine caution, Lindqvist clear, Bhattacharya pended.
  Smaller viewports clip (overflow-hidden, no scroll by design); the demo target
  is fixed at 1280×720. The `top-16` overlay constant depends on the measured
  header+tab geometry above it; if the header row ever grows, the overlay seam
  moves with it visibly, not silently.

After-screenshots: Claude Code's full-frame before/after pair in `docs/phase6/`
(exact 1280×720, same script both runs) is the artifact the phase closes against.
My own two after-JPGs previously referenced here were cropped — they lost the left
edge of the app (Sol's finding 2) — and were deleted in the fix round rather than
left looking like evidence.

## Phase 6 fix round (Fable)

### The false clearance is gone — the no-alert state now has three honest shapes

`"No pharmacogenomic contraindication."` was a component literal — a clinical
conclusion the app authored itself, rendered green for pt_reyes + capecitabine
citing CYP2D6, a gene irrelevant to the drug, with no DPYD result on file
(severity-1, `docs/phase6/finding-reyes-false-clearance.png`). The fix carries
gene-coverage facts through the response (`PrescribeResponse.genesAssessed`,
derived in `lib/pgx/evaluate.ts:assessGenes` from the drug's own CPIC index
bucket — nothing invented) and the component renders:

1. **Every relevant gene assessed, none alerted** — serif `--seal` above the
   hairline: *"✓ DPYD assessed — Normal Metabolizer. No CPIC alert raised for
   capecitabine."* Procedural statements only — what was checked, what was
   found, what the engine did — never a clinical conclusion in our own words.
2. **A relevant gene not assessed** — mono `--amber`, same voice as the two
   honest-absence lines: *"DPYD not assessed — no result on file.
   Pharmacogenomic screening incomplete for capecitabine."* Names the missing
   gene; never a tick, never seal. A result on file whose lookup matched no
   CPIC row also lands here, worded as exactly that (R-6's silent join must not
   read as a pass). Genes the patient carries that are irrelevant to the drug
   are not cited on this order at all.
3. **No CPIC guideline / no genotype** — the two pre-existing honest lines,
   unchanged.

### Squint-test residual (6b): one vermilion, one texture

- The lit `► SIGNATURE ◄` cell was `bg-accent` — a second filled vermilion block
  competing with DO NOT PRESCRIBE at a blur. It now takes the same lit-cell
  treatment as the review cells (`bg-ink`); the literal and its meaning are
  unchanged and still test-pinned. The `required control` enum value likewise
  dropped its `accent-deep`.
- `CredibilityCard` dropped its bordered `bg-paper-raised` box for a
  hairline-top open block. The bottom third previously stacked two identically
  raised rectangles (coverage slip + credibility card) that blurred into one
  band; now the coverage slip is the single raised element and the credibility
  block anchors on its serif conclusion line.
- **Left as-is, deliberately:** `CoverageLine`'s `not-covered` chip stays
  `--accent-deep`. It is outline text at step −1 — a different weight class
  from the filled block that was competing — and it encodes the payer
  determination scale (covered = seal, pended = amber, not-covered =
  accent-deep); flattening it to amber would make "pended" and "not-covered"
  the same colour, which are materially different payer outcomes. If the
  squint judge still objects, this chip is the next candidate, but it was not
  the element the finding named.

### Orphaned CSS removed (4i)

`@keyframes break-flash`, `.break-flash`, its reduced-motion override, and the
`--shadow-2xl` zeroing token + both comments. Sol's 6f made the chain break
instant and removed the only `.break-flash` consumer; the last `shadow-2xl`
consumer went with the ledger restyle. Verified orphaned by grep at deletion
time (0 consumers outside `globals.css`; positive control: the same grep form
finds `.slide-in` and `.rise` in use).
