import "dotenv/config";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const TOKEN = process.env.CLARITY_TOKEN;
if (!TOKEN) throw new Error("CLARITY_TOKEN missing in .env");

const DATA_DIR = join(import.meta.dirname, "..", "data");
const CALL_LOG = join(DATA_DIR, "call-log.json");
const DAILY_LIMIT = 10;

function checkAndRecordCallBudget(): void {
  mkdirSync(DATA_DIR, { recursive: true });
  const today = new Date().toISOString().slice(0, 10);
  const log: Record<string, number> = existsSync(CALL_LOG)
    ? JSON.parse(readFileSync(CALL_LOG, "utf-8"))
    : {};
  const usedToday = log[today] ?? 0;
  if (usedToday >= DAILY_LIMIT) {
    throw new Error(`Clarity API daily limit (${DAILY_LIMIT}) hit for ${today}`);
  }
  log[today] = usedToday + 1;
  writeFileSync(CALL_LOG, JSON.stringify(log, null, 2));
}

async function fetchClarityInsights(numOfDays: 1 | 2 | 3 = 3) {
  checkAndRecordCallBudget();
  const res = await fetch(
    `https://www.clarity.ms/export-data/api/v1/project-live-insights?numOfDays=${numOfDays}`,
    { headers: { Authorization: `Bearer ${TOKEN}` } },
  );
  if (!res.ok) {
    throw new Error(`Clarity API error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function main() {
  const data = await fetchClarityInsights(3);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = join(DATA_DIR, `clarity-${stamp}.json`);
  writeFileSync(outPath, JSON.stringify(data, null, 2));
  console.log(`Saved ${outPath}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
