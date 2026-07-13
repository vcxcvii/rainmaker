import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

interface ClarityMetric {
  metricName: string;
  information: Array<Record<string, unknown>>;
}

export interface Finding {
  metric: string;
  severity: "low" | "medium" | "high";
  value: number;
  threshold: number;
  hypothesis: string;
}

const THRESHOLDS: Record<
  string,
  { field: string; warn: number; high: number; hypothesis: string }
> = {
  DeadClickCount: {
    field: "sessionsWithMetricPercentage",
    warn: 5,
    high: 15,
    hypothesis: "Users clicking non-interactive elements — likely a link/button that looks clickable but isn't, or a slow-loading interactive element.",
  },
  RageClickCount: {
    field: "sessionsWithMetricPercentage",
    warn: 3,
    high: 10,
    hypothesis: "Repeated frantic clicking — element is unresponsive or feedback is too slow/absent.",
  },
  QuickbackClick: {
    field: "sessionsWithMetricPercentage",
    warn: 10,
    high: 25,
    hypothesis: "Users land on a page/link and immediately bounce back — content mismatch between the link's promise and the destination.",
  },
  ScriptErrorCount: {
    field: "sessionsWithMetricPercentage",
    warn: 1,
    high: 5,
    hypothesis: "JS errors occurring in-session — check console/error tracking for stack traces.",
  },
  ErrorClickCount: {
    field: "sessionsWithMetricPercentage",
    warn: 1,
    high: 5,
    hypothesis: "Clicks are triggering JS errors — likely a broken handler or race condition.",
  },
};

function latestClarityFile(dataDir: string): string {
  const files = readdirSync(dataDir)
    .filter((f) => f.startsWith("clarity-") && f.endsWith(".json"))
    .sort();
  if (files.length === 0) throw new Error("No clarity-*.json files in data/. Run `npm run fetch` first.");
  return join(dataDir, files.at(-1)!);
}

// Below this many human sessions, per-metric percentages and averages are
// dominated by individual (often bot) sessions and can't be trusted.
const MIN_HUMAN_SESSIONS = 20;

export function humanSessionCount(metrics: ClarityMetric[]): number {
  const traffic = metrics.find((m) => m.metricName === "Traffic")?.information?.[0];
  const total = Number(traffic?.totalSessionCount ?? 0);
  const bots = Number(traffic?.totalBotSessionCount ?? 0);
  return Math.max(0, total - bots);
}

export function extractFindings(metrics: ClarityMetric[]): Finding[] {
  const findings: Finding[] = [];

  const humanSessions = humanSessionCount(metrics);
  if (humanSessions < MIN_HUMAN_SESSIONS) {
    findings.push({
      metric: "Traffic",
      severity: "low",
      value: humanSessions,
      threshold: MIN_HUMAN_SESSIONS,
      hypothesis:
        "Too few human (non-bot) sessions in the window to diagnose UX — this is a distribution problem, not a friction problem. Skipping all other findings until traffic clears the floor.",
    });
    return findings;
  }

  for (const [metricName, rule] of Object.entries(THRESHOLDS)) {
    const metric = metrics.find((m) => m.metricName === metricName);
    const info = metric?.information?.[0];
    if (!info) continue;
    const value = Number(info[rule.field] ?? 0);
    if (value >= rule.high) {
      findings.push({ metric: metricName, severity: "high", value, threshold: rule.high, hypothesis: rule.hypothesis });
    } else if (value >= rule.warn) {
      findings.push({ metric: metricName, severity: "medium", value, threshold: rule.warn, hypothesis: rule.hypothesis });
    }
  }

  const scrollDepth = metrics.find((m) => m.metricName === "ScrollDepth")?.information?.[0];
  const avgScroll = Number(scrollDepth?.averageScrollDepth ?? 100);
  if (avgScroll < 40) {
    findings.push({
      metric: "ScrollDepth",
      severity: "high",
      value: avgScroll,
      threshold: 40,
      hypothesis: "Most users aren't scrolling past the fold — key content below it isn't being seen.",
    });
  } else if (avgScroll < 60) {
    findings.push({
      metric: "ScrollDepth",
      severity: "medium",
      value: avgScroll,
      threshold: 60,
      hypothesis: "Moderate scroll depth — content further down the page gets partial attention.",
    });
  }

  return findings.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "high" ? -1 : 1));
}

function main() {
  const dataDir = join(import.meta.dirname, "..", "data");
  const file = latestClarityFile(dataDir);
  const metrics: ClarityMetric[] = JSON.parse(readFileSync(file, "utf-8"));
  const findings = extractFindings(metrics);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = join(dataDir, `findings-${stamp}.json`);
  writeFileSync(outPath, JSON.stringify(findings, null, 2));

  console.log(`${findings.length} finding(s) from ${file}`);
  for (const f of findings) {
    console.log(`  [${f.severity}] ${f.metric}: ${f.value} (threshold ${f.threshold}) — ${f.hypothesis}`);
  }
  console.log(`Saved ${outPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
