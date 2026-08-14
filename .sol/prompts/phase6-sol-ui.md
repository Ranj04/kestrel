> **Inherits `.sol/prompts/_template.md` in full**, plus the adaptations in `CLAUDE.md`.
> Read both, then `.sol/prompts/phase5-design.md`, then `phase6-fable-ui.md` — you
> are the other half of that phase and you share its thesis and its boundaries.

# TASK: phase6-sol — the LEDGER pane

You are **Sol**. You own `components/ledger/` and nothing else in this phase.
Fable owns `components/prescribe/`, `app/page.tsx` and `app/globals.css`, working
in parallel. **Do not edit a file you do not own.** If you need a token that does
not exist, write `.sol/requests/token-<name>.md` — do not add it to `globals.css`
yourself, Fable is editing that file this phase.

## Why this phase exists

Kestrel placed 3rd and the judges' only stated criticism was the UI. Stage 1 of
`phase5-design.md` landed the type scale; stages 2–4 never ran. The tokens exist
and the components were never rebuilt around them.

## Boundaries — hard

**Do not touch `lib/`. Do not touch any API route. Do not change any prop
signature.** `npm test` passes identically before and after. A red test means you
changed behaviour and exceeded scope.

---

## 6e. Nothing on screen is a pixel literal

Measured baseline, **21 in your files**:

```
components/ledger/SignatureModal.tsx      7
components/ledger/ChainStatus.tsx         5
components/ledger/AuthorizationPanel.tsx  4
components/ledger/RecordRow.tsx           3
```

Every size resolves to `--step--1 … --step-3`. Report the after-count.

**Echo the baseline command before you start:**

```bash
grep -rc 'text-\[[0-9]' components/ledger | grep -v ':0$'
```

A command that prints nothing because you mistyped the path is indistinguishable
from one that prints nothing because the work is done. (Rule 4a-bis.)

## 6f. The ledger writes itself

Records enter with a stagger — ~60ms apart, 200ms each, subtle upward translate
plus fade, using the existing `.rise` keyframe.

This is **the one place motion earns its cost.** The audit trail visibly writing
itself as the user acts on the left is the single most memorable thing this app
does and it is currently invisible. Nobody in that room had it.

**Everything else stays instant.** In particular:

- **The tamper cascade must remain instant, with no easing.** A transition there
  reads as a loading state and kills the beat. This is not a style preference —
  it is the difference between "the chain broke" and "something is loading."
- `prefers-reduced-motion` already disables `.rise`. Keep that path working and
  say how you verified it.

## 6g. The chain break reads at video size

- Broken records get a **4px vermilion left rule** and drop to reduced opacity.
  Records above are untouched — **the boundary between green and red is the whole
  point** and must be visible without reading a word.
- Header becomes `CHAIN BROKEN AT RECORD n — RECORDS n–m NOT TRUSTWORTHY` at
  `--step-1`, vermilion.

## 6h. The record rows become a calibrated instrument

- Hashes and clause tags mono at `--step--1`, `--ink-soft`.
- Truncate hashes to 6 characters, full value on hover.
- **Timestamps monospace and right-aligned so they form a clean column.** An
  aligned column of monospace numerals is free precision and it is exactly what
  makes an instrument look calibrated rather than assembled.

## 6i. `AuthorizationPanel` — two reds, still distinguishable

`SUPERSEDED` and a broken chain mean completely different things and this pane is
the only place both can appear. A superseded authorization is **not** an
integrity failure — the record is still true. If a judge cannot tell those apart
at a glance, the differentiator is lost.

Superseded reads as *stale*: `--amber`, or vermilion outline without fill.
Never the same treatment as a broken hash.

---

## Do NOT

- Add a logo, nav, footer, settings icon or avatar. One screen, no chrome.
- Add shadows, gradients, glassmorphism, or corners above 4px.
- Introduce a colour not already in `globals.css`.
- Use an icon library. One `⛔` and one `✓` is enough.
- Add a loading spinner. Everything is local and instant; a spinner would be a lie.

## Deliverable clause — inherited, not optional

**1. Enumerate what you REMOVED (4i).** If nothing, say so in those words.

**2. Name the test that goes RED when you revert THAT LINE (4e).** For a visual
phase the honest answer may be *none*. **Say that rather than naming a test that
passes either way.** A named gap beats a satisfied formality.

**3. 4a-bis on the pixel-literal count** — baseline echoed first, per 6e.

**4. Evidence and claim in one sentence (4g).** *"The pixel-literal count went
21 → 0, therefore every size in this pane resolves to the scale."*

**5. Surface every shim you introduce.** `REGISTER.md`, same run.

**You do not certify your own work.** Fable audits this diff; you audit Fable's.
Opus 5 closes the phase against the before/after screenshots and the squint test.
