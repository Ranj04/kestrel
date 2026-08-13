> **Inherits `.sol/prompts/_template.md` in full**, plus the adaptations in `CLAUDE.md`.
> Read both before this file. Sol also reads `AGENTS.md` (a pointer, not a copy — rule 7).
> The deliverable clause at the bottom is inherited and not optional.

# TASK: review-fable-on-sol — try to defeat the chain

You are **Fable**. Read `~/pgx/.sol/prompts/_context.md` first.

**This is a review task. Do not edit any file.** Write findings only, to
`~/pgx/.sol/reviews/fable-on-sol.md`. That is the single file you may create.

You have roughly fifteen minutes. Depth over coverage.

## What to review

Everything under `lib/ledger/`, `lib/export/`, `app/api/ledger/`, `components/ledger/`, and
`scripts/tamper.ts`.

## What we want

**Correctness bugs, not style.** Ranked:

1. **Anything that makes the chain lie.** In either direction: a clean chain that verifies broken
   (kills the demo on stage), or a tampered chain that verifies clean (kills the product's entire
   claim). Both are severity 1. The first is more likely; the second is more embarrassing.
2. **Anything that breaks the demo path**: records appear, override signs, tamper goes red, verify
   stays red, export opens.
3. Everything else.

Do not report: formatting, naming, missing types, test coverage in the abstract, or styling.

## Where to look hardest

**`lib/ledger/hash.ts` is the measurement instrument.** Every claim in the right pane comes out of
it. Attack `canonicalJson` specifically:

- **Does it sort keys recursively, or only at the top level?** A nested object with keys in
  non-alphabetical order is the single most likely cause of a clean chain verifying broken. Write
  out the exact input that breaks it if it does.
- Arrays of objects — are the objects inside them canonicalized?
- `undefined` vs missing key vs `null` — do all three serialize identically or differently, and is
  that consistent between write time and read time? A record appended with `model: undefined` and
  re-read from JSONL as a missing key must hash the same.
- Non-ASCII in a rationale, or a quote character, or a newline. Does JSON escaping round-trip
  byte-identically through the file?
- Number formatting — can a value be written `1.0` and re-read as `1`?
- Is `hash` genuinely excluded from its own input? Is `seq` included?

**Then `lib/ledger/verify.ts`.** This is where a tampered chain could pass:

- Does it check **both** the recomputed hash *and* `prevHash` linkage? Checking only the hash means
  someone who re-hashes an edited record defeats it entirely.
- Is `brokenSeqs` genuinely first-broken-and-everything-after, or does it only list records that
  independently fail? If a tampered record is re-hashed, does the break correctly surface at the
  *next* record?
- Off-by-one at seq 0 and at the last record.
- Does a genesis record with the wrong `prevHash` get caught?
- **Is the result ever cached, memoized, or computed from an in-memory copy rather than re-read
  from disk?** The external `scripts/tamper.ts` path only works if verify reads the file fresh. If
  it verifies a cached array, the most convincing moment in the demo silently stops working.

**Then `lib/ledger/store.ts`.** Is `append` truly append-only — is there any code path that
rewrites an existing record other than `tamper`? Is `occurredAt` ever taken from the caller
instead of set at append time? Can two appends race and produce a duplicate `seq`? Does the
ephemeral fallback silently swallow a write error the UI never learns about?

**Then `lib/ledger/tamper.ts`.** Does it leave the stored `hash` untouched? Does it touch exactly
one record? If it accidentally re-hashes, verify will catch it at the *next* record instead of the
tampered one, the UI will name the wrong record, and it will look like a bug rather than a proof.

**Then `components/ledger/ChainStatus.tsx`.** Can a green check ever render from stale state — the
previous verify result, an optimistic update, or a default of `ok: true` before the first call?
Rendering an uncomputed green check is the worst possible bug in this codebase.

**Then `lib/export/`.** Does the HTML report state verification status computed at export time, or
inherited from the UI? Does `README.txt` describe the hashing rule precisely enough that someone
could independently re-verify — specifically, does it mention recursive key sorting? If it does
not, the "independently verifiable" claim is false.

## Format

For each finding:

```
### N. <one-line claim>  [severity 1/2/3]

**File:** lib/ledger/hash.ts:LINE
**What is wrong:** …
**How it fails:** concrete input or call sequence -> wrong output. Give the literal object that
breaks it where you can.
**Suggested fix:** one or two sentences. Do not implement it.
```

If you cannot find a real bug in a module, say so explicitly rather than inventing something. An
honest "I attacked canonicalJson along these six axes and it holds" is worth more than a padded
list — it tells Sol which ground is covered with under an hour left.

End with a one-paragraph verdict: what you would fix before demoing, in order. Assume only the top
two get fixed.

## Rule 2 — the files that carry the invariants

Audit against these by name, not "the diff":

- `lib/ledger/hash.ts` — the measurement instrument. Given as finished, tested code;
  **if the diff modified it, that alone is a finding** unless `tests/hash.test.ts`
  still passes and the change is enumerated per 4i.
- `lib/ledger/verify.ts` — where a tampered chain could pass.
- `lib/ledger/store.ts` — append-only means append-only.
- `tests/hash.test.ts` — did any assertion count drop? `sh scripts/check-removals.sh`.
- `lib/contracts.ts` — Sol may not edit it. Did it?

## Rule 1 — the precondition that kills the tempting option

The tempting fix for a chain that verifies red when it should be green is to relax the
comparison — hash fewer fields, skip `prevHash`, compare loosely. **Check
`tests/hash.test.ts` first: if the round-trip test passes, the hashing is not the
problem and the bug is in `store.ts` or `verify.ts`. Never weaken the digest to make
verification pass.** A chain that cannot go red is worse than no chain, because it
makes a false claim on stage.

## The two failures that are not symmetric

A clean chain verifying **broken** kills the demo. A tampered chain verifying **clean**
kills the product's claim. Both are severity 1. The first is more likely and the
second is more embarrassing — hunt the second harder, because nobody will notice it.

---

## Reviewer clause — inherited from `_template.md`

**You edit nothing.** Findings only, to the named file.

**Do not be agreeable.** A demo shipped describing shimmed providers as "live," and
catching exactly that is the job. If you cannot find a real bug in a module, say so
explicitly — an honest *"I attacked `evaluate.ts` along these five axes and it holds"*
tells the other party which ground is covered. An invented finding wastes the only
resource that matters.

**Judge each claim against its artifact, not its summary (rule 4g).** A claim broader
than the check supporting it is itself a finding. `curl` output echoing a string is not
evidence the string came from CPIC — `grep -F` against `data/cpic/index.json` is.

**A vacuous check is a severity-1 finding (rule 4a / 4a-bis).** A test whose expected
value is reachable by the buggy code proves nothing however precise it looks. A command
that returns empty for reasons unrelated to the claim is not evidence.

**Cap the argument at 3 rounds (rule 8).** If you and the other party have not
converged, stop and hand both positions to Opus 5. Never average. If it takes three
rounds, the task was too big (rule 9) — say so.

**If you both independently flag the same line, it goes to the top of the fix list**
ahead of anything either raised alone (rule 10).
