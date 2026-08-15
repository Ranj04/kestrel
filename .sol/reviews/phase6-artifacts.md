# Phase 6 — artifacts, captured and independently verified by Claude Code

Neither agent certifies its own work, and **Claude Code does not certify its own
evidence or arbitrate**. This file is the evidence layer only: what was measured,
with what instrument, and whether the instrument was shown able to fail. The
arbitration between the two cross-reviews is Opus 5's.

---

## 1. The 4a-bis baselines, and a correction to both prompts

Measured at phase open, before either agent wrote a line:

| Territory | Prompt says | Actually measured | Per-file breakdown |
|---|---|---|---|
| Fable — `components/prescribe`, `app/page.tsx` | 31 | **33** | matches the prompt exactly |
| Sol — `components/ledger` | 21 | **19** | matches the prompt exactly |

**Both prompts state a total that contradicts their own per-file list** (13+6+5+4+3+2
= 33, not 31; 7+5+4+3 = 19, not 21). The per-file numbers were right in both cases,
so the lists were measured and the totals were typed. Both agents were given the
measurement rather than the total, and both reproduced it before starting.

`grep -c` counts *lines*, `grep -o | wc -l` counts *occurrences*; here they agree,
because no line carried two literals.

### After

| Territory | Before | After |
|---|---|---|
| Fable | 33 | **0** |
| Sol | 19 | **0** |

**The count went 52 → 0 across both halves, and the identical grep still returns
33 and 19 against the HEAD copies of the same files, therefore the instrument
fires and the zero is a real result rather than a mistyped path.**

### The zero was attacked, because a zero is cheap to fake

The prescribed grep only catches `text-[<digit>`. It does not catch a rem literal,
an inline `fontSize`, a `text-[length:…]`, or a raw `style` attribute. All four
evasion paths were checked across both territories:

```
arbitrary text-[…] of any form ....... 0 hits, both halves
inline fontSize / style={{ }} ........ 0 hits, both halves
[Npx] / [N.Nrem] in any utility ...... 0 hits, both halves
```

The one surviving bracket literal is `max-w-[68rem]` in `app/pipeline/page.tsx` — a
measure, not a type size. Remaining `tracking-[…]` values are letter-spacing, and
every one of them is a value the design notes explicitly sanction (0.06 / 0.1 /
0.12 / 0.16 / 0.18em on uppercase mono).

**Every size now resolves through the `@theme` remap onto the five steps, therefore
the scale is actually in force rather than merely present.**

---

## 2. The gate, run independently of both agents

```
npx tsc --noEmit ............... exit 0
npm test ....................... 52 pass / 0 fail  — identical to the phase-open baseline
npm run verify ................. PASS
sh scripts/check-removals.sh ... exit 0 but COMPARED 0 FILES -> NOT MEASURED
npx eslint . --format json ..... 53 files examined, 0 errors, 1 warning
```

Two instruments here can report success while measuring nothing, and both were read
for their **count**, not their exit code:

- **`check-removals.sh` compared 0 files.** No test file changed, so it had nothing
  to look at. Both agents reported this correctly as NOT MEASURED rather than as a
  pass. It is not evidence of removal safety.
- **eslint is no longer vacuous.** `CLAUDE.md` R-17 says lint closes as NOT MEASURED
  while `eslint.config.mjs` is broken. It now examines **53 files** and returns a
  parseable JSON result, so **lint is measurable again and R-17's premise is stale.**
  The single warning is `'Actor' is defined but never used` in
  `app/api/prescribe/route.ts` — an API route neither agent was permitted to touch,
  unmodified in `git status`, therefore pre-existing and outside phase-6 scope.
  Fable reported "8 files examined" because it scoped eslint to its own changed
  files; the repo-wide number is 53. Both are non-vacuous.

---

## 3. Screenshots — `docs/phase6/`, exact 1280×720 PNG

Five states, before and after, ten files. `file` reports `1280 x 720` on each.

The **before** pair was captured from a `git worktree` pinned at `745880f` running
on port 3001, not from a reverted working tree — so it was reproducible at any point
during the phase and did not require unwinding either agent's work. Both halves were
captured with the **same script and the same assertions**, so before and after are
comparable rather than merely adjacent.

Selectors are text-based on purpose. The whole point of this phase is that markup
and class names change underneath; a class selector would have passed on the before
run and silently matched nothing on the after run, yielding a screenshot of the
wrong state that still looked like a successful capture. Every step asserts what it
found — all 8 steps passed on both runs.

