> **Inherits `.sol/prompts/_template.md` in full**, plus the adaptations in `CLAUDE.md`.
> Read both before this file. Sol also reads `AGENTS.md` (a pointer, not a copy — rule 7).
> The deliverable clause at the bottom is inherited and not optional.

# TASK: phase2-sol-ui — the ledger pane, the signature modal, tamper, inspection package

You are **Sol**. Read `~/"biopharma hack"/.sol/prompts/_context.md` FIRST, then `~/"biopharma hack"/lib/contracts.ts`.

Phase 1 gave you a chain that provably detects tampering. This task makes that visible from twenty
feet, in under fifteen seconds, to someone who has never heard of 21 CFR Part 11.

**You own the right half of the screen.** Fable renders `<LedgerPane />` from
`components/ledger/index.tsx` — export that exactly. Do not touch `app/page.tsx`, do not touch
anything under `components/prescribe/`.

## The pane

```
AUDIT LEDGER                              7 records · chain intact ✓

#6  alert.overridden                             14:22:07.481
    dr_chen · Attending Oncology
    "Patient has failed two prior regimens; proceeding at 25% dose
     with weekly DPD monitoring."
    signed — approval
    21CFR11.50 · signature manifestation: name, date/time, meaning
    21CFR11.70 · signature linked to record
    prev 4a91… → sha256 c81d…                            ✓

#5  alert.raised                                 14:21:58.002
    DPYD Poor Metabolizer · capecitabine · critical
    21CFR11.10(e) · secure, computer-generated, time-stamped audit trail
    prev 77bc… → sha256 4a91…                            ✓

[ Verify chain ]   [ Tamper a record ]   [ Export inspection package ]
```

Newest first. Monospace hashes, truncated to 4 hex chars with the full value on hover. Clause tags
render as `code · human phrasing` — the human phrasing is doing the persuading, so get the
regulation wording close.

**When ephemeral** (Vercel fallback from Phase 1), show a small amber pill:
`in-memory ledger — file storage unavailable`. Never hide it.

## `components/ledger/RecordRow.tsx`

Expandable. Collapsed shows type, actor, timestamp, clause tags, hash pair, status. Expanded shows
the full payload as formatted JSON, and for `model.invoked` shows the model id, version, params,
the **exact prompt sent**, and the **raw unedited output**.

Put a one-line label above that raw output: `ALCOA "Original" — unedited model output, retained
separately from any human-edited version.` Almost no production AI system keeps this. It is worth
one line of screen space and one sentence on stage.

## `components/ledger/SignatureModal.tsx`

Fable calls this on **Override and sign**. Export it and tell Fable the import path.

Required fields, because §11.50 requires all three to be manifested:

- **Printed name** — prefilled from the actor, editable
- **Meaning of signature** — a real select: authorship / review / approval. Not a checkbox.
- **Rationale** — free text, required, minimum ~20 characters. An override with no reason is not
  an override, it is a dismissal.
- Date/time, displayed live, not editable

Optional and cheap: a **Suggest rationale** button calling Fable's `lib/llm.ts`. If it fires, the
model output is logged as `model.invoked` *and* the human's final edited text is stored separately
in the override payload — the diff between them is exactly what ALCOA "Original" is about. If
there is no LLM key, hide the button entirely. Do not show a dead control.

On submit call `recordOverride()` from Phase 1 and close. Also wire an **Accept recommendation**
path that calls `recordAcceptance()`. Both branches recorded.

## `components/ledger/ChainStatus.tsx`

The header status and the three buttons.

**Verify chain** — `POST /api/ledger/verify`, recomputed fresh. On failure the pane must change
character, not just show a word:

- Header goes red: `CHAIN BROKEN AT RECORD 4 — RECORDS 4-7 NOT TRUSTWORTHY`
- Every record in `brokenSeqs` gets a red left border and `✗`
- The first broken record additionally shows `expected sha256 c81d… · found 9f2a…`
- Records before the break stay green. **The contrast is the entire demo beat** — it must be
  obvious that the damage is bounded and cascading, not that the whole app turned red.

**Tamper a record** — `POST /api/ledger/tamper`, then auto-verify, then animate. Show what changed:
`payload.rationale altered · "…weekly DPD monitoring." → "…weekly DPD monitorinh."`

A one-character change is more convincing than a big one. It proves the check is cryptographic
rather than a heuristic looking for suspicious edits.

Add a small **Reset demo** control calling `/api/ledger/reset` so you can run the demo twice.
You will need this. Put it somewhere you will not hit by accident on stage.

## `lib/export/` — the inspection package

`POST /api/ledger/export` returns a zip, and appends an `export.generated` record before returning.

Contents:

- `ledger.jsonl` — the raw chain
- `inspection-report.html` — self-contained, no external CSS or JS, opens in any browser:
  header with generation time, record count, and verification status; then every record in
  chronological order with actor, timestamp, clause tags, payload, and hash pair; signatures
  rendered with all three §11.50 elements spelled out; a final page listing every clinical string
  with its CPIC guideline and PMIDs.
- `verification.json` — the `VerifyResult` at export time
- `README.txt` — how to independently re-verify the chain, including the exact hashing rule
  (canonical JSON with recursively sorted keys, SHA-256, `hash` excluded from its own input). A
  regulator must be able to check this without your code.

§11.10(b) requires accurate and complete copies **"in both human readable and electronic form"** —
the HTML and the JSONL are literally those two forms. Say that on stage; it is a two-second line
that shows you read the regulation instead of guessing at it.

Use whatever zip library is quickest. If zipping fights you for more than ten minutes, return the
HTML alone and file `.sol/requests/export-zip.md`. Do not lose the phase to a packaging library.

## Acceptance

At 1280×720:

1. Place an order in the left pane → records appear on the right within 2s, chain green
2. Override with a signature → `alert.overridden` shows name, meaning, and rationale
3. **Tamper** → header goes red, naming the record; that record and every later one marked broken;
   earlier records stay green; the changed field is named on screen
4. **Verify** again → still red, same record. Not a one-shot animation.
5. **Reset** → empty, green
6. Externally: `npx tsx scripts/tamper.ts` then Verify in the UI → red. Proves the button is not
   a prop.
7. **Export** → opens standalone, shows every record, states verification status
8. Nothing renders a green check that was not computed by `verify()` this request

Step 6 is the one a skeptical judge will ask for. Make sure it works.

Leave your files on disk. **Do not run git.** List everything you created in your final message so
Fable can commit it.

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
