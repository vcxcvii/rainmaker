import { execFileSync } from "node:child_process";

const steps = ["src/fetch-clarity.ts", "src/finding-extractor.ts", "src/pr-generator.ts"];

for (const step of steps) {
  console.log(`--- ${step} ---`);
  execFileSync("tsx", [step], { stdio: "inherit" });
}