| State | File |
|---|---|
| initial | `before/after-01-initial.png` |
| **critical (Okafor)** | `before/after-02-critical.png` |
| **clear (Lindqvist)** | `before/after-04-clear.png` |
| **chain broken** | `before/after-05-broken.png` |
| superseded | `before/after-08-superseded.png` |

Fable's own `phase6-after-*.jpg` in `docs/` are cropped and lose the left edge; Sol
flagged that (its finding 2). The pair above supersedes them and is the artifact the
phase should be closed against.

---

## 4. The 1280×720 height budget

Measured, not eyeballed — `scrollHeight - clientHeight` per pane, six states:

```
ok  01 initial               doc:+0  left:+0  right:+0
ok  02 critical (Okafor)     doc:+0  left:+0  right:+0
ok  03 why drawer            doc:+0  left:+0  right:+0
ok  04 clear (Lindqvist)     doc:+0  left:+0  right:+0
ok  05 pended (Bhattacharya) doc:+0  left:+0  right:+0
ok  06 chain broken          doc:+0  left:+0  right:+0
```

Fable's "overflow 0 in all five demo states" holds, and holds in a sixth state it
did not name.

**Caveat, stated because it limits the claim:** this measures the two `section`
elements. The ledger's record list is an inner `overflow-hidden` flex child, so this
particular measurement *cannot fail* for content clipped inside that list — it is
the wrong instrument for Fable's finding 5, which is real (see §5) and which this
number does not contradict.

---

## 5. Quarter-screen playback and the squint test

The acceptance test, run rather than described. Logical display is ~1470×956, so
quarter-screen is ~735×478; the 1280×720 captures were played back scaled to 735px
wide, which is what "a recording in a quarter-screen window" actually is.

1. **CPIC sentence readable at that size** — yes. It is the second-largest thing on
   the pane and sets in two lines.
2. **Alert moment obvious with sound off** — yes. `DO NOT PRESCRIBE` moved from mono
   to Fraunces at `--step-3` and is unambiguously the loudest element.
3. **Green → red on the same drug reads as deliberate contrast** — yes. Verified as
   a genuine engine result, not two unrelated screens: in one run, `pt_lindqvist`
   returns `alert: null` and `pt_okafor` returns `critical` for the same
   `Xeloda 1250 mg/m2 BID`.
4. **Tamper boundary visible at a glance** — yes in the plain tamper state: 4px
   vermilion rule at full strength, contents at 60%, `MISMATCH` replacing the tick,
   1px boundary rule, intact rows above untouched. **No** in the
   supersede-then-tamper state — see §6, finding 5.
5. **Squint test** — passes on three of four. Two clear columns, one dominant red
   block, an aligned mono column on the right. The residual is the bottom third of
   the left pane, where the coverage clause and credibility card still blur into one
   uniform texture band, and where a second vermilion element (the `SIGNATURE` chip)
   competes with the headline. The before/after blur pair shows the headline
   markedly heavier and the ledger column structured where it was previously mush.

---

## 6. Findings I independently reproduced

I verified the reviewers' claims rather than relaying them.

**Sol's finding 1 — a fabricated clinical clearance. CONFIRMED, severity 1.**
`"No pharmacogenomic contraindication."` is a component literal in
`AlertCard.tsx` and returns **0 matches** in `data/cpic/index.json`,
`data/policies.json` and `data/patients.json`. The control string returns 0 too, so
the grep can distinguish. It is present at `745880f`, therefore **pre-existing and
not a phase-6 regression** — but this diff promotes it from small mono text to a
`--step-0` serif clearance, so the redesign made an unsourced clinical claim louder.

Reproduced live and captured at `docs/phase6/finding-reyes-false-clearance.png`:
Daniel Reyes carries **only CYP2D6**, no DPYD result. Ordering
`Xeloda 1250 mg/m2 BID` resolves to capecitabine, `evaluate` returns `alert: null`
for want of a DPYD result, and the screen renders
**"✓ No pharmacogenomic contraindication. CYP2D6 Ultrarapid Metabolizer."** — a green
clearance for a fluoropyrimidine, citing a gene irrelevant to it, on a patient whose
relevant gene was never tested. Absence of a result is rendered as evidence of
safety.

The same screen contradicts itself: the coverage clause immediately below is
**PENDED**, and states verbatim that fluoropyrimidine requests *"require
documentation of DPYD genotype results"* and *"submitted without a documented DPYD
result will be pended."* The payer layer gets it right; the clinical line above it
does not.

