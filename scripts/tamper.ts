import { tamper } from "../lib/ledger/tamper.ts";

const requested = process.argv[2] === undefined ? undefined : Number(process.argv[2]);
if (requested !== undefined && !Number.isInteger(requested)) {
  throw new Error("Usage: npx tsx scripts/tamper.ts [integer-seq]");
}

console.log(JSON.stringify(tamper(requested), null, 2));
