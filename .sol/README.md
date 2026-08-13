# .sol/

Parallel build convention, same as Ledge.

- `prompts/` — read `_context.md` first, then your phase prompt.
- `requests/` — Sol writes here when it needs something in Fable's territory.
  Sol never edits Fable's files and never waits.
- `reviews/` — cross-review output at feature freeze. Review tasks edit nothing.

## Order

| | Fable (Claude) | Sol (Codex) |
|---|---|---|
| read first | `_context.md`, `phase0-coverage-layer.md` | same |
| 1 | `phase1-fable-engine.md` | `phase1-sol-ledger.md` |
| 2 | `phase2-fable-ui.md` | `phase2-sol-ui.md` |
| 3 | `phase0-coverage-layer.md` (20 min, skippable) | `phase2b-sol-snapshot.md` |
| freeze | `review-fable-on-sol.md` | `review-sol-on-fable.md` |

`lib/contracts.ts` is already written and frozen, so **neither agent is blocked
at any point.** Both can start at the same moment.

**Fable owns git. Sol never runs a git command.**
