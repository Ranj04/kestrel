# Phase 6 Sol report — ledger pane (6e–6i)

## Outcome

- 6e: Replaced every `text-[Npx]` class in `components/ledger/` with the shared five-step type utilities.
- 6f: Added a persistent seen-record-id gate. Fresh rows use `.rise` once, stagger oldest-to-newest by 60ms, and run for 200ms; polling and tamper-only rerenders do not restart them.
- 6g: Broken records now keep a full-strength 4px `--accent` rule while only their contents drop to 60% opacity. Intact rows reserve the same transparent rule width, and a 1px vermilion boundary separates the broken cascade from the intact tail. The broken header uses `--step-1` and an en-dash range.
- 6h: Hashes now show six characters with the full values in `title`; timestamp and result columns have fixed widths, right alignment, monospace type, and tabular numerals.
- 6i: In the current source, any superseded authorization switches the panel to `bg-paper text-ink`; `SUPERSEDED` is struck through and a surviving `VALID` authorization uses `text-seal`, while broken hashes remain vermilion on `--void`.
- No prop signature changed. No file in Fable's owned application/component surface was edited.

## 4a-bis pixel-literal control

Before editing, the required command printed:

```text
components/ledger/SignatureModal.tsx:7
components/ledger/ChainStatus.tsx:5
components/ledger/RecordRow.tsx:3
components/ledger/AuthorizationPanel.tsx:4
```

The independent occurrence count was 19. After editing, the per-file command printed no nonzero file and the occurrence count printed `0`.

The pixel-literal count went 19 → 0, therefore every size in this pane resolves to the scale.

## Motion and reduced motion

`LedgerPane` records each fresh `data-record-id` in a persistent set before deciding whether to animate, so an id cannot animate again on the one-second refresh. The rendered list is newest-first, and reversing only the fresh DOM rows before assigning delays makes the stagger chronological. No transition or `break-flash` class remains in `components/ledger/`, so tamper styling is immediate.

I verified the reduced-motion source path by locating both guards: `components/ledger/index.tsx` checks `matchMedia("(prefers-reduced-motion: reduce)")` before adding `.rise`, and `app/globals.css` independently declares `.rise { animation: none; opacity: 1; }` inside the matching media query. This was a source-path check, not a browser-emulation artifact.

## Commands and evidence

- `npx tsc --noEmit`: exit 0, no diagnostics.
- `npm test`: 52 pass, 0 fail, 0 skipped, exit 0 before and after.
- Ledger tests named in the passing run: `key order does not affect the digest, at any depth`; `integer-like keys sort as strings, not numerically`; `undefined hashes the same as an absent key`; `unicode, quotes and newlines survive a JSON round trip`; `a record hashes identically after a JSONL round trip`; `a one-character payload change changes the digest`; `round-trip stability: five appended records retain every hash`; `clean chain verifies`; `tamper is detected and invalidates every downstream record`; `tampering the last record is detected`; `re-hashing the tampered record cannot repair its downstream link`; `override manifestation fields survive the JSONL round trip`; `a torn final JSONL line does not make readAll throw`; `ledger API routes invoke fresh verification, tamper, and reset`; `policy revision selectively supersedes capecitabine, preserves codeine, and keeps the chain intact`; and `ledger UI publishes through the evidence supersede API call site`.
- `sh scripts/check-removals.sh`: exit 0 but **compared 0 files** because no test file changed. Per the script's own output and R-17, this is not reported as a pass; it is NOT MEASURED for test-file shrinkage.
- Lint: NOT MEASURED, as directed; `next lint` was not run.

## Rule 4e mutation answer

None. No existing test goes red when any of the visual token, animation, alignment, boundary, hash-display, or superseded-treatment lines are reverted. The policy-revision render test protects the authorization content (`SUPERSEDED`, both drugs, scope result, simulated label), but not its visual treatment. This is the named visual regression gap; screenshot playback and Fable's independent audit are the phase controls.

## Rule 4i removals

- Removed 19 pixel-literal text classes: 7 from `SignatureModal.tsx`, 5 from `ChainStatus.tsx`, 3 from `RecordRow.tsx`, and 4 from `AuthorizationPanel.tsx`.
- Removed the `break-flash` class from the tamper notice; it was a 0.9s repeated animation and conflicted with the required instant break.
- Removed red/amber/green filled authorization cards and the decorative authorization status glyphs (`⛔`, `!`, `✓`); status content remains and is differentiated by medium, strike-through, and the existing palette.
- Removed the modal shadow class and hardcoded hex presentation in `SignatureModal`; tokenized borders, grounds, and text replace them.
- Removed the forest/neutral left rule from intact records and replaced it with a transparent 4px reservation, leaving vermilion exclusively for broken records.
- Replaced four-character hash shortening with six-character shortening; full hashes remain available on hover.
- Rewrote the timestamp comment to name both fixed widths and tabular numerals, and shortened the MISMATCH comment while retaining its invariant that `MISMATCH` replaces the tick.
- No tests, assertions, behavioral branches, error handling, or invariant-carrying comments were deleted.

## Shims and residue

