> **Inherits `.sol/prompts/_template.md` in full**, plus the adaptations in `CLAUDE.md`.
> Read both before this file. Read `.sol/prompts/phase5-design.md` too — this
> finishes what that started.

# TASK: phase6-fable — the LEFT pane, because the UI is what cost us first place

> **You own `components/prescribe/`, `app/page.tsx`, `app/pipeline/`, `app/globals.css`.**
> `components/ledger/` is SOL'S and is covered by `phase6-sol-ui.md`, running in
> parallel. **Do not edit a file you do not own**, even to fix an obvious 11px.
> If the shared token layer needs a change, make it in `globals.css` and say so —
> Sol is reading the same file.

You are **Fable**. Read `~/"biopharma hack"/.sol/prompts/_context.md` FIRST, then
run the app and look at it before changing anything.

## The situation, stated plainly

Kestrel placed 3rd. **The judges' only stated criticism was the UI.** Not the
idea, not the engine, not the audit model — those survived a room of biopharma
people. The paint lost it.

`phase5-design.md` stage 1 landed: `app/globals.css` has the type scale
(`--step--1` … `--step-3`), the 8px rhythm, the colour discipline. **Stages 2–4
never ran.** The tokens exist and the components were never rebuilt around them.
That is the entire gap.

## Boundaries — these are hard

**Do not touch `lib/`. Do not touch any API route. Do not change any prop
signature.** If a visual change appears to require a logic change, stop and write
`.sol/requests/design-<thing>.md` instead. This phase must be revertible with one
`git revert` and must not be able to break a single existing test.

`npm test` must pass identically before and after. If a test goes red, you
changed behaviour and you have exceeded scope.

---

## STEP 0 — the Claude Design import, and it comes first

There is a Claude Design project that was never imported:

```
https://claude.ai/design/p/5b48d718-df7c-4cb7-9274-08e1b2713321?file=Attest.dc.html
```

Use the `claude_design` MCP (`https://api.anthropic.com/v1/design/mcp`,
authenticate via `/design-login`). Read `Attest.dc.html` and the `support.js` it
imports.

**Three things about it:**

1. **It predates the rename.** It will say *Attest* everywhere. The project is
   **Kestrel**. Do not reintroduce the old name anywhere a judge can see.
2. **`phase5-design.md` outranks it on every conflict.** No logo, no nav bar, no
   footer, no shadows, no gradients, no rounded corners above 4px, no icon
   library, no spinner, no colour not already in `globals.css`.
3. **Map it onto the existing tokens. Do not add a second scale.** Four sizes
   within 20% of each other is the single most common cheap-looking tell and
   importing a design alongside an existing scale is exactly how you get it.

Treat the import as a *reference*, not a patch. Take its layout and hierarchy
decisions; discard anything that fights the four fixes below.

---

## THE FOUR FIXES, in priority order

### 6a. The alert must own the left pane

Right now the critical alert is a card in a vertical stack, competing with the
coverage line and the credibility grid below it. It reads as a notification
appended to a form.

When severity is `critical`, the alert **owns the entire prescribing pane**.
Patient card and order form recede — dim to `--ink-soft` at reduced opacity
**behind** it. Do not unmount them; the demo switches patients and they must
still be there.

Hierarchy inside it, and nothing competes:

```
⛔  DO NOT PRESCRIBE                       ← --step-3, tight tracking
    DPYD · Poor Metabolizer · capecitabine ← --step--1 mono, upper, wide tracking

    "Avoid use of 5-fluorouracil or 5-fluorouracil
     prodrug-based regimens."              ← --step-1. THE hero line.

    CPIC Level A · Strong · FDA-labeled ⓘ  ← --step--1 mono

    [ Why this? ]   [ Override and sign ]  ← equal weight
```

**The CPIC sentence is the most important text on the screen.** 40px above and
below, measure capped near 60 characters, nothing beside it.

`caution` uses the same structure at `--step-1` in `--amber`, not full-pane.
`none` is a single quiet line in `--seal`. **The restraint of the green state is
what makes the red state land** — Ana Lindqvist is the most persuasive fifteen
seconds in the demo and it is currently the least designed.

