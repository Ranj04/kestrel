# Standard agent-prompt template — Claude Code ⇄ Codex paired build

> **Stored verbatim. Inherited in full by every engineering prompt in this project.**
> Project-specific adaptations live in `CLAUDE.md` and are stated there as adaptations,
> never applied by editing this file. Two known editing artifacts are preserved rather
> than silently fixed — see `REGISTER.md` R-1 and R-2. Whoever renames `4a-ter` owns
> moving every citation in the same commit.

Every engineering prompt written for this project inherits this file. It exists because a demo shipped last week describing shimmed providers as "live," and because code written by one party and certified by the same party is how defects survive review. Both problems have the same fix: two builders, mutual audit, evidence over assertion.

Copy the sections below into each new prompt, then add the task-specific detail.

## The four parties

| Party | Invoked via | Owns | Cannot |
|---|---|---|---|
| **Opus 5 — overseer** | `Agent, model: "opus"` | Holding the plan. Deciding phase order and phase completion. Arbitrating every Sol ⇄ Fable disagreement. Judging whether a claim is supported by its evidence. Deciding when to escalate to Ranjiv. | Write the code it judges. Reach the machine, DB, providers, or chain. |
| **Sol (Codex)** | `codex exec` through Bash | Writing and refactoring code, exhaustive edge-case enumeration, adversarial logic review. Produces diffs. | Reach the DB, providers, or chain. Must never claim to have tested. |
| **Fable 5** | `Agent, model: "fable"` | Auditing diffs against architectural invariants; reasoning over large codebases; judging whether evidence supports a claim. | Certify work it wrote itself. |
| **Claude Code** | the session itself | Execution. Applying diffs, running migrations, hitting provider sandboxes and the chain, capturing artifacts. The only party with machine + network. | Certify its own evidence. Arbitrate a Sol/Fable disagreement — that is the overseer's job. |

**The rule that matters: whoever wrote it does not get to certify it.**

**Why an overseer, added 2026-08-04.** Previously Claude Code both executed and decided who was right when Sol and Fable disagreed. That is a quieter form of the same failure the loop exists to prevent: the party with the strongest incentive to declare a phase finished was also the party judging whether it was. Opus 5 holds the plan and arbitrates; Claude Code executes and reports. Neither can close a phase alone.

**Opus 5 is not a rubber stamp. If it agrees with everything, it is not doing its job.** Its specific duties:

- **Before a phase starts:** state the acceptance criteria in one sentence each, and name the single check that would most embarrass the expected result (rule 4g).
- **During:** read Sol's diff and Fable's audit independently — never accept a summary of one from the other.
- **On disagreement:** rule 8 caps it at 3 rounds. Opus decides or escalates; it never averages the positions and never lets Claude Code resolve it.
- **At phase close:** confirm each acceptance criterion against a named artifact, and name the SHA it is certifying (rule 4c).
- **Escalate to Ranjiv** when the disagreement is a product or priority call rather than a fact — those are his (rule 4f).

## Step 0 — confirm the CLI

```
which codex && codex --help && codex exec --help
```

Templates here assume `codex exec "<prompt>"`. If `--help` disagrees with any flag below, the help output wins — correct the command in place rather than working around it.

## The cross-check loop

Run per phase / per unit of work. **Never skip step 5.**

1. **Opus 5 opens the phase** — `Agent(model: "opus")`. States the acceptance criteria and the one check most likely to embarrass the expected result.
2. **Sol writes the diff** — `codex exec`
3. **Fable 5 audits Sol's diff** — `Agent(model: "fable")`, hunting for forced state, weakened guards, bypassed invariants, non-idempotent steps
4. **Claude Code applies and runs it live** — capture the artifact
5. **Sol audits Claude Code's evidence** — `codex exec`, explicitly instructed to argue the opposite case
6. **Opus 5 closes the phase** — reads Sol's diff and Fable's audit independently, confirms each acceptance criterion against a named artifact, and states the certified SHA. Any Sol ⇄ Fable disagreement is resolved here, on the record, with both positions stated. Never averaged. Never resolved by Claude Code.

