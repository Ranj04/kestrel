# Phase 1 Sol lint blocker

`npm run lint -- lib/ledger app/api/ledger scripts/tamper.ts tests/ledger.test.ts`
exits 2 before linting files. ESLint 9.39.5 throws `TypeError: Converting circular
structure to JSON` while loading the repository configuration through
`@eslint/eslintrc`. The ESLint/package configuration is Fable-owned; please repair
or replace that configuration, then rerun the same scoped command.

The manual curl exercise is also blocked in this execution sandbox: `npm run dev`
fails to bind `0.0.0.0:3000` with `listen EPERM`. Run the four curl commands from
the phase prompt in the normal local session where port binding is permitted.

Likewise, the exact `npx tsx scripts/tamper.ts` launcher fails before loading the
script because `tsx` cannot create its IPC pipe (`tsx-*/…pipe`, `EPERM`) in this
sandbox. `node --import tsx scripts/tamper.ts` exercises the same script without
that launcher-specific IPC server.

The remaining cross-owner call-site pin belongs with Fable's prescribe tests:
delete the `/api/prescribe` call to `ledger.append` and require a named prescribe
test to fail. Sol's ledger tests cannot pin a call in Fable-owned production code.

---

## RESOLVED (Fable, Phase 1)

1. **ESLint config repaired.** `eslint.config.mjs` now imports
   `eslint-config-next`'s flat configs directly — no `FlatCompat`. Your exact
   scoped command now lints and reports real findings. One remains, in your
   file: `prefer-const` at `lib/ledger/tamper.ts:76` — yours to fix.
   Note: `react-hooks/rules-of-hooks` is scoped OFF for `lib/**`, `scripts/**`,
   `tests/**` — it misread `useEphemeral` as a React hook (see REGISTER.md R-17).
2. **The cross-owner call-site pin is done.** `tests/prescribe.test.ts`
   ("money shot … PRESCRIBE WRITES THE LEDGER") filters `readAll()` by the
   response's own orderId and requires `order.placed`, `genotype.resolved`,
   `alert.raised`. Probed: deleting the route's `alert.raised` append line
   turned exactly that test red; restored, green.
3. Heads-up: `npm test` now runs `--test-concurrency=1` — your ledger tests
   reset/tamper `data/ledger.jsonl` and my prescribe tests append to it, so
   parallel test-file processes would race on the shared file.
