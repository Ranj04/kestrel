#!/usr/bin/env python3
"""
Cache CPIC pharmacogenomics data to local JSON.

stdlib only - no pip install, no API key. Run once tonight, commit ./cpic/,
and the demo never touches the network again.

    python3 scripts/cache_cpic.py             # fetch, build, self-test
    python3 scripts/cache_cpic.py --rebuild   # rebuild index.json from the
                                              # already-cached raw tables, no network

Exits non-zero if the self-test fails, so you know immediately if it worked.

`--rebuild` exists because the fetch is 113 pages of `diplotype` and the API
drops connections; once the raw tables are on disk there is no reason to pay
for them again to re-derive the index.
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request

BASE = "https://api.cpicpgx.org/v1"
OUT = "data/cpic"
PAGE = 1000

TABLES = {
    "drug": "select=*",
    "gene": "select=*",
    "recommendation": "select=*",
    "diplotype": "select=*",
    "pair_view": "select=*",
    "guideline": "select=*,publication(title,pmid,year)",
}


def get(url, tries=4):
    """Retry on transient drops. The API closed the connection mid-`diplotype`
    on a real run; one dropped page should not cost the whole 113-page fetch."""
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                return json.loads(r.read())
        except Exception as e:
            if attempt == tries - 1:
                raise
            sys.stdout.write(f" [retry {attempt + 1}: {type(e).__name__}]")
            sys.stdout.flush()
            time.sleep(2 ** attempt)


def fetch_all(table, sel):
    rows, offset = [], 0
    while True:
        page = get(f"{BASE}/{table}?{sel}&limit={PAGE}&offset={offset}")
        rows += page
        if len(page) < PAGE:
            return rows
        offset += PAGE


def lookup_terms(rec):
    """Yield (gene, lookup, phenotype) per gene on a recommendation row.

    `lookupkey` is the canonical join key and its SHAPE VARIES BY GENE:

        DPYD    lookupkey {"DPYD": "0.0"}      <- activity score
        CYP2D6  lookupkey {"CYP2D6": "3.0"}    <- activity score
        HLA-B   lookupkey {"HLA-B": "*57:01 positive"}   <- allele status

    `phenotypes` carries the human name ("Poor Metabolizer") and is {} for HLA.
    Neither field alone is sufficient: joining on phenotype misses HLA entirely,
    and joining on lookupkey alone leaves nothing a clinician can read. Carry
    BOTH -- `lookup` joins, `phenotype` displays.
    """
    keys = rec.get("lookupkey") or {}
    phenos = rec.get("phenotypes") or {}
    for gene in keys or phenos:
        yield gene, (keys.get(gene) if keys else phenos.get(gene)), phenos.get(gene)


def build_index(data):
    """{drug_name: {gene: [alert, ...]}} -- keyed the way the UI queries it."""
    drugs = {d["drugid"]: d["name"] for d in data["drug"]}
    guides = {g["id"]: g for g in data["guideline"]}
    level_a = {(p["genesymbol"], p["drugname"]) for p in data["pair_view"]
               if p.get("cpiclevel") == "A"}

    index = {}
    for rec in data["recommendation"]:
        drug = drugs.get(rec.get("drugid"))
        if not drug:
            continue
        g = guides.get(rec.get("guidelineid"), {})
        for gene, term, phenotype in lookup_terms(rec):
            index.setdefault(drug.lower(), {}).setdefault(gene, []).append({
                "gene": gene,
                "lookup": term,
                "phenotype": phenotype,
                "drug": drug,
                "recommendation": rec.get("drugrecommendation"),
                "classification": rec.get("classification"),
                "implication": (rec.get("implications") or {}).get(gene),
                "comments": rec.get("comments"),
                "population": rec.get("population"),
                "cpic_level_a": (gene, drug) in level_a,
                "guideline_name": g.get("name"),
                "guideline_url": g.get("url"),
                "citations": g.get("publication", []),
                "_source": f"{BASE}/recommendation?id=eq.{rec.get('id')}",
            })
    return index


def find(index, drug, gene, term):
    """EXACT match on `lookup`, deliberately. A substring match would let
    "Ultrarapid" pass while telling you nothing about the real join key --
    so this PASS would be weaker than `npm run verify`'s PASS, and a weaker check
    reported in the same word is exactly the failure rule 4a-bis exists to stop.

    `term` is a lookupkey ("0.0", "3.0", "*57:01 positive"), NOT a phenotype
    name. Passing "Poor Metabolizer" here returns None, correctly."""
    for a in index.get(drug.lower(), {}).get(gene, []):
        if str(a["lookup"]).strip().lower() == term.strip().lower():
            return a
    return None


def main():
    rebuild = "--rebuild" in sys.argv
    os.makedirs(OUT, exist_ok=True)
    data = {}
    for table, sel in TABLES.items():
        sys.stdout.write(f"  {table:<16}")
        sys.stdout.flush()
        if rebuild:
            # `diplotype` is gitignored (116 MB) and build_index() never reads
            # it, so a missing file here is expected, not an error.
            path = f"{OUT}/{table}.json"
            if not os.path.exists(path):
                data[table] = []
                print(f"{'--':>6}       (absent, not needed to build the index)")
                continue
            data[table] = json.load(open(path))
            print(f"{len(data[table]):>6} rows  (cached)")
            continue
        data[table] = fetch_all(table, sel)
        json.dump(data[table], open(f"{OUT}/{table}.json", "w"), indent=1)
        print(f"{len(data[table]):>6} rows")

    index = build_index(data)
    json.dump(index, open(f"{OUT}/index.json", "w"), indent=1)
    print(f"  {'index.json':<16}{len(index):>6} drugs")

    # --- self-test: the demo paths must resolve, or the build is dead ---
    # `term` is the lookupkey exactly as data/patients.json carries it. These
    # three cover both shapes: activity score (DPYD, CYP2D6) and allele status
    # (HLA-B, whose `phenotypes` is {} -- the case that makes `lookup` the key).
    print("\nself-test")
    checks = [
        ("capecitabine", "DPYD", "0.0", "Poor Metabolizer", "avoid"),
        ("codeine", "CYP2D6", "3.0", "Ultrarapid Metabolizer", "avoid"),
        ("capecitabine", "DPYD", "2.0", "Normal Metabolizer", None),
        ("abacavir", "HLA-B", "*57:01 positive", None, None),
    ]
    ok = True
    for drug, gene, term, phenotype, expect in checks:
        hit = find(index, drug, gene, term)
        if not hit:
            print(f"  FAIL  {drug} / {gene} / lookup {term!r} -> no match")
            ok = False
            continue
        if hit["phenotype"] != phenotype:
            print(f"  FAIL  {drug} / {gene} / {term} -> phenotype {hit['phenotype']!r}, "
                  f"expected {phenotype!r}")
            ok = False
            continue
        text = (hit["recommendation"] or "")
        flag = "" if (expect is None or expect in text.lower()) else "  <-- unexpected wording"
        print(f"  ok    {drug} / {gene} / lookup {hit['lookup']!r} = {hit['phenotype']!r}")
        print(f"        {text[:110]}{flag}")
        print(f"        {hit['classification']} | Level A: {hit['cpic_level_a']} | "
              f"{len(hit['citations'])} citation(s)")

    print("\nPASS - cached, joined, and both demo paths resolve." if ok
          else "\nFAIL - fix before building on this.")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
