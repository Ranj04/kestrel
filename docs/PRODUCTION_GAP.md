# Kestrel — production gap

**Phase 7 deliverable. Merged and arbitrated by Opus 5 (overseer).**
Tree audited: `06f055cb812ac0094c269421baac4487e3abe70d` (phase 6 close).

This file is the specification for phases 8–13. It is the merge of three inputs, and it
replaces all three for any downstream purpose:

| Input | Who | What it covers |
|---|---|---|
| `.sol/reviews/phase7-sol-audit.md` | Sol (`codex exec`), static read | Fable's territory — `lib/pgx/`, `lib/contracts.ts`, `lib/credibility.ts`, `lib/llm.ts`, `app/api/prescribe/`, `components/prescribe/`, `app/page.tsx`, `app/pipeline/`, clinical data files, `scripts/scrape-fda.ts`. **15 findings.** |
| `.sol/reviews/phase7-fable-audit.md` | Fable 5 | Sol's territory — `lib/ledger/`, `lib/export/`, `app/api/ledger/`, `app/api/evidence/`, `components/ledger/`, `scripts/tamper.ts`, `scripts/check-removals.sh`, root config. **13 findings.** |
| `.sol/reviews/phase7-production-facts.md` | Claude Code, live network | Five facts about the deployed application that neither agent could obtain. Treated here as **established evidence**, not as a third opinion. |

Neither agent read the other's file, and Fable deliberately left the production-facts file
unread because it could not rule out that the file was Sol's output. That was the right
call and it cost nothing: the facts are folded in below, and where they change a severity
it is said so explicitly.

**No source file was modified to produce this document.**

---

## How to read this

**Severity is about the claim, not the code.** The rubric is `.sol/prompts/phase7-audit.md`'s:

- **CRITICAL** — the product makes a claim this shim cannot support. An unsupported claim is
  worse than an absent feature, because absence is visible and a false claim is not.
- **HIGH** — real deployment is impossible without it, but nothing on screen lies.
- **MEDIUM** — works; does not scale, or does not survive a restart.
- **LOW** — cosmetic, or an accepted limitation already registered.

**Cost never moves severity.** Cost goes in the entry.

Every entry carries a **Smallest honest fix**. Read that column first. Fourteen of the
twenty-seven entries have a mitigation available today that is a label, a heading, or two
lines of gate — and a CRITICAL whose false claim can be deleted by one line of on-screen
text this afternoon is worth more than a subsystem three weeks out. **Shipping honest beats
shipping later.** The consolidated list is the phase 7.5 table near the end.

---

## Arbitration summary — what I changed and why

### Deduplication

28 filed findings became **24 entries**. There was exactly **one full duplicate** and four
partial overlaps:

| Merge | Result |
|---|---|
| Sol G-1 + Fable G-1 — no authenticated identity behind the §11.50 signature | **G-1**. Reached independently by two different models from opposite sides of the codebase. Under rule 10 that agreement is itself evidence, and it is why G-1 sits at the top of the list ahead of anything either raised alone. |
| Fable G-6 (unserialized `append`) + Sol G-11 (no idempotent request boundary) | **G-8**. Two different mechanisms, one requirement: the chain head must be a serialized, transactional resource. Phase 8 does one thing to close both. |
| Sol G-13 (auth half) + Fable G-8 (no auth/tenancy) | **G-6**. |
| Sol G-13 (telemetry half) + Fable G-10 (zero observability) | **G-19**. Sol's G-13 is the only finding split across two entries, because its auth half and its telemetry half get different fixes in different phases. |
| Sol G-12 (LLM key failover) + Fable G-11 (`.env`, no rotation) | **G-21**. The two agents audited complementary halves of one shim and said so. |

Three entries are new here and belong to neither agent: **G-20** (a process finding about
`REGISTER.md`, consolidated from notes both agents embedded in other entries), **G-22**
(from production fact F-1), and **G-25** (Sol filed it as a flagged uncertainty; the
evidence resolves it, so it is promoted to an entry).

### Re-ranking, stated rather than done silently

Sol filed **7 CRITICALs of 15**; Fable filed **3 of 13**. The spec requires the CRITICAL
section to be short, and a ranking in which half the list is critical carries no
information. I re-ranked six entries. **Nothing was deleted.** Every finding either agent
filed survives below, at the severity I judged, with the reason.

| Finding | Filed | Merged | Why |
|---|---|---|---|
| Coverage determination with no plan context (Sol G-2) | CRITICAL | **HIGH** (G-9) | `data/policies.json:2` labels itself synthetic and the badge renders inside a screen banner-labelled synthetic; the unsupported word is "determination", and one line of on-screen text removes it today. Becomes CRITICAL again the moment the pitch narrates coverage as a determination. |
| "matched exact" for a demo alias (Sol G-3) | CRITICAL | **MEDIUM** (G-23) | The resolution is correct for both mapped brands and no clinical output depends on the word; what would be false is a *pitch* sentence claiming general brand normalization, which lives in narration, not code. |
| "FDA-labeled" badge (Sol G-4) | CRITICAL | **HIGH** (G-10) | The badge cites an FDA-published table and `WhyDrawer` shows the verbatim row, source URL and retrieval time one click away, therefore the disclosure exists and the defect is terminological rather than fabricated. |
| "No human control required" under incomplete screening (Sol G-6) | CRITICAL | **HIGH** (G-11) | The amber "screening incomplete" line renders directly above it on the same card, so the screen does carry the limitation adjacent to the overstatement. Registered as R-26. Fix it in the same edit as G-5. |
| "Has a guideline today" from an undated snapshot (Sol G-7) | CRITICAL | **HIGH** (G-17) | The snapshot's *content* is verbatim and correct; the defect is currency and provenance, and the on-screen half is one word on a demo page. |
| `reset` / `tamper` unauthenticated (Fable G-7) | HIGH | **CRITICAL** (G-4) | **Upgraded, on the production facts.** Fable ranked it HIGH and said explicitly that its severity turned on whether the deployed link is live. It is live (F-1, F-2). A product whose entire claim is a tamper-evident audit trail is shipping a public one-call erase and a public one-call forge. |
| Observability and rate limiting | Sol HIGH / Fable MEDIUM | **HIGH** (G-19) | The deployment is public and the clinical endpoint calls a paid model with no limit, therefore Sol's band is the right one. |
| Secrets and LLM failover | Sol HIGH / Fable MEDIUM | **MEDIUM** (G-21) | A single-tenant deployment works today with platform env vars and nothing on screen depends on it; the multi-tenant requirement is real and future. Fable's band. |

**If Ranjiv fixes exactly one thing on the merits rather than on the ordering rule, it is
G-3.** The identity pair leads the list because independent cross-model agreement earns
that position, but G-3 is the finding that most directly defeats the sentence Kestrel
exists to say, and it was reproduced against the running app with a control.

---

## Coverage, and its holes

**What was audited:** every file in both territories, by the party that did not write it,
at the same commit. Neither agent audited its own code — the one rule this project does not
bend.

**What was NOT audited, by anyone:**

