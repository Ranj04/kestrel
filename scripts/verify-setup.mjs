#!/usr/bin/env node
/**
 * Preflight. Run this the moment the CPIC cache lands, and again any time an
 * alert mysteriously stops firing.
 *
 *     npm run verify
 *
 * It answers one question: do the three data files actually agree with each
 * other? The failure this exists to catch is a `lookup` string in patients.json
 * that does not match CPIC character for character -- because that failure is
 * silent. No error, no warning, the alert just never fires, and you lose an
 * hour to it on the clock.
 */
import { readFileSync, existsSync } from "node:fs";

const ok = (m) => console.log(`  \x1b[32mok\x1b[0m    ${m}`);
const bad = (m) => { console.log(`  \x1b[31mFAIL\x1b[0m  ${m}`); failures++; };
const info = (m) => console.log(`        \x1b[2m${m}\x1b[0m`);
let failures = 0;

const read = (p) => JSON.parse(readFileSync(p, "utf8"));

/**
 * THE severity rule. Must stay character-identical to the one specified in
 * .sol/prompts/phase1-fable-engine.md and implemented in lib/pgx/evaluate.ts.
 *
 * REGISTER.md R-5: this is a second declaration of a closed set (rule 4a-ter,
 * vocabulary kind) -- mistype one and nothing fails to compile, the two simply
 * stop agreeing, and this preflight prints PASS while evaluate.ts disagrees
 * with it. THAT DEFEATS THE ENTIRE POINT OF THE PREFLIGHT.
 *
 * Fable closes this in Phase 1: export severityOf from lib/pgx/evaluate.ts and
 * import it here. Sol's review prompt flags it as a finding if that did not happen.
 */
export function severityOf(text, classification) {
  const t = String(text ?? "");
  if (/avoid/i.test(t)) return "critical";
  if (classification === "Strong" && /reduce|not recommended/i.test(t)) return "critical";
  if (/no indication to change|label-recommended|standard dosing|no recommendation/i.test(t))
    return "none";
  return "caution";
}



// --- 4a-bis positive control -------------------------------------------------
// `npm run verify -- --prove` corrupts one lookup in memory and asserts this
// checker reports a FAILURE. A checker that cannot fail is not evidence of
// anything, and this one guards the single silent failure in the data layer.
const PROVE = process.argv.includes("--prove");

console.log("\nattest preflight\n");

// ---------------------------------------------------------------- 1. files
if (!existsSync("data/cpic/index.json")) {
  bad("data/cpic/index.json missing");
  info("run: python3 scripts/cache_cpic.py");
  console.log("\nnothing else can be checked until the cache exists.\n");
  process.exit(1);
}
const index = read("data/cpic/index.json");
ok(`data/cpic/index.json — ${Object.keys(index).length} drugs`);

const { patients } = read("data/patients.json");
ok(`data/patients.json — ${patients.length} patients`);
if (PROVE) {
  patients.find((p) => p.patientId === "pt_okafor").results[0].lookup = "0.O";
  console.log("        \x1b[2m--prove: corrupted pt_okafor DPYD lookup on purpose (0.0 -> 0.O)\x1b[0m");
}

const policyFile = read("data/policies.json");
const clauseCount = policyFile.policies.reduce((n, p) => n + p.clauses.length, 0);
ok(`data/policies.json — ${policyFile.policies.length} policies, ${clauseCount} clauses`);

// ------------------------------------------- 2. do patient lookups resolve?
console.log("\ngenotype lookups resolve against CPIC");
const DEMO = [
  ["pt_okafor", "capecitabine", "DPYD", "critical"],
  ["pt_reyes", "codeine", "CYP2D6", "critical"],
  ["pt_lindqvist", "capecitabine", "DPYD", "none"],
];

