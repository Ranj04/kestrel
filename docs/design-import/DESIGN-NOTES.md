# Attest — design decisions

> Verbatim from the Claude Design project. Says "Attest"; the project is **Kestrel**.

Mockup: `Attest.dc.html` — live at 1280×720, no scrolling in any state.
Off-frame rail below the frame switches states (keys `1`–`6`, `b`, `s`, `r`); it is not
part of the product — hide it with the `showRail` tweak before recording.

## Type scale — 5 steps, nothing between

| Step | Size / leading / tracking | Face | Used for |
|---|---|---|---|
| D1 | 52 / 1.0 / −0.02em, wght 600, opsz 144 | Fraunces | `⛔ DO NOT PRESCRIBE` only |
| D2 | 30 / 1.45 / −0.005em, opsz 72 | Fraunces | the guideline hero line; drawer quote; caution headline |
| B  | 19 / 1.5 | Fraunces | patient name, mechanism text, order field, guideline link |
| M  | 15 / 1.45 | Fraunces | buttons, ledger override quote, superseded explanation |
| μ  | 13 / 1.35 | IBM Plex Mono | every timestamp, hash, clause tag, label, banner |

Only two weights (400/600), one italic-free voice. Tracking is only ever
−0.02 / −0.005 / 0 / 0.06 / 0.1 / 0.16 / 0.18em — the wide values exclusively on
uppercase mono.

## Spacing

8 / 16 / 24 / 40 / 64 only. Pane padding 40 (left) and 20/24 (right, to buy the ledger
its rows). Hero line carries 40 above and 40 below. Ledger rows: 6 top / 7 bottom + 1px
rule — the only 6/7 in the file, and it is row rhythm, not layout gap.

## Structure

- 704 / 576 split (55/45) divided by a single 1px `--line` border. No gap, no shadow.
- Banner is 35px: mono μ, 0.16em, `--ink-soft` on `--paper-raised`, one hairline under it.
- Left pane carries a 32px ruled texture at 5.5% ink — visible as paper, invisible as pattern.
- No radius above 2px anywhere. Zero shadows. Separation is always a 1px rule.

## Colour

Vermilion `#cf4520` appears twice only: the D1 blocking headline, and the broken-chain
header + 4px record rules. Forest `#1f5d4c` only on cleared/intact. Amber `#9a6b12` only
in caution. Everything else ink / ink-soft / line.

## Deviations, and why

1. **Hero measure is 624px (~44ch), not 60ch.** At D2 30px a 60-character measure needs
   ~880px — wider than the pane. Kept the type size (it is the one thing that must read at
   quarter-screen) and let the sentence set in two lines.
2. **Caution headline is D2, not D1.** D1 is reserved for the blocking state so that at a
   blur, exactly one thing in the product is huge and red.
3. **Caution uses amber hairlines above and below the block**, not a 4px left rule — the
   4px rule is the broken-chain signal and should mean only that.
4. **Hashes are 6 chars** (`4a91f3…`) per the spec line, not the 4 of your example row.
5. **On the void pane, seal and vermilion are lightened one step** — `#57a184` and
   `#e2582c` — for text only; the 4px rules and all paper-side use keep the exact palette
   values. `#1f5d4c` text on `#1a1512` is ~1.9:1 and unreadable in a small window.
   Secondary/tertiary mono on the void is `--paper` at 55% / 40%, not a new grey.
6. **Chain break is "RECORD 4 — RECORDS 4–6"**, i.e. the tampered record and everything
   chained after it. Newest-first means those sit *above* record 4 on screen; records 1–3,
   below the boundary, stay green and untouched. A 1px vermilion rule marks the boundary.
7. **Superseded is inverted, not coloured.** The panel is a solid `--paper` block set into
   the black pane with ink text, `SUPERSEDED` struck through, `VALID` in forest, and the
   chain status still green. Different medium, not a different red — the two states cannot
   be confused at a glance.
8. **Superseded shows 3 records + `· records 1–4 unchanged · verified · not shown ·`.**
   No-scrolling means something has to give at 7 records plus a panel; eliding the
   untouched tail is the honest cut.
9. **Override signing is one inline step inside the alert** (rationale box + `Sign —
   approval`), not a modal. A modal over the takeover would be a second interruption.
10. **`MISMATCH` replaces `✓` on broken rows** rather than adding a second icon.

## Motion

Only the ledger moves: new records fade in with an 8px upward translate, 200ms,
`cubic-bezier(0.2,0,0.2,1)`, 60ms stagger oldest→newest (tweakable 0–120ms), driven by
the Web Animations API on rows that are genuinely new. Tampering is instant — no
transition. Drawer slides 200ms. `prefers-reduced-motion` drops all of it.

## Implementation notes

- Records animate on first appearance only; a set of seen record ids gates it, so
  re-renders never re-animate. Copy that behaviour or the ledger flickers on every action.
- Timestamps and the superseded panel rows use `font-variant-numeric: tabular-nums`; the
  mono column alignment depends on it.
- The clear state deliberately keeps the same ledger contents as the rest of the demo. In
  the real build Ana's order writes its own `order.placed` + `genotype.resolved` pair with
  no `alert.raised` — worth doing, since that absence is the proof the lookup is real.
