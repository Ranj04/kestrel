> **Inherits `.sol/prompts/_template.md` in full**, plus the adaptations in `CLAUDE.md`.
> Read both before this file.

# TASK: phase5-design — make it look expensive

You are **Fable**. Read `~/"biopharma hack"/.sol/prompts/_context.md` FIRST, then open
the running app and look at it before changing anything.

**This is a design pass over components that already work. Do not change behaviour, do
not rename props, do not touch `lib/` or any API route.** If a visual change requires a
logic change, stop and write `.sol/requests/design-<thing>.md` instead.

## The thesis, in one sentence

**This is an instrument, not an app.** Nearest reference is a well-made legal exhibit or
a calibrated lab report — archival, institutional, unhurried. It is *not* a SaaS
dashboard, and every instinct toward cards-with-shadows, gradient buttons, rounded
pills and colourful status chips takes it further from expensive, not closer.

Expensive is **restraint plus precision**. Cheap is many type sizes, inconsistent gaps,
and colour everywhere.

## The binding constraint

**The deliverable is a screen recording, watched in a small window.** Not a projection,
not a laptop at arm's length. Everything below is optimised for that: larger type, fewer
elements, higher contrast, motion used to steer the eye.

If a judge cannot read the CPIC sentence in that window, nothing else you do matters.

---

## STAGE 1 — tokens. Do this first, finish it, commit it.

**This stage alone must leave the app looking more expensive than it does now**, because
it may be the only stage that lands. Global rules, no component work.

### 1a. A real type scale, in `app/globals.css`

Replace ad-hoc sizes with a fixed scale and use nothing outside it. Fraunces has optical
sizing — use it, that is what makes serif type look commissioned rather than defaulted.

```
--step--1: 0.833rem   /* mono metadata, clause tags, hashes */
--step-0:  1rem       /* body */
--step-1:  1.333rem   /* the CPIC recommendation — this is the sentence that matters */
--step-2:  1.777rem   /* card headline */
--step-3:  2.369rem   /* DO NOT PRESCRIBE */
```

**Weight contrast, not size mush.** Big things are big and light-tracked; small things
are small, uppercase, wide-tracked, and mono. Nothing in between. The single most common
cheap-looking tell is four sizes within 20% of each other.

### 1b. One spacing rhythm

An 8px base. Every margin, padding and gap is a multiple: `8 / 16 / 24 / 40 / 64`.
Nothing else. Not 12, not 30, not "whatever looked right." Inconsistent gaps are the
second cheap-looking tell and they are invisible individually and obvious in aggregate.

### 1c. Colour discipline

The palette already exists in `globals.css` and is good. The rule is **how much**:

- **Vermilion `--accent` appears in exactly two situations**: the critical alert, and a
  broken chain. Nowhere else. Not on buttons, not on links, not on hover.
- **Forest `--seal`** for cleared / intact only.
- Everything else is `--ink`, `--ink-soft` and `--line`.
- **`--line` for borders, never a shadow.** Hairline rules read as archival; drop shadows
  read as 2015 Material. If you want separation, use a 1px rule and more whitespace.

### 1d. The two panes stay split, and the split gets sharper

Left `--paper` with the existing ruled-paper texture. Right `--void`. The seam between
them is a single hairline, not a gap or a shadow. The contrast is the point: the
clinical world and the machine world are visibly different systems.

**Commit here.** Even if everything below fails, the app now has a coherent scale, a
consistent rhythm and disciplined colour — which is most of what "expensive" is.

---

## STAGE 2 — the two moments that carry the demo

### 2a. The alert takes the whole left pane

When severity is `critical`, the alert **owns the entire prescribing pane**. Patient card
and order form recede — dim them to `--ink-soft` at reduced opacity behind it, do not
unmount them. It must read as *the software physically blocking you*, not as a
notification appended below a form.

Hierarchy inside it, top to bottom, and nothing else competes:

```
⛔  DO NOT PRESCRIBE                          ← --step-3, tight tracking
    DPYD · Poor Metabolizer · capecitabine    ← --step--1 mono, uppercase, wide tracking

    "Avoid use of 5-fluorouracil or 5-fluorouracil
     prodrug-based regimens."                 ← --step-1, THE hero line, generous leading

    CPIC Level A · Strong                     ← --step--1 mono

    [ Why this? ]   [ Override and sign ]     ← equal weight, neither is primary
```

The quoted CPIC sentence is the most important text on the screen. **Give it room** —
40px above and below, measure capped around 60 characters. Do not let a badge, an icon or
a button sit beside it.

`caution` uses the same structure at `--step-1`, in `--amber`, not full-pane.
`none` is a single quiet line in `--seal`. **The restraint of the green state is what
makes the red state land** — if the clear result is also loud, neither means anything.

### 2b. The chain breaking

The tamper cascade already exists. Make it read at video size:

- Broken records get a **4px vermilion left rule** and drop to reduced opacity. Intact
  records above are untouched — **the boundary between green and red is the whole point**,
  and it must be visible without reading a word.
- The pane header changes to `CHAIN BROKEN AT RECORD 4 — RECORDS 4–9 NOT TRUSTWORTHY`,
  `--step-1`, vermilion.
- **Instant, no easing.** A transition here reads as a loading state and kills the beat.

---

## STAGE 3 — the ledger writes itself

Records enter with a short stagger — roughly 60ms apart, 200ms each, subtle upward
translate plus fade. Use the existing `.rise` keyframe. This is the one place motion
earns its cost: the audit trail visibly *writing itself* as you act on the left is
something nobody in that room will have seen, and it is invisible without it.

Everything else is instant. `prefers-reduced-motion` already switches `.rise` off.

Record rows: hashes and clause tags in mono at `--step--1`, `--ink-soft`. Truncate
hashes to 6 characters with the full value on hover. Timestamps monospace and
right-aligned so they form a clean column — an aligned column of monospace numerals is
free precision and it is exactly what makes an instrument look calibrated.

---

## STAGE 4 — only if stages 1–3 are done and it is before 15:15

Optical alignment pass. The `⛔` glyph aligns to the cap height of the text beside it,
not its bounding box. Numerals are tabular. The two panes' first baselines match.
Nobody consciously notices any of this; everybody notices its absence.

---

## Do NOT

- Add a logo, a nav bar, a sidebar, a footer, a settings icon, or an avatar. There is
  one screen and it has no chrome.
- Add drop shadows, gradients, glassmorphism, or rounded corners above 4px.
- Introduce a colour that is not already in `globals.css`.
- Use an icon library. The one `⛔` and one `✓` are enough; more icons read as filler.
- Add a loading spinner. Everything is local and instant; a spinner would be a lie.
- Touch `lib/`, any API route, or any prop signature.

## Acceptance — and this is the only test that counts

Run the app, screen-record the 90-second flow, **and play it back in a window a quarter
of your screen.**

1. The CPIC sentence is comfortably readable at that size.
2. The moment the alert fires is obvious with the sound off and without reading a word.
3. Green → red on the same drug for a different patient reads as a deliberate contrast,
   not as two unrelated screens.
4. The tamper boundary — where green stops and red starts — is visible at a glance.
5. Nothing on screen is a value that cannot be traced to `data/`.
6. **Squint test:** blur your eyes. You should see two clear columns, one dominant red
   block, and an aligned column of monospace on the right. If you see scattered elements
   of similar weight, stage 1 was not finished — go back to it.

Write the decisions you made into `docs/DESIGN.md`, short. If you deviated from anything
above, say which and why — that is the record, per rule 4i.