for (const [pid, drug, gene, expect] of DEMO) {
  const p = patients.find((x) => x.patientId === pid);
  if (!p) { bad(`${pid} not in patients.json`); continue; }
  const r = p.results.find((x) => x.gene === gene);
  if (!r) { bad(`${pid} has no ${gene} result`); continue; }

  const entries = index[drug.toLowerCase()]?.[gene];
  if (!entries) {
    bad(`no CPIC entries for ${drug} / ${gene}`);
    info(`genes present for ${drug}: ${Object.keys(index[drug.toLowerCase()] ?? {}).join(", ") || "NONE"}`);
    continue;
  }

  // Join on `lookup` ONLY. For DPYD/CYP2D6 that is an activity score, so a
  // patient carrying "Poor Metabolizer" here matches nothing -- which is the
  // exact failure this preflight was built to catch, and did.
  const hit = entries.find(
    (e) => String(e.lookup).trim().toLowerCase() === r.lookup.trim().toLowerCase(),
  );
  if (!hit) {
    bad(`${pid}: lookup "${r.lookup}" does not match any CPIC entry for ${drug}/${gene}`);
    info(`CPIC offers: ${[...new Set(entries.map((e) => JSON.stringify(e.lookup)))].join(" | ")}`);
    info("fix the lookup string in data/patients.json to match one of those exactly");
    info("NOTE: `lookup` is CPIC's join key — an activity score for these genes, not a phenotype name");
    continue;
  }

  // The display name must agree too, or the screen and the citation disagree.
  if (r.phenotype !== hit.phenotype) {
    bad(`${pid}: phenotype "${r.phenotype}" but CPIC lookup ${JSON.stringify(r.lookup)} is "${hit.phenotype}"`);
    info("the join succeeded on the wrong row, or patients.json mislabels it");
  }

  const text = String(hit.recommendation ?? "");
  const severity = severityOf(text, hit.classification);

  if (severity !== expect) {
    bad(`${pid} + ${drug}: expected ${expect}, derived ${severity}`);
    info(`"${text.slice(0, 120)}"`);
  } else {
    ok(`${pid} + ${drug} — lookup ${JSON.stringify(hit.lookup)} = ${hit.phenotype} — ${severity}`);
    info(`"${text.slice(0, 96)}${text.length > 96 ? "…" : ""}"`);
    info(`${hit.classification ?? "?"} · Level A: ${hit.cpic_level_a} · ${(hit.citations ?? []).length} citation(s)`);
  }
}

// ------------------------------------------------ 3. policy clauses resolve
// Payers write policy in phenotype language ("poor metabolizer"), so clause
// criteria match on `phenotype`, not on CPIC's activity-score `lookup`. That is
// the one place matching is on the display field, and it is deliberate.
console.log("\npolicy clauses reference phenotypes that exist");
for (const pol of policyFile.policies) {
  for (const c of pol.clauses) {
    const crit = c.criterion ?? {};
    if (crit.type !== "phenotype_restriction" || !crit.phenotype) continue;
    const drug = pol.drugs.find((d) => index[d.toLowerCase()]?.[crit.gene]);
    if (!drug) { bad(`${c.clauseId}: no CPIC data for ${crit.gene} on any of ${pol.drugs.join("/")}`); continue; }
    const entries = index[drug.toLowerCase()][crit.gene];
    const hit = entries.some(
      (e) => String(e.phenotype).trim().toLowerCase() === String(crit.phenotype).trim().toLowerCase(),
    );
    hit
      ? ok(`${c.clauseId} — ${crit.gene} "${crit.phenotype}"`)
      : bad(`${c.clauseId}: "${crit.phenotype}" not a CPIC phenotype for ${crit.gene}/${drug}`);
  }
}

// -------------------------------------------------------- 4. scopes overlap
console.log("\nsupersede beat will actually discriminate");
const rev = policyFile.revision;
const affected = new Set(rev.affectedScopes);
const byPolicy = Object.fromEntries(
  policyFile.policies.map((p) => [
    p.policyId,
    [...new Set(p.clauses.flatMap((c) => c.scopes))],
  ]),
);
const hitPolicies = Object.entries(byPolicy).filter(([, s]) => s.some((x) => affected.has(x)));
const missPolicies = Object.entries(byPolicy).filter(([, s]) => !s.some((x) => affected.has(x)));

hitPolicies.length
  ? ok(`revision hits: ${hitPolicies.map(([id]) => id).join(", ")}`)
  : bad("revision hits nothing — the superseded authorization will never appear");
missPolicies.length
  ? ok(`revision spares: ${missPolicies.map(([id]) => id).join(", ")}`)
  : bad("revision hits EVERYTHING — nothing survives, so selective invalidation proves nothing");

// ------------------------------------------------------------------- done
if (PROVE) {
  const caught = failures > 0;
  console.log(
    caught
      ? "\n\x1b[32mPROVE OK\x1b[0m — a corrupted lookup is reported as a failure. This checker can fail.\n"
      : "\n\x1b[31mPROVE FAILED\x1b[0m — a corrupted lookup was NOT caught. This preflight is vacuous; do not trust a pass from it.\n",
  );
  process.exit(caught ? 0 : 1);
}

console.log(
  failures === 0
    ? "\n\x1b[32mPASS\x1b[0m — data layer is consistent. Build on it.\n"
    : `\n\x1b[31m${failures} FAILURE(S)\x1b[0m — fix these before writing feature code.\n`,
);
process.exit(failures === 0 ? 0 : 1);
