# Kestrel — demo runbook

Record **locally**, at **1280×720**. The Vercel link is a link, not the demo — see
"Why not the deployed URL" at the bottom.

## Before you hit record

```bash
npm run dev                                    # must be the ONLY server on :3000
curl -s -XPOST localhost:3000/api/ledger/reset # clean ledger
```

Set the browser window so the app renders at **1280×720**. Every state has been
measured at that size with zero overflow; wider is fine, narrower is not.

Nothing else needs doing. No key, no network — CPIC, the FDA table, the payer
policies and the Convoke capture are all cached on disk.

## The take — 90 seconds

**1. The money shot.** Maya Okafor → type `Xeloda 1250 mg/m2 BID` → Place order.

- resolution line: `Xeloda 1250 mg/m2 BID → capecitabine · matched exact`
- the pane is taken over: **DO NOT PRESCRIBE** in vermilion
- *"Avoid use of 5-fluorouracil or 5-fluorouracil prodrug-based regimens."*
- `CPIC LEVEL A · Strong recommendation · FDA-labeled ⓘ`
- coverage slip: `NOT-COVERED · Meridian PA-ONC-014 v2024.1 · clause PA-ONC-014.2`
- FDA credibility grid, SIGNATURE cell lit

> The model never writes the recommendation. It routes to it. That's the only
> reason we can cite it.

**2. Why this? →** the drawer. This is the strongest screen in the product.
CPIC verbatim, both PMIDs, `source record` = the actual CPIC API row, and the
FDA block showing `retrieved … · via brightdata`.

**3. Override and sign.** Name, meaning, rationale — 21 CFR 11.50 wants all three.

**4. The control. Ana Lindqvist → `capecitabine`.** Same drug, different patient,
**no red card** — a quiet green line and `covered · PA-ONC-014.4`.

> This is the one that proves the lookup is real. Do not cut it.

**5. Publish policy revision — BEFORE tampering.** capecitabine authorization →
**SUPERSEDED**, with the colliding scope named. codeine → **VALID**, *"evidence
changed elsewhere; no scope collision."* **The chain header stays GREEN.**

> Signing an override isn't a permanent licence. It was granted against evidence,
> and when the evidence moves the licence expires by itself. Nobody had to
> remember to go back and check.

**6. Tamper a record — LAST.** Header goes vermilion, `CHAIN BROKEN AT RECORD n`.
The broken row gets a 4px rule, drops to 0.6 opacity, and its tick becomes
**MISMATCH**. Every record before it stays green. The authorizations above are
untouched: one still SUPERSEDED, one still VALID.

> Tamper answers *did someone change the record*. The revision answered *is this
> decision still warranted*. Two red states, two different questions — and the
> chain was green through the first one.

### Why this order

Publish **before** tamper, not after. Two reasons:

1. Beat 5's whole point is that **the chain stays green** while an authorization
   dies. On an already-red chain you cannot show that — the audience sees red and
   red, and the distinction the product is built on disappears.
2. Both orders work (the publish button is no longer gated on chain integrity),
   but green→revision→red is the honest narrative arc: normal operations first,
   then the attack.

## If a judge pushes back

- **"Is the tamper button fake?"** — `data/ledger.jsonl` is a real file. Open it in
  an editor, change one character, save, hit Verify. Or run
  `npx tsx scripts/tamper.ts` in a terminal, outside the app.
- **"Is that string really from CPIC?"** — `grep -F "<the sentence>" data/cpic/index.json`
- **"Is the FDA badge real?"** — `data/fda-pgx.json`, 124 associations, `via: "brightdata"`,
  with `source_url` and `retrieved_at`.

## Reset between takes

```bash
curl -s -XPOST localhost:3000/api/ledger/reset
```

Also: `npm test` leaves ~9 records in the ledger. Reset after running it.

## Why not the deployed URL

Vercel's filesystem is read-only, so the ledger runs in memory — and each
serverless instance has **its own** memory. Measured on the live URL: five
consecutive reads returned `n=8 (broken)`, then `n=3 (intact)`, then `n=3`…
The pane polls every second, so the record count visibly flickers and one
instance reports the chain broken while the left pane says it is fine.

The clinical path is stateless and correct there — alert, coverage, FDA badge,
drawer, `/pipeline` all fine. Only the ledger's record count is unreliable.

Locally the ledger is a real file, single process, and consistent. That is also
what lets you prove the tamper by hand on stage.
