# Phase 7 mock audit — Sol

## Coverage and exclusions

I audited the Fable-owned surface at repository HEAD `06f055cb812ac0094c269421baac4487e3abe70d`: `lib/contracts.ts`, `lib/actors.ts`, `lib/pgx/`, `lib/credibility.ts`, `lib/llm.ts`, `app/api/prescribe/route.ts`, all six files in `components/prescribe/`, `app/page.tsx`, `app/pipeline/page.tsx`, `app/layout.tsx`, `app/globals.css`, the named clinical and pipeline data files, and `scripts/scrape-fda.ts`. This was a static audit; I did not execute the app or tests and do not claim runtime verification.

I did **not** audit `lib/ledger/`, `lib/export/`, `app/api/ledger/`, `app/api/evidence/`, `components/ledger/`, or `scripts/tamper.ts`, because Sol wrote that territory and Fable is independently auditing it. In particular, I followed the prop passed to `SignatureModal` from `app/page.tsx` but did not inspect the Sol-owned modal implementation. I did not read `.sol/reviews/phase7-fable-audit.md` or any other Fable audit output, because agreement is useful only if the audits remain independent.

The phase-6 missing-gene fix is present in the audited tree: `lib/pgx/evaluate.ts:131-143` derives every gene associated with the resolved drug and marks a missing relevant result `assessed: false`, therefore `components/prescribe/AlertCard.tsx:71-90` renders the live Reyes/capecitabine case amber rather than authoring a clinical clearance. R-25 and R-26 remain separate claim problems below.

Register items already recorded and not restated as new gaps are R-21 (all FDA subgroups shown), R-24 (order text survives patient switching), and the accepted process limitations R-3/R-4. R-15, R-25, and R-26 are cited below only because the production severity assigned by this audit is higher than their current register treatment.

## G-1 · CRITICAL · Every signed decision is attributed without an authenticated human identity

**Where:** `lib/actors.ts:17-28`; `app/api/prescribe/route.ts:37-58`; `app/page.tsx:184-188`; `components/prescribe/AlertCard.tsx:170-177`; `components/prescribe/CredibilityCard.tsx:30-33`; absent authentication/session/role/tenant middleware would live around `app/api/**` and the root application shell
**What it is now:** `app/page.tsx:184-188` passes the module-level `PRESCRIBER` constant from `lib/actors.ts` into `SignatureModal`, while `app/api/prescribe/route.ts:37-58` trusts a caller-supplied `orderedBy` and `actorFor()` fabricates a prescriber-shaped actor for unknown ids, therefore neither the fixed Dr. Chen manifestation nor an arbitrary API actor is attributable to an authenticated signer. The source comment calls this a demo shim, but no equivalent label appears beside “Override and sign” or the signed-decision UI.
**What production requires:** Smallest honest fix now: label the control and manifestation `DEMO — unauthenticated signer` and stop citing §11.50 compliance. Production requires an IdP-backed session, server-derived immutable subject id, re-authentication or equivalent signature ceremony, role/privilege checks, tenant membership, and tenant-scoped actor lookup; the client must never supply the authoritative signer.
**What it blocks:** The on-screen claims “Override and sign” and “Signed human decision required,” and any pitch that the record is attributable or a §11.50 signature manifestation.
**Phase:** 9

## G-2 · CRITICAL · A fictional policy is rendered as an actual patient coverage determination

**Where:** `data/policies.json:2-10`; `lib/contracts.ts:38-46`; `lib/pgx/policy.ts:87-104`; `components/prescribe/CoverageLine.tsx:19-35`
**What it is now:** `data/policies.json:2-3` says Meridian Health Plan and every clause are synthetic, `Patient` has no payer, plan, member, benefit, or effective-date context, and `matchCoverage()` selects the first policy containing the drug, therefore `CoverageLine` renders `covered`, `not-covered`, or `pended` as if it were a determination for this patient without any coverage facts. The top banner says the patient data are synthetic; it does not say the payer and determination are fictional.
**What production requires:** Smallest honest fix now: prepend `DEMO — fictional policy; not a coverage determination` to every coverage line. Production requires patient-plan identification, benefit/effective-date context, versioned payer policy ingestion, deterministic clause applicability, provenance and review status, and an explicit indeterminate state when any input is missing.
**What it blocks:** Every colored coverage badge and the pitch that Kestrel determines whether the ordered therapy is covered.
**Phase:** unassigned — phase 10 can ingest patient context, but payer-policy ingestion and adjudication need an explicit owner

