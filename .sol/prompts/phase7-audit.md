> **Inherits `.sol/prompts/_template.md` in full**, plus the adaptations in `CLAUDE.md`.
> Read both first. Read `BUILD_ORDER_V2.md` — this phase writes the specs for
> everything below it.

# TASK: phase7 — the mock audit. NO CODE.

**Both agents run this, independently, without reading each other's output.**
Fable audits Sol's territory; Sol audits Fable's. Neither audits its own.
Opus 5 merges the two into one file and arbitrates every disagreement.

## Why this comes before any productionization

Ranjiv's instruction was *"make this a production ready one and not a mocked
project."* The failure mode is obvious and expensive: start building a database
before knowing what actually needs persisting, and you build the wrong schema.

**So this phase writes no code.** It produces one document, and that document is
the specification for phases 8–13.

## Deliverable: `docs/PRODUCTION_GAP.md`

One entry per gap. This format, exactly:

```markdown
## G-n · <SEVERITY> · <one-line claim>

**Where:** file:line, or "absent" and where it would live
**What it is now:** what the code actually does today. Verbatim quote if short.
**What production requires:** concrete, not "proper handling"
**What it blocks:** which claim on screen, in the README, or in the pitch is
  currently unsupported by it
**Phase:** which of 8–13 owns it, or "unassigned"
```

### Severity, and it is about the CLAIM, not the code

- **CRITICAL** — the product makes a claim this shim cannot support. A §11.50
  signature with no authenticated identity behind it is the live example: the
  screen says *printed name, date, meaning of signature*, and the name is a
  string constant. **That is not a missing feature, it is an unsupported claim,**
  and it is worse than the feature being absent.
- **HIGH** — real deployment is impossible without it, but nothing on screen lies.
- **MEDIUM** — works, does not scale or does not survive restart.
- **LOW** — cosmetic, or an accepted limitation already in `REGISTER.md`.

**Sort by severity, and let the CRITICAL section be short.** If everything is
critical the ranking carries no information.

## Known starting points — NOT the answer, the floor

The audit is not finished when these are written up. It is finished when you have
walked every file. These are named so you do not spend time rediscovering them:

1. `lib/actors.ts` — `DEMO_ACTORS`, `dr_chen`, `PRESCRIBER`. **Start here.**
2. `lib/pgx/resolve.ts` — hardcoded brand→generic map
3. `data/patients.json` — 4 synthetic patients, no ingestion path
4. `data/policies.json` — mixed real and synthetic origins
5. Ledger persistence — file locally, **in-memory on Vercel**; chain does not
   survive a restart
6. `app/api/ledger/reset` and `/tamper` — demo endpoints that must not ship
7. No auth, no sessions, no roles, no multi-tenancy
8. No CDS Hooks endpoint — the integration is documented, not built
9. `data/cpic/index.json` — build artifact, no refresh pipeline, no staleness signal
10. Secrets: `.env` only. No rotation, no per-tenant keys.
11. No observability, no error tracking, no rate limiting
12. `lib/llm.ts` — a second OpenAI key was added as a 429 fallback. Two keys
    hardcoded as a provider strategy is a shim.

## Three questions to ask of EVERY finding

**1. Does anything on screen currently overstate this?**
That is the difference between CRITICAL and HIGH and it is the only severity
judgement that matters. The standing rule — never fabricate a hash, never
fabricate a verification result — extends here: **the UI must not imply a
guarantee the backend does not provide.**

**2. Is it already in `REGISTER.md`?**
If yes, cross-reference it and do not restate it. If it is in the register but
the severity was understated, say so — that is a finding about the register.

**3. What is the smallest honest fix?**
Frequently it is a label, not a subsystem. If the signature block said
*"DEMO — unauthenticated"* the CRITICAL becomes a LOW instantly, and that is a
one-line change available today versus an auth system available in three weeks.
**Name that option every time it exists.** Shipping honest beats shipping later.

## Also required: `docs/PRODUCTION_GAP.md` ends with a RECOMMENDED ORDER

Your ordering, with reasoning, for phases 8–13. `BUILD_ORDER_V2.md` proposes one
— persistence, identity, ingestion, hooks, hardening, regulatory. **Disagree with
it if the audit gives you reason to.** That file was written before the audit ran
and it is a hypothesis, not a finding.

## What NOT to do

- **Do not write code.** Not a fix, not a rename, not a comment. If you find a
  one-character bug, write it up and leave it.
- Do not soften a finding because the fix is expensive. Cost goes in the entry,
  not in the severity.
- Do not pad. Twelve real gaps beat forty with filler, and a padded list gets the
  same treatment as no list.
- Do not audit your own code. That is the one rule this project does not bend.

## Deliverable clause

**1. State what you did NOT audit** and why. An audit claiming full coverage
without saying what it skipped is the same defect class as a green suite that
never ran. If you did not read `lib/export/`, say so.

**2. Evidence and claim in one sentence (4g).** *"`app/api/prescribe/route.ts:34`
resolves the signer with `PRESCRIBER` from `lib/actors.ts`, a module-level
constant, therefore every signature in the ledger is attributed to the same
fictional person regardless of who is using the app."*

**3. Name your own uncertainty.** Where you could not tell whether something is a
shim or a deliberate design decision, say so and ask. Guessing produces a
confident wrong entry, which is worse than a flagged unknown.

**Opus 5 merges the two audits and closes this phase.** Neither agent's document
is the deliverable on its own — the merged file is.
