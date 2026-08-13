> **Inherits `.sol/prompts/_template.md` in full**, plus the adaptations in `CLAUDE.md`.
> Read both before this file. Sol also reads `AGENTS.md` (a pointer, not a copy — rule 7).
> The deliverable clause at the bottom is inherited and not optional.

# TASK: phase1-fable-engine — contracts, PGx engine, patients, prescribe API

You are **Fable**. Read `~/"biopharma hack"/.sol/prompts/_context.md` FIRST. It defines the project, your
directory ownership, and the standing rules. Everything below assumes it.

**Deliverable 1 is `lib/contracts.ts` and it is urgent.** Sol is blocked until it exists. Write it
first, exactly as specified below, then never change it. If you discover mid-task that it needs a
field, add the field — but adding is safe, renaming and removing are not.

No UI in this task. Phase 1 ends with a working API you can hit with `curl`.

---

## Deliverable 1 — `lib/contracts.ts` is ALREADY WRITTEN. Do not rewrite it.

`lib/contracts.ts` exists in the repo, complete and frozen. **Read the file. Do not
work from any prose restatement of it, including one in a prompt.** An earlier draft of
this prompt carried an inline copy and it had already drifted from the real file
(`evidence.superseded` vs `policy.revised`) — which is rule 4a-ter's vocabulary case
exactly: two declarations of a closed set, both syntactically fine, silently disagreeing.
The copy is deleted rather than corrected, because a corrected copy drifts again.

Skim it for: `Alert` (every string verbatim from CPIC), `Coverage`,
`EvidenceSnapshot` (bound to BOTH the CPIC entry and the policy clause),
`PrescribeResponse` (note `coverage` sits here **as well as** on `Alert` — two of the
four demo patients have no alert and their coverage must still render), `Credibility`,
and the ledger types.

**Adding a field is safe. Renaming or removing one is not.** If you need that, write
`.sol/requests/<task>.md` and keep moving.

## Deliverable 2 — `data/patients.json` is ALREADY WRITTEN and verified. Do not rewrite it.

Four synthetic patients, already in the repo, and every `diplotype` / `lookup` / `phenotype`
value is copied verbatim from a row in CPIC's `diplotype` table. `npm run verify` confirms all
four resolve against the cache. **Read the file. Do not regenerate it, and do not delete the
fourth patient** — Bhattacharya carries phase0 acceptance test #4.

| patientId | who | `lookup` → `phenotype` | why it exists |
|---|---|---|---|
| `pt_okafor` | Maya Okafor, 61F, Stage III colorectal adenocarcinoma | DPYD `"0.0"` → Poor Metabolizer | the money shot — capecitabine → avoid |
| `pt_reyes` | Daniel Reyes, 34M, post-op pain after ORIF | CYP2D6 `"3.0"` → Ultrarapid Metabolizer | codeine → avoid. proves it isn't one hardcoded case |
| `pt_lindqvist` | Ana Lindqvist, 47F, Stage II colon adenocarcinoma | DPYD `"2.0"` → Normal Metabolizer | capecitabine → **NO ALERT**. proves it isn't a red-screen generator |
| `pt_bhattacharya` | Ravi Bhattacharya, 58M, metastatic colorectal | none on file | capecitabine → coverage `pended`. the most common real prior-auth outcome |

Rows three and four are not filler. A demo that always alarms proves nothing.

**If you ever add a patient:** the `lookup` is an activity score, not a phenotype name. Look the
diplotype up in `data/cpic/diplotype.json` and copy its `lookupkey` — do not derive it. That file
is gitignored for size; re-fetch with `python3 scripts/cache_cpic.py` if it is not on disk.

---

## Deliverable 3 — `lib/pgx/`

### `lib/pgx/index.ts` — load the cache

Read `data/cpic/index.json` once at module load, keep it in memory. Node `fs`, not `fetch`.
**No network call, ever.** Export `getIndex()`.

If the file is missing, throw at startup with a message that names the file and says to run
`cache_cpic.py`. Failing loudly at boot is correct; failing silently at demo time is not.

### `lib/pgx/resolve.ts` — drug string → CPIC drug name

```ts
export async function resolveDrug(raw: string): Promise<{
  drugName: string | null;
  method: "exact" | "llm" | "none";
  candidates: string[];
}>
```

Order of attempts, and **the first two must work with no LLM**:

1. Lowercase, strip dose/route/frequency tokens, exact match against index keys.
2. Substring match against index keys; if exactly one hits, take it.
3. Only then, `llm.resolveDrug(raw, candidateNames)` — pass it the list of index keys and require
   it to return one of them or null. **If it returns a string that is not an index key, discard
   it and return `none`.** The model does not get to invent a drug.

Brand names matter for the demo — `"Xeloda"` must reach `capecitabine`. If the LLM is
unavailable, a small hardcoded brand→generic map covering the demo drugs is acceptable and
honest; put it in this file with a comment saying it's a demo shim.

### `lib/pgx/evaluate.ts` — the actual check

```ts
export function evaluate(patient: Patient, drugName: string, orderId: string): Alert | null;
```

For each of the patient's `results`, look up `index[drugName][result.gene]`, then find the entry
whose **`lookup`** matches `result.lookup`. Match case-insensitively and tolerate whitespace, but do
**not** fuzzy-match — a wrong match here is a wrong clinical recommendation.

**Join on `lookup`, never on `phenotype`.** `lookup` is an activity score for DPYD and CYP2D6
(`"0.0"`, `"3.0"`); `phenotype` is the human name and exists only for display. See `_context.md`.
Joining on `phenotype` is null for HLA and non-unique for DPYD, so it can cite the wrong row.
Carry `phenotype` onto the `Alert` for rendering — the card must say "Poor Metabolizer", not "0.0".

