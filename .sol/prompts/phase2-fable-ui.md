> **Inherits `.sol/prompts/_template.md` in full**, plus the adaptations in `CLAUDE.md`.
> Read both before this file. Sol also reads `AGENTS.md` (a pointer, not a copy — rule 7).
> The deliverable clause at the bottom is inherited and not optional.

# TASK: phase2-fable-ui — the prescriber pane, the alert, the Why? drawer

You are **Fable**. Read `~/pgx/.sol/prompts/_context.md` FIRST, then
`~/pgx/.sol/requests/` — Sol may have filed something for you.

Phase 1 gave you a working API. This task makes it something a room can watch from twenty feet.

**You own the left half of the screen and the shell. Sol owns the right half.** Build
`app/page.tsx` as a two-pane layout and render `<LedgerPane />` from `components/ledger/` on the
right — Sol is filling that in right now. If the import does not resolve yet, render a placeholder
div of the right width and move on.

## The screen

```
┌────────────────────────────────┬──────────────────────────────┐
│  PRESCRIBE          [Fable]    │  AUDIT LEDGER        [Sol]   │
└────────────────────────────────┴──────────────────────────────┘
```

Fixed two-column, roughly 55/45. **No scrolling on either pane at 1280×720 during the demo.**
Test at that size, not on your full screen. Dark background, high contrast, generous type. This
gets projected and photographed.

A persistent banner: `SYNTHETIC DATA — no real patient information`. Non-negotiable, both for the
event's rules and because saying it before anyone asks reads as competence.

## Components

### `components/prescribe/PatientCard.tsx`

Patient selector across the three synthetic patients, then name, MRN, age/sex, indication, and the
gene results as small chips: `DPYD  c.1905+1G>A/c.1679T>G  Poor Metabolizer`.

Under the chips, small and grey: `PharmCAT v3.2.0 (synthetic VCF)`. That one line makes the
genotype look like it came from somewhere.

### `components/prescribe/OrderForm.tsx`

A free-text field, placeholder `Xeloda 1250 mg/m2 BID`, and an **Place order** button. Free text
is deliberate — typing a brand name and watching it resolve to the generic is a two-second proof
that something real is happening.

Show the resolution inline after submit: `Xeloda → capecitabine · matched exact` (or `via model`).

### `components/prescribe/AlertCard.tsx`

**This is the money shot. Spend your polish budget here.**

`critical` — the card takes the full pane. Deep red, heavy border, unmissable at distance:

```
⛔  DO NOT PRESCRIBE

    DPYD · Poor Metabolizer · capecitabine

    "Avoid use of 5-fluorouracil or 5-fluorouracil prodrug-based regimens."

    CPIC Level A · Strong recommendation

    Complete DPD deficiency and increased risk for severe or even fatal
    drug toxicity when treated with fluoropyrimidine drugs.

    [ Why this? ]        [ Override and sign ]
```

The quoted recommendation and the implication are **verbatim from CPIC**. Do not reword them to
fit the layout. If the string is long, let the card grow.

`caution` — amber, same structure, smaller.

`none` — do not render a card. Render a quiet green line:
`No pharmacogenomic contraindication. DPYD Normal Metabolizer.` Understated. The contrast between
this and the red card, on the same drug, is the thing that proves the lookup is real.

### `components/prescribe/WhyDrawer.tsx`

Slides in over the left pane on **Why this?**. This is candidate A's whole argument, so it must
look like evidence, not like a tooltip:

- The recommendation, verbatim, quoted
- `classification` and the CPIC Level A badge
- `implication` and `comments`, verbatim
- `population`
- Guideline name, linked to `guidelineUrl`
- Every citation as `PMID 29152729 · title · 2017`, linked to
  `https://pubmed.ncbi.nlm.nih.gov/<pmid>/`
- At the bottom, monospace and small: the `sourceUrl` — the exact CPIC API row.
  Label it `source record`.

That last line is the whole product in one detail. A judge who clicks it lands on the actual row.

