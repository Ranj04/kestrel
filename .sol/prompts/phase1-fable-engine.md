> **Inherits `.sol/prompts/_template.md` in full**, plus the adaptations in `CLAUDE.md`.
> Read both before this file. Sol also reads `AGENTS.md` (a pointer, not a copy — rule 7).
> The deliverable clause at the bottom is inherited and not optional.

# TASK: phase1-fable-engine — contracts, PGx engine, patients, prescribe API

You are **Fable**. Read `~/pgx/.sol/prompts/_context.md` FIRST. It defines the project, your
directory ownership, and the standing rules. Everything below assumes it.

**Deliverable 1 is `lib/contracts.ts` and it is urgent.** Sol is blocked until it exists. Write it
first, exactly as specified below, then never change it. If you discover mid-task that it needs a
field, add the field — but adding is safe, renaming and removing are not.

No UI in this task. Phase 1 ends with a working API you can hit with `curl`.

---

## Deliverable 1 — `lib/contracts.ts`

Write this verbatim. Sol is coding against it right now.

```ts
export type Severity = "none" | "caution" | "critical";
export type RiskLevel = "low" | "medium" | "high";

export interface GeneResult {
  gene: string;          // "DPYD"
  diplotype: string;     // "c.1905+1G>A/c.1679T>G"
  lookup: string;        // "Poor Metabolizer" — MUST match CPIC's lookupkey value
  source: string;        // "PharmCAT v3.2.0 (synthetic VCF)"
  reportedAt: string;    // ISO
}

export interface Patient {
  patientId: string;
  displayName: string;
  mrn: string;
  age: number;
  sex: string;
  indication: string;    // "Stage III colorectal adenocarcinoma"
  results: GeneResult[];
}

export interface Order {
  orderId: string;
  patientId: string;
  drugRaw: string;       // what the prescriber typed
  drugName: string;      // resolved CPIC drug name
  dose: string | null;
  route: string | null;
  orderedBy: string;
  orderedAt: string;
}

export interface Citation { pmid: string; title: string; year: number; }

/** Every string field here is VERBATIM from data/cpic/index.json. Never model-generated. */
export interface Alert {
  alertId: string;
  orderId: string;
  gene: string;
  diplotype: string;
  lookup: string;
  drugName: string;
  severity: Severity;
  recommendation: string;
  implication: string | null;
  classification: string | null;   // "Strong" | "Moderate" | "Optional" | "No Recommendation"
  comments: string | null;
  population: string | null;
  cpicLevelA: boolean;
  guidelineName: string | null;
  guidelineUrl: string | null;
  citations: Citation[];
  sourceUrl: string;               // the exact CPIC API row URL this came from
  snapshot: EvidenceSnapshot;      // what an override against this alert gets bound to
  raisedAt: string;
}

/** Snapshot binding, ported from writ.ai at depth one.
 *  An override is authorized against the evidence as it stood the moment it was signed.
 *  If that evidence is later superseded, the authorization goes stale on its own. */
export interface EvidenceSnapshot {
  snapshotId: string;          // "cpic:DPYD:capecitabine:2017"
  entryHash: string;           // stableHash() of the exact CPIC index entry
  guidelineName: string | null;
  scopes: string[];            // ["dosing.capecitabine", "monitoring.dpd"]
  capturedAt: string;
}

export type AuthorizationStatus = "valid" | "superseded" | "needs-review";

/** FDA draft guidance: risk = model influence x decision consequence. */
export interface Credibility {
  contextOfUse: string;
  modelInfluence: RiskLevel;
  decisionConsequence: RiskLevel;
  risk: RiskLevel;
  requiredControl: "auto" | "human-review" | "human-signature";
  rationale: string;
}

export interface PrescribeResponse {
  order: Order;
  alert: Alert | null;
  credibility: Credibility;
  resolution: {
    matched: boolean;
    method: "exact" | "llm" | "none";
    candidates: string[];
  };
}

export type LedgerEventType =
  | "order.placed"
  | "genotype.resolved"
  | "alert.raised"
  | "alert.accepted"
  | "alert.overridden"
  | "model.invoked"
  | "evidence.superseded"
  | "export.generated";

export interface Actor { id: string; name: string; role: string; }

export interface ModelProvenance {
  id: string;
  version: string;
  params: Record<string, unknown>;
  prompt: string;
  rawOutput: string;   // ALCOA "Original" — the UNEDITED output, kept separately
}

export interface LedgerRecord {
  seq: number;
  recordId: string;
  type: LedgerEventType;
  occurredAt: string;
  actor: Actor;
  payload: unknown;
  model?: ModelProvenance;
  clauses: string[];
  prevHash: string;
  hash: string;
}

export interface VerifyResult {
  ok: boolean;
  total: number;
  firstBrokenSeq: number | null;
  brokenSeqs: number[];   // firstBroken and everything after it
  checkedAt: string;
}
```

Commit this immediately so Sol can pull it.

---

## Deliverable 2 — `data/patients.json`

Three synthetic patients. **Do not invent the `lookup` strings.** Open
`data/cpic/index.json`, find the real entries, and copy the `lookup` values character for
character. If `lookup` for DPYD in that file is `"Poor Metabolizer"`, write exactly that. A
mismatched string here means the alert silently never fires and you will lose an hour finding it.

| patientId | who | gene result | why it exists |
|---|---|---|---|
| `pt_okafor` | Maya Okafor, 61F, Stage III colorectal adenocarcinoma | DPYD, poor metabolizer | the money shot — capecitabine → avoid |
| `pt_reyes` | Daniel Reyes, 34M, post-op pain after ORIF | CYP2D6, ultrarapid metabolizer | codeine → avoid. proves it isn't one hardcoded case |
| `pt_lindqvist` | Ana Lindqvist, 47F, Stage II colon adenocarcinoma | DPYD, normal metabolizer | capecitabine → **NO ALERT**. proves it isn't a red-screen generator |

Give each a plausible `diplotype` string and a `source` of
`"PharmCAT v3.2.0 (synthetic VCF)"`. Top-level key `"note"`:
`"SYNTHETIC — no real patient data. Genotypes hand-authored to match CPIC lookup keys."`

The third patient is not filler. A demo that always alarms proves nothing.

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
whose `lookup` matches `result.lookup`. Match case-insensitively and tolerate whitespace, but do
**not** fuzzy-match — a wrong match here is a wrong clinical recommendation.

Copy CPIC's strings through **verbatim**. Do not reword, summarize, truncate, or title-case
anything. `sourceUrl` comes from the entry's `_source`.

Severity is derived from CPIC's own text, not invented:

- `critical` — recommendation text contains "avoid" (case-insensitive), **or** `classification`
  is `"Strong"` and the text contains "reduce" or "not recommended"
- `caution` — any other actionable recommendation
- `none` — text indicates no change to therapy; **return `null`, do not raise an alert**

Put that rule in a single small function with a comment naming it as the only place severity is
decided.

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
