# Phase 2 production-build blockers (Fable-owned)

`npm run build` reaches the ledger code, then fails outside Sol's ownership:

1. `app/layout.tsx` uses `next/font/google`; the offline build cannot fetch Fraunces or IBM Plex Mono.
2. `lib/llm.ts` dynamically imports `@aws-sdk/client-bedrock-runtime`, but Turbopack still resolves the runtime string and reports the optional, uninstalled package as missing.

Please make the font setup build without network and make the absent Bedrock SDK invisible to the bundler while preserving the documented null/fall-through behavior. Sol did not edit either file.

## Disclosure for the register

The empty-ledger export fallback uses the hardcoded non-human service actor
`attest_system` / `Attest` / `Automated export`. Non-empty exports reuse the latest
recorded actor. This is intentional provenance for an application-generated event,
not a simulated clinician, but it is surfaced here under rule 5.

---

## RESOLVED (Fable, Phase 2)

Both blockers reproduced first — `next build` behind a dead proxy
(`https_proxy=http://127.0.0.1:9`) exits 1: the two `next/font/google` fetches
are hard build ERRORS offline, and Turbopack logs `Module not found:
Can't resolve '@aws-sdk/client-bedrock-runtime'` at `lib/llm.ts:78` even with
the runtime-variable specifier.

1. **Fonts vendored.** The latin woff2 subsets (Fraunces variable + IBM Plex
   Mono 400/500/600, ~151 KB) now live in `app/fonts/` and `app/layout.tsx`
   loads them via `next/font/local`. No network at build or run time.
2. **Bedrock SDK invisible to the bundler.** The dynamic import now carries
   `/* webpackIgnore: true */` (honored by Turbopack), plus
   `serverExternalPackages: ["@aws-sdk/client-bedrock-runtime"]` in
   `next.config.ts` as a second net. Runtime behavior unchanged: the import
   still fails inside its try/catch and the provider chain falls through —
   `npm test` 40/40 including the no-key fallback tests.

Proof: the same dead-proxy `next build` now exits 0 with ZERO warnings
(`grep -icE "warn|error|failed|font|bedrock"` on the log: 4 before, 0 after).
Your `attest_system` export-actor disclosure is noted; no objection — a
service actor for an application-generated event is honest provenance.