## G-3 · CRITICAL · The UI calls a hardcoded demo alias an exact drug match

**Where:** `lib/pgx/resolve.ts:11-17,44-50`; `components/prescribe/OrderForm.tsx:12-16,57-66`
**What it is now:** `resolveDrug()` maps only `xeloda` and `adrucil` through `BRAND_MAP` and returns `method: "exact"`, therefore the UI renders `Xeloda → capecitabine · matched exact` even though the input did not exactly match a CPIC drug key and was resolved by an undisclosed two-entry demo dictionary.
**What production requires:** Smallest honest fix now: return/render `matched demo alias` for this branch. Production requires coded medication input where available, a versioned RxNorm/terminology service for brands, ingredients, combinations, and spelling variants, ambiguity handling that requires confirmation, and provenance identifying the terminology version and mapping used.
**What it blocks:** The visible resolution proof and any pitch that free-text medication normalization works beyond the two staged brands.
**Phase:** 10

## G-4 · CRITICAL · Inclusion in an FDA association table is presented as proof of FDA labeling

**Where:** `data/fda-pgx.json:2-5`; `lib/pgx/fda.ts:55-89`; `components/prescribe/AlertCard.tsx:134-151`; `components/prescribe/WhyDrawer.tsx:73-99`
**What it is now:** `data/fda-pgx.json:2-5` identifies its source only as the FDA Table of Pharmacogenetic Associations and stores table rows, therefore the `FDA-labeled` badge in `AlertCard` and `WhyDrawer` asserts a stronger labeling fact than the cached artifact establishes.
**What production requires:** Smallest honest fix now: rename the badge `FDA association table` and keep the current source/retrieval disclosure. Production use of `FDA-labeled` requires a separately captured, versioned labeling source and a verified join to the applicable label section; if “FDA-labeled” was intended as shorthand for table inclusion, Opus should resolve that terminology explicitly because the evidence still supports only table inclusion.
**What it blocks:** The `FDA-labeled` badge and any regulatory pitch that the displayed passage was verified against current prescribing information.
**Phase:** 13

## G-5 · CRITICAL · A complete-looking clinical result can omit other actionable findings or turn a suppressed conflict green

**Where:** `lib/pgx/evaluate.ts:61-63,80-100`; `lib/pgx/evaluate.ts:131-143`; `components/prescribe/AlertCard.tsx:71-101`; `REGISTER.md:616-635` (R-25)
**What it is now:** `evaluate()` retains only one highest-severity alert and deliberately drops a gene whose matching CPIC rows conflict, while `assessGenes()` marks any matching lookup assessed without carrying either condition, therefore the screen can omit a second actionable recommendation and can render a green check with “No CPIC alert raised” for a result the engine refused to determine. R-25 records only the conflict case as a deliberate limitation; under phase 7’s rule that UI implication counts, its production severity is understated.
**What production requires:** Smallest honest fix now: label results `DEMO — highest-severity finding only; not an exhaustive screen`, and render any conflict amber rather than green. Production requires a result collection rather than a single alert, a first-class conflict/indeterminate state, preservation of every applicable gene-drug recommendation, and clinician-visible resolution rules for multi-gene guidance.
**What it blocks:** The green procedural clearance, the singular alert card as a complete prescribing check, and the product-level claim of pharmacogenomic screening.
**Phase:** 10, with phase 13 defining the allowed clinical claim

## G-6 · CRITICAL · “No human control required” is shown when the system did not complete screening