**Fable's finding 3 and the orphaned CSS — CONFIRMED, and reached independently.**
I found both before reading Fable's review, so this is genuine agreement, not
anchoring:
- `toLocaleTimeString([], { hour12:false, fractionalSecondDigits:3 })` renders
  **bare milliseconds** — ECMA-402 suppresses the h/m/s defaults when only
  `fractionalSecondDigits` is requested. Reproduced in node: `581`, against
  `16:27:28.581` with h/m/s supplied. The ledger shows `489`, `488`, `746` where 6h
  asks for a calibrated time column. Pre-existing line, but 6h rebuilt the column
  around it and Sol's report claims the column is calibrated — true of its
  alignment, false of its contents (rule 4g).
- `.break-flash` is orphaned in `app/globals.css` — keyframes, class,
  reduced-motion override, and a now-false "Used once" comment — after Sol correctly
  removed its only consumer and correctly did not edit Fable's file. Sol did not
  file the `.sol/requests/` note that would have closed the loop. `globals.css`
  already carries a comment about this exact thing happening in an earlier phase.

**Fable's finding 1 — refresh staleness. CONFIRMED structurally, pre-existing.**
`refresh()` has no request token; it polls every 1s and unconditionally calls
`setVerification(body.verify)`. A poll dispatched before a tamper can resolve after
it and repaint the prior instant's `chain intact ✓`. The function is **byte-identical
at `745880f`**, so phase 6 neither introduced nor touched it. The window is one
fetch latency, which is why neither Fable nor I could force it locally — but it is
the one bug class `CLAUDE.md` calls unacceptable outright, and it lands on the
demo's loudest beat.

**Fable's finding 5 — CONFIRMED and understated.** In supersede-*then*-tamper, the
chain-broken header, the tamper notice quoting both rationale strings, four buttons
and the full superseded panel consume the pane; the record list is pushed down until
only `#4` and a sliver of `#3` remain, **both broken**. The green/red boundary that
6g calls "the whole point" is entirely below the fold — not merely clipped. The
design import anticipated exactly this (deviation 8) and elides the untouched tail
with `· records 1–4 unchanged · verified · not shown ·`; that elision was not built.

**A 4g gap in Sol's own report.** It claims 6i renders "an inverted `--paper` panel
with struck-through `SUPERSEDED`, forest `VALID`". What renders is vermilion text on
the void with a strike-through — no inverted paper block, no forest `VALID`. That is
still within 6i's letter ("vermilion outline without fill"), and **6i's substance
holds**: the chain status stays forest `chain intact ✓` while an authorization is
superseded, so a superseded authorization is not confusable with an integrity
failure. But the report describes the mockup, not the implementation.

---

## 7. Cross-boundary interaction between the two halves

Fable changed a shared value: `.rise` retimed 700ms/14px → **200ms/8px,
cubic-bezier(0.2,0,0.2,1)**, and flagged it in-file and in its report as required.
This lands in Sol's pane. **It is convergent, not conflicting** — Sol independently
set `animationDuration: 200ms` and the same curve inline, so both halves aimed at
the design notes' motion spec and agree. Sol inherits the 8px translate, which is
also the spec. **No custom-property value changed**, so no colour or type token
shifted under Sol.

Scope held on both sides: `git diff --stat` shows Fable confined to
`components/prescribe/`, `app/page.tsx`, `app/globals.css`, and Sol confined to
`components/ledger/`. No `lib/`, no API route, no prop signature. `LedgerPane` takes
no props and `SignatureModalProps` is unchanged; `tsc` exit 0 across the boundary.

---

## 8. What this evidence does not cover

- **Rule 4e: no test goes red for any line in this phase.** Both agents said so
  plainly rather than naming a test that would pass either way. That is the honest
  answer for a paint phase and it is a real gap, not a formality: the entire visual
  result rests on the screenshots above and on the two cross-reviews.
- **No mutation testing was run.** Rule 4b requires a commit first and the tree
  carries both agents' uncommitted work. Fable named this itself. It unblocks the
  moment phase 6 is committed.
- **`prefers-reduced-motion` was verified by reading both guards**, not by browser
  emulation — Sol's JS `matchMedia` check and the CSS override in `globals.css`.
  Fable accepted the source-path check and named browser emulation as an unclosed
  residual. I did not close it either.
- **Sol's review could not reach `http://localhost:3000`** — its sandbox exposed no
  browser and refused the connection. It disclosed this rather than implying a live
  check, and its visual finding is therefore against artifacts, not the running app.
  Fable's review *did* drive the live app end to end.
