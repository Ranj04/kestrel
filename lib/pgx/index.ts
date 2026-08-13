/**
 * CPIC cache + patient loader. Reads the committed JSON ONCE at module load
 * with node:fs. NO network call to CPIC at runtime, ever — the cache is the
 * only source of clinical truth and conference wifi is assumed hostile.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Patient } from "../contracts";

export interface CpicCitation {
  pmid: string;
  title: string;
  year: number;
}

/** One row of data/cpic/index.json. `lookup` is THE JOIN KEY — an activity
 *  score for DPYD/CYP2D6 ("0.0", "3.0"), allele status for HLA. `phenotype`
 *  is the human name, display only, null for HLA. Never join on phenotype. */
export interface CpicEntry {
  gene: string;
  lookup: string;
  phenotype: string | null;
  drug: string;
  recommendation: string;
  classification: string | null;
  implication: string | null;
  comments: string | null;
  population: string | null;
  cpic_level_a: boolean;
  guideline_name: string | null;
  guideline_url: string | null;
  citations: CpicCitation[];
  _source: string;
}

export type CpicIndex = Record<string, Record<string, CpicEntry[]>>;

const INDEX_PATH = join(process.cwd(), "data", "cpic", "index.json");
const PATIENTS_PATH = join(process.cwd(), "data", "patients.json");

let cpicIndex: CpicIndex;
try {
  cpicIndex = JSON.parse(readFileSync(INDEX_PATH, "utf8")) as CpicIndex;
} catch {
  // Failing loudly at boot is correct; failing silently at demo time is not.
  throw new Error(
    `data/cpic/index.json is missing or unreadable (looked at ${INDEX_PATH}). ` +
      `Run: python3 scripts/cache_cpic.py — the app never fetches CPIC at runtime.`,
  );
}

const patientFile = JSON.parse(readFileSync(PATIENTS_PATH, "utf8")) as { patients: Patient[] };

/**
 * Phase 2b hook (Sol): supersede edits evidence IN MEMORY ONLY — the file on
 * disk is clinical source of truth and a demo button must never mutate it.
 * Sol registers a transform here instead of editing this file (ownership rule).
 */
type IndexOverlay = (index: CpicIndex) => CpicIndex;
let overlay: IndexOverlay | null = null;
export function setIndexOverlay(fn: IndexOverlay | null): void {
  overlay = fn;
}

export function getIndex(): CpicIndex {
  return overlay ? overlay(cpicIndex) : cpicIndex;
}

export function getPatients(): Patient[] {
  return patientFile.patients;
}

export function getPatient(patientId: string): Patient | null {
  return patientFile.patients.find((p) => p.patientId === patientId) ?? null;
}
