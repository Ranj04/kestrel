> **Inherits `.sol/prompts/_template.md` in full**, plus the adaptations in `CLAUDE.md`.
> Read both before this file. The deliverable clause at the bottom is not optional.

# TASK: phase4-sponsors — make the sponsor keys real

You are **Fable**. Read `~/"biopharma hack"/.sol/prompts/_context.md` FIRST.

Sponsor integration is explicitly scored (*"5 tools in play. Ship with them, get
scored."*). Right now **four sponsor keys sit in `.env` and no code reads any of them.**
Only Codex is genuinely integrated, because Sol is Codex.

## ORDER, and it is not negotiable

**Item 1 runs before the fallback video. Items 2-4 run only after the video exists and
the project is submitted.** The submission gate is `save project → record demo →
submit`, the deadline is **16:15**, and the only judged prize is **Best Demo**. A
sponsor checkbox is worth nothing if the demo never gets recorded.

If you reach the freeze with items 2-4 unstarted, that is the correct outcome. Say so
and stop.

---

## ITEM 1 — `lib/llm.ts` points at OpenAI. ~20 minutes. Before the video.

`lib/llm.ts` currently calls `https://api.anthropic.com/v1/messages` and reads
`ANTHROPIC_API_KEY`, which is **not set**. So the model path is dead *and* aimed at a
non-sponsor. `OPENAI_API_KEY` **is** set.

Switch it to OpenAI. Keep everything else — the two functions, the `ModelProvenance`
return, the null-on-no-key behaviour.

- Model: a current OpenAI chat model, read from `process.env.ATTEST_LLM_MODEL` with a
  sane default so it can be changed without a code edit.
- `ModelProvenance.id` must record the **provider and model actually used**
  (`"openai:<model>"`), not a hardcoded string. An audit record naming the wrong model
  is a fabricated measurement.
- **`ModelProvenance.rawOutput` stays the unedited response body.** Do not parse, trim
  or normalise before storing. ALCOA "Original".
- **Returning `null` remains a fully supported path.** The deterministic
  exact/substring resolution already works and the demo must survive with every key
  unset. Do not make OpenAI a hard dependency of any code path.

**Acceptance — run both halves, and 4a-bis applies: prove the check can fail.**

```bash
# with the key set — the LLM path must actually engage
curl -s localhost:3000/api/prescribe -H 'content-type: application/json' \
  -d '{"patientId":"pt_okafor","drugRaw":"Xeloda 1250 mg/m2 BID","orderedBy":"dr_chen"}' \
  | jq '{method:.resolution.method, drug:.order.drugName, sev:.alert.severity}'
# EXPECT method "llm" (or "exact" if the brand shim caught it first -- say which, and why)

# with it unset — the SAME order must still resolve and still alert
OPENAI_API_KEY= npm run dev   # then re-run the curl above
# EXPECT alert still critical, method "exact" or "substring", NO throw, NO empty alert
```

Then confirm the ledger recorded it: a `model.invoked` record must exist in the first
case and **must not** in the second. If it appears in both, something is fabricating
provenance for a call that never happened — severity 1.

---

## ITEM 2 — Bright Data → the FDA pharmacogenetic associations table. After the video.

**Why this target:** the FDA publishes ~116 gene-drug pharmacogenetic associations as
**HTML only** — no CSV, no API, no download. That is exactly the "public website with no
machine-readable version" problem Bright Data exists for, and unlike a payer PDF you
already know the content is there.

Source: <https://www.fda.gov/medical-devices/precision-medicine/table-pharmacogenetic-associations>

**Two stages, and stage 1 must be complete and inspected before stage 2 starts.** If the
scrape yields junk you stop, and the demo is untouched.

### Stage 1 — `scripts/scrape-fda.ts`, writes `data/fda-pgx.json`

```jsonc
{
  "note": "Scraped from the FDA Table of Pharmacogenetic Associations via Bright Data. Verbatim cell text only — no summarisation, no paraphrase.",
  "source_url": "https://www.fda.gov/...",
  "retrieved_at": "2026-08-13T21:40:00Z",
  "associations": [
    { "gene": "DPYD", "drug": "capecitabine", "section": 1,
      "affected_subgroups": "<VERBATIM cell text>",
      "description": "<VERBATIM cell text>" }
  ]
}
```

**Verbatim or nothing.** Copy cell text through unchanged. If a cell cannot be parsed,
omit the row and log it — never reconstruct it. The standing rule now covers scraped
sources: **never fabricate policy, label, or regulatory language.**

Print the row count and whether `DPYD/capecitabine` and `CYP2D6/codeine` are present.
**If either is missing, stop and report it — do not proceed to stage 2.** Cache the
file; the app must never scrape at runtime.

### Stage 2 — the badge

`lib/pgx/fda.ts`: `fdaAssociation(gene, drug): FdaAssociation | null`, read from the
cached file, exact match on gene and drug name.

Add `fdaLabeled: FdaAssociation | null` to `Alert` in `lib/contracts.ts` — **additive
only**. Render a second badge beside `CPIC Level A`:

```
CPIC Level A  ·  Strong        FDA-labeled ⓘ
```

The `ⓘ` expands to the verbatim FDA text, the section number, and the source URL with
its retrieval timestamp. Same treatment as the CPIC `source record` line — a judge who
clicks it lands on the real thing.

**Absence is not evidence.** A drug not in the table renders **no badge**, never
"not FDA-labeled." The table is a list of associations, not a list of exclusions.

The line this buys: *"The FDA publishes this as a web page you're expected to read with
your eyes. We scraped it, so the alert can check it."*

---

## ITEM 3 — Bright Data → a real payer policy. Only if item 2 landed and time remains.

`data/policies.json` is synthetic and you would have to say so on stage. Real payer
prior-authorization policies are public PDFs with no API.

**Known risk, stated up front:** most capecitabine prior-auth policies concern
indication and step therapy and may never mention DPYD. **Timebox the hunt to 15
minutes.** If no policy with a pharmacogenomic criterion is found, stop and keep the
synthetic file. That is not a failure — it is the honest outcome, and it goes in
`REGISTER.md`.

If one is found, this is where **retrieval genuinely belongs**: the document has no
structured criteria field, so there is no key to look up. Use the model to **locate and
quote** the clause — returning the verbatim span, the page or section, the source URL
and the retrieval timestamp. **It must never rewrite, summarise or normalise the clause
text.** Retrieval, not generation. That is the only reason the scraped clause is as
citable as the CPIC row.

Merge into `data/policies.json` alongside the synthetic clauses with
`"origin": "scraped"` vs `"origin": "synthetic"`, and **label them differently on
screen.** Never present a scraped clause as verified.

If it lands, the supersede beat can stop being simulated: re-scrape, compare the hash of
the quoted span, and a real change supersedes the authorization.

---

## ITEM 4 — Convoke. Ranjiv runs this himself; you only consume the file.

Ranjiv connects the MCP server and runs the queries. **You do not call it, and Sol must
never have access** — there are 10 credits total and an autonomous agent can burn them.

He will produce `data/convoke-pipeline.json`. Your job, and only if it exists: one small
panel or slide listing late-stage programs whose drugs run through a gene already in
`data/cpic/index.json`, framed as *guideline gap arriving*. Cached file only, no
runtime call.

---

## What NOT to do

- Do not make any sponsor a hard dependency. Every path keeps its deterministic fallback.
- Do not scrape at runtime. Fetch once, cache, render from the file.
- Do not let any scraped or model-produced text into the **clinical** recommendation
  path. CPIC remains an exact lookup on `(drug, gene, activityScore)`, verbatim.
- Do not check a sponsor box for something you did not actually ship. A hollow
  integration in front of the person who built the tool is worse than an honest omission.

---

## Deliverable clause — inherited from `_template.md`, not optional

**1. Enumerate what you REMOVED (rule 4i).** Separately and always: every test,
assertion, branch, error handler, or comment carrying an invariant that you deleted.
**If nothing was removed, say so in those words.** A removal leaves no line to review
and no test to fail — it is invisible by construction. `sh scripts/check-removals.sh`
runs before your diff is read.

**2. Name the test that goes RED when you revert THAT LINE (rule 4e).** Not the
subsystem — the line. If the suite passes identically with and without your change,
there is no coverage of it, whatever the number next to the slash. If you cannot name
the test, you have found a gap, not a formality.

**3. Pin the CALL SITE, not just the implementation (rule 4a-quater).** For every
capability you add, name the one line that invokes it in production code, delete that
line, and run the tests that claim to cover the feature. If they stay green, the wiring
is untested — add an assertion on the call site before restoring the line.
**The live instance in this codebase:** `/api/prescribe` calls `ledger.append`. Delete
that call and every ledger test still passes, because they call the ledger directly.

**4. Before trusting a check that passed, confirm it CAN fail (rule 4a-bis).** Echo the
applied-count first (`grep -c '<changed text>' <file>`) and assert it is what you
expect. A mutation that never landed and a guard that does not work produce the
identical observation. If you cannot state what your command would print if the
property were false, you have not verified the property.

**5. Put the evidence and the claim in the same sentence (rule 4g).** *"`evaluate.ts`
copies `entry.recommendation` through untouched, therefore the string on screen is
CPIC's."* If the sentence has no *therefore*, there is no evidence in it.

**6. Surface every shim, stub, hardcoded value or synthetic id you introduce** —
unprompted, even when inconvenient. Anything surfaced and deliberately not fixed goes
to `REGISTER.md` **in the same run** (rule 5), not into a summary nobody reads twice.

**You do not certify your own work.** Hand over the diff and the reasoning; the other
agent audits it and Opus 5 closes the phase against a named artifact.