**Where:** `lib/credibility.ts:12-23`; `app/api/prescribe/route.ts:101-120`; `components/prescribe/CredibilityCard.tsx:30-33,46-71`; `REGISTER.md:637-654` (R-26)
**What it is now:** `assess()` receives only `alert | null` and maps every null—including missing relevant genotype, unmatched lookup, and conflict suppression—to `requiredControl: "auto"`, therefore the screen states `No human control required` immediately below an amber incomplete-screening result. R-26 recognizes that a reader can take this as permission to proceed but treats it as deliberate; under the mandatory on-screen-claim rubric it is CRITICAL.
**What production requires:** Smallest honest fix now: suppress the credibility card for incomplete or indeterminate screening, or relabel the conclusion `No AI-generated recommendation to review — screening status shown above`. Production requires the assessment input to carry completeness/conflict facts, a cited and versioned control framework, and a separate state for “system made no determination.”
**What it blocks:** The on-screen control recommendation and any claim that the FDA-framed credibility assessment safely governs incomplete cases.
**Phase:** 10, with phase 13 owning the regulatory wording

## G-7 · CRITICAL · “Has a guideline today” is computed from an undated CPIC build artifact

**Where:** `data/cpic/index.json:1-2`; `data/cpic/README.md:3-14,34-35`; `app/pipeline/page.tsx:44-47`
**What it is now:** `data/cpic/index.json` begins directly with drug buckets and carries no capture time, upstream release/version, checksum manifest, or refresh status, therefore `app/pipeline/page.tsx` cannot support its temporal heading `Has a guideline today`; the only date shown on that page is the separate Convoke capture date.
**What production requires:** Smallest honest fix now: replace `today` with `in the bundled CPIC snapshot (capture date unavailable)`. Production requires an automated CPIC refresh pipeline, immutable source manifest, retrieval and effective dates, schema/content validation, change review, rollback, and a visible stale/failed-refresh state.
**What it blocks:** The pipeline page’s current-tense coverage claim and any assertion that prescribing uses current CPIC guidance.
**Phase:** 10

## G-8 · HIGH · The application has no real patient or genotype ingestion boundary and would ship the whole patient file to every browser

**Where:** `data/patients.json:2-74`; `app/page.tsx:1,19-23`; absent ingestion endpoints/adapters would live under `app/api/fhir/` or `app/api/cds-services/` and a server-side patient repository
**What it is now:** `app/page.tsx` is a client component that imports all four records from `data/patients.json` and selects among them locally, therefore replacing the fixture with real records would bundle the whole cohort to every client and there is no provenance-checked path from a lab, FHIR Observation, EHR, or patient repository. The synthetic-patient banner is honest, so this is not an on-screen overstatement.
**What production requires:** A server-side tenant/patient repository, minimum-necessary queries, FHIR Genomics Reporting parsing, code-system validation, patient/result identity binding, source organization and report identifiers, status/amendment handling, provenance, access logging, and a quarantine state for unsupported or ambiguous observations.
**What it blocks:** Any real-patient deployment, PHI isolation, or claim that patient genotype is “already on file” in Kestrel rather than in a fixture.
**Phase:** 10

## G-9 · HIGH · R-15 understates the absent EHR integration as stretch despite documentation describing it as present

**Where:** absent `app/api/cds-services/` discovery, hook, and feedback routes; `data/cds-hooks-example.json:2`; `docs/INTEGRATION.md:3-6,45-75`; `REGISTER.md:231-256` (R-15)
**What it is now:** no `app/api/cds-services/` route exists, while the fixture says it is used by that endpoint and `docs/INTEGRATION.md:6` says “this system sits on all three” integration surfaces, therefore the repository documents an implemented connection that is absent. R-15’s `STRETCH ONLY` classification was reasonable for the hackathon but understates a HIGH production blocker.
**What production requires:** Smallest honest fix now: change the documentation and fixture note to `planned/not implemented`. Production requires CDS Hooks discovery, authenticated `order-sign`, strict FHIR validation, prefetch and scoped-token handling, stable card ids, feedback ingestion, idempotency, EHR conformance testing, and fail-safe timeout behavior.
**What it blocks:** The pitch that an EHR can call Kestrel and all hospital integration or workflow claims.
**Phase:** 11

