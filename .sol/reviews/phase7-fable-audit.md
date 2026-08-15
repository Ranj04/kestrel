# Phase 7 mock audit — Fable's half: Sol's territory

**Auditor:** Fable 5. **Tree audited:** `06f055cb812ac0094c269421baac4487e3abe70d` (phase 6 close), walked file by file — not from memory of an earlier tree.
**No source file was modified this run.** Two read-only instruments were executed: a scratchpad
chain probe against `lib/ledger/{hash,verify}.ts` (output quoted in G-3) and `npx eslint .`
(exit 0, instrument previously proven able to fail — R-17 closure).

Entry format is the mandatory five fields from `phase7-audit.md`, plus two uniform extra
fields — **Register:** (question 2) and **Smallest honest fix:** (question 3) — identical in
every entry so the merge with Sol's file stays mechanical.

---

## Coverage — what I did NOT audit, and why

- **Fable-owned files** — `lib/pgx/`, `lib/contracts.ts` (as an engine), `lib/credibility.ts`,
  `lib/llm.ts` (including the two-key 429 shim, starting point 12), `app/api/prescribe/`,
  `components/prescribe/`, `app/page.tsx`, `app/pipeline/`, and the `data/` clinical files
  (`cpic/index.json` staleness, `patients.json`, `policies.json`, `resolve.ts` brand map —
  starting points 2, 3, 4, 9). I wrote that half; Sol is auditing it now. I read
  `contracts.ts`, `page.tsx:21,59,89,187`, and `app/api/prescribe/route.ts:57` **only** as
  evidence of how Fable's half wires into Sol's surface, never as audit subjects.
- **`.sol/reviews/phase7-sol-audit.md`** — forbidden, and not opened. Also present untracked:
  `.sol/reviews/phase7-production-facts.md`, which appeared in the tree and which I **left
  unread** because I could not rule out it being Sol's phase-7 output; independence beats
  curiosity. Flagged for Opus 5 — if it was input intended for me, this audit ran without it.
- **`.env` contents** — secrets; observed only `ls -la` metadata (see G-11).
- **The deployed Vercel instance** — not visited; every Vercel-context claim below is reasoned
  from `store.ts`/`state.ts` + `README.md:124-128` and is stated as reasoning, not observation.
- **`npm test` was not run this session.** Claims about tests come from reading test source
  (`tests/ledger.test.ts`, `tests/hash.test.ts`); the only executed checks are the two named above.
- **`scripts/cache_cpic.py`, `scripts/verify-setup.mjs`, `scripts/scrape-fda.ts`** — clinical-data
  instruments on Fable's side of the split; Sol's to audit. I audited `scripts/tamper.ts` and
  `scripts/check-removals.sh` (G-13).
