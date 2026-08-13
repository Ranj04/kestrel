> **Inherits `.sol/prompts/_template.md` in full**, plus the adaptations in `CLAUDE.md`.
> Read both before this file. Sol also reads `AGENTS.md` (a pointer, not a copy — rule 7).
> The deliverable clause at the bottom is inherited and not optional.

# TASK: phase1-sol-ledger — hash-chained audit ledger, verification, tamper

You are **Sol**. Read `~/"biopharma hack"/.sol/prompts/_context.md` FIRST. It defines the project, your
directory ownership, and the standing rules. Everything below assumes it.

Also read `~/"biopharma hack"/lib/contracts.ts` — Fable writes it in the first ten minutes and then freezes it.
`LedgerRecord`, `VerifyResult`, `Actor`, and `ModelProvenance` are yours to implement against.
**If it does not exist yet, do not wait.** Copy the type declarations out of Fable's Phase 1
prompt (`.sol/prompts/phase1-fable-engine.md`, Deliverable 1) into your head, build against them,
and switch to importing the real file the moment it lands.

You are building the half of this product that nobody else has built. The alert is table stakes;
this is the differentiator. No UI in this task — Phase 1 ends with a library and an API you can
hit with `curl`, plus tests that prove the chain actually detects tampering.

---

## Deliverable 1 — `lib/ledger/hash.ts`

### `canonicalJson(value: unknown): string`

Deterministic serialization. **Recursively sort object keys.** Arrays keep their order.
`undefined` values are omitted. Numbers, strings, booleans, null serialize as JSON does.

This function is the single most dangerous thing in the codebase. `JSON.stringify` preserves
insertion order, so a record hashed at write time and re-hashed after a round trip through disk
can produce two different digests through no fault of anyone. When that happens the chain shows
red before anybody tampers with it, the demo dies on stage, and it looks exactly like a real bug
in the product. Write this carefully and test it hard.

### `hashRecord(record): string`

Already implemented and tested in `lib/ledger/hash.ts` — **do not rewrite it.**
SHA-256 hex of `canonicalJson({ seq, recordId, type, occurredAt, actor, payload, model, clauses, prevHash })`.

`hash` is **excluded** from its own input. Node's built-in `crypto` — no dependency.

Genesis `prevHash` is the exported `GENESIS_PREV_HASH` = `"sha256:" + "0".repeat(64)`.
The `sha256:` prefix is part of it (writ.ai does the same, so a digest is
self-describing in the UI). Import the constant; do not retype the literal.

---

## Deliverable 2 — `lib/ledger/store.ts`

Append-only JSONL at `data/ledger.jsonl`, one record per line.

```ts
export function append(
  type: LedgerEventType,
  payload: unknown,
  actor: Actor,
  clauses: string[],
  model?: ModelProvenance,
): LedgerRecord;

export function readAll(): LedgerRecord[];
export function reset(): void;   // demo reset. truncates the file.
```

- `seq` is monotonic from 0. `recordId` is a short random hex.
- `occurredAt` is set at append time — ALCOA "Contemporaneous". Never accept it from the caller.
- **Appends only.** No update, no delete. Do not expose one "for convenience".
- Reads must tolerate a partially-written final line without throwing (a torn write at the end of
  the file should be reported as broken, not crash the process).

**Vercel's filesystem is read-only.** If writing throws `EROFS` or `EACCES`, fall back to an
in-memory array and set a module-level flag `ephemeral = true` that the API exposes. Do not
silently swallow the error — the UI needs to know. The live demo runs locally, where the file is
real; the deployed link is a convenience.

### Clause tags

`append` takes them, but export a helper with the canonical mapping so callers don't invent tags:

| type | clauses |
|---|---|
| `order.placed` | `21CFR11.10(e)`, `ALCOA+:Attributable`, `ALCOA+:Contemporaneous` |
| `genotype.resolved` | `21CFR11.10(e)`, `ALCOA+:Original` |
| `model.invoked` | `21CFR11.10(e)`, `ALCOA+:Original`, `FDA-AI:model-provenance` |
| `alert.raised` | `21CFR11.10(e)`, `ALCOA+:Accurate`, `ALCOA+:Traceable` |
| `alert.accepted` | `21CFR11.10(e)`, `ALCOA+:Attributable` |
| `alert.overridden` | `21CFR11.50`, `21CFR11.70`, `ALCOA+:Attributable`, `ALCOA+:Enduring` |
| `policy.revised` | `21CFR11.10(k)(2)`, `ALCOA+:Traceable`, `ALCOA+:Enduring` |
| `export.generated` | `21CFR11.10(b)` |