## G-10 · HIGH · Clinical and regulatory JSON is trusted through TypeScript assertions without runtime integrity validation

**Where:** `lib/pgx/index.ts:38-52`; `lib/pgx/policy.ts:53-54`; `lib/pgx/fda.ts:39-50`
**What it is now:** CPIC and policy files are accepted by `JSON.parse(...) as ...`, and FDA validation checks only that `associations` is an array, therefore a parseable stale, truncated, wrong-shaped, or partially regenerated artifact can silently remove alerts or render malformed evidence while still loading successfully.
**What production requires:** Versioned runtime schemas; required-field, vocabulary, URL, date, and uniqueness checks; cross-file referential checks; signed/checksummed manifests; source row counts and positive controls; atomic promotion only after validation; and a visible unavailable state when validation fails.
**What it blocks:** A defensible claim that every rendered clinical or regulatory string came from a complete, validated source artifact.
**Phase:** 10

## G-11 · HIGH · Prescribing has no idempotent or atomic request boundary

**Where:** `app/api/prescribe/route.ts:37-60,62-85,101-126`; `lib/pgx/evaluate.ts:147-160`
**What it is now:** one request performs several ledger appends around asynchronous resolution without accepting an idempotency key or wrapping the sequence in a transaction, therefore a client retry can create a second order and a failure after the first append can leave a partial prescribing event sequence even though no response succeeded.
**What production requires:** A durable transaction boundary or outbox/state machine, caller-supplied idempotency key scoped to tenant and encounter, unique constraints, replay-safe response storage, explicit failed/aborted states, and recovery tests for a failure after every step. The current four-byte random order and alert ids should become database-enforced UUIDs or equivalent durable identifiers.
**What it blocks:** Reliable EHR retries, exactly-once order attribution, and the claim that the audit sequence is a complete receipt of one prescribing action.
**Phase:** 8

## G-12 · HIGH · LLM routing and secret handling are process-global demo failover, not a production provider strategy

**Where:** `lib/llm.ts:41-50,121-181,218-232`; absent secret management would live in deployment configuration and a tenant/provider policy service
**What it is now:** `completeOpenAI()` retries a second process-wide OpenAI key after any failure and `complete()` selects providers solely from environment-variable presence, therefore authentication errors, invalid requests, outages, and rate limits are all collapsed into an unobserved credential retry with no tenant boundary, rotation, health state, retry budget, or policy control.
**What production requires:** Keep the deterministic no-model path, but use a managed secret store with rotation and least privilege, explicit tenant/provider policy, status-specific retry rules, bounded backoff and circuit breaking, quotas, audit-safe key identifiers, health metrics, and tested provider degradation. If the Bedrock branch is intentionally inert rather than a supported provider, say so in deployment documentation and do not count it as redundancy.
**What it blocks:** A production reliability/security claim for model-assisted resolution; it does not block the deterministic clinical core, and the UI’s `via model` label does not itself overstate which path ran.
**Phase:** 12

## G-13 · HIGH · The only clinical API has no rate limit, operational telemetry, or error-tracking boundary

**Where:** `app/api/prescribe/route.ts:37-126`; `package.json:18-33`; absent middleware/instrumentation would live around `app/api/**`, `instrumentation.ts`, and deployment infrastructure
**What it is now:** `POST /api/prescribe` is exported without authentication, rate limiting, request-size limits, trace/correlation ids, metrics, or structured error reporting, and the dependency list contains no corresponding control, therefore an exposed deployment cannot detect silent clinical lookup failures, distinguish provider degradation, or bound abusive LLM spend.
**What production requires:** Authentication first; per-tenant/user/IP limits; body and field length limits; structured audit-safe logs; traces and correlation ids; alerting on lookup conflicts, cache failures, and model degradation; error tracking with PHI scrubbing; SLOs; dashboards; and runbooks. Until then, deploy only behind explicit demo access controls and label it non-production.
**What it blocks:** Safe public exposure, incident response, clinical quality monitoring, and any uptime or reliability claim.
**Phase:** 12

## G-14 · HIGH · Raw patient results and model prompts are retained without a production privacy or retention model

