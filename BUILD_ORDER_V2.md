# Build order v2 — hackathon build → real product

Kestrel placed 3rd at Biopharma Hack Day. **The judges' only stated criticism was
the UI.** Not the idea, not the engine, not the audit model. That is the most
actionable feedback a project can get and phase 6 exists solely to close it.

Everything after phase 6 answers a different question: *what is still a shim?*

Same four parties as `BUILD_ORDER.md`. Same rule: **whoever wrote it does not get
to certify it.**

| Party | Is | Owns |
|---|---|---|
| **Opus 5** | overseer | Opens and closes phases. Arbitrates. Never writes code. |
| **Fable 5** | `Agent(model: "fable")` | `lib/pgx/`, `lib/credibility.ts`, `lib/llm.ts`, `app/api/prescribe/`, `components/prescribe/`, `app/page.tsx`, `app/pipeline/` |
| **Sol** | `codex exec` | `lib/ledger/`, `lib/export/`, `app/api/ledger/`, `components/ledger/` |
| **Claude Code** | this session | Executes, runs everything, captures artifacts. Never certifies its own evidence. |

---

## Phase 6 — the UI. Do this first, alone, and ship it.

→ `.sol/prompts/phase6-fable-ui.md`

Closes the judge feedback. **Zero changes to `lib/`, zero to any API route, zero
to any prop signature.** Bounded, reversible, and independently shippable.

This is the only phase that should be started before the audit, because its scope
is already known and it does not depend on anything the audit will find.

**Gate:** the quarter-screen window test from `phase5-design.md`, plus every
existing test still green.

---

## Phase 7 — the audit. Nothing below it starts until this lands.

→ `.sol/prompts/phase7-audit.md`

**No code.** Produces `docs/PRODUCTION_GAP.md`: every shim, hardcoded value,
synthetic dataset and absent subsystem, with what production actually requires,
what it blocks, and a severity.

**Why this gates everything:** phases 8–13 below are named but deliberately NOT
specified. Specifying a database schema before auditing what is mocked is how you
build the wrong schema. The audit writes those specs.

Known starting points, non-exhaustive — the audit must find the rest:

- `lib/actors.ts` — `DEMO_ACTORS`, `dr_chen`. A §11.50 signature with no real
  identity behind it is theater. **This is the highest-severity item in the repo.**
- `lib/pgx/resolve.ts` — hardcoded brand→generic map
- `data/patients.json` — 4 synthetic patients, no ingestion path
- `data/policies.json` — mixed real and synthetic
- Ledger persistence — file-based locally, **in-memory on Vercel**. The chain does
  not survive a restart. Currently labelled honestly on screen; that is a demo
  affordance, not a production answer.
- `app/api/ledger/reset` and `app/api/ledger/tamper` — demo-only endpoints that
  must not exist in a production build
- No auth, no sessions, no roles, no multi-tenancy
- No CDS Hooks endpoint — the integration story is documented, not built
- `data/cpic/index.json` is a build artifact with no refresh pipeline

---

## Phases 8–13 — named, not yet specified. The audit writes them.

| # | Phase | Owner | The question it answers |
|---|---|---|---|
| 8 | Persistence | Sol | Does the chain survive a restart, and can a second process verify it? |
| 9 | Identity & authorization | Fable | Is there a real human behind the signature? |
| 10 | Genotype ingestion | Fable | Where does a real patient's genotype come from? |
| 11 | CDS Hooks endpoint | Fable | Can an EHR actually call this? |
| 12 | Production hardening | Both | What must NOT ship — demo endpoints, shims, missing observability |
| 13 | Regulatory posture | Opus 5 | What would have to be true to put this near a patient? Doc, not code. |

**Order is not arbitrary.** 8 before 9 because an identity system with no durable
store is pointless. 9 before 10 and 11 because both create records that need a
signer. 12 last among the code phases because it removes things, and removing
before the replacements exist breaks the demo you still need.

## Standing constraints — unchanged from v1, and they still bind

- Never fabricate a clinical recommendation or policy string. Verbatim or absent.
- Never fabricate a hash or a verification result. Render an error, never a green
  check you did not compute.
- Every shim introduced gets surfaced unprompted and written to `REGISTER.md` in
  the same run.
- The app stays fully demoable with no network and no LLM key.
