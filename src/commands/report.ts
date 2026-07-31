import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readLedger } from '../ledger/append.js';
import { materialise } from '../ledger/materialise.js';
import { renderReport } from '../report/render.js';
import type { ReportWindow } from '../report/windows.js';
import type { Diagnosis } from './audit.js';

const LEDGER = join('data', 'ledger.jsonl');
const SNAPSHOTS = join('data', 'snapshots');
const REPORTS_DIR = 'reports';

const VALID_WINDOWS: ReportWindow[] = ['pulse', '28d', 'month', 'quarter', 'half-year', 'strategy'];

function flag(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function snapshotDirs(): string[] {
  return existsSync(SNAPSHOTS) ? readdirSync(SNAPSHOTS).sort() : [];
}

function earliestSnapshotAt(): string | null {
  const dirs = snapshotDirs();
  if (dirs.length === 0) return null;
  const path = join(SNAPSHOTS, dirs[0], 'crawl.json');
  if (!existsSync(path)) return null;
  const crawl = JSON.parse(readFileSync(path, 'utf8')) as { fetched_at: string };
  return crawl.fetched_at;
}

function latestCapabilities(): Record<string, 'live' | 'missing' | 'error'> {
  const dirs = snapshotDirs();
  if (dirs.length === 0) return {};
  const path = join(SNAPSHOTS, dirs[dirs.length - 1], 'diagnosis.json');
  if (!existsSync(path)) return {};
  const diagnosis = JSON.parse(readFileSync(path, 'utf8')) as Diagnosis;
  return diagnosis.capabilities;
}

export function runReport(args: string[]): number {
  const window = (flag(args, '--window') ?? '28d') as ReportWindow;
  if (!VALID_WINDOWS.includes(window)) {
    console.error(`Unknown window "${window}". Use one of: ${VALID_WINDOWS.join(', ')}`);
    return 1;
  }

  const now = new Date().toISOString();
  const events = readLedger(LEDGER);
  const state = materialise(events, now);

  const result = renderReport({
    window,
    now,
    earliestSnapshotAt: earliestSnapshotAt(),
    state,
    events,
    capabilities: latestCapabilities(),
  });

  if (!result.ok) {
    console.error(result.refusal);
    return 1;
  }

  console.log(result.text);

  mkdirSync(REPORTS_DIR, { recursive: true });
  const path = join(REPORTS_DIR, `${window}-${now.slice(0, 10)}.md`);
  writeFileSync(path, `${result.text}\n`, 'utf8');
  console.log(`\nWritten to ${path}`);
  return 0;
}