- **`scripts/cache_cpic.py` and `scripts/verify-setup.mjs`.** Fable excluded them as
  clinical-data instruments on Sol's side of the split; Sol's coverage statement names
  `scripts/scrape-fda.ts` and does not name these two. **Neither agent read them**, and
  `npm run verify` (rule 4a's live instrument in this repo, the one that caught R-6) runs
  through `verify-setup.mjs`. An unaudited gate instrument is the same defect class as a
  green suite that never ran.
- **`.env` contents** — deliberately unread by both. Only file metadata was observed (G-21).
- **`tests/` as a subject.** Fable read test *source* as evidence; neither agent audited
  whether the suite's coverage matches the claims it is cited for.
- **`ARCHITECTURE.md`, `DECISIONS.md`, `demo/RUNBOOK.md`** — no one checked whether their
  claims still match the code. `docs/INTEGRATION.md` was checked and produced G-15, which
  suggests this is not a safe assumption.
- **`npm test` was not executed this session by either agent.** Fable ran `npx eslint .`
  (exit 0) and a read-only in-memory chain probe; Sol executed nothing and says so.
- **The deployed application's behaviour under POST.** See G-4 and the open questions —
  route existence is demonstrated, unauthenticated *success* is inferred.

---

# CRITICAL

## G-1 · CRITICAL · The §11.50 signature manifestation has no authenticated identity behind it, and nothing on screen says so

**Found by:** Sol (G-1) and Fable (G-1), independently, from opposite sides of the
codebase. The only finding both agents reached alone.

**Where:** `lib/actors.ts:19-23,27-29`; `app/page.tsx:187`;
`components/ledger/SignatureModal.tsx:91,103,121-122`; `app/api/prescribe/route.ts:37-58`;
`lib/export/index.ts:44-55`. Absent authentication/session middleware would live around
`app/api/**` and the root shell — there is no `middleware.ts` in the repo.

**What it is now:** `app/page.tsx:187` hands `SignatureModal` the actor as
`actor={PRESCRIBER}`, and `PRESCRIBER` is a module-level constant at `lib/actors.ts:23`,
therefore every signature in the chain is attributed to the same fictional person
regardless of who is using the app. The modal renders the heading `21 CFR PART 11
SIGNATURE` (`:91`), an **editable free-text** printed-name field (`:103`), and a live clock
labelled "set by the ledger on submit" (`:121-122`) — a complete §11.50 manifestation over
a constant. On the API side `app/api/prescribe/route.ts` trusts a caller-supplied
`orderedBy` and `actorFor()` fabricates a prescriber-shaped actor for any unknown id
(`lib/actors.ts:28`). `lib/actors.ts:17-18` calls itself a DEMO SHIM **in a source
comment**; the screen banner (`app/page.tsx:89`) labels the *patients* synthetic, not the
signer, and nothing in the modal, the record rows, or the exported HTML says demo or
unauthenticated.

**What production requires:** an IdP-backed session; a server-derived immutable subject id;
signature re-authentication at the moment of signing (§11.200(a) two-component first
signing); a printed name **derived from the authenticated identity, never typed**; role and
privilege checks; tenant membership. The client must never supply the authoritative signer.

**What it blocks:** the pitch's central claim that the decision is captured as a *signed*
record; the on-screen "Override and sign" and the §11.50 manifestation itself; any
attributability claim in the exported inspection package.

**Phase:** 9.

**Register:** **no R-entry exists.** `BUILD_ORDER_V2.md:49-51` calls this "the
highest-severity item in the repo" and `REGISTER.md` does not carry it — R-18 closed the
*duplication* of the constant, not the shim. See G-20.

**Smallest honest fix (today):** one line in the modal and one in the export signature
block — *"DEMO — unauthenticated signature; the signer is a fixture."* The same line
belongs on `RecordRow`'s override rendering. That converts this CRITICAL to a LOW today,
against an auth system available in weeks.

## G-2 · CRITICAL · Ledger attribution is whatever the HTTP client sends: the write routes take the actor object off the request body

**Found by:** Fable (G-2). **Arbitration: this is a distinct defect from G-1 and stays
separate.** Fable argued the distinction; I checked it and it holds. G-1 is the absence of
an identity system, whose fix is authentication. G-2 is an API *contract* that accepts
identity as input, and a session layer bolted on top of a route that still reads
`body.actor` leaves attribution exactly as wire-controlled as it is today. The two have
different fixes, different owners, and different smallest-honest-fixes; merging them would
lose the second one.

**Where:** `app/api/ledger/override/route.ts:14-18,45-50`;
`app/api/ledger/accept/route.ts:4-8,18-28`; contrast `lib/actors.ts:27-29` and
`app/api/prescribe/route.ts:57`.

**What it is now:** `isActor()` checks only that `id`, `name` and `role` are strings and
the route passes `body.actor` straight into `recordOverride`/`recordAcceptance`, therefore
the strongest attribution statement in the chain — the signed override — is whatever
identity the caller chose to send, and `curl` can write a record signed by any name and any
role. `actorFor()` exists precisely to resolve an id to a controlled actor and the prescribe
route uses it; **the ledger write routes bypass it.** That is rule 4a-quater's exact shape:
the capability is present and correct, and the absence is in a different file. The project's
own fixture shows the consequence — `tests/ledger.test.ts:35-39` posts a *different
spelling* of the same person ("Dr. Maya Chen" / "Attending Oncology") than
`lib/actors.ts:20` declares, which is what identity-as-data does.

**What production requires:** the API contract must not take identity as input. The actor is
resolved server-side from the authenticated session; the request carries at most a
re-authentication proof. **This is a contract change to Sol-owned routes**, and phase 9 is
currently listed as Fable-owned — see the recommended order.

**What it blocks:** every record row renders `ALCOA+:Attributable — attributable to the
person responsible` (`components/ledger/RecordRow.tsx:116`, label from
`lib/ledger/clauses.ts:20`) over an attribution the wire controls. Combined with F-1, this
is live: the deployed build contains these routes and no auth middleware exists in the repo.

**Phase:** 9 — and the phase 9 spec must assign the route change to Sol.

**Register:** no R-entry. R-18's closure note states the mechanism ("the override record's
actor is posted by the client") without flagging it as a gap — an understatement by
omission. See G-20.

**Smallest honest fix (today, without auth):** accept only an actor **id** and resolve it
through `actorFor()`, so the wire cannot choose the display name and role of a known id.
One declaration changed, strictly more honest, and it shrinks the phase 9 diff.

## G-3 · CRITICAL · "Chain intact" proves the integrity of the records that are present and says nothing about the ones that were removed — deletion and erasure verify clean

**Found by:** Fable (G-3), reasoned statically with an in-memory probe; **independently
reproduced end-to-end against the running app, with a control, by Claude Code (F-5).** The
control is what makes this evidence rather than an assertion.

**Where:** `lib/ledger/verify.ts:10-47`; `components/ledger/ChainStatus.tsx:67`;
`lib/export/index.ts:164-181`; `README.md:65`.

**What it is now:** `verifyState()` checks each record's `prevHash` linkage and recomputed
hash from genesis forward and nothing else — each record commits to its predecessor and
**nothing commits to the chain's length or to its head** — therefore a chain with its tail
deleted, or emptied entirely, has no mismatch to find. Reproduced against
`POST /api/ledger/verify` on a seeded 5-record chain:

```
baseline                      -> ok: true    total: 5
CONTROL: in-place tamper      -> ok: FALSE   firstBrokenSeq: 2    <- the instrument CAN fail
delete the last record        -> ok: TRUE    total: 4             <- evidence destroyed, verifies clean
erase the chain entirely      -> ok: TRUE    total: 0             <- an EMPTY chain verifies clean
```

Verification is not broken wholesale: the same call correctly reports `ok:false` with the
exact broken sequence for an in-place edit. **It is specifically blind to removal.** The UI
renders the result as `N records · chain intact ✓` (`ChainStatus.tsx:67`), and the
inspection package's README tells a regulator "The first mismatch and every record after it
are not trustworthy" (`lib/export/index.ts:176-177`), which implies everything before a
mismatch **is** trustworthy — with no step in the export procedure that could detect a
shortened chain and no external anchor to check it against.

**What it blocks:** `README.md:65` — "Any audit system can tell you *whether a record was
altered*" — and the pitch claim that the record cannot be quietly altered afterwards.
Alteration in place is genuinely detected; **removal is the quieter attack and it is not.**
The concrete case: delete the `alert.overridden` record — the single record proving a
clinician was warned and prescribed anyway — and the application renders a green, verified
audit trail of everything that remains. That is the exact claim the product exists to make.

**What production requires:** an external anchoring mechanism — periodic head-hash
publication to a store the application cannot rewrite (WORM bucket, transparency log, or a
counterparty countersignature) — plus expected-count and anchor-verification steps in the
export procedure. **Persistence alone does not close this.** A Postgres table's tail deletes
as quietly as a file's; a DBA `DELETE` still verifies clean. This is a schema-shaping
requirement for phase 8, not an implementation detail.

**Phase:** 8 for the anchoring; the wording is available today.

**Register:** no R-entry. See G-20.

**Smallest honest fix (today):** on screen and in the export README, "chain intact" becomes
*"records present are internally consistent; completeness requires the anchored head"* — or
plainly, *"cannot detect deletion of trailing records."* One sentence in each place.

## G-4 · CRITICAL · `reset` and `tamper` are unauthenticated mutation endpoints on the audit chain, and they are live on a public URL right now

**Found by:** Fable (G-7), filed HIGH. **Upgraded to CRITICAL by the production facts, not
by a re-reading of the code.** Fable's own uncertainty #3 said its priority turned on
whether the deployed link is live. It is.

**Where:** `app/api/ledger/reset/route.ts:3-14`; `app/api/ledger/tamper/route.ts:3-12`;
`app/api/evidence/supersede/route.ts:12-36` (same exposure class);
`https://kestrel-olive.vercel.app`.

**What it is now:** both are plain exported `POST` handlers with no gate of any kind — the
only `process.env` read in the entire Sol surface is the storage switch at
`lib/ledger/store.ts:35`, therefore nothing (`NODE_ENV`, a flag, middleware, auth)
distinguishes a production build from a demo build. The live deployment answers:

```
https://kestrel-olive.vercel.app/api/ledger          GET -> 200
https://kestrel-olive.vercel.app/api/ledger/reset    GET -> 405   route EXISTS
https://kestrel-olive.vercel.app/api/ledger/tamper   GET -> 405   route EXISTS
https://kestrel-olive.vercel.app/api/evidence/supersede GET -> 405
```

A POST-only Next route answers `405`; an absent route answers `404`. **`/api/ledger/tamper`
answers 405 rather than 404 on a public URL with no auth in front of it, therefore anyone
who knows the hostname can corrupt the audit chain of the deployed application, and anyone
can wipe it via `/api/ledger/reset`.** `tamper` targets the latest `alert.overridden`
record by preference (`lib/ledger/tamper.ts:113-117`) — the signed one.

**Honest residual:** Claude Code did **not** issue the POST, because confirming the
vulnerability by exploiting it would mutate a live deployment and 405-vs-404 already settles
existence. Unauthenticated *success* is therefore inferred from the absence of any auth
middleware in the repo, not demonstrated. That residual is named rather than papered over.

**Read this together with G-3 and G-7:** the chain is erasable by anyone (this entry),
erased by ordinary platform behaviour (G-7), and reports `ok:true` after either (G-3).

**What it blocks:** on the demo screen nothing lies — the buttons say "Reset demo" and
"Tamper a record". What it blocks is the deployed artifact being pointed at by anyone: the
link in `demo/` and in the repo homepage is an unauthenticated destruction-and-forgery API
on the product's core claim. `README.md:124` says "Demo locally, not on the deployed link",
which acknowledges the link exists and does not gate it.

**What production requires:** the endpoints do not exist in a production build — build-time
exclusion, or an explicit `DEMO_MODE` gate that production refuses to set — with the demo
keeping them behind the flag.

**Phase:** 12 owns the removal; **the gate is pulled forward to phase 7.5, today.**

**Register:** no R-entry; named in `BUILD_ORDER_V2.md:57-59` as something that "must not
exist in a production build". It already does. See G-20.

**Smallest honest fix (today, two lines):** `if (!process.env.DEMO_MODE) return new
Response(null, { status: 404 })` on both routes, ahead of the real removal. Until that ships,
the honest alternative is taking the public link down.

## G-5 · CRITICAL · A complete-looking clinical result can omit a second actionable finding, and a suppressed conflict renders green

**Found by:** Sol (G-5). Kept at Sol's severity — this is the clinical-claim entry, and
`CLAUDE.md` names `lib/pgx/evaluate.ts` putting the wrong recommendation on a patient as the
worst defect this codebase can have. A green clearance for a determination the engine
refused to make is that shape.

**Where:** `lib/pgx/evaluate.ts:61-63,80-100,131-143`;
`components/prescribe/AlertCard.tsx:71-101`; `REGISTER.md` R-25.

**What it is now:** `evaluate()` retains only the single highest-severity alert and
deliberately drops a gene whose matching CPIC rows conflict, while `assessGenes()` marks any
matching lookup `assessed: true` without carrying either condition, therefore the screen can
silently omit a second actionable recommendation and can render the green procedural line
"GENE assessed — <phenotype>. No CPIC alert raised" for a gene whose answer the engine
deliberately withheld. R-25 records the conflict case as a deliberate limitation on the
grounds that the wording stays literally true; under this phase's rule — that what the
screen implies counts — the register's treatment understates it.

**What production requires:** a result *collection* rather than a single alert; a
first-class conflict/indeterminate state carried through the contract to the renderer;
preservation of every applicable gene-drug recommendation; and clinician-visible resolution
rules for multi-gene guidance.

**What it blocks:** the green procedural clearance, the single alert card read as a complete
prescribing check, and the product-level claim of pharmacogenomic screening.

**Phase:** 10, with phase 13 defining the allowed clinical claim.

**Register:** R-25, at an understated severity. R-16 (multi-gene guidelines flatten) is the
related closed item.

**Smallest honest fix (today):** label the result *"DEMO — highest-severity finding only;
not an exhaustive screen"*, and render a suppressed conflict amber rather than green. The
amber path already exists (`AlertCard.tsx:71-90` renders the Reyes/capecitabine
missing-gene case amber) — this reuses it.

---

# HIGH

## G-6 · HIGH · No authentication, no sessions, no roles, no tenancy — and `GET /api/ledger` hands the entire corpus to any caller

**Found by:** Fable (G-8) and Sol (G-13, auth half).

**Where:** absent. Would live in `middleware.ts` (none exists — verified), a session layer,
and per-route authorization across `app/api/ledger/*`, `app/api/evidence/*`,
`app/api/prescribe/`. Evidence: `app/api/ledger/route.ts:11-20`;
`app/api/ledger/export/route.ts`.

**What it is now:** `GET /api/ledger` returns every record wholesale — genotype payloads,
diplotypes, override rationales — to any caller, and `POST /api/ledger/export` hands the
same corpus out as a ZIP *and appends a record while doing it*, therefore read access to the
clinical audit trail is anonymous and unlogged. Today the data is synthetic and
`app/page.tsx:89` says so, so nothing on screen lies — **the moment phase 10 ingests one
real genotype, this anonymous read path is a PHI breach rather than a gap.**

**What production requires:** authentication (sessions); authorization with distinct roles
(prescriber, auditor, admin — read and write are different rights on an audit ledger);
tenancy boundaries per institution; and audit-of-access, since who read the ledger is itself
§11-relevant.

**What it blocks:** an ordering constraint more than a current claim. **Phases 10 and 11
must not land before this covers the read paths.**

**Phase:** 9.

**Register:** R-3/R-4 accepted the hackathon scope; the production absence is not separately
registered.

**Smallest honest fix:** none — this is the subsystem. The honest interim is G-4's gate plus
not deploying real data.

## G-7 · HIGH · The ledger is non-durable and, on serverless, non-singular — confirmed live: the production chain reports `ephemeral: true` and zero records

**Found by:** Fable (G-5), reasoned from source; **confirmed against production by Claude
Code (F-3)**, which resolves Fable's stated inability to observe the deployment.

**Where:** `lib/ledger/state.ts:3-4`; `lib/ledger/store.ts:21,33-47`;
`lib/ledger/snapshot.ts:50-51,158-232`; `README.md:124-128`.

**What it is now:** `memoryRecords`, `activeRevision`/`publishedResult`, and the pgx
overlays installed by `installOverlays()` are all module-level, and `store.ts:35` branches
on `process.env.VERCEL` because the Vercel filesystem is read-only outside `/tmp`, therefore
each serverless instance holds an independent chain and an independent view of whether a
policy revision is active. The live instance confirms it:

```json
GET https://kestrel-olive.vercel.app/api/ledger
{ "records": 0, "ephemeral": true, "verify": { "ok": true } }
```

A traced consequence worse than the flicker `README.md:126` admits: `restoreRevisionState`
(`snapshot.ts:190`) refuses to restore when `verify(records).ok` is false, so after
*publish revision → tamper → process restart* the capecitabine authorization that the ledger
says was superseded renders **VALID** (`snapshot.ts:325-334`), and the SIMULATED-revision
banner disappears, while the `policy.revised` record still sits in the chain.

**What production requires:** one durable, shared, transactional store holding records
**and** revision state, so that any process — including a second, independent verifier —
reads the same chain; plus defined state-reconstruction rules for the broken-chain case
rather than emergent ones.

**What it blocks:** phase 8's own question — "does the chain survive a restart, and can a
second process verify it?" Both answers are currently no. On screen the amber badge says
"in-memory ledger — file storage unavailable", which reads as an infrastructure hiccup
rather than "this audit trail is one of several and evaporates"; `README.md:124` is honest.

**Phase:** 8.

**Register:** not registered. `README.md` and `BUILD_ORDER_V2.md` carry it; `REGISTER.md`
does not. See G-20.

**Smallest honest fix (today):** badge wording — *"DEMO: in-memory, per-instance ledger —
not durable."*

## G-8 · HIGH · The write path is neither atomic nor idempotent: concurrent orders can fork the chain and paint a false "CHAIN BROKEN"

**Found by:** Fable (G-6, the `append` race) and Sol (G-11, the request boundary) —
different mechanisms, one requirement, merged here because phase 8 closes both with one
design decision.

**Where:** `lib/ledger/store.ts:101-145`; `app/api/prescribe/route.ts:37-60,62-85,101-126`;
`lib/pgx/evaluate.ts:147-160`.

**What it is now:** `append()` reads the whole state, derives `seq` and `prevHash` from the
tail, then `appendFileSync`s with no lock, transaction or retry, therefore two overlapping
requests can both read tail N and write two records with the same `seq` and the same
`prevHash`, after which `verify()` honestly reports the second as broken — **the chain goes
red from clean concurrent use, indistinguishable on screen from tampering.** `CLAUDE.md`
names "a clean chain that verifies broken" as one of the two demo-killing defects. Above it,
one `POST /api/prescribe` performs several ledger appends around asynchronous resolution
with no idempotency key and no transaction, therefore a client retry creates a second order
and a failure after the first append leaves a partial prescribing sequence even though no
response succeeded. Single-user demo traffic never hits either.

**What production requires:** atomic append with a serialized head — a DB transaction taking
the tail under lock (`SELECT … FOR UPDATE` or an advisory lock) or a single-writer queue —
plus a durable transaction boundary or outbox at the request level, a caller-supplied
idempotency key scoped to tenant and encounter, unique constraints, replay-safe stored
responses, explicit failed/aborted states, and recovery tests for a failure after every
step. The current four-byte random order and alert ids should become database-enforced
identifiers. **This is schema-shaping: phase 8 must make the head a contended, serialized
resource, not a computed value.**

**What it blocks:** nothing on screen lies today; deployment with more than one concurrent
user is impossible, as are reliable EHR retries and exactly-once order attribution.

**Phase:** 8.

**Register:** not registered.

**Smallest honest fix:** none smaller than the real one. The interim is a single-flight
guard in the route plus a comment; the entry exists so phase 8's spec inherits it.

## G-9 · HIGH · A fictional payer policy renders as a coverage determination for a patient with no plan, member, or benefit context

**Found by:** Sol (G-2). **Re-ranked from CRITICAL** — reason in the arbitration table.

**Where:** `data/policies.json:2-10`; `lib/contracts.ts:38-46`; `lib/pgx/policy.ts:87-104`;
`components/prescribe/CoverageLine.tsx:19-35`.

**What it is now:** `data/policies.json:2` states the payer and every clause are synthetic,
`Patient` carries no payer, plan, member, benefit or effective-date field, and
`matchCoverage()` selects the first policy containing the drug, therefore `CoverageLine`
renders `COVERED` / `NOT-COVERED` / `PENDED` with a payer name, policy id, version and
clause id as though it were a determination for this patient, computed from no coverage
facts about this patient. The screen banner says "SYNTHETIC DATA — no real patient
information" (`app/page.tsx:89`), which scopes to patient data and does not label the payer.
`README.md:97` does label the file synthetic; the screen does not.

**What production requires:** patient-to-plan identification; benefit and effective-date
context; versioned payer-policy ingestion; deterministic clause applicability; provenance
and review status; and an explicit indeterminate state whenever any input is missing.

**What it blocks:** every coloured coverage badge, and any pitch sentence claiming Kestrel
determines whether the ordered therapy is covered. **Narrating it as a determination on
stage makes this CRITICAL again** — the same one-line fix prevents that.

**Phase:** unassigned. Phase 10 can ingest patient context; payer-policy ingestion and
adjudication need an explicit owner and currently have none.

**Register:** not registered.

**Smallest honest fix (today):** prepend *"DEMO — fictional payer; illustrative clause
match, not a coverage determination"* to the coverage line.

## G-10 · HIGH · The `FDA-labeled` badge asserts labeling; the evidence supports table inclusion

**Found by:** Sol (G-4). **Re-ranked from CRITICAL.**

**Where:** `data/fda-pgx.json:2-5`; `lib/pgx/fda.ts:55-89`;
`components/prescribe/AlertCard.tsx:150`; `components/prescribe/WhyDrawer.tsx:73-99`.

**What it is now:** `data/fda-pgx.json:2` identifies its source as the FDA Table of
Pharmacogenetic Associations and stores table rows, therefore the badge text `FDA-labeled`
asserts a stronger fact — that the association appears in approved labeling for this drug —
than the cached artifact establishes, which is that the pair appears in FDA's association
table. Mitigating and the reason this is not CRITICAL: the badge's `title` already reads
"FDA Table of Pharmacogenetic Associations", and `WhyDrawer` renders the verbatim row,
section, affected subgroups, `source_url`, `retrieved_at` and `via` one click away, so the
disclosure exists and nothing is fabricated. The defect is terminological, and "FDA-labeled"
is a term of art in exactly the audience this product targets.

**What production requires:** a separately captured, versioned labeling source and a
verified join to the applicable label section before the word "labeled" is used.

**What it blocks:** the badge, and any regulatory pitch that the displayed passage was
verified against current prescribing information.

**Phase:** 13 owns the terminology; the rename is available today.

**Register:** R-21 (the badge shows every row for the pair, including other subgroups) is
the adjacent registered item and is not restated here.

**Smallest honest fix (today):** rename the badge `FDA association table`, keeping the
existing source and retrieval disclosure.

## G-11 · HIGH · "No human control required." renders under a screening the system did not complete

**Found by:** Sol (G-6). **Re-ranked from CRITICAL** — the amber "screening incomplete" line
renders immediately above it on the same card, so the screen carries the limitation adjacent
to the overstatement.

**Where:** `lib/credibility.ts:12-23`; `app/api/prescribe/route.ts:101-120`;
`components/prescribe/CredibilityCard.tsx:31,46-71`; `REGISTER.md` R-26.

**What it is now:** `assess()` receives only `alert | null` and maps every null — missing
relevant genotype, unmatched lookup, conflict suppression — to `requiredControl: "auto"`,
rendered as "No human control required." (`CredibilityCard.tsx:31`), therefore for
pt_reyes + capecitabine the screen states that no human control is required directly below
an amber line saying DPYD was not assessed and screening is incomplete. The rationale is
procedurally true — it rates the *model's* influence, and no model output influenced
anything — and a skimming clinician reads it as permission to proceed.

**What production requires:** the assessment input must carry completeness and conflict
facts; a cited, versioned control framework; and a separate state for "the system made no
determination", distinct from "the system determined no control is needed".

**What it blocks:** the on-screen control recommendation, and any claim that the
FDA-framed credibility gate safely governs incomplete cases.

**Phase:** 10, with phase 13 owning the regulatory wording.

**Register:** R-26, OPEN and DELIBERATE, at an understated severity. See G-20.

**Smallest honest fix (today):** suppress the credibility card whenever screening is
incomplete or indeterminate, or relabel the conclusion *"No AI-generated recommendation to
review — see screening status above."* One line, and it belongs in the same edit as G-5.

## G-12 · HIGH · Clause tags render as compliance attestations — "preserved for the required retention period" is stamped on records held in process memory

**Found by:** Fable (G-4).

**Where:** `lib/ledger/clauses.ts:9,14-27`; `components/ledger/RecordRow.tsx:116`;
`lib/export/index.ts:35-42`.

**What it is now:** every `alert.overridden` record carries `ALCOA+:Enduring`
(`clauses.ts:9`) and the UI and the export render its label — *"preserved for the required
retention period"* (`clauses.ts:25`) — beside the record, while on Vercel that record lives
in one lambda's memory (G-7) and locally in a gitignored JSONL with no backup and no
retention policy. Likewise `21CFR11.10(e) — secure, computer-generated, time-stamped audit
trail` renders over a store that `POST /api/ledger/reset` empties without authentication
(G-4). The amber ephemeral badge names the storage medium but never retracts the per-record
retention claim, and it renders only when `ephemeral` is true.

**Arbitration of Fable's uncertainty #4** (do the tags read as "controls this record
satisfies" or "clauses this event type addresses"?): **they read as attestations.**
`CLAUSE_LABELS` renders a compliance sentence in the indicative, beside the record, with no
framing. The reader's reading is the one that counts, so the honest fix is the heading below.

**What production requires:** either the controls themselves — a retention policy on durable
storage, at which point the tags become true — or a rendering that presents the tags as
*citations of the applicable clause*, not attestations of compliance.

**What it blocks:** `README.md:139`'s "every record carries clause tags" is literally true;
what the screen adds — a compliance-worded label per record — is the overstatement. A
§11-literate reader takes the stronger reading.

**Phase:** 8 for real retention; the wording is available today.

**Register:** not registered.

**Smallest honest fix (today):** render the tag list under a five-word heading — *"clauses
addressed by this record type:"* — or suppress the `Enduring` label whenever `ephemeral` is
true.

## G-13 · HIGH · The export record is attributed to whoever happened to act last, not to whoever exported

**Found by:** Fable (G-9).

**Where:** `app/api/ledger/export/route.ts:9-13`.

**What it is now:** `const latestActor = readAll().at(-1)?.actor ?? { id: "kestrel_system"
… }` — the `export.generated` record borrows the previous record's actor, therefore the
ledger asserts that Dr. Chen generated the inspection package when the true generator is any
anonymous HTTP caller, or attributes the export to the automated policy-registry actor if
the last record happened to be `policy.revised`. The row renders that attribution on screen
(`RecordRow.tsx:114`) and in the exported HTML (`lib/export/index.ts:60`). Attribution by
adjacency is the defect class §11.10 attributability exists to prevent; in a single-actor
demo it is right by luck and becomes false the moment a second actor exists.

**What production requires:** the export record's actor is the authenticated exporter — or,
until identity exists, always the system actor and never a borrowed human.

**What it blocks:** the ALCOA+-attributable framing of the chain, from inside the chain.

**Phase:** 9 for the real fix; the one-line change is available now.

**Register:** not registered.

**Smallest honest fix (today, one line):** delete the borrow and use the `kestrel_system`
fallback unconditionally. Strictly more honest, no subsystem required.

## G-14 · HIGH · There is no patient or genotype ingestion boundary, and the whole patient file ships to every browser

**Found by:** Sol (G-8).

**Where:** `data/patients.json:2-74`; `app/page.tsx:1,19-23`. Absent ingestion endpoints
would live under `app/api/fhir/` or `app/api/cds-services/` with a server-side patient
repository.

**What it is now:** `app/page.tsx` is a client component that imports all four records from
`data/patients.json` and selects among them locally, therefore replacing the fixture with
real records would bundle the entire cohort to every client, and there is no
provenance-checked path from a lab, a FHIR Observation, an EHR, or any patient repository.
The synthetic-patient banner is honest, so nothing on screen overstates this.

**What production requires:** a server-side tenant/patient repository; minimum-necessary
queries; FHIR Genomics Reporting parsing; code-system validation; patient/result identity
binding; source organization and report identifiers; status and amendment handling;
provenance; access logging; and a quarantine state for unsupported or ambiguous
observations.

**What it blocks:** any real-patient deployment, PHI isolation, and any claim that a
patient's genotype is "already on file" in Kestrel rather than in a fixture.

**Phase:** 10, gated on G-6 covering the read paths first.

**Register:** not registered beyond R-3/R-4's scope acceptance.

**Smallest honest fix:** none — this is the subsystem. The banner already carries the honest
label.

## G-15 · HIGH · The CDS Hooks integration is documented as present and does not exist

**Found by:** Sol (G-9).

**Where:** absent `app/api/cds-services/` discovery, hook and feedback routes;
`data/cds-hooks-example.json:2`; `docs/INTEGRATION.md:3-6,45-75`; `REGISTER.md` R-15.

**What it is now:** no `app/api/cds-services/` route exists, while the fixture says it is
used by that endpoint and `docs/INTEGRATION.md:6` says "this system sits on all three"
integration surfaces, therefore the repository documents an implemented connection that is
absent. R-15's `STRETCH ONLY` classification was reasonable for a hackathon and understates
a production blocker.

**What production requires:** CDS Hooks discovery; an authenticated `order-sign` hook;
strict FHIR validation; prefetch and scoped-token handling; stable card ids; feedback
ingestion; idempotency; EHR conformance testing; and fail-safe timeout behaviour.

**What it blocks:** the pitch that an EHR can call Kestrel, and every hospital-integration
or workflow claim built on it.

**Phase:** 11.

**Register:** R-15, at an understated severity for production. See G-20.

**Smallest honest fix (today):** change `docs/INTEGRATION.md` and the fixture note to
*planned / not implemented*.

## G-16 · HIGH · Clinical and regulatory JSON is trusted through TypeScript assertions with no runtime validation

**Found by:** Sol (G-10).

**Where:** `lib/pgx/index.ts:38-52`; `lib/pgx/policy.ts:53-54`; `lib/pgx/fda.ts:39-50`.

**What it is now:** the CPIC and policy files are accepted by `JSON.parse(...) as ...` and
the FDA validation checks only that `associations` is an array, therefore a parseable but
stale, truncated, wrong-shaped or partially regenerated artifact loads successfully and can
silently remove alerts or render malformed evidence. This is R-6's defect class — a silent
data fault with no error and no warning — one layer up from the join keys `npm run verify`
guards.

**What production requires:** versioned runtime schemas; required-field, vocabulary, URL,
date and uniqueness checks; cross-file referential checks; signed or checksummed manifests;
source row counts and positive controls; atomic promotion only after validation; and a
visible unavailable state when validation fails.

**What it blocks:** a defensible claim that every rendered clinical or regulatory string
came from a complete, validated source artifact.

**Phase:** 10.

**Register:** R-6 is the closed instance of the same class; the structural gap is not
registered.

**Smallest honest fix:** none label-tier. `npm run verify` partially covers the join keys
and should be extended rather than replaced.

## G-17 · HIGH · The CPIC snapshot has no capture date, version or refresh pipeline, and the pipeline page says "today"

**Found by:** Sol (G-7). **Re-ranked from CRITICAL** — the snapshot's content is verbatim
and correct; the defect is currency and provenance, and the on-screen half is one word.

**Where:** `data/cpic/index.json:1-2`; `data/cpic/README.md:3-14,34-35`;
`app/pipeline/page.tsx:46`.

**What it is now:** `data/cpic/index.json` begins directly with drug buckets and carries no
capture time, upstream release, checksum manifest or refresh status, therefore
`app/pipeline/page.tsx:46`'s heading "Has a guideline today" cannot be supported by the
artifact behind it; the only date on that page is the separate Convoke capture date.

**What production requires:** an automated CPIC refresh pipeline; an immutable source
manifest; retrieval and effective dates; schema and content validation; change review;
rollback; and a visible stale-or-failed-refresh state.

**What it blocks:** the pipeline page's present-tense coverage claim, and any assertion that
prescribing uses current CPIC guidance.

**Phase:** 10.

**Register:** not registered.

**Smallest honest fix (today):** replace "today" with *"in the bundled CPIC snapshot
(capture date unavailable)"*.

## G-18 · HIGH · Raw genotypes and full model prompts are retained in the audit trail with no privacy, minimization or retention model

**Found by:** Sol (G-14).

**Where:** `lib/contracts.ts:230-239`; `lib/llm.ts:237-287`;
`app/api/prescribe/route.ts:63-85`.

**What it is now:** model provenance retains the exact prompt and raw output, and the
prescribe route appends the patient's entire results array to the ledger, therefore real
free-text orders and genotype data would be copied into the audit trail with no field-level
minimization, no purpose limitation, no retention or deletion policy, no legal-hold rules,
no tenant encryption and no PHI-aware redaction before the external model call.

**What production requires:** a data-flow inventory and threat model; minimum-necessary
event schemas; explicit PHI classification; encryption and tenant keying; access and audit
controls; retention and legal-hold rules **reconciled with the record-integrity obligation**
rather than traded against it; redaction before external model calls; provider data-use
controls; and incident response. Do not close this by silently dropping provenance — the
§11 requirement and the privacy requirement must be reconciled explicitly, and that
reconciliation is phase 13's document.

**What it blocks:** HIPAA-ready deployment, defensible model use with PHI, and the claim
that the audit trail is regulator-legible without creating an uncontrolled secondary
clinical record.

**Phase:** 13 defines it; 12 implements the controls.

**Register:** not registered.

**Smallest honest fix:** none label-tier; the standing constraint (synthetic patients only,
labelled on screen) is what currently keeps this from being live.

## G-19 · HIGH · No observability, no error tracking, no rate limiting anywhere — and the ledger silently changes its own durability class

**Found by:** Fable (G-10, ledger surface) and Sol (G-13, clinical surface).
**Arbitrated to HIGH**, Sol's band: the deployment is public and the clinical endpoint calls
a paid model with no limit.

**Where:** absent. Instrumentation would live in a logger wrapper under `lib/`, wired
through the API routes, plus an error tracker and per-route limits at the middleware layer.
Evidence: `grep -rn "console\." lib/ledger lib/export app/api/ledger app/api/evidence`
returns **nothing**; `package.json:18-33` contains no observability dependency;
`app/api/prescribe/route.ts:37-126` exports `POST` with no limit, no request-size cap and no
correlation id.

**What it is now:** a failed ledger write, a failed verification, a `tamper` invocation or
an export produces no server-side signal of any kind — errors are returned to the client and
exist nowhere else. The sharpest instance: `lib/ledger/store.ts:44-46` and `:138-142` catch
`EROFS`/`EACCES` and **silently migrate the audit trail to process memory**, an event that
changes the durability class of the ledger, with no record and no log — only a UI badge.
On the clinical side, an unauthenticated public endpoint (G-4, G-6) calls a paid model with
no per-IP or per-tenant limit.

**What production requires:** structured logs for every ledger mutation and verification;
alerting on `ephemeral` transitions, verify failures and lookup conflicts; error tracking
with PHI scrubbing; per-tenant/user/IP rate limits; body and field length limits; traces and
correlation ids; SLOs, dashboards and runbooks. For an audit product the operational bar is
unusually high: **a ledger whose own failures vanish silently defeats its purpose.**

**What it blocks:** nothing on screen lies; it blocks operating the product at all,
incident response, clinical quality monitoring, and any uptime or reliability claim. It also
bounds LLM spend on a public endpoint.

**Phase:** 12.

**Register:** not registered.

**Smallest honest fix (today):** one `console.error` in each silent catch in `store.ts`.

## G-20 · HIGH · Process finding — `REGISTER.md` does not carry the repo's highest-severity items, and understates three it does carry

**Found by:** both agents, as notes embedded in other entries. Consolidated here because a
register that under-rates its own worst item is a control failure, not a code defect, and it
is the reason two of this document's CRITICALs were invisible to the project's own tracking.

**Where:** `REGISTER.md` (R-1 … R-26); `BUILD_ORDER_V2.md:49-51`.

**What it is now:**

*Absent entirely.* `BUILD_ORDER_V2.md:49-51` calls the `lib/actors.ts` shim "the
highest-severity item in the repo" and **there is no R-entry for it** — `grep -n
"actors.ts\|PRESCRIBER\|dr_chen" REGISTER.md` returns only R-18, which closed the
*duplication* of the constant, therefore the item the build order names as worst is tracked
nowhere in the register (G-1). The same is true of G-2 (wire-controlled attribution), G-3
(deletion blindness), G-4 (live unauthenticated `tamper`), G-7 (non-durability), G-8
(unserialized append), G-12, G-13, G-19 and G-21.

*Understated by omission.* R-18's closure note states the mechanism — "the override
record's actor is posted by the client" — without flagging it as a gap, therefore the
register records the exact defect of G-2 as an implementation detail of a closed item.

*Understated in severity.* R-15 (`STRETCH ONLY`) against documentation that says the
integration exists (G-15); R-25 and R-26 (`OPEN, DELIBERATE`) against a rubric where what
the screen implies is the severity (G-5, G-11).

**What production requires:** the register is this project's substitute for a PR trail
(`CLAUDE.md`, adaptation 4), so rule 5 — anything surfaced and deliberately not fixed gets
written to the register in the same run — has to bind for *architectural* shims, not only
for defects found during a diff. A shim disclosed in a source comment is surfaced; if it
never reaches the register, the register reports a cleaner repo than exists.

**What it blocks:** nothing on screen. It blocks the register being usable as the project's
account of what is known-broken, which is the one thing it is for.

**Phase:** 7.5 — write the missing entries as part of the honesty pass, cross-referencing
this file rather than restating it.

**Smallest honest fix (today):** one R-entry per CRITICAL and HIGH above that has none,
each a single line pointing at `docs/PRODUCTION_GAP.md#g-n`.

---

# MEDIUM

## G-21 · MEDIUM · Secrets live in one `.env` with no rotation or per-tenant scoping, and the LLM provider strategy is two hardcoded keys

**Found by:** Sol (G-12, the provider half) and Fable (G-11, the infrastructure half) —
complementary halves of one shim, each explicitly deferring the other to its counterpart.
**Arbitrated to MEDIUM**, Fable's band: a single-tenant deployment works today with platform
env vars, and nothing on screen depends on it.

**Where:** `lib/llm.ts:41-50,121-181,218-232`; `.env` (741 B, mode `-rw-r--r--`) and
`.env.example` (mode `-rw-------`) at repo root — metadata observed, contents deliberately
unread by both agents and by me.

**What it is now:** `completeOpenAI()` retries a second process-wide OpenAI key after any
failure and `complete()` selects providers solely from environment-variable presence,
therefore authentication errors, invalid requests, outages and rate limits are all collapsed
into one unobserved credential retry with no tenant boundary, rotation, health state, retry
budget or policy control. All keys live in one gitignored dotenv consumed at process start,
and the real secrets file is world-readable at 644 while the example is locked to 600 — a
local-machine detail, and the right shape of wrong.

**What production requires:** keep the deterministic no-model path; move secrets to a
managed store (platform env vars at minimum, KMS-backed for per-tenant keys) with rotation
and least privilege; explicit tenant/provider policy; status-specific retry rules; bounded
backoff and circuit breaking; quotas; audit-safe key identifiers; health metrics; and tested
provider degradation. If the Bedrock branch is deliberately inert, say so in deployment
documentation and do not count it as redundancy.

**What it blocks:** a production reliability or security claim for model-assisted
resolution, and multi-tenant deployment. It does not block the deterministic clinical core,
and the UI's `via model` label does not overstate which path ran.

**Phase:** 12.

**Register:** not registered.

**Smallest honest fix (today):** `chmod 600 .env`, one command. The rest is phase 12.

## G-22 · MEDIUM · The production deployment is not declared anywhere in the repository

**Found by:** neither agent — it comes from production fact F-1, and it is the reason
Fable's audit had to reason about Vercel from `store.ts` rather than observe it.

**Where:** absent. There is no `vercel.json`, no `Dockerfile`, no committed `.vercel/`
directory. The deployment was located via `gh api repos/Ranj04/kestrel --jq '.homepage'`.

**What it is now:** `https://kestrel-olive.vercel.app` serves `GET / -> 200` and is
referenced by no deployment configuration in the repository, therefore **the audit could not
reason about a production surface the codebase does not describe**, and two of this
document's severities (G-4, G-7) had to be settled by probing rather than by reading. A
deployment that no file in the repo declares is a deployment no reviewer can be expected to
audit.

**What production requires:** the deployment target, its environment variables, its build
command and its access posture declared in-repo and reviewed like code; environment parity
documented; and a documented answer to which commit is live.

**What it blocks:** nothing on screen. It blocks any claim that reviewing this repository
tells you what is running.

**Phase:** 12.

**Register:** not registered.

**Smallest honest fix (today):** a `vercel.json` (or a ten-line `docs/DEPLOY.md`) naming the
project, the URL, and the required environment variables.

## G-23 · MEDIUM · A two-entry demo alias map is rendered as "matched exact"

**Found by:** Sol (G-3). **Re-ranked from CRITICAL** — reason in the arbitration table.

**Where:** `lib/pgx/resolve.ts:14-17,44-50`; `components/prescribe/OrderForm.tsx:13,57-66`.

**What it is now:** `BRAND_MAP` contains exactly `xeloda` and `adrucil`
(`resolve.ts:15-16`), and step 1 returns `method: "exact"` after substituting through it,
therefore the UI renders `Xeloda → capecitabine · matched exact` for an input that did not
match a CPIC key and was resolved by an undisclosed two-entry demo dictionary. The
substitution is correct for both brands and no clinical output depends on the word.

**What production requires:** coded medication input where available; a versioned
RxNorm/terminology service for brands, ingredients, combinations and spelling variants;
ambiguity handling that requires confirmation; and provenance identifying the terminology
version used.

**What it blocks:** the visible resolution proof, and any pitch that free-text medication
normalization works beyond the two staged brands. The code does not make that claim; a
narrator can.

**Phase:** 10.

**Register:** not registered.

**Smallest honest fix (today, one word):** render `matched demo alias` for that branch.

## G-24 · MEDIUM · The FDA scraper writes provenance text that can contradict its own retrieval route

**Found by:** Sol (G-15).

**Where:** `scripts/scrape-fda.ts:90-119,138-150`.

**What it is now:** `--direct` correctly sets `via: "direct"` while the emitted `note`
always says the table was scraped "via Bright Data", therefore a direct refresh produces a
self-contradictory evidence artifact. It does not currently overstate anything on screen,
because `WhyDrawer` renders the `via` field rather than the note.

**What production requires:** derive the note from `via`, or drop the transport claim from
the note; and have the refresh job emit an immutable retrieval manifest with parser version,
content hash, validation counts and promotion status.

**What it blocks:** machine-readable scrape provenance being trustworthy on its face.

**Phase:** 10.

**Register:** R-20 is the adjacent closed item (Bright Data zones).

**Smallest honest fix (today):** one string interpolation.

## G-25 · MEDIUM · The scraped Aetna clauses are truncated mid-word and labelled "Verbatim"

**Found by:** Sol filed this as a flagged uncertainty rather than an entry, because it could
not tell whether the truncation was a deliberate excerpt or a capture bug. **The evidence
resolves it, so I am promoting it to an entry.**

**Where:** `data/payer-policies-scraped.json:13,22`; `README.md:95`.

**What it is now:** clause `AETNA-0715.dpyd-testing` ends `"…Epidermal growth factor recep"`
and `AETNA-0715.cpt-81232` ends `"…Other CPT codes related to the"`, therefore both cuts land
mid-word **and pull in adjacent unrelated content** (an EGFR sentence has nothing to do with
DPYD testing), which is the signature of a fixed-length capture window rather than a chosen
excerpt. Both entries carry a `note` beginning "Verbatim", and `README.md:95` lists the file
as **Real**, scraped via Bright Data. The file is not wired to the live determination path.

**What production requires:** re-capture with a source locator proving the excerpt
boundaries, or an explicit `truncated: true` and a character offset. **The file must not be
promoted into the determination path until that is answered** — this project's standing
constraint is that policy language is verbatim or absent, and a truncated string labelled
verbatim is neither.

**What it blocks:** `README.md:95`'s "Real, scraped" claim for this file, if anyone reads the
clause text as a complete quotation.

**Phase:** 10, alongside G-9's payer-policy ingestion owner.

**Register:** not registered.

**Smallest honest fix (today):** change the `note` to say the passage is a truncated capture,
not verbatim.

---

# LOW

## G-26 · LOW · The staleness-token fix holds; the residual is that `actionInFlight` is a boolean, not a token

**Found by:** Fable (G-12), verifying the fix for a severity-1 it raised itself in phase 6.

**Where:** `components/ledger/index.tsx:129,131-147,186-301`.

**What it is now:** all five action handlers call `beginAction()`, which invalidates
outstanding tokens and clears `verification`, and every state application is guarded by
`isCurrentLedgerRequest(...)`, therefore no handler and no poll can repaint a verification it
did not just receive — pinned three ways at `tests/ledger.test.ts:306`, `:340` and `:507`.
**The fix holds.** The residual: `actionInFlight` is a single boolean reset by whichever
action finishes first, so a double-dispatch in the gap before React re-renders `disabled`
can overlap two actions. Traced failure mode: the second action's result is *dropped*, never
a stale green, and the one-second poll corrects the missed repaint.

**What production requires:** token-scope the in-flight guard if the window is ever observed.

**What it blocks:** nothing. Recorded so the residual is a written limitation rather than a
future discovery.

**Phase:** unassigned. **Register:** the fix landed with the R-24–R-26 batch; the residual is
new here.

## G-27 · LOW · `check-removals.sh` counts substring token matches, so a removed `it(` can be masked by an added `limit(`

**Found by:** Fable (G-13). Filed LOW, kept LOW, and worth reading anyway: this is a **gate
instrument**, and rule 4a-bis holds instruments to the same standard as fixtures.

**Where:** `scripts/check-removals.sh:18,44,69-76`.

**What it is now:** `count()` uses `grep -oF "$t"` over a token list including bare `it(`,
`test(` and `assert(`, therefore any identifier ending in those strings (`limit(`, `unit(`,
`splitTest(`) counts as a token and a real removal can net to zero against a coincidental
addition in the same file — the checker compares totals, not sites. The `--prove` control
(R-7/R-8) exercises only the `assert.` path and does not cover the masking shape.
Word-splitting on `$changed` (line 58) is safe today only because no test filename contains a
space — in the one repo whose *root path* contains one.

**What production requires:** anchored matches (`grep -oE '(^|[^A-Za-z0-9_])it\('`-style) or
per-site diffing, plus a `--prove` case for the masking shape.

**What it blocks:** nothing on screen. It weakens one of the five gates in `CLAUDE.md`'s
definition of done — the same class as R-17's false-green lint.

**Phase:** unassigned. **Register:** R-7/R-8 closed different defects in this script; this
mode is new.

---

## Open questions — resolved and still open

**Resolved by the production facts or by the code, and closed here:**

| Question | Resolution |
|---|---|
| Fable #3 — is the deployed Vercel link live and public right now? | **Yes.** `GET / -> 200`; `reset` and `tamper` answer 405, not 404. G-4 is a present exposure, not a deployment hypothesis, and was upgraded HIGH → CRITICAL on this. |
| Fable #5 — was `.sol/reviews/phase7-production-facts.md` input for the audit? | **Yes**, authored by Claude Code, not by Sol. Fable's decision to leave it unread was correct on the information it had — independence beats curiosity — and the file is folded into this merge, so nothing was lost. |
| Fable #4 — do the clause tags read as attestations or as citations? | **Attestations.** Arbitrated in G-12: the label is a compliance sentence in the indicative, rendered beside the record with no framing, and the reader's reading is the one that counts. |
| Sol — are the Aetna clause excerpts deliberate or a truncating capture bug? | **A capture bug.** Both cuts land mid-word and pull in adjacent unrelated content. Promoted to G-25. |

**Still open, and they are Ranjiv's to answer:**

1. **Is `/pipeline` a maintained production capability or a sponsor/demo artifact?** Sol
   could not tell, and the answer changes whether G-17 needs a refresh owner or just the
   one-word label. **My recommendation:** it is a demo artifact — it exists to show the
   Convoke retrieval — so take the label and do not staff a refresh pipeline for it. Confirm
   or overrule, because phase 10's scope depends on it.
2. **Which commit is live on `kestrel-olive.vercel.app`?** (production fact F-4, unresolved).
   The phase-6 fixes landed as `06f055c` minutes before the audit opened and it could not be
   established from outside whether the deployment serves them. Both G-4 and G-7 are
   structural and present in `06f055c` either way, so the findings stand; the unknown is only
   which build exhibited them. `vercel ls` or the dashboard settles it in a minute — and
   G-22 is the reason the question exists at all.
3. **`restoreRevisionState`'s `verify(records).ok` gate** (`lib/ledger/snapshot.ts:190`):
   deliberate distrust of a broken chain, or an accident with the traced
   SUPERSEDED-becomes-VALID-after-restart consequence in G-7? Defensible either way, and only
   Sol knows the intent. **Ask Sol** — and note that the consequence is real regardless, so
   phase 8 must define the reconstruction rule explicitly rather than inherit this one.
4. **`verify(records?)` always calling `readState()`** even when an explicit chain is passed
   (`lib/ledger/verify.ts:50-51`, commented "Always touch current storage on this call"):
   presumably to trigger the ephemeral-migration init before verifying, but nothing documents
   what depends on the side effect. **Ask Sol.**
5. **Was `FDA-labeled` intended as shorthand for table inclusion?** (Sol's question in G-10.)
   If yes it is a naming decision to record; if no it is a terminology defect. Either way the
   badge gets renamed — this only decides whether an R-entry says "decided" or "fixed".

---

## Phase 7.5 — the honesty pass. One short day, all label-tier, and it ships before any subsystem

Both agents converged on this independently in different words, and it is the single
highest-value item in this document: **every CRITICAL here except the arithmetic of G-3 and
the contract of G-2 has a mitigation available today that costs one line.**

| # | Change | Where | Closes |
|---|---|---|---|
| 1 | `if (!process.env.DEMO_MODE) return 404` on `reset` and `tamper` | `app/api/ledger/{reset,tamper}/route.ts` | G-4 — the live exposure, first |
| 2 | *"DEMO — unauthenticated signature; the signer is a fixture"* on the modal, the export signature block, and the override row | `components/ledger/SignatureModal.tsx`, `lib/export/index.ts`, `components/ledger/RecordRow.tsx` | G-1 CRITICAL → LOW |
| 3 | Accept an actor **id** only and resolve through `actorFor()` | `app/api/ledger/{override,accept}/route.ts` | G-2, partially, without auth |
| 4 | *"records present are internally consistent; completeness requires the anchored head"* | `components/ledger/ChainStatus.tsx`, export README | G-3 CRITICAL → LOW |
| 5 | Label results *"highest-severity finding only; not an exhaustive screen"*; render suppressed conflicts amber | `components/prescribe/AlertCard.tsx` | G-5 |
| 6 | Suppress the credibility card when screening is incomplete | `components/prescribe/CredibilityCard.tsx` | G-11 |
| 7 | *"DEMO — fictional payer; not a coverage determination"* | `components/prescribe/CoverageLine.tsx` | G-9 |
| 8 | Rename the badge `FDA association table` | `components/prescribe/AlertCard.tsx`, `WhyDrawer.tsx` | G-10 |
| 9 | Drop the borrowed actor; always `kestrel_system` | `app/api/ledger/export/route.ts` | G-13 |
| 10 | Clause list under *"clauses addressed by this record type:"* | `components/ledger/RecordRow.tsx`, `lib/export/index.ts` | G-12 |
| 11 | Badge: *"DEMO: in-memory, per-instance ledger — not durable"* | `components/ledger/ChainStatus.tsx` | G-7 |
| 12 | `matched demo alias`; "in the bundled CPIC snapshot" | `OrderForm.tsx`, `app/pipeline/page.tsx` | G-23, G-17 |
| 13 | `docs/INTEGRATION.md` → *planned / not implemented*; Aetna note → *truncated capture* | docs + `data/payer-policies-scraped.json` | G-15, G-25 |
| 14 | `chmod 600 .env`; one `console.error` in each silent catch in `store.ts`; the missing R-entries | repo | G-21, G-19, G-20 |

Nothing in that table collides with the phase 8 diff, and rows 1–4 alone convert three
CRITICALs and remove a live exposure.

---

## RECOMMENDED ORDER for phases 8–13

Three orderings were on the table and they disagree. I am picking one, not averaging.

```
7.5  honesty pass        (new — half a day, all label-tier)
8    persistence         Sol      — widened: atomic head, external anchoring, revision state
9    identity & authz    Fable + Sol (split ownership)
10   genotype ingestion  Fable    — gated on 9 covering the read paths
12   production hardening Both
11   CDS Hooks           Fable
13   regulatory posture  Opus 5
```

**Phase 7.5 is new, and it goes first.** Adopted from Fable, widened with Sol's label-tier
fixes and with the `reset`/`tamper` gate promoted out of phase 12 on production fact F-2.
Reason: **every CRITICAL in this document is a claim defect**, and claim defects are closed
by labels in hours, not by subsystems in weeks. Deferring them to the phase that eventually
builds the subsystem means shipping a false claim for the intervening weeks in exchange for
nothing. `BUILD_ORDER_V2` has no equivalent, and its plan leaves a live, unauthenticated
`tamper` endpoint standing on a public URL through five phases.

**8 before 9 — `BUILD_ORDER_V2` and Fable win, Sol loses, and Sol's argument survives as a
constraint on 8.** Sol argued identity first, because actor and tenant semantics shape the
persistence schema. That is a real argument and it is why phase 8's spec must be written
against phase 9's identity model — subject id, tenant id, signature-ceremony record — even
though phase 9 builds afterwards. It is not enough to reorder for, because: the durable-store
gap is the one confirmed *absent in production* (`ephemeral: true`, 0 records); G-3 and G-8
are schema-shaping and cannot be retrofitted cheaply; and an auth system whose sessions and
access log have nowhere durable to write is not testable. An actor column is one foreign key;
a serialized head and an anchoring scheme are the shape of the store.

**Phase 8's spec is widened by this audit and must not be read as "swap JSONL for
Postgres"** — that would close G-7 and leave G-3 and G-8 open. It must require: (a) atomic
append with a serialized head (G-8) — a contended resource, not a computed value;
(b) **external head anchoring** (G-3), because a table's tail deletes as quietly as a file's
and durability alone cannot close a completeness claim; (c) revision and overlay state in the
same store as the records (G-7), so a second process reconstructs the same world.

**9 with a corrected ownership boundary.** `BUILD_ORDER_V2` lists phase 9 as Fable-owned, and
G-2 shows the routes that must stop accepting identity from the wire are **Sol-owned**
(`app/api/ledger/override`, `accept`, and G-13's export attribution). The phase 9 spec must
split it: Fable builds sessions and signer resolution, Sol changes the ledger API contract to
resolve actors server-side. Written down now so it does not surface mid-phase as an ownership
violation. Adopted from Fable.

**10 then hardening, with a hard precondition.** Phase 10 must not land before phase 9 covers
the anonymous **read** paths (G-6): ingesting one real genotype before then converts an
architecture gap into a PHI breach. Adopted from Fable.

**12 before 11 — Sol wins, Fable and `BUILD_ORDER_V2` lose.** Phase 11 is the only phase
whose consumers are third parties: publishing a CDS Hooks endpoint creates an externally
relied-on contract, and exposing it before rate limiting, observability and demo-endpoint
removal exist would repeat exactly the defect this audit found in production (F-2: a public
surface with no gate). `BUILD_ORDER_V2`'s reason for putting 12 last — "removing before the
replacements exist breaks the demo you still need" — is sound for the *removals*, and by the
time 8, 9 and 10 have landed the replacements do exist; it was never sound for the *gating*,
which costs two lines, preserves the demo behind a flag, and is already pulled into 7.5.

**13 last — Fable wins, Sol loses, and Sol's kernel is salvaged into 7.5.** Sol argued
regulatory posture first, so that intended use, prohibited claims and §11 applicability are
settled before they harden into schemas. The useful half of that argument is the
prohibited-claims list — what Kestrel must not say: "FDA-labeled", "coverage determination",
"§11-compliant signature", "chain intact" — and that half is phase 7.5, which I have adopted
and moved to the front. The other half, written before the subsystems exist, would produce a
regulatory document about a product that does not exist. Phase 13 goes last and is fed by
this file: G-1 through G-4, G-12 and G-18 are its raw material, because the delta between
what §11.10(d) access controls, §11.200 signature components and retention actually require
and what this codebase does is exactly what this audit measured.

---

*Phase 7 closed by Opus 5. Sol audited Fable's territory, Fable audited Sol's, Claude Code
supplied the production facts neither could reach, and no party certified its own work.*