**Where:** `lib/contracts.ts:230-239`; `lib/llm.ts:237-287`; `app/api/prescribe/route.ts:63-85`
**What it is now:** model provenance retains the exact prompt and raw output and the prescribe route appends the patient’s entire results array, therefore real free-text orders and genotype data would be copied into the audit trail without field-level minimization, purpose limitation, retention, deletion/legal-hold policy, tenant encryption, or PHI-aware redaction.
**What production requires:** A data-flow inventory and threat model; minimum-necessary event schemas; explicit PHI classification; encryption and tenant keying; access/audit controls; retention and legal-hold rules reconciled with record-integrity obligations; redaction before external model calls; provider data-use controls; and incident response. Do not solve this by silently dropping provenance—the regulatory and privacy requirements must be reconciled explicitly.
**What it blocks:** HIPAA-ready deployment, defensible model use with PHI, and a claim that the audit trail is regulator-legible without creating an uncontrolled secondary clinical record.
**Phase:** 13, with phase 12 implementing the controls

## G-15 · MEDIUM · The FDA scraper can write provenance text that contradicts its actual retrieval route

**Where:** `scripts/scrape-fda.ts:90-119,138-150`
**What it is now:** `--direct` correctly sets `via: "direct"`, but the emitted `note` always says the table was scraped “via Bright Data,” therefore a direct refresh creates a self-contradictory evidence artifact even though the current UI happens to render the separate `via` field honestly.
**What production requires:** Smallest honest fix: derive the note from `via` or remove the transport claim from the note. The refresh job should additionally emit an immutable retrieval manifest, parser version, content hash, validation counts, and promotion status.
**What it blocks:** Reliable machine-readable scrape provenance; it does not currently overstate the route on screen because `WhyDrawer` renders `via` from the file.
**Phase:** 10

## Uncertainty and deliberately unassigned observations

I cannot tell whether `/pipeline` is intended to become a maintained production capability or remain a sponsor/demo artifact. Its screen does disclose the Convoke retrieval time, exact-name method, and lower-bound limitation, so I did not turn its manual authenticated capture into another gap; if the route is in production scope, it needs a refresh owner and source-license review.

`data/payer-policies-scraped.json:13,22` ends both stored passages mid-word or mid-sentence. I cannot tell whether these are deliberate excerpts or a truncating capture bug, and the file is not connected to the live determination path, so I did not assign severity; it must not be promoted until that question is answered and a source locator proves the excerpt boundaries.

## RECOMMENDED ORDER for phases 8–13

1. **Phase 13 — regulatory posture first.** Define intended use, prohibited claims, §11/ALCOA applicability, signature ceremony, clinical responsibility, privacy/retention, and the difference between FDA association and labeling before those assumptions harden into schemas. Apply the honest demo labels from G-1 through G-7 immediately.
2. **Phase 9 — identity and authorization.** Authenticated subject, tenant, roles, and signing ceremony must be known before persistence chooses actor and tenant keys; this reverses the original hypothesis because the highest-severity gap shapes the storage model.
3. **Phase 8 — persistence.** Build durable, tenant-scoped, transactional, idempotent records around the identity model, with independently verifiable integrity and restart safety.
4. **Phase 10 — clinical and policy ingestion.** Replace client-bundled fixtures and demo aliases with validated FHIR/RxNorm inputs and versioned CPIC/FDA/payer pipelines, and make incomplete/conflicting/multiple findings first-class.
5. **Phase 12 — production hardening.** Add secret management, privacy controls, rate limits, observability, error handling, deployment isolation, and remove or gate every demo surface before accepting external traffic.
6. **Phase 11 — CDS Hooks last.** Expose discovery, `order-sign`, and feedback only after identity, persistence, real inputs, and hardening exist; building the public EHR edge earlier would turn every internal shim into an externally relied-on contract.

This order intentionally disagrees with persistence → identity and with placing hardening after the integration endpoint: the audit found that actor/tenant semantics determine the persistence schema, regulatory claim boundaries determine both, and an unhardened CDS endpoint would expose the exact unauthenticated, non-idempotent route this audit rejects.
