> **Inherits `.sol/prompts/_template.md` in full**, plus the adaptations in `CLAUDE.md`.
> Read both before this file. Sol also reads `AGENTS.md` (a pointer, not a copy — rule 7).
> The deliverable clause at the bottom is inherited and not optional.

# TASK: phase2b-sol-snapshot — snapshot-bound overrides and selective invalidation

You are **Sol**. Read `~/pgx/.sol/prompts/_context.md` FIRST, then `~/pgx/lib/contracts.ts`.

**This is the differentiator. Everything before it was table stakes.** If you are behind schedule,
cut polish anywhere else and build this.

## The idea, in one paragraph

The hash chain proves nobody *edited* the record. It does not prove the decision is still
*warranted*. A clinician overrides a DPYD contraindication and signs — but they signed against the
2017 CPIC guideline. When CPIC publishes a revision, that authorization should not quietly remain
in force. It should go stale, on its own, and say exactly which publication superseded it.

This is ported from writ.ai's authorization model, evaluated at depth one:

```
intersection = authorization.snapshot.scopes ∩ supersedingChange.affectedScopes
```

Empty intersection → the authorization survives. Non-empty → `superseded`.

That one line is why the capecitabine override dies and the codeine override lives.

## Deliverable 1 — `lib/ledger/snapshot.ts`

```ts
export interface SupersedeInput {
  gene: string;
  drugName: string;
  affectedScopes: string[];
  newGuidelineName: string;
  newCitation: { pmid: string; title: string; year: number };
  summary: string;      // one line, shown on screen
}

/** Mutate the in-memory CPIC entry, recompute its hash, log evidence.superseded. */
export function supersede(input: SupersedeInput): {
  snapshotIdBefore: string; entryHashBefore: string;
  entryHashAfter: string; record: LedgerRecord;
};

/** For every alert.overridden record: is its bound snapshot still current? */
export function authorizationStatus(): Array<{
  seq: number; alertId: string;
  status: AuthorizationStatus;
  boundTo: EvidenceSnapshot;
  currentEntryHash: string;
  intersectingScopes: string[];
  supersededBy: { pmid: string; title: string; year: number } | null;
}>;
```

`supersede` edits the entry **in memory only** — never write to `data/cpic/index.json`. That file
is the clinical source of truth and a demo button must not mutate it on disk. Keep an
`overlay: Map<string, entry>` in `lib/pgx/index.ts`'s module scope... except that file is Fable's.
So: keep the overlay in **your** module and have Fable's `getIndex()` consult it. That needs a
three-line change in Fable's file — **write `.sol/requests/snapshot-overlay.md` describing exactly
the change you need, and in the meantime keep your own copy of the entry so your half works
standalone.** Do not block on Fable.

Status rules:

- Bound `entryHash` equals current → `valid`
- Differs, and `intersection(snapshot.scopes, affectedScopes)` is non-empty → `superseded`
- Differs, empty intersection → `valid`. **Say so explicitly in the UI** — "evidence changed,
  authorization unaffected" is a stronger claim than silence, and it is the sentence that proves
  this is a real scope check rather than a global invalidate.

## Deliverable 2 — `POST /api/evidence/supersede`

One canned change, hardcoded, no parameters needed to fire it:

```
gene: "DPYD", drugName: "capecitabine"
affectedScopes: ["dosing.capecitabine"]
newGuidelineName: "DPYD and Fluoropyrimidines (2024 revision)"
summary: "Revised starting-dose guidance for DPYD poor metabolizers."
```

Use a **real** newer DPYD publication if you can find one already sitting in
`data/cpic/index.json`'s citations for that entry; otherwise mark the citation
`"SIMULATED — demo guideline revision"` in the payload and render that label on screen.
**Never present a fabricated publication as real.** The standing rule about fabricated clinical
content applies to citations too.

`GET /api/ledger` gains an `authorizations` field from `authorizationStatus()`.

## Deliverable 3 — `components/ledger/AuthorizationPanel.tsx`

Above the record stream. One row per override:

```
AUTHORIZATIONS

⛔ AUTH-4F2C  capecitabine · dr_chen                          SUPERSEDED
   bound to  cpic:DPYD:capecitabine:2017   sha256 4a91…
   current   cpic:DPYD:capecitabine:2024   sha256 77bc…
   scope collision: dosing.capecitabine
   superseded by PMID 29152729 · CPIC DPYD guideline, 2024 revision

✓  AUTH-91BE  codeine · dr_chen                               VALID
   bound to  cpic:CYP2D6:codeine:2021      sha256 c81d…
   evidence changed elsewhere; no scope collision with dosing.capecitabine
```

The second row is the demo. Both overrides were signed. One died, one lived, and the panel names
the reason. **Do not cut the second row to save time** — a panel showing only the superseded
authorization proves nothing beyond "we set a flag."

Add a **Publish CPIC revision** button next to Tamper. Different colour from Tamper: tampering is
an attack, superseding is *normal life*, and conflating them muddles the point.

## Why this beats the tamper demo — say this on stage

Tamper answers *"did someone change the record?"*
This answers *"is this decision still warranted?"*

Every audit system on the market answers the first. Almost none answer the second. Line to use:

> *"Signing an override isn't a permanent licence. It was granted against evidence, and when the
> evidence moves, the licence expires by itself. Nobody had to remember to go back and check."*

## Acceptance

1. Override capecitabine for Okafor, sign → `AUTH-… VALID`
2. Override codeine for Reyes, sign → second `AUTH-… VALID`
3. **Publish CPIC revision** → capecitabine `SUPERSEDED` with the scope collision named;
   **codeine still VALID with the no-collision reason shown**
4. The hash chain stays **green** throughout — superseding is not tampering, and if the chain goes
   red here you have written to the ledger's past instead of appending to its future. That is a
   severity-1 bug.
5. `data/cpic/index.json` on disk is **byte-identical** before and after. Check with `md5`.
6. Export the inspection package → the superseded authorization and its reason appear in the HTML

Step 4 is the one to watch. Two different red states that mean different things is the whole
design; if they collapse into one, the idea is lost.

Leave files on disk. **Do not run git.** List what you created in your final message.

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