- **Root config** (`package.json`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`) —
  audited; no entry warranted. `next.config.ts` documents its deliberately-uninstalled Bedrock
  external; `eslint.config.mjs` scoping matches R-17's closure; lint exits 0 having linted.

---

# CRITICAL

## G-1 · CRITICAL · The §11.50 signature manifestation renders with no identity system behind it and no on-screen demo label

**Where:** `lib/actors.ts:17-23`; `components/ledger/SignatureModal.tsx:91,103,121-122`;
`app/page.tsx:187`; `lib/export/index.ts:44-55`
**What it is now:** `app/page.tsx:187` hands Sol's `SignatureModal` the actor via
`actor={PRESCRIBER}`, and `PRESCRIBER` is a module-level constant in `lib/actors.ts:23`,
therefore every signature in the chain is attributed to the same fictional person regardless
of who is using the app. The modal renders `21 CFR PART 11 SIGNATURE` (SignatureModal.tsx:91),
an **editable free-text** printed-name input prefilled "Dr. Chen" (:103), and a live clock
labelled "set by the ledger on submit" (:121-122). The export's signature block
(`lib/export/index.ts:44-55`) renders the same manifestation into the inspection package.
`lib/actors.ts:17-18` labels itself "DEMO SHIM" — in a source comment, which is not a label
on screen: nothing in the modal, the record rows, or the exported HTML says demo or
unauthenticated. The page banner (`app/page.tsx:89`) labels the **patients** synthetic, not
the signer.
**What production requires:** authentication (session → signer resolution), signature
re-authentication at the moment of signing (§11.200(a) two-component first-signing), and a
printed name that is **derived from the authenticated identity, never typed**.
**What it blocks:** the pitch's central claim — "captured as a **signed** … record". The
screen presents a full §11.50 manifestation; the backend supports none of it. This is
`phase7-audit.md`'s own live example of an unsupported claim, worse than absence.
**Phase:** 9.
**Register:** not in `REGISTER.md`. R-18 closed the *duplication* of the constant, not the
shim itself — the item `BUILD_ORDER_V2.md` calls "the highest-severity item in the repo" has
**no register entry**, which is itself a rule-5 process finding: surfaced (the source comment
exists) and not fixed, but never written to the register.
**Smallest honest fix:** one line in the modal and one in the export signature block —
*"DEMO — unauthenticated signature; signer is a fixture"*. Turns this CRITICAL into a LOW
today, against an auth system available in weeks. The same line belongs in
`RecordRow`'s override rendering.

## G-2 · CRITICAL · Ledger attribution is client-supplied: the write routes accept the whole actor object from the request body

**Where:** `app/api/ledger/override/route.ts:14-18,45-50`; `app/api/ledger/accept/route.ts:4-8,18-28`;
contrast `lib/actors.ts:27-29`
**What it is now:** `isActor()` checks only that `id`, `name`, `role` are strings, and the
route passes `body.actor` straight into `recordOverride`/`recordAcceptance`, therefore the
strongest attribution statement in the chain — the signed override — is whatever identity the
HTTP client chose to send. `curl` can write a record attributed to any name and role.
`actorFor()` (`lib/actors.ts:27-29`) exists precisely to resolve an id to a controlled actor,
and the prescribe route uses it (`app/api/prescribe/route.ts:57`); the ledger write routes
bypass it — the capability is present and the wiring absent, rule 4a-quater's exact shape.
Note the tell: the project's own test fixture posts a *different spelling* of the same person
(`tests/ledger.test.ts:35-39` — "Dr. Maya Chen" / "Attending Oncology" vs `lib/actors.ts`'s
"Dr. Chen" / "Attending, Oncology"), which is what identity-as-data does.
**What production requires:** the API contract must not take identity as input. Actor is
resolved server-side from the authenticated session; the request carries at most a signature
re-authentication proof. This is a **contract change to Sol-owned routes** that phase 9
(listed as Fable-owned) cannot make alone — the phase 9 spec must name it explicitly or the
auth system will be bolted onto an API that still trusts the wire.
**What it blocks:** every record row on screen renders `ALCOA+:Attributable — attributable to
the person responsible` (`components/ledger/RecordRow.tsx:116`, labels from
`lib/ledger/clauses.ts:20`) over an attribution the wire controls. Distinct from G-1: fix
auth and leave this contract, and attribution is still client-controlled.
**Phase:** 9 (spec must assign the route change to Sol).
**Register:** not in `REGISTER.md`. R-18's closure note ("the override record's is posted by
the client") states the mechanism without flagging it as a gap — an understatement by
omission.
**Smallest honest fix:** available today without auth — accept only an actor **id** and
resolve through `actorFor()`, so at least the wire cannot choose the display name and role of
a known id. Honest, one declaration, and it shrinks the phase-9 diff.

## G-3 · CRITICAL · "Chain intact ✓" proves integrity of what is present, not completeness of what was recorded — erasure and tail-truncation verify clean, and no surface states the limitation

**Where:** `lib/ledger/verify.ts:10-47`; `components/ledger/ChainStatus.tsx:66-68`;
`lib/export/index.ts:164-181`
**What it is now:** `verifyState()` checks each record's `prevHash` linkage and recomputed
hash from genesis forward and nothing else, therefore a chain with its tail deleted — or the
whole file emptied — has no mismatch to find and verifies `ok: true`. Demonstrated this run
with a read-only in-memory probe (positive and negative controls included, rule 4a-bis):

```
full chain        : {"ok":true,"total":3}
tail truncated    : {"ok":true,"total":2}     <- deletion is invisible
middle tampered   : {"ok":false,"firstBrokenSeq":1}   <- verify CAN fail
empty chain       : {"ok":true,"total":0}     <- erasure verifies clean
```

The live instance confirms the empty case: `GET /api/ledger` on the running dev server
returned `records: 0, verify.ok: true`. The UI renders this as
`N records · chain intact ✓` (`ChainStatus.tsx:66-68`), and the inspection package's
`README.txt` tells a regulator "The first mismatch and every record after it are not
trustworthy" (`lib/export/index.ts:176-177`) — implying everything before a mismatch **is**
trustworthy, with no step that could detect a shortened chain and no external anchor to check
it against.
**What production requires:** an external anchoring mechanism — periodic head-hash
publication to a store the app cannot rewrite (WORM bucket, transparency log, a counterparty
countersign), plus expected-count/anchor verification steps in the export procedure.
Persistence alone (a Postgres table) does **not** close this: a DBA's `DELETE` from the tail
still verifies clean.
**What it blocks:** the pitch claim "cannot be quietly altered afterwards" and README:65 "Any
audit system can tell you *whether a record was altered*". Alteration-in-place is genuinely
detected (the demo is honest about what it demos); removal is not, and removal is the quieter
attack. The green check on screen implies a guarantee the math does not provide.
**Phase:** 8 (anchoring belongs in the persistence spec) + 13 (the honest wording).
**Register:** not in `REGISTER.md`.
**Smallest honest fix:** wording — on screen and in the export README, "chain intact" becomes
*"records present are internally consistent; completeness requires the anchored head"* (or
plainly: *"cannot detect deletion of trailing records"*). One sentence in each place, honest
today.

---

# HIGH

## G-4 · HIGH · Clause tags render as attestations — "preserved for the required retention period" is stamped on records held in process memory

**Where:** `lib/ledger/clauses.ts:9,14-27`; `components/ledger/RecordRow.tsx:116`;
`lib/export/index.ts:35-42`
**What it is now:** every `alert.overridden` record carries `ALCOA+:Enduring`, and the UI and
export render its label "preserved for the required retention period" beside the record —
while on Vercel the record lives in one lambda instance's memory (`store.ts:33-47`) and
locally in a **gitignored** JSONL (`.gitignore:11`) with no backup or retention policy.
Likewise `21CFR11.10(e) — secure … audit trail` renders over a store that
`POST /api/ledger/reset` empties without authentication. The amber badge
("in-memory ledger — file storage unavailable", `ChainStatus.tsx:73-75`) names the storage
medium but never retracts the per-record retention claim, and it renders only when
`ephemeral` is true.
**What production requires:** either the controls (retention policy on durable storage — then
the tags are true) or a rendering that presents tags as *citations of the applicable clause*,
not attestations of compliance.
**What it blocks:** the README:139 claim "every record carries clause tags" is literally true;
what the screen adds — the compliance-worded label per record — is the overstatement. Kept
out of CRITICAL only because the amber badge and the SYNTHETIC banner partially frame it;
a §11-literate reader still takes the stronger reading.
**Phase:** 8 (real retention) / today (wording).
**Register:** not in `REGISTER.md`.
**Smallest honest fix:** render the tag list under a five-word heading — *"clauses addressed
by this record type:"* — or suppress the `Enduring` label whenever `ephemeral` is true.

## G-5 · HIGH · The ledger is non-durable and, on serverless, non-singular — three files hold module-level state, so each instance carries its own chain and its own revision overlay

**Where:** `lib/ledger/state.ts:3-4`; `lib/ledger/store.ts:21,33-47`;
`lib/ledger/snapshot.ts:50-51,158-232`; `README.md:124-128`
**What it is now:** `memoryRecords` (`state.ts:4`), `activeRevision`/`publishedResult`
(`snapshot.ts:50-51`), and the pgx overlays installed by `installOverlays()` are all
module-level, therefore on Vercel every serverless instance holds an independent chain and an
independent view of whether a policy revision is active — the README admits the record count
"visibly flickers between requests". Nothing survives a restart. A traced consequence that is
worse than flicker: `restoreRevisionState` (`snapshot.ts:191`) refuses to restore when
`verify(records).ok` is false, so after *publish revision → tamper → process restart*, the
capecitabine authorization that the ledger says was superseded renders **VALID**
(`snapshot.ts:325-334`: overlays absent → `currentHash` equals `boundTo.entryHash` →
`hashChanged` false), and the SIMULATED-revision banner disappears — while the
`policy.revised` record still sits in the chain.
**What production requires:** one durable, shared, transactional store (the phase 8 database)
holding records **and** revision state, so that any process — including a second, independent
verifier — reads the same chain; state reconstruction rules defined for the broken-chain case
rather than emergent.
**What it blocks:** "Does the chain survive a restart, and can a second process verify it?" —
phase 8's own question; today both answers are no. On screen the amber badge says "file
storage unavailable", which reads as an infrastructure hiccup, not "this audit trail is one of
several and evaporates" — an understatement, though README:124 is honest.
**Phase:** 8.
**Register:** not in `REGISTER.md` (README and BUILD_ORDER carry it; the register does not).
**Smallest honest fix:** badge wording — *"DEMO: in-memory, per-instance ledger — not
durable"*.

## G-6 · HIGH · append() is an unserialized read-modify-write — two concurrent orders can fork the chain and paint a false "CHAIN BROKEN"

**Where:** `lib/ledger/store.ts:101-145`
**What it is now:** `append()` reads the whole state, derives `seq` and `prevHash` from the
tail, then `appendFileSync`s — with no lock, transaction, or retry — therefore two
overlapping requests can both read tail N and write two records with the same `seq` and the
same `prevHash`, after which `verify()` honestly reports the second as broken. The chain goes
red from clean concurrent use, indistinguishable on screen from tampering — CLAUDE.md names
"a clean chain that verifies broken" as one of the two demo-killing defects. Single-user demo
traffic never hits it; the 1-second poll plus one writer is why it has not been seen.
**What production requires:** atomic append with a serialized head — a DB transaction taking
the tail under lock (`SELECT … FOR UPDATE` or an advisory lock), or a single-writer queue.
This is a **schema-shaping requirement**: phase 8's design must make the head a contended,
serialized resource, not a computed value.
**What it blocks:** nothing on screen lies today; real deployment with >1 concurrent user is
impossible without it.
**Phase:** 8.
**Register:** not in `REGISTER.md`.
**Smallest honest fix:** none smaller than the real one; interim honesty is a comment plus a
single-flight guard in the route, and the entry exists so phase 8's spec inherits it.

## G-7 · HIGH · `reset` and `tamper` are unauthenticated mutation endpoints against the audit chain, in the production build with no gate of any kind

**Where:** `app/api/ledger/reset/route.ts:3-14`; `app/api/ledger/tamper/route.ts:3-12`;
also `app/api/evidence/supersede/route.ts:12-36` (canned demo action, same exposure class)
**What it is now:** both are plain exported `POST` handlers; the only `process.env` read in
the entire Sol surface is the storage switch (`store.ts:35`), therefore nothing —
`NODE_ENV`, a flag, middleware (none exists), auth (none exists) — distinguishes a production
build from a demo build, and any internet client can erase the audit trail
(`reset` → `verify` then reports `ok:true` on the emptied chain, per G-3's probe) or corrupt
a signed override in place (`tamper` targets the latest `alert.overridden` by preference,
`lib/ledger/tamper.ts:113-117`). In a deployed context these are not demo affordances; they
are an unauthenticated destruction-and-forgery API on the product's core artifact. README:124
says "Demo locally, not on the deployed link" — which implies a deployed link exists and is
reachable now.
**What production requires:** the endpoints do not exist in a production build (build-time
exclusion or explicit `DEMO_MODE` gate that production refuses to set), and the demo keeps
them behind the flag.
**What it blocks:** on the demo screen nothing lies — the buttons say "Reset demo" and
"Tamper a record" (`ChainStatus.tsx:83,106`). HIGH rather than CRITICAL for exactly that
reason; it is the first item that must not ship, and it should not wait for phase 12 (see
recommended order).
**Phase:** 12, with the gate pulled forward to now.
**Register:** not in `REGISTER.md`; named in `BUILD_ORDER_V2.md`.
**Smallest honest fix:** a two-line env gate (`if (!process.env.DEMO_MODE) return 404`) on
both routes, today, ahead of the real removal.

## G-8 · HIGH · No auth, no sessions, no roles, no tenancy — every ledger read and write is anonymous (absent)

**Where:** absent. Would live in a `middleware.ts` (none exists — verified), a session layer,
and per-route authorization in `app/api/ledger/*` and `app/api/evidence/*`.
**What it is now:** `GET /api/ledger` (`app/api/ledger/route.ts:11-20`) returns every record
wholesale — genotype payloads, diplotypes, override rationales — to any caller;
`POST /api/ledger/export` hands the same corpus out as a ZIP and *also appends a record while
doing it*; the write routes are covered by G-2/G-7. Today the data is synthetic and the
screen says so (`app/page.tsx:89`), therefore nothing on screen lies — but the moment
phase 10 ingests a real genotype, the anonymous read path is a PHI breach, not a gap.
**What production requires:** authn (sessions), authz (roles: prescriber, auditor, admin —
read and write are different rights on an audit ledger), tenancy boundaries per institution,
and audit-of-access (who read the ledger is itself §11-relevant).
**What it blocks:** ordering constraint more than a current claim: phase 10 and 11 **must
not** land before this covers the read paths.
**Phase:** 9.
**Register:** R-3/R-4 accepted the hackathon scope; the production absence is not separately
registered.
**Smallest honest fix:** none — this is the subsystem. The honest interim is G-7's gate plus
not deploying real data.

## G-9 · HIGH · The export event is attributed to whoever happened to act last, not to whoever exported

**Where:** `app/api/ledger/export/route.ts:9-13`
**What it is now:** `const latestActor = readAll().at(-1)?.actor ?? {kestrel_system…}` — the
`export.generated` record borrows the identity of the previous record's actor, therefore the
ledger asserts "Dr. Chen generated this inspection package" when the true generator is any
anonymous HTTP caller (or, if the last record is `policy.revised`, the export is attributed
to the automated policy-registry actor). The row renders that attribution on screen
(`RecordRow.tsx:114`) and in the exported HTML (`lib/export/index.ts:60`). Attribution by
adjacency is the defect class §11.10 attributability exists to prevent; in the single-actor
demo it is right by luck, and it becomes false the moment a second actor exists.
**What production requires:** the export record's actor is the authenticated exporter, or —
until identity exists — always the system actor, never a borrowed human.
**What it blocks:** the `ALCOA+`-attributable framing of the chain, from inside the chain.
**Phase:** 9 (real fix); the one-line change is available now.
**Register:** not in `REGISTER.md`.
**Smallest honest fix:** delete the borrow — use the `kestrel_system` fallback
unconditionally. One line, strictly more honest, no subsystem required.

---

# MEDIUM

## G-10 · MEDIUM · Zero observability: not one log line in the ledger surface; silent durability demotion; no error tracking; no rate limiting (absent)

**Where:** absent. Evidence:
`grep -rn "console\." lib/ledger lib/export app/api/ledger app/api/evidence` returns
**nothing**, therefore a failed ledger write, a failed verification, a tamper invocation, or
an export produces no server-side signal of any kind — errors are returned to the client and
exist nowhere else. Sharpest instance: `store.ts:44-46` and `:138-142` catch `EROFS`/`EACCES`
and **silently migrate the audit trail to process memory** — an event that changes the
durability class of the ledger — with no record, no log, only the UI badge.
**What it is now:** see above; instrumentation would live in a structured logger wrapper
under `lib/`, wired through the API routes, plus an error tracker and per-route rate limits
at the middleware layer.
**What production requires:** structured logs for every ledger mutation and verification,
alerting on `ephemeral` transitions and verify failures, error tracking, rate limiting on the
mutation endpoints. For an audit product the operational bar is unusually high: a ledger
whose own failures vanish silently defeats its purpose.
**What it blocks:** nothing on screen lies; operating the product blind is what it blocks.
**Phase:** 12.
**Register:** not in `REGISTER.md`.
**Smallest honest fix:** one `console.error` in each silent catch, today.

## G-11 · MEDIUM · Secrets: one `.env`, no rotation, no per-tenant keys — and the real secrets file is more readable than the example (absent)

**Where:** absent. `.env` (741 B, mode `-rw-r--r--`) and `.env.example` (mode `-rw-------`)
at repo root — observed via `ls -la` only; contents deliberately unread.
**What it is now:** all keys live in one gitignored dotenv consumed at process start; no
rotation story, no per-tenant scoping, no secrets manager. The mode inversion (the real file
world-readable at 644 while the example is locked to 600) is a local-machine detail but the
right shape of wrong.
**What production requires:** a managed secrets store (platform env vars at minimum, KMS-backed
manager for per-tenant keys), rotation procedure, and no long-lived provider keys shared
across tenants. The two-OpenAI-key fallback shim lives in Fable-owned `lib/llm.ts` and is
Sol's to audit; this entry is the infrastructure side only.
**What it blocks:** nothing on screen; multi-tenant deployment.
**Phase:** 12.
**Register:** not in `REGISTER.md`.
**Smallest honest fix:** `chmod 600 .env` costs one command; the rest is phase 12.

---

# LOW

## G-12 · LOW · The phase-6 staleness-token fix is sound and covers every action handler; the residual is that `actionInFlight` is a boolean, not a token

**Where:** `components/ledger/index.tsx:129,131-147,186-301`
**What it is now:** verified, per the phase instruction, as the party that raised the
original severity-1. All five action handlers (`verifyNow`, `tamperNow`, `resetNow`,
`supersedeNow`, `exportNow`) call `beginAction()` — which invalidates outstanding tokens and
clears `verification` — and every state application is guarded by
`isCurrentLedgerRequest(latestRequest, dispatchedToken)`, therefore no handler and no poll
can repaint a verification it did not just receive. Pinned three ways in
`tests/ledger.test.ts:306` (stale response discarded), `:340` (action invalidates a running
poll), and `:507` (source assertion that all five actions call `beginAction`). **The fix
holds.** Residual: `actionInFlight` (`index.tsx:129`) is a single boolean reset by whichever
action finishes first; a double-dispatch in the gap before React re-renders `disabled` can
overlap two actions, and the first finisher re-enables polling mid-action. Traced failure
mode: the second action's result is *dropped* (its token was invalidated), never a stale
green — the defect degrades to a missed repaint the 1-second poll corrects.
**What production requires:** token-scope the in-flight guard (store the dispatched token,
clear only if still current) if the double-dispatch window is ever observed.
**What it blocks:** nothing; recorded so the residual is a written limitation, not a
discovery.
**Phase:** unassigned.
**Register:** the fix landed with the R-24–R-26 batch; the residual is new here.
**Smallest honest fix:** as stated; one ref comparison.

## G-13 · LOW · `check-removals.sh` counts substring token matches, so a removed `it(` can be masked by an added `limit(` in the same file

**Where:** `scripts/check-removals.sh:18,44,69-76`
**What it is now:** `count()` uses `grep -oF "$t"` and the token list includes bare `it(`,
`test(`, `assert(`, therefore any identifier *ending* in those strings (`limit(`, `unit(`,
`splitTest(`) counts as a token, and a real removal can net to zero against a coincidental
addition in the same file — the checker compares totals, not sites. The `--prove` control
(R-7/R-8) proves only the `assert.` path can fail; it does not exercise the masking case.
Word-splitting on `$changed` (line 58) is safe today only because test filenames carry no
spaces — in the one repo whose *root* path has a space.
**What production requires:** anchored matches (`grep -oE '(^|[^A-Za-z0-9_])it\('`-style) or
per-site diffing; a `--prove` case for the masking shape.
**What it blocks:** nothing on screen; it is a gate instrument, and rule 4a-bis holds
instruments to the same standard as fixtures.
**Phase:** unassigned.
**Register:** R-7/R-8 closed different defects in this same script; this mode is new.
**Smallest honest fix:** anchor the grep patterns; five minutes, but it is code, so it waits.

---

## Named uncertainties — flagged, not guessed (deliverable clause 3)

1. **`restoreRevisionState`'s `verify(records).ok` gate** (`snapshot.ts:191`): deliberate
   distrust of a broken chain, or an accident with the traced SUPERSEDED→VALID-after-restart
   consequence in G-5? Defensible either way; only Sol knows the intent. **Ask Sol.**
2. **`verify(records?)` always calling `readState()`** even when an explicit chain is
   supplied (`verify.ts:50-51`, "Always touch current storage on this call"): presumably to
   trigger the ephemeral-migration init before verifying, but nothing documents what depends
   on the side effect. **Ask Sol.**
3. **Whether the deployed Vercel link is live and public right now.** README:124 implies it
   exists. If it is, G-7's exposure is current fact, not deployment hypothesis, and its
   priority rises accordingly. **Ask Ranjiv / Claude Code to confirm with a URL.**
4. **How the clause tags are intended to read** — "controls this record satisfies" versus
   "clauses this event type addresses." The rendering does not say, and G-4's severity turns
   on which reading a viewer takes. I judged by the skimming reader; the author may have
   intended the weaker claim. **Ask Sol.**
5. **`.sol/reviews/phase7-production-facts.md`** — present, untracked, unread (see coverage).
   If it was input for this audit, Opus 5 should decide whether anything in it changes an
   entry above.

---

## RECOMMENDED ORDER for phases 8–13

`BUILD_ORDER_V2.md` proposes 8 persistence → 9 identity → 10 ingestion → 11 hooks →
12 hardening → 13 regulatory. **I agree with the skeleton and disagree with three things the
audit surfaced: the scope of 8, the ownership inside 9, and the position of two slivers of 12.**

**Phase 7.5 — an honesty pass, before any subsystem. One short day, all label-tier:**
the G-1 demo line on the signature block and export; the G-3 completeness sentence on screen
and in the export README; the G-4 clause-tag heading; the G-9 one-line system-actor fix; the
G-7 two-line env gate on `reset`/`tamper`; `chmod 600 .env`. Every one converts a CRITICAL or
HIGH overstatement into a labelled limitation *today*. Shipping honest beats shipping later,
and none of it collides with the phase 8 diff.

**8 — persistence, with the spec widened by this audit.** Keep it first: identity without a
durable store is pointless, and G-5/G-6 confirm it. But if phase 8 is specified as "swap
JSONL for Postgres" it will close G-5 and leave G-3 and G-6 open. The spec must require:
(a) atomic append with a serialized head — the race in G-6 is a schema-shaping constraint,
not an implementation detail; (b) an external anchoring mechanism for the chain head — G-3
is a claim gap that durability alone cannot close, because a table's tail deletes as quietly
as a file's; (c) revision/overlay state in the same store as the records (G-5's
SUPERSEDED→VALID trace), so a second process reconstructs the same world.

**9 — identity, with one boundary correction.** BUILD_ORDER lists 9 as Fable-owned, but G-2
shows the routes that must stop accepting identity from the wire are **Sol-owned**
(`app/api/ledger/override`, `accept`, plus G-9's export attribution). The phase 9 spec must
split: Fable builds sessions and signer resolution; Sol changes the ledger API contract to
resolve actors server-side. Written now so it does not surface as a mid-phase ownership
violation.

**10 then 11, unchanged — with a hard precondition.** Both need 9's signer, as BUILD_ORDER
says. The audit adds: 10 (real genotypes) must not land before 9 covers the anonymous **read**
paths (G-8) — ingesting one real patient before then converts an architecture gap into a
PHI breach.

**12 — hardening, still last among code phases, minus the two slivers pulled into 7.5.**
BUILD_ORDER's reasoning ("removing before the replacements exist breaks the demo") is right
for the removals; it is wrong for the *gating* of reset/tamper, which costs two lines,
preserves the demo behind a flag, and closes the single worst deployed-exposure today (G-7).
Observability (G-10) and secrets (G-11) live here.

**13 — regulatory posture, last, and fed by this file.** G-1 through G-4 are its raw
material: what §11.10(d) access controls, §11.200 signature components, and retention
actually require is exactly the delta this audit measured. Writing 13 first would have
produced a document about a product that does not exist; after 8–12 it documents one that
does.
