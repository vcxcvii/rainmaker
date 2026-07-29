import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import type { Finding } from "../analyze/findings.js";
import { mapFindingToSuggestion } from "../analyze/component-mapper.js";

const REPO = process.env.LAZARUS_TARGET_REPO ?? "vcxcvii/vcxcvii.github.io";
const LABEL = "lazarus-pit";

function latestFindingsFile(dataDir: string): string {
  const files = readdirSync(dataDir)
    .filter((f) => f.startsWith("findings-") && f.endsWith(".json"))
    .sort();
  if (files.length === 0) throw new Error("No findings-*.json files in data/. Run `npm run diagnose` first.");
  return join(dataDir, files.at(-1)!);
}

function existingOpenTitles(): Set<string> {
  const out = execFileSync(
    "gh",
    ["issue", "list", "--repo", REPO, "--label", LABEL, "--state", "open", "--json", "title", "--limit", "100"],
    { encoding: "utf-8" },
  );
  const issues: Array<{ title: string }> = JSON.parse(out);
  return new Set(issues.map((i) => i.title));
}

function ensureLabelExists(): void {
  try {
    execFileSync("gh", ["label", "list", "--repo", REPO, "--search", LABEL, "--json", "name"], { encoding: "utf-8" });
    execFileSync(
      "gh",
      ["label", "create", LABEL, "--repo", REPO, "--color", "8B0000", "--description", "Filed by lazarus-pit UX agent", "--force"],
      { stdio: "ignore" },
    );
  } catch {
    // label may already exist or repo perms differ — non-fatal
  }
}

function createIssue(title: string, body: string): string {
  return execFileSync(
    "gh",
    ["issue", "create", "--repo", REPO, "--title", title, "--body", body, "--label", LABEL],
    { encoding: "utf-8" },
  ).trim();
}

function main() {
  const dataDir = join(import.meta.dirname, "..", "data");
  const file = latestFindingsFile(dataDir);
  const findings: Finding[] = JSON.parse(readFileSync(file, "utf-8"));

  if (findings.length === 0) {
    console.log("No findings to file. Site's healthy (or thresholds too strict).");
    return;
  }

  ensureLabelExists();
  const already = existingOpenTitles();

  for (const finding of findings) {
    const { title, body } = mapFindingToSuggestion(finding);
    if (already.has(title)) {
      console.log(`Skip (already open): ${title}`);
      continue;
    }
    const url = createIssue(title, body);
    console.log(`Filed: ${title}\n  ${url}`);
  }
}

main();
