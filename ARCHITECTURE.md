# Attest — architecture

*(name is a placeholder, change it if you hate it — it's `attest` in two config strings and nowhere else)*

> **The drug that would have killed you, and the receipt that proves we knew.**

Biopharma Hack Day, AWS Builder Loft, Thu Aug 13. Solo build, ~5 hours, orchestrated as a
Fable/Sol parallel build using the same structure as Ledge.

---

## 1. The one architectural decision that matters

**The model never writes the clinical recommendation. It routes to it.**

Every word of medical advice on screen is a verbatim string from the cached CPIC dataset, carried
with its guideline URL, evidence classification, and PMIDs. The LLM is allowed to do exactly three
things, none of them clinical:

1. Parse free-text prescriber input into a structured order (`"Xeloda 1250 BID"` → drug + dose)
2. Resolve a brand/typo'd drug string to a CPIC drug name (`"Xeloda"` → `capecitabine`)
3. Draft a *suggested* override rationale that the human edits and signs

This is not a safety nicety. It is the entire reason the provenance claim holds. If the model
generated the recommendation, there would be nothing to cite and the audit trail would be theatre.

**The demo line:** *"The model never writes the recommendation. It routes to it. That's the only
reason we can cite it."*

Standing rule, inherited from Ledge's "never fabricate a measurement":
**never fabricate a clinical recommendation.** Any recommendation string that did not come out of
`data/cpic/index.json` is a bug, not a style issue.

---

## 2. What's on screen

One screen, split. **Left is Fable's. Right is Sol's.** That's not a coincidence — the ownership
split and the visual split are the same line.

```
┌────────────────────────────────┬──────────────────────────────┐
│  PRESCRIBE                     │  AUDIT LEDGER                │
│                                │                              │
│  Patient: Maya Okafor, 61F     │  #4  alert.raised            │
│  MRN 4417-2                    │      21CFR11.10(e)           │
│                                │      ALCOA+ Contemporaneous  │
│  ▸ Order: capecitabine ...     │      sha256 9f2a…  ✓         │
│                                │                              │
│  ╔══════════════════════════╗  │  #5  alert.overridden        │
│  ║  ⛔ DPYD Poor Metabolizer ║  │      21CFR11.50 signature    │
│  ║  Avoid use of 5-FU or    ║  │      sha256 c81d…  ✓         │
│  ║  5-FU prodrug regimens.  ║  │                              │
│  ║  [ Why? ]  [ Override ]  ║  │  [ Verify chain ] [ Export ] │
│  ╚══════════════════════════╝  │  [ Tamper ]                  │
└────────────────────────────────┴──────────────────────────────┘
```

The **[ Why? ]** drawer is candidate A's payoff: CPIC recommendation verbatim, evidence
classification, Level A badge, guideline link, PMIDs, and the exact CPIC API row URL the string
came from.

The **[ Tamper ]** button is candidate B's payoff: it edits one byte of one record's payload
in `data/ledger.jsonl`, and every hash from that record forward goes red.

The **[ Publish CPIC revision ]** button is the *better* payoff, ported from writ.ai at depth one.
An override is a signed authorization **bound to the evidence as it stood when signed**. Publish a
guideline revision and the capecitabine override goes `SUPERSEDED` — while the codeine override
stays `VALID`, because the change's scopes don't intersect its scopes. Same traversal rule as
`authority/engine.py`, evaluated one hop deep:

```
intersection = authorization.snapshot.scopes ∩ change.affectedScopes
```

Two red states that mean different things, and keeping them distinct is the design:
**tamper** answers *did someone change the record*; **supersede** answers *is this decision still
warranted*. Every audit product answers the first. Almost none answer the second.

`lib/ledger/hash.ts` is given to Sol as finished code — a TypeScript port of writ.ai's
`stable_hash`, verified against key-order independence, `undefined`-vs-missing, integer-like keys,
unicode round-trip, and JSONL re-read.

---

## 3. Stack — and why

**Next.js 15 (App Router) + TypeScript, one process, no database.** Run the demo with
`npm run dev` from your laptop.

- Matches most of your portfolio; you'll move fastest here.
- No DB means no migration, no connection string, and nothing to fail on stage.
- **The ledger is a file: `data/ledger.jsonl`, append-only, one JSON record per line.** This is a
  deliberate choice, not laziness. It means during the demo you can open the actual file in VS
  Code, change one character, save, hit **Verify**, and watch it go red. A judge who suspects the
  Tamper button is fake can watch you do it by hand. A Postgres table can't be shown that way in
  ten seconds.
- Node's built-in `crypto` gives you SHA-256. No dependency.
- **Deploy to Vercel as a link, but demo locally.** Vercel's filesystem is read-only, so the
  ledger falls back to in-memory there and the Tamper button still works — but the live demo runs
  on your machine so file-level tampering is available if challenged.

**LLM:** Bedrock (Claude) if you can get creds at the loft — it's an AWS Builder Loft and it costs
you nothing to say "Bedrock" on stage. **Fall back to any key you already have.** Put it behind
`lib/llm.ts` with one function so swapping providers is a one-line change, and make the whole app
work with the LLM stubbed out — parsing falls back to exact string match on drug name. **The demo
must survive having no model access at all.**

---

## 4. Data flow

```
data/cpic/index.json        ← cached tonight by cache_cpic.py. static. never fetched at runtime.
data/patients.json          ← 3 synthetic patients w/ diplotypes. Fable writes this.
        │
        ▼
  POST /api/prescribe   { patientId, drugRaw }
        │
        ├─ llm.parseOrder()  ────────────────────► ledger: model.invoked
        ├─ pgx.resolveDrug(drugRaw) → drugName
        ├─ pgx.evaluate(patient, drugName) → Alert | null
        │       looks up index[drug][gene], matches patient's `lookup` term,
        │       returns CPIC's verbatim strings + citations
        ├─ credibility.assess(alert) → risk grid → requiredControl
        └─ ledger.append("alert.raised", …)
        │
        ▼
  { order, alert, credibility }
```

Nothing in that path touches the network.

---

## 5. The FDA credibility gate (this is the part judges will remember)

FDA's draft guidance on AI in regulatory decision-making defines model risk as
**influence × consequence**. Implement it literally:

| | consequence low | consequence high |
|---|---|---|
| **influence low** | auto — proceed | human review |
| **influence high** | human review | **human e-signature required** |

- A "no change to therapy" alert → low/low → passes silently.
- DPYD Poor Metabolizer + capecitabine → high influence (the alert *is* the basis for the
  decision), high consequence (fatal first dose) → **hard gate, cannot proceed without a signed
  rationale.**

The UI renders a small Context-of-Use card showing the two axes and where this decision landed.
Ten seconds on screen, and it visibly implements a named FDA framework. This is the single
highest-value thing you can add after the core works, and it's cheap.

---

## 6. Ownership split — HARD

Same rule as Ledge: read anything, edit only yours.

**Fable (Claude) owns — the decision layer:**
```
lib/contracts.ts        the shared interface. Sol reads it constantly, never edits it.
lib/pgx/                index loading, drug resolution, alert evaluation
lib/credibility.ts      the FDA influence × consequence grid
lib/llm.ts              provider wrapper + stub fallback
app/api/prescribe/      the order endpoint
components/prescribe/   left pane: order form, alert card, Why? drawer
data/patients.json      synthetic patients
app/page.tsx            the two-pane shell
README.md DECISIONS.md  and git. Fable owns git. Sol never runs a git command.
```

**Sol (Codex) owns — the provenance layer:**
```
lib/ledger/             record shape, canonical hashing, append, verify, tamper
app/api/ledger/         list / verify / export endpoints
components/ledger/      right pane: record stream, override modal, verify + export controls
lib/export/             inspection package builder (human-readable + machine-readable)
scripts/tamper.ts       CLI tamper, for when you want to do it outside the UI
```

Contract between them is exactly one file: `lib/contracts.ts`. Fable writes it in the first ten
minutes of Phase 1 and then **freezes it**. If Sol needs a change, Sol writes
`.sol/requests/<task>.md` and keeps moving — it does not edit the file and does not wait.

---

## 7. The hash chain — get this exactly right or the demo lies

```ts
record.hash = sha256(canonicalJson({
  seq, recordId, type, occurredAt, actor, payload, model, clauses, prevHash
}))
```

Three things that will silently break it:

1. **`canonicalJson` must sort object keys recursively.** `JSON.stringify` preserves insertion
   order, so a record re-read from disk can hash differently than when written. This is the bug
   that ruins the demo — the chain shows red before anyone tampers with anything. Sol's Phase 1
   acceptance test exists specifically to catch it.
2. **`hash` itself is excluded from the hashed payload.** Obvious, easy to get wrong.
3. **Genesis record has `prevHash = "0".repeat(64)`.**

`verify()` walks the file from record 0 and returns the **first** broken index plus every index
after it, so the UI can render "record 4 tampered, records 4–9 no longer trustworthy" rather than
just a boolean. That cascade is what makes the red look serious.

---

## 8. Part 11 / ALCOA+ clause tags

Every record carries `clauses: string[]`. Not decoration — it's what makes the right pane look
like a compliance artifact instead of a log viewer.

| Event | Clauses |
|---|---|
| `order.placed` | `21CFR11.10(e)`, `ALCOA+:Attributable`, `ALCOA+:Contemporaneous` |
| `genotype.resolved` | `21CFR11.10(e)`, `ALCOA+:Original` |
| `model.invoked` | `21CFR11.10(e)`, `ALCOA+:Original`, `FDA-AI:model-provenance` |
| `alert.raised` | `21CFR11.10(e)`, `ALCOA+:Accurate`, `ALCOA+:Traceable` |
| `alert.overridden` | `21CFR11.50`, `21CFR11.70`, `ALCOA+:Attributable`, `ALCOA+:Enduring` |
| `export.generated` | `21CFR11.10(b)` |

`model.invoked` records the model id, version, full params, the exact prompt, and the **raw
unedited output** — ALCOA's "Original" requires the unmodified result be preserved separately from
any human-edited version. Almost no production AI system does this. Say that on stage.

---

## 9. Timeline

Assumes ~11:30 start, ~4:00 demos. **Verify on arrival; if it's shorter, drop Phase 3 entirely —
the app is complete and demoable without it.**

| Time | Fable | Sol |
|---|---|---|
| 11:30–11:40 | scaffold + write & freeze `contracts.ts` | wait, read contracts, start |
| 11:40–12:45 | **P1**: pgx engine, patients, `/api/prescribe` | **P1**: ledger core, hash chain, verify, tamper |
| 12:45–2:00 | **P2**: left pane, alert card, Why? drawer | **P2**: right pane, override modal, export |
| 2:00–2:30 | **P3**: second drug path + credibility gate UI | **P2b**: snapshot binding + authorization panel |
| 2:30–2:45 | **cross-review, no edits** | **cross-review, no edits** |
| 2:45–3:15 | fix severity-1 findings only. **FREEZE.** | ditto |
| 3:15–3:45 | record fallback video | rehearse twice with a timer |

**Feature freeze at 2:45 is the rule.** Solo builders lose by still coding at demo time.

---

## 10. Demo state to have ready before you start building

Three synthetic patients in `data/patients.json`. **Do not invent diplotypes — copy the exact
`lookup` strings from `data/cpic/index.json` or nothing will match.**

| Patient | Genotype | Demo role |
|---|---|---|
| Maya Okafor, 61F | DPYD Poor Metabolizer | **the money shot.** capecitabine → avoid |
| Daniel Reyes, 34M | CYP2D6 Ultrarapid | codeine → avoid. proves it's not one hardcoded case |
| Ana Lindqvist, 47F | DPYD Normal Metabolizer | prescribe capecitabine → **no alert.** proves it isn't a red screen generator |

That third patient matters more than it looks. A demo that always alarms is a demo that always
alarms. Showing a clean pass first, then the same drug on a different patient going red, is what
makes the room believe the lookup is real.
