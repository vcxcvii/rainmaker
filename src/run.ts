import { execFileSync } from "node:child_process";

// Legacy Clarity-only pipeline, carried over from lazarus-pit. Superseded by
// `rainmaker routine` once the GA4/GSC fetchers and ledger land (blocks 3 and 4).
const steps = ["src/fetch/clarity.ts", "src/analyze/findings.ts", "src/issues/filer.ts"];

for (const step of steps) {
  console.log(`--- ${step} ---`);
  execFileSync("tsx", [step], { stdio: "inherit" });
}