Steps 1 and 2 may run **in parallel** with any independent unit of work — Sol building phase N+1 while Fable audits phase N is fine, and is the point of having two builders. What must not overlap is a phase closing while its audit is still open.

An objection from either party is **blocking until answered on the record**. The cross-check exchange goes in the PR description — it is a deliverable, not a formality.

## Command templates

**Sol implements:**

```
codex exec "TASK: <task>.
CONTEXT: Avior backend, repo root $(pwd). FIRST read <the prompt file> in full — do not guess at constraints.
CONSTRAINTS: <task-specific invariants>. Never force an end state that the real state machine is supposed to reach through transitions. Never weaken a guard to make something pass.
DELIVERABLE: unified diff, short rationale, an explicit list of edge cases considered and how each is handled, and — separately and always — AN EXPLICIT LIST OF ANYTHING REMOVED (tests, assertions, branches, error handling, comments carrying an invariant). If nothing was removed, say so in those words. See rule 4i.
YOU CANNOT reach the database, provider sandboxes, or the chain. Do not run tests. Do not claim anything is verified. Hand me the diff; I apply and verify."
```

**Sol audits evidence (step 4 — argue the opposite case):**

```
codex exec "TASK: adversarial review. I claim <claim>. Argue the OPPOSITE case and try to break it.
EVIDENCE: <artifact — full tx hash / provider id / webhook event row / test output>.
DIFF APPLIED: <diff>.
Ask specifically: does this artifact prove what I claim, or something weaker? Could this have been produced by our own code rather than the external system? Is this the object I say it is?
Return CONNECTED / NOT CONNECTED (or PASSES / FAILS) with reasoning. Do not be agreeable — a recent demo was described as live when providers were shimmed, and catching exactly that is your job."
```

**Fable 5 audits a diff (step 2):** spawn `Agent` with `model: "fable"`, instruct it to read the diff plus the relevant invariant-bearing files, and to report every place the diff forces state rather than driving real transitions, weakens a guard, or bypasses a deliberate deferral.

## Rules learned from real runs

Each of these comes from an actual failure or near-miss in a previous run. **Do not drop them.**

**1. Name the precondition that would kill the tempting option.** When a task has an obvious-looking solution that might be impossible, say what to check before proposing it. In the zero-auth run, telling Sol "check whether migration 0036 permits a zero-amount hold before proposing that route, and never weaken the constraint to make it work" meant it found `CHECK (amount > 0)` and discarded the option in one pass instead of producing a diff that the database would reject.

**2. Tell the auditor which files carry the invariants.** "Audit this diff" is weak; "audit this diff against `machine.ts`, `send.ts`, `verification.ts` and migration 0036" is what produced the run's single most valuable finding — a heap-order-nondeterministic hold selection that would have silently dropped settlements, i.e. the exact bug the fix existed to close, reintroduced inside the fix.

**3. "It can't be tested" is a claim requiring proof, not an excuse.** If either party says a property cannot be covered by a test, it must state what refactor would make it testable and why that refactor isn't worth doing. In the zero-auth run both parties accepted "SQL row order can't be pinned" and neither noticed the selection could simply be extracted into a pure function and unit-tested with an array. An untested invariant that was already broken once will break again.

**4. If the orchestrator touches anything, it goes back for audit.** Claude Code edited Sol's test file (removing unspyable log assertions), then ran the suite and declared it green. Mechanical or not, that is the one party certifying its own work. Any orchestrator edit — even formatting — returns to Fable 5 before the run closes.

**4a. A regression pin's fixture must make the correct and buggy values DIFFER.** This is now a pattern, not an incident. PR #82 shipped one vacuous pin; the #40 FX fix shipped two, and both times the fixture happened to make the mutation invisible. In #40 the payout fixture quoted `fxRate: 0.8` while the settled legs derived `0.8`, and the convert fixture quoted `1.25` while deriving `1.25` — so `String(enrichment.fxRate)`, the exact bug being pinned, reproduced both expected values and the tests passed under a full revert. A test whose expected value is reachable by the buggy code proves nothing, however precise it looks.

