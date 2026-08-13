# data/cpic/

**This directory is empty until you run the cache script. Nothing works without it.**

From the project root:

```bash
python3 scripts/cache_cpic.py
```

stdlib only, no pip install, no API key. Takes about a minute. Ends in `PASS`.

It writes `index.json` (the only file the app reads) plus the raw tables it was
built from. `index.json` is keyed `drug -> gene -> alert[]`.

**`lookup` joins. `phenotype` displays.** CPIC's `lookupkey` is an *activity
score* for DPYD and CYP2D6, and *allele status* for HLA:

| gene | `lookup` | `phenotype` |
|---|---|---|
| DPYD | `"0.0"` | `"Poor Metabolizer"` |
| CYP2D6 | `"3.0"` | `"Ultrarapid Metabolizer"` |
| HLA-B | `"*57:01 positive"` | `null` |

Matching on phenotype returns nothing for HLA (where `phenotypes` is `{}`) and
is ambiguous for DPYD (`"0.0"` and `"0.5"` are both Poor Metabolizer). Always
join on `lookup`; render `phenotype`.

`diplotype.json` is **gitignored** — it is 116 MB, above GitHub's 100 MB file
limit, and `build_index()` never reads it. It is here so a human can look up a
real diplotype → activity-score row when authoring `data/patients.json`.
`--rebuild` works without it.

Once written, the app makes **no network calls at runtime**. Conference wifi is
assumed hostile.
