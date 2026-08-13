# data/cpic/

**This directory is empty until you run the cache script. Nothing works without it.**

From the project root:

```bash
python3 scripts/cache_cpic.py
```

stdlib only, no pip install, no API key. Takes about a minute. Ends in `PASS`.

It writes `index.json` (the only file the app reads) plus the raw tables it was
built from. `index.json` is keyed `drug -> gene -> alert[]`.

**`lookup` is the join key, not `phenotype`.** CPIC keys most genes by phenotype
("Poor Metabolizer") but HLA genes by allele status ("*57:01 positive"), and
`phenotypes` comes back as `{}` for those. Matching on phenotype silently
returns nothing for HLA.

Once written, the app makes **no network calls at runtime**. Conference wifi is
assumed hostile.
