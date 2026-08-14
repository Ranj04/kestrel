# Kestrel

**The drug that would have killed you, and the receipt that proves we knew.**

A pharmacogenomic prescribing check with a regulator-legible audit trail underneath it.

> A kestrel hovers completely motionless, watching, before it commits. Hold, check,
> then act — which is what this does to a drug order.

Built for Biopharma Hack Day, AWS Builder Loft, 13 Aug 2026.

**Live:** https://kestrel-olive.vercel.app · **Run it locally:** [below](#run-it) ·
**Demo script:** [`demo/RUNBOOK.md`](demo/RUNBOOK.md)

---

## The problem

About a third of people carry a gene variant that changes how they process a common
drug. A **DPYD poor metabolizer** given standard-dose capecitabine can die from the
first cycle. The science is settled, the reference data is free and public, and
almost no US hospital runs the check at the moment of prescribing.

There's a second problem underneath it. Where pharmacogenomic alerts *do* exist,
clinicians override them — because they look like every other pop-up, and because
overriding is often correct. What's missing is a record of that decision good enough
for a regulator to read a year later.

Kestrel does both halves: **the alert, and the receipt.**

## What it does

Place a drug order for a patient whose genotype is on file. If CPIC publishes a
guideline for that gene–drug pair, the order is interrupted with **CPIC's own words**
— and the interruption is recorded as a hash-chained, signable record.

| Patient | Genotype | Order | What happens |
|---|---|---|---|
| Maya Okafor | DPYD Poor Metabolizer | capecitabine | **Blocked** — *"Avoid use of 5-fluorouracil…"* |
| Ana Lindqvist | DPYD Normal Metabolizer | capecitabine | **Nothing.** Quiet green line, covered |
| Daniel Reyes | CYP2D6 Ultrarapid | codeine | Blocked, *different* text |
| Ravi Bhattacharya | none on file | capecitabine | No alert — coverage `pended` |

**Row two is the one to watch.** Same drug, different patient, no alarm. A tool that
always alarms proves nothing; the contrast is what shows the lookup is real.

## The one rule everything rests on

> **The model never writes the clinical recommendation. It routes to it.**

Every word of medical advice on screen is a verbatim string from a cached CPIC
dataset, carried with its evidence level, guideline URL and PMIDs. The language
model is allowed exactly three jobs, none of them clinical:

1. Parse free text into a structured order (`"Xeloda 1250 BID"` → drug + dose)
2. Map a brand name to a generic (`"Xeloda"` → `capecitabine`)
3. Draft a *suggested* override rationale that a human edits and signs

If the model wrote the recommendation, there would be nothing to cite and the whole
audit trail would be theatre. **The app runs fully with no network and no API key** —
the deterministic path carries the entire demo.

## The part nobody else builds

Any audit system can tell you *whether a record was altered*. Kestrel also answers
**whether a decision is still warranted.**

When a clinician overrides an alert and signs, the signature is bound to the evidence
**as it stood at that moment** — the CPIC entry and the payer clause, hashed together.
Publish a policy revision and:

- the **capecitabine** authorization goes `SUPERSEDED`, naming the colliding scope
- the **codeine** authorization stays `VALID` — *"evidence changed elsewhere; no scope collision"*
- **the hash chain stays green**

Two red states that mean different things, and keeping them apart is the design:

| | asks | means |
|---|---|---|
| **Tamper** | Did someone change the record? | Your log was attacked |
| **Publish revision** | Is this decision still warranted? | The world moved on |

> Signing an override isn't a permanent licence. It was granted against evidence, and
> when the evidence moves the licence expires by itself. Nobody had to remember to go
> back and check.

## What's real and what's synthetic

Stated plainly, because the project's whole claim is provenance.

