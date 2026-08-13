/**
 * Stage 1 of phase4-sponsors item 2.
 *
 * The FDA publishes ~116 gene-drug pharmacogenetic associations as HTML only —
 * no CSV, no API, no download. Scrape it once, cache it, and the app never
 * touches the network at runtime.
 *
 *   BRIGHTDATA_ZONE=<zone> npx tsx scripts/scrape-fda.ts
 *   npx tsx scripts/scrape-fda.ts --from-file /tmp/fda.html   # parser only, no network
 *
 * VERBATIM OR NOTHING. Cell text is copied through unchanged: entities decoded,
 * tags stripped, whitespace collapsed — no summarising, no paraphrase, no
 * reconstruction. A cell that cannot be parsed causes its row to be OMITTED and
 * logged, never rebuilt. The standing rule in _context.md covers scraped sources.
 *
 * `via` records how the bytes were actually obtained. A direct fetch is not a
 * Bright Data integration and must not be described as one.
 */
import { writeFileSync, readFileSync } from "node:fs";

const SOURCE_URL =
  "https://www.fda.gov/medical-devices/precision-medicine/table-pharmacogenetic-associations";
const OUT = "data/fda-pgx.json";

interface Association {
  gene: string;
  drug: string;
  section: number;
  affected_subgroups: string;
  description: string;
}

/** Strip tags, decode the entities the FDA page actually uses, collapse runs of
 *  whitespace. Nothing else — this must not "clean up" clinical wording. */
function cellText(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&ge;/g, "≥")
    .replace(/&le;/g, "≤")
    .replace(/\s+/g, " ")
    .trim();
}

function parse(html: string): { rows: Association[]; skipped: number } {
  const tables = html.match(/<table[\s\S]*?<\/table>/gi) ?? [];
  const rows: Association[] = [];
  let skipped = 0;

  tables.forEach((table, i) => {
    const section = i + 1; // the page presents three numbered sections
    for (const tr of table.match(/<tr[\s\S]*?<\/tr>/gi) ?? []) {
      const tds = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => cellText(m[1]));
      if (tds.length < 4) continue; // header row, or a layout row — not data
      const [drug, gene, affected_subgroups, description] = tds;
      if (!drug || !gene) {
        skipped++; // unparseable: omit and count it. NEVER reconstruct.
        continue;
      }
      rows.push({ gene, drug, section, affected_subgroups, description });
    }
  });
  return { rows, skipped };
}

async function viaBrightData(): Promise<string> {
  const key = process.env.BRIGHTDATA_API_KEY?.trim();
  const zone = process.env.BRIGHTDATA_ZONE?.trim();
  if (!key) throw new Error("BRIGHTDATA_API_KEY is not set");
  if (!zone)
    throw new Error(
      "BRIGHTDATA_ZONE is not set. The account had no zones (R-20) — create a Web " +
        "Unlocker zone in the Bright Data dashboard and pass its name.",
    );
  const res = await fetch("https://api.brightdata.com/request", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ zone, url: SOURCE_URL, format: "raw" }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Bright Data ${res.status}: ${body.slice(0, 200)}`);
  return body;
}

/** Plain GET. NOT a Bright Data integration — the output records `via: "direct"`
 *  so nothing downstream can describe it as one. Exists so stage 2 can be built
 *  and verified while a Bright Data zone is still being provisioned (R-20);
 *  re-running without --direct upgrades the provenance and nothing else. */
async function viaDirect(): Promise<string> {
  const res = await fetch(SOURCE_URL, { headers: { "user-agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`direct fetch ${res.status}`);
  return res.text();
}

async function main() {
  const fileArg = process.argv.indexOf("--from-file");
  const fromFile = fileArg !== -1 ? process.argv[fileArg + 1] : null;
  const direct = process.argv.includes("--direct");

  let html: string;
  let via: string;
  if (fromFile) {
    html = readFileSync(fromFile, "utf8");
    via = "file (parser test only — NOT a scrape)";
    console.log(`  reading ${fromFile} — parser test, no network`);
  } else if (direct) {
    console.log("  fetching DIRECTLY — this is NOT a Bright Data integration");
    html = await viaDirect();
    via = "direct";
  } else {
    console.log(`  fetching via Bright Data zone "${process.env.BRIGHTDATA_ZONE}"…`);
    html = await viaBrightData();
    via = "brightdata";
  }

  const { rows, skipped } = parse(html);
  console.log(`  ${rows.length} associations parsed, ${skipped} row(s) skipped as unparseable`);

  // The two demo pairs decide whether stage 2 is worth starting at all.
  const has = (g: string, d: string) =>
    rows.find(
      (r) =>
        r.gene.toLowerCase() === g.toLowerCase() &&
        r.drug.toLowerCase().includes(d.toLowerCase()),
    );
  const dpyd = has("DPYD", "capecitabine");
  const cyp = has("CYP2D6", "codeine");
  console.log(`  DPYD / capecitabine : ${dpyd ? "PRESENT" : "MISSING"}`);
  if (dpyd) console.log(`      "${dpyd.description.slice(0, 96)}"`);
  console.log(`  CYP2D6 / codeine    : ${cyp ? "PRESENT" : "MISSING"}`);
  if (cyp) console.log(`      "${cyp.description.slice(0, 96)}"`);

  if (!fromFile) {
    writeFileSync(
      OUT,
      JSON.stringify(
        {
          note:
            "Scraped from the FDA Table of Pharmacogenetic Associations via Bright Data. " +
            "Verbatim cell text only — no summarisation, no paraphrase. Absence from this " +
            "table is NOT evidence of absence: it lists associations, not exclusions.",
          source_url: SOURCE_URL,
          retrieved_at: new Date().toISOString(),
          via,
          associations: rows,
        },
        null,
        1,
      ) + "\n",
    );
    console.log(`  wrote ${OUT}`);
  }

  if (!dpyd || !cyp) {
    console.log("\nFAIL — a demo pair is missing. Do NOT start stage 2.");
    process.exit(1);
  }
  console.log("\nPASS — both demo pairs resolve.");
}

main().catch((e) => {
  console.error(`\nFAIL — ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
