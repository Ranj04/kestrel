# Phase 7.5 — Sol honesty-pass report

This is an implementation and execution report, not a certification of Sol's own
work. It covers only Sol-owned ledger, export, route and component paths, plus the
required tests and register entries.

## Outcome

- **G-4:** `reset` and `tamper` now return 404 unless
  `DEMO_MODE === "1"` or `NODE_ENV === "development"`. `GET /api/ledger` returns
  the same `demoControls` fact, and the pane hides only Reset and Tamper when it is
  false. Verify, Export and Publish policy revision remain visible.
- **G-2:** override and acceptance now accept `actorId`, resolve it with
  `actorFor()`, and no longer accept caller-supplied name or role as attribution.
  The modal sends only `actorId` for attribution.
- **G-1:** the signature modal, override row and export signature block say
  `DEMO — unauthenticated signature; the signer is a fixture`.
- **G-3:** clean-state UI and export wording now say the records present are
  internally consistent and completeness requires the anchored head. The export
  README also says it cannot detect deleted trailing records. Hash verification
  arithmetic was not changed or weakened.
- **G-13:** every `export.generated` record uses `kestrel_system`, never the prior
  record's actor.
- **G-12:** record and export clause lists are framed as `clauses addressed by this
  record type`, while retaining the clause ids and labels.
- **G-7:** the ephemeral badge now says `DEMO — in-memory, per-instance ledger;
  not durable`.
- **G-19:** all three durability-demotion catches in `store.ts` now emit an error
  before falling back to process memory.
- **G-20:** R-27 through R-34 register the mitigations and their remaining work.

The printed-name field remains editable. Making only the browser input read-only
would not secure the write route; phase 9 must derive an immutable printed name from
re-authenticated identity. The fixture/unauthenticated limitation is now visible at
every signature manifestation in this phase.

## 4a-bis — each new test failed against the old behavior first

The first targeted run exited 1 with three reds:

1. `demo mutation routes default to 404 in production and stay enabled locally`
   reported `actual 200 !== expected 404` at the production tamper call.
2. `ledger write routes accept only actorId and resolve authoritative actor fields`
   received the forged actor `{ id: "forged", name: "Forged Name", role:
   "Forged Role" }` instead of the resolved `dr_chen` fixture.
3. `ChainStatus hides only demo mutation controls when they are disabled` found
   both `Reset demo` and `Tamper a record` in the old rendered markup.

For G-13, the positive control first found `latestActor` at the two old-code sites;
with that old adjacency logic present,
`export.generated uses system attribution instead of the preceding actor` exited 1
because it received the preceding `dr_chen` actor instead of `kestrel_system`.
After implementation, all four pins pass.

## 4e — revert-to-red map

| Change | Test that turns red on revert |
|---|---|
| Production-default gate, development/explicit opt-in, GET `demoControls` | `demo mutation routes default to 404 in production and stay enabled locally` |
| Pane propagation and hiding only Reset/Tamper | `ChainStatus hides only demo mutation controls when they are disabled` |
| Override/accept `actorId` contract, server resolution, and modal call site | `ledger write routes accept only actorId and resolve authoritative actor fields` |
| System attribution for `export.generated` | `export.generated uses system attribution instead of the preceding actor` |
| Signature-disclosure labels | None; these are procedural copy changes and no render assertion was added. |
| Internal-consistency/completeness labels and export README limitation | None; these are procedural copy changes. Existing tamper tests continue to pin the arithmetic that was deliberately left unchanged. |
| Clause-list framing | None; procedural copy only. |
| Non-durability badge | None; procedural copy only. |
| Three `console.error` calls | None; no filesystem-permission injection harness exists in this phase. |
| Register entries | None; documentation only. |

## End-to-end demo sequence

The sandbox refused listener creation: `npm run dev` failed with `listen EPERM` on
`0.0.0.0:3000`, and the `127.0.0.1` retry failed identically. This limitation is
recorded in `.sol/requests/phase75-sol-dev-server.md`; no live-browser result is
claimed here.

The same sequence was executed through the real route handlers in one process with
`NODE_ENV=development`:

```text
initial reset             200
prescribe                 200, alert returned
override/sign             200, alert.overridden, actorId dr_chen
before tamper             4 records, demoControls true, verify ok true
tamper                    200, sequence 3
verify after tamper       200, ok false, firstBrokenSeq 3
final reset               200
after reset               0 records, verify ok true
```

The handler run returned `ok:false` at the altered record and the unchanged tamper
tests remained green, therefore this pass preserved modification detection while
retracting the unsupported completeness claim.

## Definition-of-done command evidence

```text
npx tsc --noEmit
  exit 0

npm test
  exit 0
  tests 71 = 67 prior + 4 new
  pass 71, fail 0, skipped 0

sh scripts/check-removals.sh
  exit 0
  check-removals: compared 1 file(s) against HEAD
  no removals

npx eslint . --format json
  exit 0 (with pipefail retained through the JSON count parser)
  FILES EXAMINED: 53
  ERRORS: 0
  WARNINGS: 0
```

Evidence and claim in one sentence: the production-default test got 404 from both
mutation handlers and found `readAll()` unchanged, therefore an unset
production deployment no longer exposes reset or tamper while development and an
explicit `DEMO_MODE=1` opt-in retain the demo.

## 4i — explicit enumeration of removals

Removed from the final behavior/code:

1. Acceptance of whole caller-supplied actor objects, including the two local
   `isActor()` shape checks and use of caller-supplied actor name/role.
2. The `latestActor` adjacency branch that attributed exports to the previous actor.
3. Rendering of Reset and Tamper controls when the server reports demo controls
   disabled.
4. The clean-state claims `chain intact ✓` and `CHAIN INTACT`.
5. The export README claims that its ledger and report were `complete` without an
   anchored head.
6. The old durability euphemism `in-memory ledger — file storage unavailable`.
7. Unframed clause labels that read as direct compliance attestations.

No tests, assertions, error handling, verification branches, or invariant-bearing
comments were removed. Clause ids and labels remain. Verify, Export package and
Publish policy revision controls remain. No dependency or subsystem was added.

## Deliberately open

- **G-3 arithmetic:** tail deletion and empty-chain completeness remain undetectable
  until phase 8 adds an external anchored head.
- **G-2/G-1 identity:** `actorId` remains caller-selected and the printed name remains
  editable until phase 9 supplies authentication, authorization and signature
  re-authentication.
- **G-7:** storage remains per-instance and non-durable; only the claim is now honest.
- **G-19:** error lines are not structured observability, alerting or rate limiting.
- **G-4:** the mutation routes still exist and can be deliberately re-enabled; phase
  12 owns removal or real authorization.