### 6b. Nothing on screen is 11px

The coverage clause and the credibility grid are hardcoded at `text-[11px]`.
`CoverageLine.tsx` alone has four instances. That is below `--step--1` and it is
why half the pane reads as texture rather than text.

**Every size on screen comes from the scale. Eliminate every pixel literal in
the files you own.**

Measured baseline, taken before this prompt was written — **31 in your files**:

```
components/prescribe/WhyDrawer.tsx        13
components/prescribe/PatientCard.tsx       6
app/page.tsx                               5
components/prescribe/CredibilityCard.tsx   4
components/prescribe/CoverageLine.tsx      3
components/prescribe/OrderForm.tsx         2
```

(Sol owns the other 21, in `components/ledger/`.) Report your after-count. If it
is not zero, name which survived and why.

### 6c. The credibility assessment is a statement, not a table

It is currently a dense 2×2 with `auto / review / review / SIGNATURE`. The
conclusion is the point and it is the smallest thing in the box.

Lead with the conclusion at `--step-1`:

> **Signed human decision required.**
> High model influence · high decision consequence

Keep the grid, demote it to supporting evidence beneath, and keep the explanatory
sentence. A judge should get the answer without reading a cell.

### 6d. The ledger writes itself

Records enter with a short stagger — ~60ms apart, 200ms each, subtle upward
translate plus fade. Use the existing `.rise` keyframe.

This is the one place motion earns its cost: the audit trail visibly writing
itself as you act on the left is something nobody in that room had, and it is
invisible without it. **Everything else stays instant.** The tamper cascade in
particular must remain instant — easing there reads as a loading state and kills
the beat. `prefers-reduced-motion` already disables `.rise`; keep that.

Truncate hashes to 6 chars with the full value on hover. Timestamps monospace and
right-aligned so they form a clean column.

---

## Acceptance — the only test that counts

Run the app, screen-record the demo flow, **and play it back in a window a
quarter of your screen.**

1. The CPIC sentence is comfortably readable at that size.
2. The moment the alert fires is obvious with sound off, without reading a word.
3. Green → red on the same drug for different patients reads as deliberate
   contrast, not two unrelated screens.
4. The tamper boundary — where green stops and red starts — is visible at a glance.
5. **Squint test.** Blur your eyes. You should see two clear columns, one dominant
   red block, and an aligned column of monospace on the right. Scattered elements
   of similar weight means 6b is not finished.

Capture a before/after screenshot pair at 1280×720 and put them in `docs/`.
Write decisions to `docs/DESIGN.md`. Deviations from anything above get named and
justified there, per rule 4i.

---

## Deliverable clause — inherited, not optional

**1. Enumerate what you REMOVED (4i).** Every assertion, branch, or invariant-
carrying comment deleted. **If nothing, say so in those words.**
`sh scripts/check-removals.sh` runs before your diff is read.

**2. Name the test that goes RED when you revert THAT LINE (4e).** For this phase
the honest answer may be *none* — it is a visual change and `ui.test.ts` may not
cover it. **Say that plainly rather than naming a test that would pass either
way.** A gap named is worth more than a formality satisfied.

**3. Before trusting a check that passed, confirm it CAN fail (4a-bis).** For 6b:

```bash
grep -rc 'text-\[[0-9]' components/prescribe app/page.tsx | grep -v ':0$'
```

Baseline is 31 across 6 files, recorded above. **Echo it before you start.** A
command that prints nothing because you typo'd the path looks identical to a
command that prints nothing because the work is done.

**4. Evidence and claim in the same sentence (4g).** *"Every size now resolves to
a token because the pixel-literal count went 14 → 0, therefore the scale is
actually in force."* No *therefore*, no evidence.

**5. Surface every shim you introduce** — unprompted. Anything not fixed goes to
`REGISTER.md` in the same run (rule 5).

**You do not certify your own work.** Sol audits this diff. Opus 5 closes the
phase against the before/after pair and the squint test — not against your
description of them.