| Source | Real? | Where |
|---|---|---|
| CPIC guidelines — 107 drugs, 19 genes, 88 Level A pairs | **Real**, cached from `api.cpicpgx.org` | `data/cpic/` |
| FDA Table of Pharmacogenetic Associations — 124 rows | **Real**, scraped via Bright Data | `data/fda-pgx.json` |
| Aetna CPB 0715 DPYD coverage clauses | **Real**, scraped via Bright Data | `data/payer-policies-scraped.json` |
| Convoke pipeline capture — 239 Phase 3 oncology programs | **Real**, via Convoke's MCP server | `data/convoke-pipeline.json` |
| Payer policy "Meridian Health Plan" — 2 policies, 6 clauses | **Synthetic**, labelled in-file | `data/policies.json` |
| Patients — 4 | **Synthetic**, genotypes copied verbatim from CPIC's diplotype table | `data/patients.json` |

No patient data here is real, and the UI says so on every screen. Scraped content
carries `source_url`, `retrieved_at` and how it was fetched, and renders visibly
differently from verified clinical evidence — a scraped clause is **never** presented
as a verified one.

Nothing is fetched at runtime. Every source is cached to disk, so the demo survives
hostile conference wifi.

## Run it

```bash
npm install
python3 scripts/cache_cpic.py    # ~60s, stdlib only, no key. must end in PASS
npm run verify                   # must end in PASS
npm run dev                      # http://localhost:3000
```

`npm run verify` is the one that matters. It cross-checks every patient genotype
against the CPIC cache and every policy clause, and prints exactly what to change if
they disagree. The failure it exists to catch — a join key off by one character — is
otherwise completely silent: no error, no warning, the alert simply never fires.

That is not hypothetical. It happened. See `R-6` in [`REGISTER.md`](REGISTER.md).

**Demo locally, not on the deployed link.** Vercel's filesystem is read-only, so the
ledger runs in memory and each serverless instance has its own copy — the record count
visibly flickers between requests. The clinical path is correct there; the ledger's
state is not. Locally the ledger is a real file, which is also what lets you open
`data/ledger.jsonl` in an editor and prove the tamper by hand.

## Under the hood

Next.js 16 · TypeScript · no database. The ledger is a JSONL file, deliberately:
you can open it on stage, change one character, hit **Verify**, and watch the chain go
red. A Postgres table can't be shown that way in ten seconds.

- **Hash chain** — SHA-256 over canonical JSON with recursively sorted keys, so a
  record hashes identically before writing and after re-reading. `verify()` returns
  the first broken record *and every record after it*.
- **21 CFR Part 11 / ALCOA+** — every record carries clause tags; signatures record
  printed name, date/time and **meaning**, as §11.50 requires.
- **FDA credibility gate** — the draft AI guidance defines model risk as
  influence × consequence. It's implemented literally, as a 2×2 with the current
  cell lit.
- **Export** — an inspection package in both human-readable and machine-readable
  form, which is what §11.10(b) actually asks for.

## Deeper

| | |
|---|---|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | how the pieces fit, and why |
| [`DECISIONS.md`](DECISIONS.md) | one paragraph per non-obvious choice |
| [`REGISTER.md`](REGISTER.md) | every defect found, fixed or deliberately not — including the ones that were embarrassing |
| [`docs/INTEGRATION.md`](docs/INTEGRATION.md) | how this reaches a real EHR (CDS Hooks `order-sign`, FHIR, `overrideReasons`) |
| [`demo/RUNBOOK.md`](demo/RUNBOOK.md) | the 90-second demo, in order |

`REGISTER.md` is worth a look if you want to judge the engineering rather than the
demo. It records the defects honestly, including a data bug that silently disabled
every alert in the product and was caught by a preflight rather than by review.

## Tests

```bash
npm test          # 52 tests
npm run verify    # data-layer consistency
npm run build     # production build, no network required
```

Two of them exist to prove the *checkers* aren't vacuous — a check that cannot fail
is not evidence:

```bash
npm run verify:prove      # corrupts a genotype, must report FAIL
npm run removals:prove    # deletes real assertions, must report SHRANK
```

`removals:prove` already caught a real defect: the checker had been carried from
another codebase and counted tokens this project doesn't use, so it would have
reported "no removals" no matter what was deleted.

---

Synthetic data only. Not a medical device. Not for clinical use.