Construct fixtures so the two paths cannot coincide — the standard shape is **fee drag**: give the quoted value a realistic pre-fee offset from the derived one (quoted 0.79 vs derived 0.8; quoted 1.2375 vs derived 1.25). Make this the default way FX fixtures are built. Then **verify it by mutation, and count the reds**: "the suite is green" is not evidence a pin exists. Before the fee drag only 4 deposit tests went red; after, 6 including both destination-side pins. If a mutation you expect to be caught leaves a test green, that test is not a pin — say so explicitly rather than counting it. (In the same run, a second #45 test asserting malformed-input behaviour passed under both versions; it was kept as a robustness pin but explicitly not counted as a regression pin.)

**4a-bis. BEFORE TRUSTING A CHECK THAT PASSED, CONFIRM IT CAN FAIL.** A command that returns empty for reasons unrelated to your claim is not evidence. Rule 4a says a fixture must be able to fail. This is the same rule applied one level up, to the verification commands themselves — and it was rediscovered from scratch three times in one week, which is what a rule is for.

The failure shape is always identical: a command returns silence, silence is read as success, and the silence had nothing to do with the property being tested.

| command | returns empty when… | what it was read as |
|---|---|---|
| `git diff HEAD -- <path>` | the path is untracked — it has no HEAD version to differ from | "the file is restored / unchanged" |
| `git diff --name-only <a> <b> -- $PATHS` | the shell didn't word-split `$PATHS`, so the pathspec matched nothing (zsh does not split unquoted expansions) | "no certified file moved — the certification carries" |
| `git checkout -- <path>` | it restored from the index, not HEAD, so a staged modification came back and `git status` went clean | "reverted" |
| `git stash pop` | the ref was consumed by something else; the stash still exists as an unreachable commit | "nothing was stashed, so nothing was lost" |
| a pathspec-limited diff | the file was renamed — it matches neither side of the pathspec | "unchanged" |
| `biome check` (default) | it truncated at 20 diagnostics and the summary sat above the cut | "lint clean" |
| a mutation script | the anchor missed, so nothing was mutated and the suite stayed green | "the test is not a pin" (or worse: "the pin holds") |

**The mechanical fix, and it costs one line: run the check in a state where it MUST report something, and confirm it does. Then run it for real.**

- Comparing paths? Echo the applied-count first: `grep -c '<token>' <file>`. A missed anchor is visible immediately instead of arriving as a suspicious pass.
- Diffing against a ref? Prove the pathspec matched by pointing the same command form at a path you know moved, and confirming it prints.
- Restoring a file? For anything untracked, `git diff HEAD` cannot see it — compare against a file copy instead.
- Asserting absence? Assert on the absence of a key, not `toBeUndefined()` — an explicit `undefined` a serialiser still emits passes the weak form.
- Reading a tool's summary? Grep for the count, and pass whatever flag defeats truncation (`--max-diagnostics=…`). A truncated view of a pass/fail tool is not evidence of passing.
- **Prefer an instrument that cannot fail silently over one that can.** `git rev-parse <sha>:<path>` errors loudly on a missing, mistyped or renamed path; a pathspec returns silence. Where both exist, the loud one is the rule (this is why 4c-bis prescribes blob-hash comparison rather than a pathspec diff).

**The tell:** if you cannot state what this command would print if the property were false, you have not verified the property — you have observed a command producing no output.

**4a-bis-MUT. WHEN A MUTATION PRODUCES NO REDS, SUSPECT THE MUTATION BEFORE THE CONTROL.** The inverse of 4a-bis, and more dangerous than the original, because 4a-bis makes you add a check while this one argues for deleting a working safeguard.

A mutation that never applied and a guard that does not work produce the identical observation: a green suite. The two conclusions are opposite — "my edit missed" versus "this pin is worthless" — and only one of them destroys protection. Reach for the second and you remove a control that was doing its job, with a green run as your evidence.

**Prove the edit landed before drawing any conclusion.** Grep the changed text, not the diff summary, not the tool's exit code. Four real instances in a single week, every one of which showed no reds and none of which was a bad guard:

| the mutation | why nothing reddened |
|---|---|
| a multi-line `grep -cF` anchor | `grep -c` counts LINES; a multi-line anchor matches none, so nothing was replaced |
| injected an import of a setter | the audit matches a call — an import is not one |
| `!!x` on a boolean | a no-op; the value never changed |
| `"http://host/admin/…"` where the regex anchors `/admin/` to the quote | the real form is `url: "/admin/…"`; the probe was not the shape under test |

The habit that catches all four costs one line: **echo the applied-count first** (`grep -c '<changed text>' <file>`), assert it is what you expect, and only then read the suite. An anchor that missed is then visible immediately, instead of arriving disguised as a finding.

And the same asymmetry applies to a red: a mutation broader than you intended reddens honestly for the wrong reason. Disambiguate the anchor, and confirm the code you did NOT mean to touch is still intact.

**4a-ter. BEFORE RE-DECLARING ANYTHING, ASK: CAN YOU BREAK IT WITHOUT BREAKING A COMPILE?** One question, applicable at the moment of writing — which is the only moment that matters. Same shape as 4a-bis and the same reason: it stops the defect instead of catching it. Established by Opus 5 arbitrating R-153, where two auditing parties disagreed for a day about whether seven hand-written interfaces violated #115 and the answer turned out to be "four yes, three no" along a line neither had drawn.

A **VOCABULARY** is the members of a closed set — document kinds, step ids, role unions, country and category codes, status strings, and any map keyed on or valued by them. Two copies can disagree about what exists while both still typecheck. **Never re-declare one, at any path** — not in a screen, not in a lib, not in a store, not in a test helper.

A **SHAPE** is the fields of a payload crossing a process boundary. Two copies can disagree only by a field being absent, extra, or retyped, and that disagreement surfaces at the first read.

The discriminator, and it is mechanical: mistype `"COMPANY_DETAILS"` → every consumer still compiles, matching silently stops → **vocabulary**. Rename `acceptableTypes` → every consumer fails to compile → **shape**.

**Clause 2** — where the argument actually gets decided: a shape mirror is legitimate *only where the other side has no declaration on an importable path*. If one already exists in `src/contracts/**` or `src/domain/**`, a second copy is re-declaration even though it is a shape, and any bundle-safety defence is void because there is nothing unsafe to import.

**Clause 3:** where a mirror is legitimate it must be **narrowing-only**, and expressed as `extends` against the existing constraint wherever one exists — that turns drift from a runtime surprise into a compile error at zero cost.

The deeper tell, and the reason this is worth a rule: when a client re-declares a server's response shape, the usual cause is not laziness — it is that **the server never declared one**. `GET /v1/kyb/requirements` had no response contract anywhere in the repo; its wire shape was an accident of type inference over a provider's `.passthrough()` schemas, and the client's private copy was the only written statement of it that existed. Before calling a mirror a violation, check whether the other side has anything to import. If it does not, the finding is the missing declaration, not the copy.

**4a-ter. ANNOTATE A SERVICE METHOD'S RETURN TYPE BEFORE A CLIENT IS WRITTEN AGAINST IT.** *(see R-1 — this identifier collides with the rule above)* A method whose return type is inferred and then `json()`'d to the wire has no checked contract — the endpoint's shape is an accident of inference over whatever the provider layer happens to return, including `.passthrough()` index signatures and raw fields nobody intended to publish. That is survivable while there is exactly one declaration. It stops being survivable the moment a second party writes a client, because the client's hand-written interface is then the only written statement of the contract, and nothing checks the two against each other. They drift, silently, and the compiler is content.

Measured here 5 Aug: 8 of 10 unannotated service methods were already `json()`'d straight to the wire, against 14 that carried an annotation. The failure class is not hypothetical — the Due client shipped with 9 of 11 wire shapes wrong and 923 tests green, because no test compared a shape to a second declaration of it.

This is a policy, not a backlog item, and deliberately so. A list of "N endpoints to annotate" parked behind a feature freeze rots; a rule with a natural trigger does not. The trigger is **a client is about to be written**, which means the remaining endpoints get fixed exactly when they start to matter and never before. Same property that makes 4a-bis work: it applies at the moment of writing rather than in review.

The pattern, already demonstrated in-tree by `joinIndustryDecision` + `src/domain/kyb-industry-category.ts`: declare the shape once in a module both sides may import (`src/domain/**` or `src/contracts/**`, zero imports, no provider types), annotate the service method with it, and have the client import the same declaration. The compiler then checks the server against what the client reads. Note the direction — **annotating the service** is what makes the check real; a shared type the service does not claim is just a third declaration.

**4a-quater. TESTING A CAPABILITY IS NOT TESTING THAT ANYTHING USES IT.** For any capability, pin the CALL SITE, not just the implementation — and prove it by **DELETING THE CALL**, not by breaking the function. If the suite stays green, the wiring is untested.

The operational half is the half that works. "Test the integration" is advice; "delete the call and see if anything goes red" is a command you can run at the moment of writing, which is the only moment that matters — the same property that makes 4a-bis and 4a-ter rules rather than aspirations.

Established the hard way: three times in one evening, each found by mutation and never by review. (1) `kybApi` gained five beneficiary functions against five live routes and nothing called them — R-158, where the payload was assembled, rendered on Review and dropped. (2) The categories client was written and the dropdown still screened against an empty list — R-155. (3) `setApplication(await getKybApplication(...))` was deleted from the flow and all 43 tests stayed green, because every route test called the client directly and none could see the screen had stopped asking. That last one is R-158's inbound defect returning through the door it was found in, one commit later.

Why review keeps missing it: the implementation and its tests are both present and both correct, and the diff that introduces the capability looks complete. The absence is in a different file — nothing is wrong on screen, something is merely missing off it. A reviewer reads what is there; a mutation asks what happens when a specific line is not.

**The check, concretely.** For each capability you add, name the one line that invokes it in production code, delete that line, and run the tests that claim to cover the feature. If they pass, add an assertion on the call site itself — the exported function's presence, the path it targets, the ORDER two calls occur in — before restoring the line. Assertions about the source are legitimate here and often the only honest instrument: the defect is a call that does not exist, and a render test cannot see an absent network call.

**4b. Commit before mutation-testing, not after.** The degrade → confirm red → `git checkout` → confirm green loop restores from HEAD. If the work under test is still uncommitted, that `git checkout` destroys it — which happened twice in one session, once losing the `selectSurvivorHold` extraction and once the #45 schema change. Commit first, then mutate.

**4c. A certification names a SHA, and a force-push invalidates it.** Every audit verdict must state the exact commit it certifies ("HEAD 7ec4034 is certified"), and that SHA must be the one that merges. Any force-push to a certified branch invalidates the certification and requires re-certifying against the new head — including an innocuous `--amend` for a typo or a mangled commit message, which is how this gap surfaced (a backtick-mangled message on #89 was amended and force-pushed after the branch had been reviewed). Without this, "Fable approved this branch" silently refers to a commit that is no longer what is about to merge, and the approval reads as stronger than it is. Cheap to honour: re-run the confirmatory pass against the new SHA, or don't force-push a certified branch.

**4c-bis. NAMED EXCEPTION — a clean merge from main does NOT require full re-certification. Prove the bytes didn't move instead.** Added 5 Aug after the Due KYB port re-certified twice in one session, the second time because main had moved six commits in a day. Rule 4c is right that any change invalidates a certification, but applying it literally to an integration merge means re-running the entire gate every time someone else lands a commit — which is heavy enough that people will start skipping it, and a rule that gets skipped protects nothing.

The instrument already exists: it is the one the overseer invented to certify the docs-only commit on top of the certified code. Generalise it.

**COMPARE BLOB HASHES, not a pathspec diff.** This instrument is prescribed because it cannot fail silently: `git rev-parse <sha>:<path>` errors loudly on a path that is missing, mistyped or renamed, whereas a bad pathspec returns silence, and silence reads as "nothing moved".

```sh
for p in path/one.ts path/two.ts dir/; do
  a=$(git rev-parse "<certified-sha>:$p")   # errors loudly if the path is wrong
  b=$(git rev-parse "<head>:$p")
  [ "$a" = "$b" ] && echo "SAME $p" || echo "MOVED $p"
done
```

Every path SAME means the certified bytes did not move, and the certification CARRIES to the new head unchanged. Any MOVED means a real change requiring a real re-certification — no judgement call, no discretion. (A directory path compares its tree hash, which also catches files added to or deleted from it — a pathspec diff over a renamed file would not.)

⚠ **WHY THE INSTRUMENT IS SPECIFIED THIS WAY:** the first version of this rule used a pathspec diff, and it lied on its first use. In zsh an unquoted `$PATHS` does not word-split, so `-- $PATHS` reached git as ONE nonsense pathspec, matched nothing, and returned empty — reported as *certification carries* when two certified files had in fact changed by 33 and 28 lines. A silently-empty pathspec is a vacuous check (rule 4a) sitting inside the rule that decides whether an audit gets skipped. If you use a pathspec form anyway, its positive control is **not** `git diff | wc -l` (that proves the range is non-empty, not that the pathspec matched) — it is re-running the same pathspec form against a path you know moved and confirming it prints.

Three conditions, all mandatory, because the exception is narrow:

1. **The merge must be a PURE merge** — proven mechanically, not asserted from "no conflicts". Conflict-free is not sufficient: an evil merge carries hand-authored content while reporting no conflict, and the first merge under this rule was one. Prove it:
   ```sh
   git merge-tree --write-tree <parent1> <parent2>   # must equal <merge-commit>^{tree}
   ```
   Any difference is authorship riding inside an integration commit, and every differing file must be enumerated (rule 4i) or the exception is void.
2. **The path list must be written down in the certification itself**, not reconstructed later from memory. A certification whose scope is remembered rather than recorded is exactly the gap this rule exists to close — and on the first use it was the recorded path list that caught what condition 1 missed.
3. **The full gate runs once on the merged tree, AND the certified code's own tests are named and reported individually.** "925 green" is a claim broader than the check supporting it (rule 4g): a suite total can stay flat while the certified pins are the ones that broke. Name them — for the KYB port, `tests/due-kyb-client.test.ts` and `tests/kyb-boundary-gate.test.ts` — and report each. The exception is about not re-running the audit, never about not running the tests.
4. **The party that performed the merge does not declare the carry alone.** The first application of this rule was made by the same party that authored content inside the merge being exempted — the template's core rule ("whoever wrote it does not get to certify it") turned on the exception itself. The overseer confirms the carry, or it is not carried.

What this does not cover: a merge that conflicts, an evil merge, a rebase, an amend, a squash, or a force-push. All of those rewrite or reauthor and all still invalidate under 4c. It also does not cover main changing something the certified code depends on — condition 3 is what catches that, and if anything moves, re-certify rather than explain the movement away.

*(R-2: an earlier three-condition block appeared here in the source and is preserved in `REGISTER.md` rather than duplicated inline.)*

**4d. Audit unmerged work immediately; do not queue it behind a merge.** Audits run against the diff, not the merged state, so a follow-up branch can be certified before its base lands. Holding it serialises work for no benefit — and, more importantly, unaudited work sitting next to a merge you are about to perform is exactly how something slips in unaudited. Audit it while nothing is pressing. If the base later shifts materially, re-running is cheap.

**4e. For any change, name the specific test that goes RED when you revert THAT LINE.** Not the subsystem — the line. This is the mechanical gate that catches all three variants of the same failure class seen so far, every one of which passed a green suite:

- A test that couldn't fail — the payout/convert FX pins, whose fixtures quoted the same value they derived (#40).
- A fix that reintroduced its own bug — the `fxRate` coercion opening the fabrication gate it was meant to close (#45).
- A change with no test pointed at it — `statements.ts:159` formatting the FX rate, where every existing assertion was against DB rows and none against statement output (#44).

The tell is always the same: **"the suite passed identically with and without the change."** If that is ever true, there is no coverage of that change, regardless of the number next to the slash. 638/638 is not evidence; "reverting line X turns test Y red" is. State that sentence explicitly for every change before claiming it is done — and if you cannot name the test, you have found a gap, not a formality.

**4f. Ranjiv's TECHNICAL claims are proposals to verify, not instructions. His PRODUCT and PRIORITY calls are decisions and stand.** Standing rule, set by Ranjiv 20 Jul: *"My recommendations reach you as settled decisions and they shouldn't."*

- **Decisions — accept and execute:** what to build, what matters, what ships when, what the product should do. *"Columns or a side table, not ledger entries." "Item #1 stays red." "Don't escalate to Due yet."*
- **Proposals — route through the loop before implementing:** any technical value or claim about the codebase, about provider behaviour, or about correctness. *"Use 4dp"* becomes *"Ranjiv proposes 4dp — check it against the supported currency list before implementing."*

Two of the day's thirteen errors were his and neither went through the loop: 4dp FX display, which breaks COP (20% error) and NGN (5%) — corridors already supported — and a stale `statements.ts:155` line number repeated after it had been corrected. Had this rule been in place, Fable would have caught the COP corridor before he did. **Verifying a claim is not disagreeing with it**; the check costs one agent call and the alternative is shipping a 20% display error on a live corridor.

**4g. The thirteen errors are really two failure modes. Both have a mechanical fix.**

1. **A claim broader than the check that supports it.** ("Genuine hosted route" from a payload without resolving the redirect; "omission, never corruption" without testing `""`; "never shown as zero" when only malformed input was covered; "structurally impossible" when it was test-pinned.)
   **Fix — grammatical, applied while writing:** put the evidence and the claim in the same sentence. *"createEmbeddedWallet passes no owner, therefore app-owned."* The gap becomes visible as you write it rather than when someone audits it. **If the sentence has no "therefore", there is no evidence in it.**
2. **A check shaped by the answer you wanted.** (Fixtures quoting the value they derived; a tiny-rate test picking 0.00006, the one value that survives; asserting `kind` on a path where `kind` is a literal.)
   **Fix — before writing the check, ask which single test would most EMBARRASS the claim, and do that one first.** Volunteering your own weak point is the same instinct: the side dependency was surfaced as a known residue rather than waiting for an auditor to find it.

None of the thirteen shipped — the loop caught every one. So the goal is not fewer first-draft errors; **it is never skipping the loop.** Guard specifically against skipping it because a change is small, late, or obviously fine — all three were true of the `statements.ts` change that turned out to have no coverage at all.

**4h. Never eyeball the tail of a tool whose summary sits ABOVE the tail — grep for the finding count.** `npx biome check src tests | tail -2` printed two near-blank lines and was reported as "lint clean". It was not: a formatter finding sat further up, and the `× Some errors were emitted` summary was above the truncation window. The same trap applies to any tool that prints findings first and a banner last, or vice versa. Do the check that cannot be ambiguous: grep for the count (`| grep -cE "^(src|tests)/"`), or assert on the exit code, or print the specific line that states the total. A truncated view of a pass/fail tool is not evidence of passing — and "I looked at the output" is exactly the kind of claim rule 4g warns is broader than the check supporting it.

**4i. A deliverable must ENUMERATE WHAT IT REMOVED, not only what it added.** Sol twice in one day changed things outside its brief in ways invisible to a report that lists additions: it silently deleted a gated sandbox test (caught only because the suite's skipped count moved 2 → 1), and separately altered a test's money-safety contract while fixing something unrelated. A removal leaves no line to review and no test to fail — the reviewer's attention goes to the new code, and the missing thing is invisible by construction. So: every build prompt requires an explicit list of anything deleted — tests, assertions, branches, error handling, comments carrying an invariant.

But an instruction is not a control, because it depends on the agent honouring it and on someone noticing. Both instances were caught by luck — one test broke, and a skipped count moved 2 → 1. So the check is now mechanical, and it runs **BEFORE the diff is read**:

```sh
sh scripts/check-removals.sh          # baseline HEAD; exit 1 if anything shrank
```

It compares `it(` / `test(` / `describe(` / `skipIf` / `expect(` counts and file existence in every changed test file against the baseline. Static, no suite run, milliseconds. Verified against the real incident: reproducing the deleted gated block reports `'it(' 15 -> 14`, `'skipIf' 1 -> 0`, `'expect(' 65 -> 63` and exits 1. A drop is not automatically wrong — a legitimate consolidation shrinks counts too — but it must be **explained, never merely unnoticed**. Register #109 tracks whether this holds.

**5. Anything surfaced and deliberately not fixed gets written to the register, in the same run.** Not the PR description, which nobody reads twice. The zero-auth run surfaced a real stranded-reserve bug ($0 auth → increment → reversal leaves the hold) and correctly declined to fix it in scope; without an explicit write to `docs/open-items-register.md` it would have vanished.

**6. Accepted limitations must be stated as limitations.** When a disagreement resolves as "we can't verify this here," the resolution goes on the record with the reason, the empirical check that established it, and the follow-up that would fix it. Never averaged, never quietly dropped.

**7. Both agents must read the same ground rules.** Codex reads `AGENTS.md`; Claude reads `CLAUDE.md`. If only one exists, one party is working blind — the backend ran without an `AGENTS.md` for weeks, so every `codex exec` there saw no project instructions at all. Keep `AGENTS.md` as a **pointer** to `CLAUDE.md`, never a copy: copies drift, and two auditors checking each other against different rules is worse than no cross-check, because it looks rigorous.

**8. Cap the argument at 3 rounds, then escalate.** If Fable 5 and Sol have not converged after three exchanges, stop and hand both positions to Ranjiv with a one-line summary of the disagreement. Do not keep looping — an unbounded argument burns tokens and usually means the disagreement is about a judgement call, not a fact.

**9. Three failed rounds means the task is too big, not that the agents are wrong.** If a task fails to converge across three rounds, decompose it and run the pieces separately rather than pushing the same spec harder.

**10. When both parties independently flag the same line, treat it as confirmed.** Findings raised by Fable 5 and Sol separately go to the top of the fix list ahead of anything either raised alone — independent agreement on a specific line is the strongest signal available.

**11. For stateful money paths, prefer property-based tests over example tests.** The zero-auth defect was a state-machine edge case (auth → increment → clearing → reversal orderings). Enumerated examples miss orderings nobody thought of; generating orderings and asserting invariants — never a silent drop, never a double debit, balance always equals posted entries — finds them.

## Why the four-party loop earns its cost

**Eight silent instruments, none caught by a gate, three caught by an auditor reading the tree instead of the text.**

That is the whole argument, and it was measured rather than argued: over one week, eight checks reported success while measuring nothing — a mutation anchor that matched no lines, an unquoted zsh loop that iterated once, a route sweep that only sent POST and GET, a lint grep anchored away from the directory just written, a pipeline reporting `tail`'s exit code, `check-removals` comparing zero files after a commit, a verification loop iterating an empty list, and a `git stash -u` that hid a file in a parent `git show` does not traverse.

Not one was caught by a gate, because a gate can only fail on what it looks at, and each of these was blind in the exact place it was pointed. Three were caught because a second party read the artifact while the first read the claim — a commit message asserting a dedupe that was not in the tree, a citation naming a file in no ref, a "lint 0" produced by a grep that could not see `scripts/`.

That division is the loop's actual product. **Not more eyes on the same text — one party reading the claim, another reading the thing the claim is about.** Whoever wrote it cannot do both, because the claim is what they already believe.

## Evidence standard

**Nothing is "working," "wired," or "connected" without an external artifact a third party can independently verify.**

| Claim | Required artifact |
|---|---|
| On-chain movement | full untruncated tx hash, confirmed on the explorer |
| Provider account created | the real provider id, visible in that provider's dashboard |
| Webhook integration | a received inbound event row — proven not self-signed |
| Auth works | a real token verified with the dev bypass off |
| Tests pass | actual command output, on real Postgres |

**No artifact means the status is not working.** No softer wording, no partial credit.

## Standing constraints (carry into every prompt)

- Do not weaken guards, entitlement checks, state machines, the non-custodial invariant, or the PII ceiling.
- Do not fake or work around a deliberate deferral (e.g. `kyb_deferred`).
- Surface every shim, mock, dev bypass, hardcoded identity, or synthetic id encountered — unprompted, even when inconvenient.
- Minimum code that solves the problem. No speculative abstraction.
- Touch only what the task requires; match existing style.
- Never commit secrets. `.env` stays gitignored.
- Never hand-pick migration numbers — `db:generate` assigns them. Allowlist new tables in `tests/kyc-adversarial.test.ts`.
- Do not self-merge. Open a PR and request review.

## Definition of done

`npm run typecheck` · `npm run lint` · full `npm test` on real Postgres · from-zero migrate clean · the artifact captured and independently challenged by the party that did not produce it · cross-check log in the PR.
