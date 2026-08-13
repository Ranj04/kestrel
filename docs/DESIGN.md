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
