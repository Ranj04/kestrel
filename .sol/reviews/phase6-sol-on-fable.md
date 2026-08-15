# Phase 6 cross-review — Sol on Fable

### 1. The redesigned green state fabricates a clinical clearance  [severity 1]
**File:** components/prescribe/AlertCard.tsx:60
**What is wrong:** `No pharmacogenomic contraindication.` is a literal in the component and occurs nowhere in `data/cpic/index.json`, `data/policies.json`, or `data/patients.json`. The prescribed clinical-string grep was too narrow to catch it. This sentence predates phase 6, but this diff explicitly rebuilds and promotes the branch from small mono text to a step-0 serif clearance, so the after-state still violates the highest-priority invariant. Test 42 pins the literal's presence; it does not prove a CPIC source.
**How it fails:** Daniel Reyes + `Xeloda 1250 mg/m2 BID` resolves to capecitabine. Reyes has a nonempty CYP2D6 result, but no DPYD result, so `evaluate(reyes, "capecitabine", ...)` returns `null`. `resolution.matched` is true and `patient.results.length` is nonzero, therefore this branch renders a green “No pharmacogenomic contraindication” despite no relevant genotype/CPIC comparison having occurred. The same branch also conflates a CPIC no-action row with a D6 conflict deliberately suppressed as `null`.
**Suggested fix:** Render neutral state, such as “No CPIC alert raised for this order,” unless the response carries a source-backed no-action determination for the relevant gene/drug pair. If a clinical clearance is desired, carry and render CPIC's verbatim no-action row rather than synthesizing one in the component.

### 2. The required before/after artifact pair is absent, and the submitted after shots are cropped  [severity 3]
**File:** .sol/reviews/phase6-fable-report.md:72
**What is wrong:** The task requires a before/after pair at 1280×720 in `docs/`, but the tree contains only `phase6-after-critical-1280x720.jpg` and `phase6-after-clear-1280x720.jpg`; Fable's report explicitly delegates the missing before evidence to an external phase-open capture. Those two files compare different after-states, not the same state before and after. Both JPEGs also visibly lose the left edge of the app (pane label, patient text, order text, and critical headline are truncated) while leaving a blank strip on the right, so they are not faithful full-frame evidence for the quarter-screen or squint claims.
**How it fails:** The closer opens the required artifacts to compare the old and new critical state and cannot do so. In the critical JPEG, the leading pane/alert content is outside the captured frame, so the artifact cannot prove that the complete blocking headline and two-column composition are visible at 1280×720.
**Suggested fix:** Capture the same critical flow from HEAD and from the working tree at an exact 1280×720 viewport, with horizontal position reset and the full app bounds visible. Store both files in `docs/`; a separate clear-state after shot may remain supplementary.

## Areas attacked with no finding

- The pixel-literal control is non-vacuous: the identical HEAD grep returns 33 hits and the working tree returns 0. I also checked arbitrary `text-[…]` values (including rem/length forms), inline `fontSize`/`font-size`, and raw style attributes; none evades the count. Named text utilities map to the five declared steps.
- The specified clinical-literal patterns and `Attest` return no hits in reachable `components/` or `app/` code. No prescribing component introduces a hash or computed-verification display.
- Fable's target diff is confined to `app/globals.css`, `app/page.tsx`, and `components/prescribe/`; there is no `lib/` or API-route diff. The parallel `components/ledger/` changes are Sol's and out of scope. `LedgerPane` and `SignatureModal` call shapes are unchanged.
- `npm test` reports 52 pass / 0 fail. Independently rerun: `npx tsc --noEmit` exit 0, `npm run verify` PASS, and ESLint examined 8 target files with 0 errors / 0 warnings. `check-removals.sh` compared 0 test files, so it is correctly NOT evidence of removals safety rather than a claimed pass.
- No forbidden logo/nav/footer/avatar, spinner, radius, shadow, or new color was added. The existing repeating gradient is the ruled-paper texture and the existing shadow token resolves to zero. No custom-property value changed; `.rise` was deliberately retimed for the ledger, and left-pane `.rise` uses were removed. PatientCard and OrderForm remain mounted in the critical JSX, and the only left-pane animation is the permitted drawer.

## Review limitation

The requested fresh live click-through could not be repeated: the browser runtime exposed no browser, and `http://localhost:3000` refused the connection. I did not start a second server, as instructed. The visual finding above is therefore against Fable's submitted 1280×720 artifacts; the structural escape path was checked from JSX, where patient selection remains mounted and clears the critical response.

## Verdict

Before demoing, fix the unsourced green clearance first because it can tell a patient with the wrong gene result that no pharmacogenomic contraindication exists. Second, recapture a valid same-state before/after pair with the full 1280×720 frame visible; the current artifacts cannot support the visual acceptance claims. The type-scale cleanup, scope boundary, critical-state mounting, motion boundary, and automated gates otherwise hold under the attacks listed above.