### `components/prescribe/CredibilityCard.tsx`

Small, below the alert. Render the FDA grid as an actual 2×2 with the current cell lit:

```
FDA credibility assessment
context of use: pre-prescription pharmacogenomic screening for a single order

                consequence low   consequence high
influence low        auto            review
influence high      review        ► SIGNATURE ◄

model influence: high — the alert is the sole basis for the decision
decision consequence: high — fatal first-cycle toxicity
```

Then: `Required control: human signature`. When control is `human-signature`, the **Override**
button must be visually gated — it opens Sol's signature modal, never a plain dismiss. When
control is `auto`, no gate.

Ten seconds on screen, and it visibly implements a named FDA framework. Cheap, and it is the
thing the judges will repeat to each other afterwards.

## Wiring

- `POST /api/prescribe` on submit, render the response.
- **Override** calls Sol's modal. Import it from `components/ledger/`. If it does not exist yet,
  stub the handler to `console.log` and move on — do not block, and do not build your own
  signature modal. That is Sol's.
- After any ledger-affecting action, the right pane must refresh. Simplest thing that works: bump
  a key in shared state, or have `<LedgerPane />` poll every 1500ms. **Do not build an event bus.**

## Acceptance

At 1280×720, with the LLM key unset:

1. Select Okafor → order `Xeloda 1250 mg/m2 BID` → red card, verbatim CPIC text, no scroll needed
2. **Why this?** → drawer shows classification, Level A badge, ≥1 clickable PMID, and `source record`
3. Select Lindqvist → order `capecitabine` → green line, **no red card**
4. Select Reyes → order `codeine 30mg q6h prn` → red card with different text
5. Credibility grid lights the correct cell in all three cases
6. Nothing on screen is a value you cannot trace to `data/cpic/index.json` or `data/patients.json`

Step 3 is the one to check twice. Then update `DECISIONS.md` and commit — including Sol's files,
since Sol does not run git.

---

## Deliverable clause — inherited from `_template.md`, not optional

**1. Enumerate what you REMOVED (rule 4i).** Separately and always: every test,
assertion, branch, error handler, or comment carrying an invariant that you deleted.
**If nothing was removed, say so in those words.** A removal leaves no line to review
and no test to fail — it is invisible by construction. `sh scripts/check-removals.sh`
runs before your diff is read.

**2. Name the test that goes RED when you revert THAT LINE (rule 4e).** Not the
subsystem — the line. If the suite passes identically with and without your change,
there is no coverage of it, whatever the number next to the slash. If you cannot name
the test, you have found a gap, not a formality.

**3. Pin the CALL SITE, not just the implementation (rule 4a-quater).** For every
capability you add, name the one line that invokes it in production code, delete that
line, and run the tests that claim to cover the feature. If they stay green, the wiring
is untested — add an assertion on the call site before restoring the line.
**The live instance in this codebase:** `/api/prescribe` calls `ledger.append`. Delete
that call and every ledger test still passes, because they call the ledger directly.

**4. Before trusting a check that passed, confirm it CAN fail (rule 4a-bis).** Echo the
applied-count first (`grep -c '<changed text>' <file>`) and assert it is what you
expect. A mutation that never landed and a guard that does not work produce the
identical observation. If you cannot state what your command would print if the
property were false, you have not verified the property.

**5. Put the evidence and the claim in the same sentence (rule 4g).** *"`evaluate.ts`
copies `entry.recommendation` through untouched, therefore the string on screen is
CPIC's."* If the sentence has no *therefore*, there is no evidence in it.

**6. Surface every shim, stub, hardcoded value or synthetic id you introduce** —
unprompted, even when inconvenient. Anything surfaced and deliberately not fixed goes
to `REGISTER.md` **in the same run** (rule 5), not into a summary nobody reads twice.

**You do not certify your own work.** Hand over the diff and the reasoning; the other
agent audits it and Opus 5 closes the phase against a named artifact.
