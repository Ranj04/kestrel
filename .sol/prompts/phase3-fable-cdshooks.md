> **Inherits `.sol/prompts/_template.md` in full**, plus the adaptations in `CLAUDE.md`.
> Read both before this file.

# TASK: phase3-fable-cdshooks — become a real CDS Hooks service

You are **Fable**. Read `~/"biopharma hack"/.sol/prompts/_context.md` FIRST, then
`~/"biopharma hack"/docs/INTEGRATION.md`, then `~/"biopharma hack"/lib/contracts.ts`.

## THIS IS A STRETCH TASK. Read this paragraph before anything else.

**Do not start this until the core demo works end to end and the fallback video is
recorded.** A working clinical stop with a signed, supersedable, tamper-evident
authorization is a complete project. This task converts one sentence of the pitch from
an assertion into an artifact — valuable, but strictly less valuable than the thing it
is decorating. **If you are behind, skip it entirely and say so.**

Budget: **40 minutes.** If you pass 40, ship the discovery endpoint alone and stop.

## Why it is worth 40 minutes and not more

The most likely judge question is *"how would this connect to a hospital's patient
data?"* The answer is that there is an HL7 standard for exactly this — CDS Hooks
v2.0.1, hook id `order-sign`, described by its own spec as *"the last point at which the
CDS Service can influence"* — and its card format is close enough to what we already
built that the mapping is embarrassing:

| CDS Hooks card | ours |
|---|---|
| `indicator: "critical"` | `Severity` |
| `source.label` / `source.url` | guideline name and link |
| `detail` (markdown) | the verbatim CPIC recommendation |
| **`overrideReasons`** (array of `Coding`, normative) | the override modal |

Saying that is good. **Having a live endpoint a judge can `curl` is better** — that is
the difference rule 4g draws between a claim and evidence.

## Deliverable 1 — `app/api/cds-services/route.ts` (do this one first)

`GET /cds-services` — the discovery endpoint. **Must be unauthenticated**, per spec.

```jsonc
{"services":[{
  "hook": "order-sign",
  "id": "attest-pgx",
  "title": "Attest — pharmacogenomic prescribing check",
  "description": "Interrupts an order when the patient's genotype contraindicates it, citing the CPIC guideline and the payer coverage clause. Every override is a hash-chained, signed record.",
  "prefetch": {
    "pgx": "Observation?patient={{context.patientId}}&code=http://loinc.org|79719-1,http://loinc.org|79715-9"
  }
}]}
```

Ten minutes. Even alone it makes the claim checkable.

## Deliverable 2 — `app/api/cds-services/attest-pgx/route.ts`

`POST` an `order-sign` request, return `{ cards: [...] }`.

`data/cds-hooks-example.json` is a real request body with a DPYD Observation attached.
**Use it as your fixture.** Its `context.patientId` is `pt_okafor` and its
`valueCodeableConcept.coding.display` is `"Poor metabolizer"` — already agreeing with
`data/patients.json`.

Pipeline, reusing everything:

1. Read `context.draftOrders` → first `MedicationRequest` →
   `medicationCodeableConcept.coding[]` where system is RxNorm. **Match on the RxNorm
   code against `data/cpic/index.json`'s drug entries, not on the display string.**
   `capecitabine` is `RxNorm:194000` and CPIC's `drug` table carries `rxnormid` — join
   on the code. A display-string match is a substring match wearing a costume.
2. Read the genotype from `prefetch.pgx` — map LOINC-coded Observations to `GeneResult`
   (see `lib/pgx/fhir.ts` below). **If `prefetch` is absent, return `{"cards":[]}`.**
   Do not invent a genotype and do not fall back to `data/patients.json` in this route
   — an empty card array is the honest answer to "I was given nothing," and a fabricated
   one is the exact failure this project's standing rule forbids.
3. `evaluate()` — unchanged. Same function, same verbatim strings.
4. Map `Alert` → card. `severity` → `indicator` (`critical`→`critical`,
   `caution`→`warning`, `none`→ no card). `recommendation` → `detail`.
   `guidelineName`/`guidelineUrl` → `source`. `summary` **must be ≤140 chars** — spec
   requirement, and the one field where you may compose rather than copy, because it is
   a label and not a clinical recommendation. Everything in `detail` stays verbatim.
