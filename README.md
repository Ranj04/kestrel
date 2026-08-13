# Attest

**The drug that would have killed you, and the receipt that proves we knew.**

A pharmacogenomic prescribing check with a regulator-legible audit trail under it.
Biopharma Hack Day, AWS Builder Loft, Aug 13 2026.

---

## Start here — three commands, in this order

```bash
npm install                      # ~60s
python3 scripts/cache_cpic.py    # ~60s, stdlib only, no key. must end in PASS
npm run verify                   # must end in PASS. do not skip this one
npm run dev                      # http://localhost:3000 -- LEAVE IT RUNNING ONCE
```

**That first `npm run dev` matters more than it looks.** `next/font/google` fetches
Fraunces and IBM Plex Mono at build time. Run it once on good wifi and `.next` caches
them; skip it and the fonts fetch when you can least afford it. The theme has a real
fallback stack so a failure degrades the typeface rather than the layout, but warm it.

If `npm test` errors with `bad option`, your Node is older than the runner expects —
`nvm use` reads the committed `.nvmrc`.

`npm run verify` is the one that matters. It cross-checks every genotype in
`data/patients.json` against the CPIC cache and against every policy clause, and
it prints exactly what to change if they disagree. The failure it exists to catch —
a `lookup` string off by one character — is completely silent otherwise: no error,
no warning, the alert simply never fires.

If verify fails, fix it before writing a line of feature code.

## The build discipline

This project inherits the **standard agent-prompt template** — `.sol/prompts/_template.md`,
stored verbatim. `CLAUDE.md` states every adaptation and why; `AGENTS.md` is a pointer
to it, never a copy (rule 7). `REGISTER.md` carries everything surfaced and deliberately
not fixed (rule 5).

**Whoever wrote it does not get to certify it.** Four parties: Opus 5 arbitrates and
closes phases, Sol writes, Fable audits, and this session executes and captures
artifacts. Each agent audits only the other's work.

Two checks exist to prove they are not vacuous — run both once before you trust either:

```bash
npm run removals:prove    # deletes real assertions, must report SHRANK
npm run verify:prove      # corrupts a lookup, must report FAIL
```

`npm run removals:prove` already caught one real defect: the token list was carried
from a vitest codebase and counted `expect(` in a project that uses `node:assert`. It
would have reported "no removals" no matter what was deleted.

## Then

Two agents, in parallel, in this repo.

| | Fable (Claude) | Sol (Codex) |
|---|---|---|
| read | `.sol/prompts/_context.md` | same |
| build | `.sol/prompts/phase1-fable-engine.md` | `.sol/prompts/phase1-sol-ledger.md` |

`lib/contracts.ts` is **already written and frozen**, so neither is blocked. Both
start at the same moment. Full order in `.sol/README.md`.

## What's already done

- `lib/contracts.ts` — the frozen interface, complete
- `lib/ledger/hash.ts` — canonical hashing, ported from `writ.ai/backend/writai/hashing.py`, 6 passing tests
- `data/policies.json` — synthetic payer policy, 2 policies, 6 clauses, scopes set
- `data/patients.json` — 4 synthetic patients including the two that prove the system isn't a red-screen generator
- `app/globals.css` — the case-file theme, carried over from Paperwork Advocate
- `scripts/verify-setup.mjs` — the preflight

## What's not

Everything under `lib/pgx/`, `lib/export/`, `app/api/`, and `components/`. That's
the build. See `ARCHITECTURE.md` for how the pieces fit and `DECISIONS.md` for why.

## The rule

**The model never writes clinical or policy text. It routes to it.**

Every recommendation on screen is verbatim from `data/cpic/index.json`; every
clause is verbatim from `data/policies.json`. The LLM parses free-text orders,
maps brand names to generics, and drafts an override rationale a human signs.
That's all. It is the only reason anything here can be cited.

The app must be fully demoable with **no network and no LLM key.**

## Demo state

| Patient | Genotype | Order | Expect |
|---|---|---|---|
| Maya Okafor | DPYD Poor Metabolizer | capecitabine | **red — "Avoid use of 5-fluorouracil"** |
| Ana Lindqvist | DPYD Normal Metabolizer | capecitabine | green, no alert |
| Daniel Reyes | CYP2D6 Ultrarapid | codeine | red, different text |
| Ravi Bhattacharya | none on file | capecitabine | coverage `pended` |

Row two is the one to protect. Same drug, different patient, no alarm — that's
what makes the room believe the lookup is real.

## Freeze

Stop building at demo-minus-75. Cross-review, fix only severity-1, record the
fallback video, rehearse twice with a timer. Solo builders lose by still coding
at demo time.
