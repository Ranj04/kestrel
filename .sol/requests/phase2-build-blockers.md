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
