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