Also export a human-readable label for each tag — the UI renders
`21CFR11.10(e) · secure, computer-generated, time-stamped audit trail` and that phrasing is doing
real work on stage. Get the clause wording close to the actual regulation text.

---

## Deliverable 3 — `lib/ledger/verify.ts`

```ts
export function verify(records?: LedgerRecord[]): VerifyResult;
```

Walk from seq 0. A record is broken if its recomputed hash differs from its stored `hash`, **or**
if its `prevHash` does not equal the previous record's stored `hash`.

**`brokenSeqs` must contain the first broken record and every record after it**, even if those
later records are internally self-consistent. That cascade is the point: one altered record
invalidates everything downstream, and the UI renders that as a block of red rather than a single
red line. A boolean would be technically correct and dramatically worthless.

`firstBrokenSeq` is null when `ok`.

---

## Deliverable 4 — `lib/ledger/tamper.ts` + `scripts/tamper.ts`

```ts
export function tamper(seq?: number): { seq: number; field: string; before: string; after: string };
```

Rewrite one record's `payload` in place on disk — change a single meaningful value, **leave the
stored `hash` untouched**, and do not touch any other record. Default to the most interesting
record present (prefer `alert.overridden`, else `alert.raised`, else the last one).

This must simulate someone editing the database directly. It must **not** re-hash. If you find
yourself needing to re-hash, you have misunderstood the task.

Return what changed so the UI can say *"payload.rationale was altered."*

`scripts/tamper.ts` is the same thing from the CLI (`npx tsx scripts/tamper.ts`), because a judge
who suspects the button is fake should be able to watch it happen outside the app.

---

## Deliverable 5 — `app/api/ledger/`

- `GET  /api/ledger` → `{ records, verify, ephemeral }`
- `POST /api/ledger/verify` → `VerifyResult`, recomputed fresh from disk every call — **never
  cached, never memoized.** A cached green check is the worst possible bug in this codebase.
- `POST /api/ledger/tamper` → result of `tamper()`
- `POST /api/ledger/reset` → truncate, for demo reruns

Sol owns these routes. Fable's prescribe route imports `append` from `lib/ledger` directly.

---

## Deliverable 6 — `lib/ledger/override.ts`

```ts
export function recordOverride(input: {
  alertId: string; orderId: string;
  actor: Actor;
  rationale: string;
  signatureMeaning: "authorship" | "review" | "approval";
}): LedgerRecord;
```

21 CFR §11.50 requires a signature manifestation to carry the signer's **printed name, date/time,
and the meaning of the signature**. Store all three explicitly in the payload as named fields —
not implied, not derived at render time. §11.70 requires the signature be linked to its record so
it cannot be excised and transplanted; the hash chain is that link, and a one-line comment should
say so.

Also export `recordAcceptance(...)` for the case where the clinician follows the recommendation.
Both branches must be recorded. A system that only logs disagreement is not an audit trail.

---

## Acceptance — write these as real tests and run them

`tests/ledger.test.ts` (yours; Fable's tests live in their own place):

1. **Round-trip stability.** Append 5 records, `readAll()`, recompute every hash. All match.
   *This is the test that saves the demo.* Include a record whose payload has keys inserted in a
   deliberately awkward order and a nested object, to prove `canonicalJson` sorts recursively.
2. **Clean chain verifies.** `verify()` → `ok: true`, `firstBrokenSeq: null`.
3. **Tamper is detected.** Append 6, `tamper(2)`, `verify()` → `ok: false`, `firstBrokenSeq: 2`,
   `brokenSeqs: [2,3,4,5]`.
4. **Tampering the last record is detected.** Off-by-one guard.
5. **Re-hashing defeats nothing downstream.** Tamper record 2 *and* recompute record 2's own hash.
   Verify must still fail — because record 3's `prevHash` no longer matches. Prove the chain, not
   just the digest.
6. **Override record carries all three §11.50 fields**, and they survive the round trip.
7. **Torn final line.** Append 3, truncate the file mid-record, `readAll()` does not throw.

Then by hand:

```bash
curl -s localhost:3000/api/ledger | jq '{n:(.records|length), ok:.verify.ok}'
curl -s -XPOST localhost:3000/api/ledger/tamper | jq
curl -s -XPOST localhost:3000/api/ledger/verify | jq '{ok, firstBrokenSeq, brokenSeqs}'
# EXPECT ok:false and a contiguous broken range running to the end
```

If test 1 fails, fix it before writing anything else. Everything downstream is worthless if a
clean chain does not verify clean.

Finish the whole task. Then start Phase 2.

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