No shim, mock, development bypass, hardcoded identity, synthetic id, or new dependency was introduced, so there is no `REGISTER.md` entry. Independent visual certification remains with Fable/Opus against the 1280×720 screenshots; this report does not self-certify that artifact.

## Fix round

### Outcome and evidence

- Fix 1: Every ledger refresh now carries a monotonically increasing request token, every action dispatch invalidates older polls, and interval polls pause during an action; the deliberately reversed resolution test applied only the newer broken result and discarded the older green result, therefore a pre-action poll cannot repaint a post-action green check.
- Fix 2: `RecordRow` now requests two-digit hour, minute, and second fields alongside milliseconds; the render test produced a string matching `^\d{2}:\d{2}:\d{2}\.\d{3}$`, therefore the timestamp column contains a complete time rather than bare milliseconds.
- Fix 3: In the superseded-plus-broken state the visible plan retains broken records `6,5,4`, the boundary's first intact record `3`, and replaces intact records `2,1,0` with `· 3 records (0–2) unchanged · verified · not shown ·`; the plan test checks those exact sequences and the separate unknown-status test rejects `verified`, therefore the boundary survives the data reduction and the elision cannot claim verification it did not receive.
- Fix 4: The broken header selects `RECORD` only when the first broken record is also the last record and retains `RECORDS n–m` otherwise; the singular and plural render tests cover both branches, therefore `RECORD 2 NOT TRUSTWORTHY` and `RECORDS 2–4 NOT TRUSTWORTHY` are both grammatical.
- Fix 5: The fresh-row DOM pass now runs through an SSR-safe `useLayoutEffect` alias while polling remains in `useEffect`; the source-path test is anchored to the row-query body, therefore it fails if the stagger returns to a passive effect rather than merely finding an unrelated layout effect.
- Fix 6: I re-read `AuthorizationPanel.tsx` before changing the report. The current working tree contains `border-line bg-paper text-ink` when `hasSuperseded`, strikes `SUPERSEDED`, and uses `text-seal` for a surviving valid authorization, therefore the corrected 6i sentence above describes the current source. This conflicts with the independent artifact paragraph that describes vermilion text on `--void`; I did not replace one unsupported report claim with another.

### 4a-bis and rule 4e mutation record

- Fix 1 — `ledger refresh discards an older response that resolves after the latest request` went red against the extracted old unconditional-apply behavior with actual applications `[broken, stale-green]`; `every ledger action invalidates old polls and interval polls pause during actions` went red when the `beginAction` invalidation call was replaced with a non-incrementing token read.
- Fix 2 — `RecordRow renders a complete millisecond timestamp` went red against the old options object because the rendered value was exactly `581`.
- Fix 3 — `supersede-then-tamper keeps the cascade, boundary row, and verified elision count` went red when compaction was bypassed because all seven rows remained visible; `the elision label never claims verified without a current verification` went red when `verified` was made unconditional.
- Fix 4 — `ChainStatus uses singular copy when only one record is untrustworthy` went red against the old header with `RECORDS 2 NOT TRUSTWORTHY`; `ChainStatus keeps plural range copy when multiple records are untrustworthy` pins the range branch.
- Fix 5 — `LedgerPane applies fresh-row stagger in a layout effect` went red when the row-query effect was changed back to `useEffect`.
- Fix 6 — no test goes red for the report-only correction. The control is direct source inspection, and this report does not claim otherwise.

Every mutation command first counted the changed anchor as present, therefore none of the red results came from a missed edit; each exact mutation was restored before the final green run.

### Final gate

- `npx tsc --noEmit` exited 0 with no diagnostics, therefore the ledger changes typecheck.
- `npm test` reported 67 pass / 0 fail / 0 skipped: the original 52 remain green, nine tests belong to this ledger fix round, and six arrived from Fable's parallel work.
- `sh scripts/check-removals.sh` exited 0 and compared 4 changed test files against `HEAD`, therefore the removal check was measured rather than vacuous; only `tests/ledger.test.ts` is part of this ledger round.
- `npx eslint . --format json` exited 0 and returned 53 file objects with 0 errors and 1 warning; all ledger files have zero warnings, while the existing unused `Actor` warning is in Fable-owned `app/api/prescribe/route.ts` and was not edited here.

### Rule 4i removals

- Removed unconditional success and error commits from stale ledger refreshes; only the response carrying the current request token may now update UI state.
- Removed the passive-effect scheduling path for fresh-row animation and replaced it with the SSR-safe layout-effect path.
- In the superseded-plus-broken presentation only, removed intact tail rows from the visible window and replaced them with a counted elision; no ledger record or verification data is deleted.
- Removed the plural `S` from the exactly-one-untrustworthy-record copy.
- No tests, assertions, error handling, behavioral branches, or invariant-carrying comments were removed.

No shim, mock, bypass, hardcoded identity, synthetic id, dependency, or unresolved ledger residue was introduced, so this fix round requires no `REGISTER.md` entry.

The in-app browser runtime reported no available browser, so this round did not capture a fresh pixel-level supersede-then-tamper artifact. The tests prove which records and label render, not their physical pixel fit; independent visual certification of the 1280×720 frame remains with Fable/Opus and is not claimed here.
