# Phase 7.5 Sol — local server blocked by sandbox

`npm run dev` failed before startup with `listen EPERM` on `0.0.0.0:3000`.
Retrying with `npm run dev -- --hostname 127.0.0.1` failed with the same `EPERM`.
This environment cannot bind a listener, so the local HTTP/browser demo must be
executed by Claude Code. Sol continued with the same sequence through the real route
handlers in-process and did not claim a live HTTP result.