Copy CPIC's strings through **verbatim**. Do not reword, summarize, truncate, or title-case
anything. `sourceUrl` comes from the entry's `_source`.

Severity is derived from CPIC's own text, not invented. **This exact rule already exists** as
`severityOf(text, classification)` in `scripts/verify-setup.mjs`:

```js
if (/avoid/i.test(t)) return "critical";
if (classification === "Strong" && /reduce|not recommended/i.test(t)) return "critical";
if (/no indication to change|label-recommended|standard dosing|no recommendation/i.test(t))
  return "none";
return "caution";
```

`none` means **return `null`, do not raise an alert.**

**Move it, do not copy it.** Export `severityOf` from `lib/pgx/evaluate.ts`, then change
`verify-setup.mjs` to import it and delete its local copy. Two declarations of a closed set that
can silently disagree is exactly the defect this project already recorded as R-5 — the preflight
would keep printing PASS while `evaluate.ts` classified differently. Closing it is part of this
deliverable, not a nicety. `scripts/verify-setup.mjs` is `.mjs` and Fable owns both files.

If a patient has several genes hitting one drug, return the highest-severity alert. Note in a
comment that a real system would surface all of them; one is right for a 90-second demo.

**Build the `snapshot` here.** Import `stableHash` from Sol's `lib/ledger/hash.ts` (it is given to
Sol as finished code, ported from writ.ai, so it exists from minute one):

- `entryHash` = `stableHash(entry)` over the **exact CPIC index entry object** you matched
- `snapshotId` = `` `cpic:${gene}:${drugName}:${year of the newest citation}` ``
- `scopes` = `["dosing.<drugName>"]`, plus `"monitoring.<gene lowercased>"` when the
  recommendation or comments mention monitoring. Two scopes is enough — they exist so a later
  guideline change can invalidate one prescription and leave a sibling alone.

This is what an override gets bound to. Sol's Phase 2b depends on it, so do not skip it.

---

## Deliverable 4 — `lib/credibility.ts`

```ts
export function assess(alert: Alert | null): Credibility;
```

Implement FDA's `risk = influence × consequence` literally:

- No alert → influence `low`, consequence `low`, risk `low`, control `auto`
- `caution` → influence `medium`, consequence `medium`, risk `medium`, control `human-review`
- `critical` → influence `high`, consequence `high`, risk `high`, control `human-signature`

`contextOfUse` is a real sentence, e.g.
`"Pre-prescription pharmacogenomic contraindication screening for a single order."`
`rationale` explains the two axes in one sentence each — this text goes on screen, so write it
like a human wrote it.

---

## Deliverable 5 — `lib/llm.ts`

One thin wrapper. Two functions: `parseOrder(raw)` and `resolveDrug(raw, candidates)`.
Provider from env; **if no key is present, both return `null` immediately and never throw.**

Every call returns its `ModelProvenance` alongside the result so the route can log it —
model id, version, params, the exact prompt sent, and the raw unedited output. That last field is
the one that matters; do not trim or parse it before storing it.

**Build and test the no-LLM path first.** The app must be fully demoable with the key unset.

---

## Deliverable 6 — `app/api/prescribe/route.ts`

`POST { patientId, drugRaw, orderedBy }` → `PrescribeResponse`.

Sequence:

1. Load patient. 404 if unknown.
2. `ledger.append("order.placed", …)`
3. `resolveDrug()`. If it used the LLM, `ledger.append("model.invoked", …)` with full provenance.
4. `ledger.append("genotype.resolved", …)` with the patient's gene results
5. `evaluate()`. If an alert, `ledger.append("alert.raised", …)` with the full alert object
   including citations — the exported package must be readable without the app.
6. `assess()`
7. Return

Import Sol's ledger from `lib/ledger`. **Sol may not have written it when you start.** Do not
block: write `lib/pgx/ledger-shim.ts` that no-ops with the same signature, use it behind a
try/catch import, and delete the shim the moment `lib/ledger/append.ts` exists. Note the swap in
`DECISIONS.md`.

---

## Acceptance — run these, do not skip

```bash
# 1. money shot fires
curl -s localhost:3000/api/prescribe -H 'content-type: application/json' \
  -d '{"patientId":"pt_okafor","drugRaw":"Xeloda 1250 mg/m2 BID","orderedBy":"dr_chen"}' \
  | jq '{sev:.alert.severity, rec:.alert.recommendation, ctrl:.credibility.requiredControl, cites:(.alert.citations|length)}'
# EXPECT severity "critical", recommendation containing "Avoid", control "human-signature", cites > 0

# 2. clean pass — SAME DRUG, different patient
curl -s localhost:3000/api/prescribe -H 'content-type: application/json' \
  -d '{"patientId":"pt_lindqvist","drugRaw":"capecitabine","orderedBy":"dr_chen"}' | jq '.alert'
# EXPECT null

# 3. second path
curl -s localhost:3000/api/prescribe -H 'content-type: application/json' \
  -d '{"patientId":"pt_reyes","drugRaw":"codeine 30mg q6h prn","orderedBy":"dr_chen"}' \
  | jq '{sev:.alert.severity, rec:.alert.recommendation}'
# EXPECT severity "critical", recommendation containing "Avoid"

# 4. no-LLM path
unset ANTHROPIC_API_KEY AWS_ACCESS_KEY_ID; # then re-run test 1 — must still pass
```

**If test 2 returns an alert, stop and fix it before anything else.** A system that flags the
normal metabolizer is worse than useless and a judge will find it.

Write a one-paragraph note into `DECISIONS.md` for each non-obvious choice — especially the
severity derivation, since Sol will review it and a decision already recorded is not a finding.

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
