# How this connects to a hospital

> **STATUS: PLANNED — NOT IMPLEMENTED.** No CDS Hooks surface exists in this
> repository: there is no `app/api/cds-services/` route, no discovery endpoint, no
> hook handler, no feedback endpoint, and no FHIR or SMART code. Everything below is
> the integration *design* against the published standards — it describes what would
> be built, not what has been. The one artifact that exists is
> `data/cds-hooks-example.json`, a synthetic request fixture nothing serves or
> consumes. (Phase 7 audit: `docs/PRODUCTION_GAP.md` G-15; `REGISTER.md` R-15.)

The short answer, and the one to give on stage: **you never touch their database.**
No hospital gives a third party a connection string to patient data, and asking for one
is the tell that you have not built healthcare software before. There are three
standard surfaces, and this system is designed to sit on all three — **none of the
three is implemented today.**

Everything below is split into **verified** and **unverified**. Do not blur the line —
a claim broader than its check is the failure mode this project's whole discipline
exists to prevent (rule 4g).

---

## 1. The EHR calls you. You do not call it.

**CDS Hooks** — HL7 Standard for Trial Use, **v2.0.1 (STU2)**, built on FHIR R4.
<https://cds-hooks.hl7.org/2.0/>

The hook is called **`order-sign`**, and its own spec describes it as *"the clinician is
ready to sign one or more orders… the last point at which the CDS Service can
influence."* That is this product's entire use case, written by a standards body.

When the prescriber signs, the EHR POSTs to your service:

```jsonc
{
  "hook": "order-sign",
  "hookInstance": "<uuid>",
  "fhirServer": "https://fhir.example.org/api/FHIR/R4",
  "fhirAuthorization": { "access_token": "...", "token_type": "Bearer",
                         "scope": "patient/Observation.rs" },
  "context": {
    "userId": "Practitioner/ABC123",
    "patientId": "1288992",
    "draftOrders": { "resourceType": "Bundle", "entry": [ /* the MedicationRequest */ ] }
  },
  "prefetch": { /* the EHR can pre-attach the genomic Observations */ }
}
```

Note `fhirAuthorization`: the EHR mints a scoped, short-lived token **for you**, so you
read exactly the resources you declared and nothing else. There is no database
credential anywhere in this picture.

You reply with **cards**, and the field names are uncomfortably close to what we already
built:

| CDS Hooks card field | What we call it |
|---|---|
| `indicator` — `info` \| `warning` \| `critical` | `Severity` |
| `summary` (≤140 chars) | the red banner line |
| `detail` (markdown) | the verbatim CPIC recommendation |
| `source.label` + `source.url` | the guideline name and link in the Why? drawer |
| `suggestions[].actions[].type: "delete"` | "cancel this order" |
| **`overrideReasons`** — array of `Coding` | **the override modal** |

**`overrideReasons` is normative.** And the EHR reports the clinician's choice back to
you at a **feedback endpoint**:

```jsonc
POST {base}/cds-services/{id}/feedback
{"feedback":[{
  "card": "<card.uuid>",
  "outcome": "overridden",
  "overrideReason": { "reason": {"code","system","display"}, "userComment": "..." },
  "outcomeTimestamp": "2026-08-13T18:22:07Z"
}]}
```

Read that payload again: **actor, reason, free-text comment, timestamp.** That is a
21 CFR §11.50 signature manifestation arriving over a public standard. Our
`alert.overridden` ledger record is that object, hashed and chained.

Discovery is a single unauthenticated `GET /cds-services` returning the services you
offer. That is the entire onboarding surface.

## 2. The genotype arrives as FHIR, not as a query

**HL7 Genomics Reporting IG v3.0.0 (STU3), FHIR R4.**
<https://www.hl7.org/fhir/uv/genomics-reporting/>

Everything is `Observation`-based. **Verified LOINC codes:**

| Concept | Code |
|---|---|
| DPYD metabolic activity interpretation | **79719-1** |
| CYP2D6 | **79715-9** · CYP2C19 **79714-2** · CYP2C9 **79716-7** |
| Answer list for metabolizer phenotype | **LL3856-3** |
| Poor metabolizer | **LA9657-3** |
| Intermediate / Normal / Rapid / Ultrarapid | LA10317-8 / LA25391-6 / LA25390-8 / LA10315-2 |
| Diplotype (`genotype` profile) | 84413-4 · haplotype 84414-2 · gene-studied 48018-6 |

Our `GeneResult.lookup` is that `valueCodeableConcept.coding.display`. `GeneResult.gene`
is the `gene-studied` component. The adapter is a mapping, not an integration.

**Unverified — do not assert:** star-allele coding has **no normative binding**. The IG's
examples use PharmVar (`http://www.pharmvar.org`) but that is example-level. And
`MolecularSequence` is **not** the path — the IG defines zero profiles on it.

## 3. Launching a UI inside the EHR

**SMART App Launch v2.2.0.** <https://hl7.org/fhir/smart-app-launch/> OAuth2 + OIDC.
The `links[].type: "smart"` field on a card is how a CDS Hooks card opens a full app
with context carried through. Scopes this app needs: `launch`, `openid`, `fhirUser`,
`patient/Observation.rs`, `patient/MedicationRequest.rs`.

---

## The reality gap — say this part out loud, it is the strongest thing you know

The standards are not the constraint. **The data is.**

- **Most PGx results are not discrete.** The PennChart Genomics Initiative reports it
  plainly: *"most genetic results are reported in unstructured PDF documents."* Their
  own numbers — **627 discrete results against ~21,500 documents.**
  <https://www.nature.com/articles/s41436-020-01056-y>
- **Epic supports `order-sign` as a client**, per Epic staff on the HL7 chat archive
  (`patient-view` Aug 2018, `order-sign` Feb 2021, `order-select` May 2021).
  <https://chat-archive.fhir.org/stream/179159-cds-hooks/topic/EHR.20Vendors.html>
- **What is actually deployed** is native Epic BestPractice Advisories firing off
  **Genomic Indicators** in Epic's Genomics module — not third-party cards. At UF this
  needed custom middleware converting assay calls to star alleles and HL7 v2 into the
  variant store; interruptive alerts rose 112%.
  <https://www.frontiersin.org/journals/pharmacology/articles/10.3389/fphar.2024.1458095/full>

**UNVERIFIED — flag these if asked rather than filling them in:**

- Epic's *2026* CDS Hooks support. The statements above are 2021–2022 and
  `fhir.epic.com` is login-gated. **Do not claim Epic honours the full card model** —
  specifically `suggestions`, `overrideReasons`, or the feedback endpoint.
- What fraction of US hospitals have the Genomics Module live. No credible published
  figure was found. Treat any number you hear as unverified.

**So the honest architecture answer is:** the integration is a solved standard; the
binding constraint is whether a discrete diplotype exists in the chart at all. Which is
the same gap this product's second half addresses from the other end — a result nobody
can trace is a result nobody acts on.
