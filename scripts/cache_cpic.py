#!/usr/bin/env python3
"""
Cache CPIC pharmacogenomics data to local JSON.

stdlib only - no pip install, no API key. Run once tonight, commit ./cpic/,
and the demo never touches the network again.

    python3 scripts/cache_cpic.py     # run from the project root

Exits non-zero if the self-test fails, so you know immediately if it worked.
"""
import json
import os
import sys
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


def get(url):
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=90) as r:
        return json.loads(r.read())


def fetch_all(table, sel):
    rows, offset = [], 0
    while True:
        page = get(f"{BASE}/{table}?{sel}&limit={PAGE}&offset={offset}")
        rows += page
        if len(page) < PAGE:
            return rows
        offset += PAGE


def lookup_terms(rec):
    """CPIC keys most genes by phenotype, but HLA genes by allele status.
    `lookupkey` is the canonical join key -- `phenotypes` is {} for HLA."""
    return rec.get("lookupkey") or rec.get("phenotypes") or {}


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
        for gene, term in lookup_terms(rec).items():
            index.setdefault(drug.lower(), {}).setdefault(gene, []).append({
                "gene": gene,
                "lookup": term,
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
    for a in index.get(drug.lower(), {}).get(gene, []):
        if term.lower() in str(a["lookup"]).lower():
            return a
    return None


def main():
    os.makedirs(OUT, exist_ok=True)
    data = {}
    for table, sel in TABLES.items():
        sys.stdout.write(f"  {table:<16}")
        sys.stdout.flush()
        data[table] = fetch_all(table, sel)
        json.dump(data[table], open(f"{OUT}/{table}.json", "w"), indent=1)
        print(f"{len(data[table]):>6} rows")

    index = build_index(data)
    json.dump(index, open(f"{OUT}/index.json", "w"), indent=1)
    print(f"  {'index.json':<16}{len(index):>6} drugs")

    # --- self-test: the two demo paths must resolve, or the build is dead ---
    print("\nself-test")
    checks = [
        ("capecitabine", "DPYD", "Poor Metabolizer", "avoid"),
        ("codeine", "CYP2D6", "Ultrarapid", "avoid"),
        ("abacavir", "HLA-B", "positive", None),
    ]
    ok = True
    for drug, gene, term, expect in checks:
        hit = find(index, drug, gene, term)
        if not hit:
            print(f"  FAIL  {drug} / {gene} / {term} -> no match")
            ok = False
            continue
        text = (hit["recommendation"] or "")
        flag = "" if (expect is None or expect in text.lower()) else "  <-- unexpected wording"
        print(f"  ok    {drug} / {gene} / {hit['lookup']}")
        print(f"        {text[:110]}{flag}")
        print(f"        {hit['classification']} | Level A: {hit['cpic_level_a']} | "
              f"{len(hit['citations'])} citation(s)")

    print("\nPASS - cached, joined, and both demo paths resolve." if ok
          else "\nFAIL - fix before building on this.")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
