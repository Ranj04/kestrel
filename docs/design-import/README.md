# Claude Design import — READ-ONLY reference for phase 6

Pulled from the `claude_design` MCP project `5b48d718-df7c-4cb7-9274-08e1b2713321`
by Claude Code at the open of phase 6, so neither agent needs MCP access.

Files here are a **reference, not a patch.** `.sol/prompts/phase5-design.md` and the
phase-6 prompts outrank this on every conflict.

- `Attest.dc.html` — the mockup, verbatim. Inline styles, one 1280×720 frame, all six
  left-pane states and all three ledger states.
- `DESIGN-NOTES.md` — the designer's own decision log, verbatim. **Read this first;**
  it is worth more than the markup because it states the *reasons*, including ten
  named deviations and why each was taken.

## Two things about it before you use it

1. **It predates the rename. It says "Attest" throughout. The project is KESTREL.**
   Do not reintroduce the old name anywhere a judge can see. The filename below keeps
   the old name only because that is its path in the design project.
2. **It carries its own 5-step type scale in raw px. We already have one in rem.**
   Importing a second scale alongside the existing one is the single most common
   cheap-looking tell. **Use the mapping below. Do not add sizes.**

## THE MAPPING — both agents use this, identically

The import's scale is px-absolute and pitched for a fixed 1280×720 frame. Ours is
rem-relative and already in `app/globals.css`. Map, never add:

| Import step | Import px | → our token | Our px | Used for |
|---|---|---|---|---|
| D1 | 52 | `--step-3` | 37.9 | `⛔ DO NOT PRESCRIBE` and nothing else |
| D2 | 30 | `--step-1` | 21.3 | the CPIC hero line; drawer quote; caution headline |
| B  | 19 | `--step-0` | 16 | patient name, mechanism text, order field |
| M  | 15 | `--step-0` | 16 | buttons, override quote, superseded explanation |
| μ  | 13 | `--step--1` | 13.3 | every timestamp, hash, clause tag, label, banner |

B and M collapsing onto `--step-0` is deliberate and is the point of a five-step
scale — 19 and 15 are within 21% of each other and having both is the tell.

Ratios are preserved where it matters: the import's D1:μ is 4.0×, ours is 2.85×. The
hero line stays the largest body text on screen either way. **If a size you want is
not one of the five steps, the answer is one of the five steps, not a sixth.**

Spacing maps 1:1 — the import's 8/16/24/40/64 is already our rhythm.

Colour maps 1:1 and is already in `globals.css`, including the two void-pane lifts
(`--seal-void` #57a184, `--accent-void` #e2582c) which came from deviation 5 of the
notes and are an accessibility fix, not a new palette entry.

## What the import is genuinely good for

Layout and hierarchy decisions that neither phase-6 prompt spells out:

- the 704/576 split divided by a single 1px `--line` border, no gap, no shadow
- the critical state as an `inset:0` overlay at `rgba(paper, 0.93)` over a 0.3-opacity
  base pane — which is exactly 6a's "recede behind it, do not unmount"
- 40px above *and* below the hero line, measure capped (notes deviation 1 explains why
  624px/~44ch beat the 60ch the prompt asks for, and the reasoning transfers)
- the ledger row rhythm: 6 top / 7 bottom + 1px rule
- `font-variant-numeric: tabular-nums` on timestamps — 6h's aligned mono column does
  not actually align without it
- the "animate on first appearance only, gated by a seen-id set" note in the notes'
  implementation section. **Copy that behaviour or the ledger re-animates on every
  render.** This is the single most useful line in the whole import.
