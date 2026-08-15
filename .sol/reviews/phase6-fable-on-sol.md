# phase6 — Fable auditing Sol's ledger diff (6e–6i)

Fable. Diff under review: `git diff -- components/ledger` in the uncommitted working
tree (both agents' phase6 work is unlanded, so there is no SHA to certify — per 4c
the phase-close commit is what Opus certifies; this review binds to the working tree
as of 2026-08-14, and I re-ran every command myself rather than trusting the report).

Method: read the diff in full, read the five current files in full, ran the greps
with positive controls, ran the gate (`npm test` 52/0 · `tsc` exit 0 · `npm run
verify` PASS · `check-removals` compared 0 files = NOT MEASURED), then drove the
live app on the running dev server: reset → Okafor order `Xeloda 1250 mg/m2 BID` →
override + sign → publish policy revision → tamper (the combined 6i/6g state) →
reset → order → tamper (the plain 6g state) → reset. Screenshots and pixel zooms at
each beat.

---

### 1. A previous poll's verification can repaint the pane AFTER a tamper or reset lands  [severity 1]
**File:** components/ledger/index.tsx:31-46 (refresh), 48-55 (1s interval), 102-116 (tamperNow), 118-132 (resetNow)
**What is wrong:** `refresh()` applies whatever response arrives, with no guard
against a response that was dispatched before the user's action. Every action
correctly does `setVerification(null)` first — the designed gap state is the honest
"verification pending — no status assumed" — but the poll interval keeps firing
regardless of `busy`, and an in-flight poll GET captured *before* the tamper can
resolve *after* it.
**How it fails:** poll fetch dispatched at t−5ms (server computes `verify` on the
pre-tamper chain, `ok:true`) → user clicks **Tamper a record** at t, `verification`
nulled, POST sent → the stale poll response resolves and `setVerification(ok:true)`
repaints **"chain intact ✓"** with the tamper notice above it. In the worst
interleave (stale GET resolves after `tamperNow`'s own refresh) the stale green
*persists until the next poll* — up to ~1s of a tampered chain reading clean,
immediately after the click, which is the exact frame the demo exists to show. The
same race runs in reverse on Reset: a stale response can flash the old CHAIN BROKEN
state and the old records onto a freshly cleaned ledger. Both directions are the
review brief's item 1/2 shape ("the previous poll's result"). I could not force the
interleave by hand in the live run — the window is one fetch-latency wide per click
(~2-5% per click locally) — this is an analysis finding off the code, stated as such.
It self-heals in ≤1s and the green shown is a real server-computed verification of
the pre-action chain, not a fabricated one; that is why this is the mild end of
severity 1 and not a product-killer, but on stage a one-second "chain intact ✓"
after the tamper click reads as the product failing.
**Suggested fix:** a monotonically increasing request token in `LedgerPane` — stamp
each `refresh()` invocation, apply the response only if it is still the newest
(or: skip applying poll responses while `busy !== null`). ~6 lines, no prop change.

### 2. `.break-flash` is now dead CSS that looks load-bearing — in the file that documents why that is not allowed  [severity 2]
**File:** app/globals.css:129-134 (keyframes + class), 156 (reduced-motion line); usage count in `app/` + `components/`: **0** (grep, with `rise` as the positive control)
**What is wrong:** Sol removed the only `.break-flash` usage (ChainStatus tamper
notice — correctly: a 0.9s repeated flash contradicts the instant-break spec, and
the removal is enumerated in Sol's 4i list). The definition, its keyframes, its
reduced-motion override and the comment "Used once, and it needs to read from
across the room" survive in `globals.css` — which Sol was rightly forbidden to
edit, and which is my file. The comment is now false, and globals.css:135-142
carries the phase5 note deleting *exactly this class of residue* ("selectors
matched nothing and are deleted rather than left as dead CSS that looks
load-bearing"). Related, shared-blame: `--shadow-2xl` (globals.css:88-90) says
"shadow-2xl is the only shadow utility in use" — after this phase the usage count
is 0 (Sol dropped SignatureModal's, I dropped WhyDrawer's), so the token and its
comment are stale too.
**How it fails:** no runtime failure — the failure is the next reader wiring a
tamper effect to a class that nothing certifies, or a judge reading the comment and
believing the flash exists.
**Suggested fix:** at phase close, Fable (me) deletes the `.break-flash` block, its
reduced-motion line, and rewrites the two stale comments. One commit, my file, after
this review lands so the certifier/author split stays clean.

### 3. The "calibrated" timestamp column renders bare milliseconds, not a timestamp  [severity 3 — top of band]
**File:** components/ledger/RecordRow.tsx:90-95
**What is wrong:** `new Date(...).toLocaleTimeString([], { hour12: false,
fractionalSecondDigits: 3 })` — per ECMA-402, when any time component is present in
options the hour/minute/second defaults are *not* applied, so the string is the
fraction alone. Proven: node prints `"255"` for `2026-08-14T23:57:01.255Z`; adding
`hour/minute/second: "2-digit"` prints `"16:57:01.255"`. Observed live in every
screenshot: the column reads `881`, `067`, `536`, `199` — records minutes apart
show near-identical values and the column cannot even be *ordered* by eye.
**How it fails:** the line itself is pre-existing (the diff moves it unchanged), so
this is not a defect Sol introduced — but 6h's whole job was to make this column a
calibrated instrument, Sol rebuilt the exact element (`w-24 shrink-0 text-right
tabular-nums` plus the comment "Fixed widths plus tabular numerals make one
calibrated time column"), and the report claims the column without reading what it
renders. Rule 4g: the claim is true of the alignment and false of the contents.
"Free precision" currently means *only* the precision, with no time attached.
**Suggested fix:** add `hour: "2-digit", minute: "2-digit", second: "2-digit"` to
the options. Then re-check the width: 12 glyphs of step--1 mono is ≈96px, exactly
`w-24` — likely needs `w-28` to keep the column from colliding with the type name.

### 4. Fresh rows can paint one frame at full opacity before `.rise` lands  [severity 3]
**File:** components/ledger/index.tsx:57-83
**What is wrong:** the animation classes and delays are applied in a passive
`useEffect`, which React does not guarantee to run before the browser paints the
newly committed rows. A fresh row can paint once in its natural state, then blink
to `opacity: 0` (the `.rise` base) and sit invisible for its stagger delay before
rising — visible as a flicker on the later rows of a burst.
**How it fails:** append 3 records → row 3 paints → next frame it vanishes for
120ms → rises. I did not catch the frame in screenshots (polling captures can't);
this is an analysis finding off React's effect-timing contract, stated as such.
**Suggested fix:** `useLayoutEffect` instead of `useEffect` — same body, runs
before paint. (The `.rise { opacity: 0 }` base + `forwards` fill is otherwise
exactly right for staggered delays — no flash *during* the delay once the class is
on before first paint.)

### 5. In the full demo arc, the green/red boundary is below the fold  [severity 3]
**File:** components/ledger/index.tsx:209-231 (`overflow-hidden` list) + AuthorizationPanel.tsx (the superseded panel's grown height)
**What is wrong:** the record list is a fixed window (`overflow-hidden`, by design,
pre-existing). The redesigned superseded panel is materially taller than the old
one (three-line inverted header, serif `text-base` collision block, `max-w-sm`
revision note). In the combined state the demo actually builds to — override →
publish revision → tamper — I measured at a 784px-high window: rows #4 and #3 show
MISMATCH and then the pane runs out; the 1px boundary and the intact `✓` tail
(#2–#0) are clipped. At the 720px demo frame it is tighter still. In the *plain*
tamper state (no supersede) the boundary and tail are fully visible and read
perfectly — verified, zoomed, it is the best frame in the product.
**How it fails:** the beat 6g calls "the whole point" — broken cascade *against*
intact tail — is not on screen in the state the full demo script ends in.
**Suggested fix:** either cap the superseded panel (clamp the revision note, drop
its right column to one line) or let the record list scroll only when broken —
whichever the phase closer prefers; alternatively script the demo to tamper before
superseding.

### 6. `CHAIN BROKEN AT RECORD 2 — RECORDS 2 NOT TRUSTWORTHY`  [severity 3 — nit]
**File:** components/ledger/ChainStatus.tsx:26-28, 61-64
**What is wrong:** when exactly the last record is broken, `rangeLabel` collapses
to one number but the surrounding copy stays plural. Observed live with 3 records
and the tamper landing on seq 2.
**How it fails:** as above, on screen, in vermilion, at step-1 — the one line
everyone reads, with a number-agreement error. The spec's own template has this
edge; Sol implemented the spec faithfully.
**Suggested fix:** `RECORD${plural ? "S" : ""} ${range}` — one conditional.

---

## Ground attacked that held

Stated per the reviewer clause, so the closer knows what is covered — not padding.

- **Fabricated strings (brief items 1-3):** `grep -rn "21CFR\|Utilization
  Management\|pharmcat\|Poor Metabolizer\|failed two prior regimens"
  components/ledger` → empty, and the same grep hits 4 files in
  `docs/design-import/` (the control that proves it can fail). Everything clinical
  or clausal on the pane renders off `record.*` / `CLAUSE_LABELS[clause]` /
  `authorization.*` — the on-screen "21CFR11.10(e) - secure, computer-generated…"
  is `record.clauses` through a pre-existing lib map, not a literal. The one "21
  CFR" in a component (`SignatureModal` header label "21 CFR PART 11 SIGNATURE") is
  pre-existing UI chrome, not mockup copy, unchanged by this diff.
- **The old name:** `grep -rn "Attest" components/ledger` → empty; control: the
  same grep hits `docs/design-import/*` and `CLAUDE.md`.
- **No default, optimistic, or stale-state green in the components:** the tick
  needs `verification !== null`; `records` and `verify` arrive in one
  `/api/ledger` response (`force-dynamic`, `verifyDetailed()` per request — route
  read), so a row can never show a ✓ from a verification that didn't cover it;
  every action nulls verification before fetching; error path renders amber
  "VERIFICATION UNAVAILABLE — STATUS UNKNOWN", null path renders "verification
  pending — no status assumed". The only crack in this armor is finding 1, which
  lives in the fetch plumbing, not the render.
- **6e, the zero is real:** the phase grep prints nothing against the tree and
  4/5/3/7 against HEAD (the instrument proven able to fail on the identical
  command form). Attacked per the brief: `grep -rn 'text-\['` (catches
  `text-[0.688rem]` and `text-[length:…]` forms too) → zero arbitrary text values
  of any kind remain; `style=\|fontSize\|font-size` → zero. And the zero *means*
  scale-resolution, not just literal-removal, because `globals.css` `@theme` maps
  `text-xs/sm→--step--1`, `base→0`, `lg/xl→1`, `2xl→2`, `3xl/4xl→3` — every named
  size Sol used (`xs`, `sm`, `base`, `lg`, `xl`) lands on a step. Sol's "19 → 0,
  therefore" sentence survives the audit.
- **6f, the seen-id gate, attacked on five axes:** (1) 1s poll — ids already in
  the ref set, no re-animation; watched live across ~20 polls, rows static.
  (2) tamper — mutates payload of an existing `recordId`, no fresh rows, no
  animation; observed. (3) reset → new orders — new ids animate; observed the
  stagger mid-flight (screenshot caught #0/#1 partially risen, #2 still in its
  delay slot — chronological order confirmed, oldest first). (4) strict-mode
  double-effect — second pass finds no unseen ids, idempotent. (5) React
  className reconciliation — a broken-status flip rewrites the `<li>` class
  string and would strip the imperative `rise`, but only post-animation and the
  id is already seen; no restart path. The gate holds, modulo finding 4's timing.
  Initial mount animates the *entire* existing ledger (every id unseen) — that is
  "first appearance" as specced, looks intentional, and I am not filing it.
- **6f, reduced motion:** both guards verified in source — the JS `matchMedia`
  early-return (index.tsx:68-72, and it returns *before* classes are added) and
  the CSS `@media` block (globals.css:154-158), which crucially includes
  `opacity: 1` (without it `.rise`'s base `opacity: 0` would leave rows invisible)
  and sits after `.rise` at equal specificity, so `animation: none` wins the
  cascade and also defeats the inline duration/delay (inline styles set duration,
  not name). Is a source-path check sufficient? **For this claim, yes** — the two
  guards are independent and the CSS one alone is decisive, and the cascade-order
  failure a source check could miss is the thing I checked. But "keep that path
  working" is a behavioural claim and nobody has run a browser with the
  preference on; one DevTools emulation by Claude Code at phase close would
  convert it from argued to observed. Named residual, not a defect.
- **6g, instant break:** `grep -rn "transition\|duration-\|ease-"
  components/ledger` → only the comment asserting the invariant. Live: the break
  painted whole in one poll frame — header, notice, MISMATCH cascade, rules — no
  easing, no loading feel. The 4px reservation works: broken and intact rows'
  text starts at the same x (pixel-zoomed); the rule stays full-strength while
  contents dim (`opacity-60` moved to the inner wrapper — correct structure).
- **6i, two reds:** verified in the one state that matters — superseded panel
  *and* broken chain on screen together. Unmistakable: inverted paper ground,
  ink text, struck-through SUPERSEDED, zero vermilion, "(simulated)" label
  rendered, against a vermilion header and MISMATCH rows. Sol deviated from the
  prompt's suggested treatments (amber, or vermilion outline) — the inverted
  panel arguably reads *emphasized* rather than *stale*, and the flip is
  panel-wide off any one superseded row — but the requirement ("never the same
  treatment as a broken hash") is met with room to spare. Deviation noted, no
  finding. Content pin `ledger.test.ts:244` (/SUPERSEDED/) still green.
- **6h, hashes:** 6-char truncation in both `hashShort`s, full value in `title`
  on every hash span including expected/found — source-verified; hover is native
  `title` behaviour.
- **Scope and props:** changed paths = my declared set (prescribe, page.tsx,
  globals.css, REGISTER.md, DESIGN.md) ∪ Sol's `components/ledger/` exactly;
  `REGISTER.md`'s diff is only my R-24; `.sol/requests/` has nothing new — Sol
  needed no token and asked for none. Honest limit: with both halves uncommitted
  in one tree, git cannot *attribute* hunks — the check is declared-set
  consistency, not authorship proof. All four exported interfaces
  (`SignatureModalProps`, `ChainStatusProps`, `RecordRowProps`,
  `AuthorizationPanelProps`) and `LedgerPane()`'s nullary signature are
  byte-unchanged; `page.tsx:12` imports resolve; `tsc` exit 0.
- **Gate:** `npm test` 52 pass / 0 fail / 0 skipped (matches both reports'
  baseline); `npx tsc --noEmit` exit 0; `npm run verify` PASS exit 0;
  `check-removals` compared 0 files → NOT MEASURED, exactly as Sol's report
  states it (it does not claim the pass — correct under R-17's lesson). Sol's 4e
  answer ("none — no test pins the visual lines") is corroborated: no test
  references MISMATCH, NOT TRUSTWORTHY, `.rise`, or `break-flash`; the named gap
  is real and honestly named, which per the phase prompt beats a satisfied
  formality. Sol's 4i removal list matches the diff — including the removals a
  reviewer would miss (the ⛔/!/✓ glyphs, the forest left rule on intact rows,
  the modal shadow); nothing removed that the list omits.

## Where Sol's report overclaims

One instance, already filed as finding 3: "timestamp and result columns have fixed
widths, right alignment, monospace type, and tabular numerals" — every word true,
and the column is still wrong, because the value inside it is not a timestamp. The
report's other claims each survived their artifact.

## Verdict

If only two things get fixed before the demo, fix **finding 3** (the timestamp
column — one options object; it is on screen in every second of the video, it is
the difference between an instrument and a prop, and right now the "calibrated"
column renders `536` where a time should be) and **finding 1** (the refresh
staleness token — ~6 lines; it is improbable per click but its failure mode is
"chain intact ✓" flashing after the Tamper click, the single worst pixel this
product can show, and the demo will click that button on stage every time).
Finding 5 is next only because the demo script can route around it for free by
tampering before superseding; findings 2, 4 and 6 are cleanup the phase closer can
take in the same commit as the phase close without re-opening the audit.
