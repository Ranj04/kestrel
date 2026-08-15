# Phase 7 — verified production facts, captured by Claude Code

Neither agent can obtain these from source. Sol's sandbox has no network; Fable was
not asked to probe production. **Claude Code is the only party with machine and
network**, so this file carries the facts the two audits must be merged against.

All three were obtained **read-only**. Nothing on the live deployment was mutated.

---

## F-1 · There is a live, public deployment

```
https://kestrel-olive.vercel.app     GET / -> 200
```

Found via `gh api repos/Ranj04/kestrel --jq '.homepage'`. It is not referenced by any
deployment config in the repo — there is no `vercel.json`, no `Dockerfile`, no
`.vercel/` directory committed. **The deployment exists outside anything the repo
describes**, which is itself worth an entry: the audit cannot reason about a
production surface the codebase does not declare.

## F-2 · The demo-only mutation endpoints are LIVE, PUBLIC and UNAUTHENTICATED

`BUILD_ORDER_V2.md` item 6 calls `app/api/ledger/reset` and `app/api/ledger/tamper`
*"demo-only endpoints that must not exist in a production build."* They are already
in one.

Probed with `GET`, which a POST-only Next route answers `405` and an absent route
answers `404`. **The distinction is the evidence** — it proves the route exists
without invoking it:

```
/api/ledger                 GET -> 200
/api/ledger/reset           GET -> 405   route EXISTS, accepts another method
/api/ledger/tamper          GET -> 405   route EXISTS, accepts another method
/api/ledger/verify          GET -> 405
/api/evidence/supersede     GET -> 405
```

**`/api/ledger/tamper` answers 405 rather than 404 on a public URL with no auth in
front of it, therefore anyone who knows the hostname can corrupt the audit chain of
the deployed application, and anyone can wipe it via `/api/ledger/reset`.**

I did **not** issue the POST. Confirming the vulnerability by exploiting it would
mutate a live deployment, and 405-vs-404 already settles existence. Whether the POST
succeeds unauthenticated is therefore *inferred* from the absence of any auth
middleware in the repo, not directly demonstrated — **that residual is named here
rather than papered over.** If Ranjiv wants it demonstrated, that is his call to
make, not mine to take.

This is not "a gap to close in phase 12". It is a present exposure on a URL that is
already shared. **Severity should reflect deployed reality, not intended reality.**

## F-3 · The chain is in-memory in production, confirmed live

```json
GET https://kestrel-olive.vercel.app/api/ledger
{ "records": 0, "ephemeral": true, "verify": { "ok": true } }
```

`lib/ledger/store.ts:35` branches on `process.env.VERCEL` because the Vercel
filesystem is read-only outside `/tmp`. **The deployed instance reports
`ephemeral: true` and 0 records, therefore the audit chain of the live application
has no durable store and does not survive a restart — this is the production
configuration, not a local quirk.**

Note the interaction with F-2 that neither fact carries alone: the chain is both
**erasable by anyone** (F-2) and **erased by ordinary platform behaviour** (F-3).
For a product whose entire claim is a tamper-evident audit trail, those two together
are the finding, and they are more than the sum of the parts.

## F-5 · The chain detects MODIFICATION but not DELETION — reproduced end to end

Fable's G-3 claims verification passes on a truncated or erased chain. **I
reproduced it against the running app, with a control, before it goes into a
production document as CRITICAL.** Every line below is `POST /api/ledger/verify`
against a locally seeded 5-record chain:

```
baseline                      -> ok: true   total: 5
CONTROL: in-place tamper      -> ok: FALSE  firstBrokenSeq: 2     <- the instrument CAN fail
delete the last record        -> ok: TRUE   total: 4              <- evidence destroyed, verifies clean
erase the chain entirely      -> ok: TRUE   total: 0              <- an EMPTY chain verifies clean
```

The control is what makes this evidence rather than an assertion. Verification is
not broken wholesale — the same call correctly returns `ok:false` for an in-place
edit, naming the exact broken sequence. **It is specifically blind to records being
removed**, because each record's hash commits to its predecessor and nothing commits
to the chain's length or to its head.

**`POST /api/ledger/verify` returns `ok:true` after the last record is deleted and
again after the file is emptied, while returning `ok:false` for an in-place edit,
therefore the screen's "chain intact ✓" attests to the integrity of the records that
remain and says nothing about the ones that were removed.**

The concrete attack this permits: delete the `alert.overridden` record — the single
record proving a clinician was warned and prescribed anyway — and the application
renders a green, verified audit trail of the remaining events. That is the exact
claim the product exists to make, and deletion defeats it.

Restored to the 5-record baseline afterwards; `ok: true`, nothing left mutated.

## F-4 · Build currency — UNRESOLVED, and I am flagging it rather than guessing

The phase-6 fixes were pushed as `06f055c` minutes before this audit opened. I could
not establish from outside whether the live deployment serves that commit. The
absence of the old fabricated clearance string in the served HTML proves nothing —
that string only ever rendered after an order is placed, never in the initial
document.

**So: whether F-2 and F-3 were observed against current or stale code is unknown.**
Both are structural and present in `06f055c` either way, so the findings stand; the
unknown is only which build exhibited them. Resolvable with `vercel ls` or the
dashboard, which I did not run.
