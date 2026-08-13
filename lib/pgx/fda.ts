/**
 * FDA Table of Pharmacogenetic Associations — cached lookup.
 *
 * data/fda-pgx.json is scraped once at author time (scripts/scrape-fda.ts) and
 * committed. Read ONCE at module load with node:fs, exactly like the CPIC cache
 * in ./index.ts. NOTHING here ever touches the network at runtime.
 *
 * ABSENCE IS NOT EVIDENCE. The FDA publishes a table of *associations*, not a
 * table of exclusions: a pair that is not in it means the FDA has not published
 * an association, NOT that none exists. So the only two answers this module can
 * give are "here is the FDA's verbatim text" and `null`. It never returns, and
 * callers must never render, a negative claim.
 *
 * A missing or unparseable file yields `null` everywhere and no throw — the
 * badge is additive to the demo and must never be able to take it down.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { FdaAssociation } from "../contracts";

/** The shape of data/fda-pgx.json, as written by scripts/scrape-fda.ts. */
interface FdaFile {
  note: string;
  source_url: string;
  retrieved_at: string;
  /** how the page was actually retrieved. RENDERED FROM THE FILE, never asserted
   *  in code — re-running the scrape through a proxy flips this one field and
   *  the UI must stay true either way (REGISTER R-20). */
  via: string;
  associations: {
    gene: string;
    drug: string;
    section: number;
    affected_subgroups: string;
    description: string;
  }[];
}

const FDA_PATH = join(process.cwd(), "data", "fda-pgx.json");

/** Exported only so a test can pin the missing-file path: the demo has to
 *  survive without data/fda-pgx.json, and a path that cannot be exercised is
 *  a claim, not a behaviour. */
export function loadFdaTable(path: string = FDA_PATH): FdaFile | null {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as FdaFile;
    return Array.isArray(parsed.associations) ? parsed : null;
  } catch {
    return null;
  }
}

const table = loadFdaTable();

/**
 * Gene matches exactly (after trim); drug matches case-insensitively, because
 * the FDA writes "Capecitabine" and CPIC writes "capecitabine" — a case fold is
 * not a normalisation of the CONTENT, and the string rendered on screen is
 * always the FDA's own spelling, never the folded one.
 *
 * EVERY matching row is carried, not the first: the FDA publishes two rows for
 * (CYP2D6, codeine) — ultrarapid metabolizers in section 1, poor metabolizers
 * in section 2 — and picking one would make the citation insertion-order
 * dependent, the same defect the D6 guard exists for in evaluate.ts. Rows are
 * NOT filtered by the patient's phenotype: `affected_subgroups` is regulatory
 * prose, not a join key, and fuzzy-matching it would be inventing a join.
 */
export function fdaAssociation(gene: string, drug: string): FdaAssociation | null {
  if (!table) return null;
  const wantGene = gene.trim();
  const wantDrug = drug.trim().toLowerCase();

  const rows = table.associations.filter(
    (a) => a.gene.trim() === wantGene && a.drug.trim().toLowerCase() === wantDrug,
  );
  if (rows.length === 0) return null; // absence -> no badge, never a negative claim

  return {
    gene: rows[0].gene,
    drug: rows[0].drug, // the FDA's own spelling, verbatim
    rows: rows.map((r) => ({
      section: r.section,
      affected_subgroups: r.affected_subgroups, // VERBATIM cell text
      description: r.description, // VERBATIM cell text
    })),
    source_url: table.source_url,
    retrieved_at: table.retrieved_at,
    via: table.via,
  };
}
