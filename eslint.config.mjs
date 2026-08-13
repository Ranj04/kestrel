// eslint-config-next@16 ships flat configs; wrapping them in FlatCompat made
// ESLint 9 throw "Converting circular structure to JSON" before linting a
// single file (.sol/requests/phase1-sol-lint.md). Import them directly.
import cwv from "eslint-config-next/core-web-vitals";
import ts from "eslint-config-next/typescript";

const config = [
  ...cwv,
  ...ts,
  {
    // Server-side library/test code, not React. Without this the react-hooks
    // rule misreads Sol's `useEphemeral` (a ledger state helper) as a React
    // hook and errors on files that never render anything.
    files: ["lib/**", "scripts/**", "tests/**"],
    rules: { "react-hooks/rules-of-hooks": "off" },
  },
];

export default config;