5. `overrideReasons` — real `Coding[]`, each with `display` populated (normative).
6. `ledger.append("alert.raised", …)` exactly as `/api/prescribe` does.

## Deliverable 3 — `lib/pgx/fhir.ts`

```ts
export function geneResultsFromBundle(bundle: unknown): GeneResult[];
```

~40 lines. For each `Observation` whose `code.coding` carries a LOINC in the table
below, emit a `GeneResult` where `lookup` is `valueCodeableConcept.coding[0].display`
and `gene` comes from the `48018-6` gene-studied component.

| LOINC | gene |
|---|---|
| `79719-1` | DPYD |
| `79715-9` | CYP2D6 |
| `79714-2` | CYP2C19 |
| `79716-7` | CYP2C9 |

Verified real (`docs/INTEGRATION.md`). Answer list `LL3856-3`; `LA9657-3` = *Poor
metabolizer*.

**Case is the small trap. The vocabulary gap is the real one.** FHIR gives you a *phenotype
name* (`"Poor metabolizer"`); `evaluate()` joins on `lookup`, which for DPYD and CYP2D6 is an
*activity score* (`"0.0"`, `"3.0"`). Case-folding does not bridge that — `"Poor Metabolizer"`
matches no CPIC entry at all. This is the same defect that shipped in `patients.json` and
silently disabled every alert; see `_context.md`.

So the boundary must **resolve** phenotype → lookup, not normalize it:

1. Case-fold and trim the FHIR value.
2. Scan `index[drug][gene]` for entries whose `phenotype` matches it.
3. If they all carry the same `recommendation`, use any of their `lookup` values — DPYD `"0.0"`
   and `"0.5"` are both Poor Metabolizer with identical text, so this is safe and common.
4. **If they carry different recommendations, that is ambiguous — return no card and log it.**
   Do not pick one. A phenotype that maps to two different clinical answers is exactly the case
   where guessing produces the opposite recommendation.

Do all of it in this file, once, and **write the test that pins it** before you write the mapping.
Do not loosen `evaluate()`'s match to absorb any of this; that function's exactness is what stops
it returning the opposite recommendation.

## Deliverable 4 — `tests/cds-hooks.test.ts`

1. `data/cds-hooks-example.json` → exactly one card, `indicator: "critical"`,
   `detail` containing CPIC's verbatim "Avoid use of 5-fluorouracil…"
2. `summary` is ≤140 characters
3. `source.url` is the real guideline URL from the CPIC entry, not a constructed one
4. **Delete `prefetch` → `{"cards":[]}`.** Not a card built from `patients.json`.
   This is the honesty test; write it first.
5. **Rule 4a-quater — pin the call site.** Delete the `ledger.append` line in this route
   and confirm a test goes red. If it stays green, the wiring is untested and an
   assertion on the call site itself is required before you restore the line.
6. A Normal Metabolizer Observation → no card. Copy the example, change
   `LA9657-3`/`"Poor metabolizer"` to `LA25391-6`/`"Normal metabolizer"`.

## What NOT to build

No SMART launch. No OAuth. No `fhirServer` fetching — **use `prefetch` only.** No
`suggestions` actions beyond a single `delete`. No feedback endpoint.

`docs/INTEGRATION.md` records that Epic's *2026* card-model support is unverified —
the statements available are 2021–2022 and `fhir.epic.com` is login-gated.
**Do not claim on stage that Epic honours `overrideReasons` or the feedback endpoint.**
Say the standard defines them and that our service implements them. That sentence is
true and the stronger one is not checkable.

## The line this buys you

> *"There's an HL7 standard for exactly this — the hook is called `order-sign`, and it
> fires at the moment the clinician signs. We're a compliant service; point any EHR at
> this URL. And the spec has a field called `overrideReasons`, which is our override
> modal, already standardized. The integration isn't the hard part — the hard part is
> that most genotype results are still scanned PDFs."*

That last clause is the most credible thing you can say in that room, and it is on the
record: 627 discrete results against 21,500 documents, Penn, published.
