import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { appendEvents, readLedger, statusIndex } from '../ledger/append.js';
import { materialise } from '../ledger/materialise.js';
import { readCommitsSince, shippedFromCommits } from '../ledger/shipped.js';
import { fileIssues, planIssues, targetRepo } from '../issues/filer.js';
import { runAudit } from './audit.js';
import { runFetch } from './fetch.js';
import type { Diagnosis } from './audit.js';

const LEDGER = join('data', 'ledger.jsonl');
const LAST_ROUTINE_REF = join('data', '.last-routine-ref');

export async function refreshForRoutine(deps: {
  fetch: (args: string[]) => Promise<number>;
  audit: (args: string[]) => Promise<number>;
}, args: string[] = []): Promise<number> {
  const providerIndex = args.indexOf('--provider');
  const providerArgs = providerIndex >= 0 && args[providerIndex + 1]
    ? ['--provider', args[providerIndex + 1]]
    : [];
  const fetched = await deps.fetch(['--source', 'all', ...providerArgs]);
  if (fetched !== 0) return fetched;
  return deps.audit(['--refresh', '--json']);
}

function latestDiagnosis(): Diagnosis | null {
  const dir = join('data', 'snapshots');
  if (!existsSync(dir)) return null;
  const entries = readdirSync(dir).sort();
  if (entries.length === 0) return null;
  const path = join(dir, entries[entries.length - 1], 'diagnosis.json');
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8')) as Diagnosis;
}

function readLastRoutineRef(): string | null {
  return existsSync(LAST_ROUTINE_REF) ? readFileSync(LAST_ROUTINE_REF, 'utf8').trim() : null;
}

function writeLastRoutineRef(): void {
  try {
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf-8' }).trim();
    mkdirSync('data', { recursive: true });
    writeFileSync(LAST_ROUTINE_REF, head);
  } catch {
    // not a git repo; nothing to persist
  }
}

/**
 * The scheduled pass: fetch/audit, scan commits for shipped work, file issues
 * in revenue order, all idempotently. Running this twice in one day must
 * file zero duplicate issues and append zero duplicate shipped events.
 */
export async function runRoutine(args: string[]): Promise<number> {
  console.log('Refreshing measurements...');
  const auditResult = await refreshForRoutine({ fetch: runFetch, audit: runAudit }, args);
  if (auditResult !== 0) {
    console.log('Could not write and audit a fresh snapshot. Run `rainmaker doctor` for setup details.');
    return auditResult;
  }

  const now = new Date().toISOString();
  const status = statusIndex(readLedger(LEDGER));

  let shippedEvents: ReturnType<typeof shippedFromCommits> = [];
  try {
    const commits = readCommitsSince(readLastRoutineRef());
    shippedEvents = shippedFromCommits({ commits, status, now });
  } catch {
    console.log('Could not read git history for shipped detection (not a git repo, or no commits). Skipping.');
  }

  const appendResult = appendEvents(LEDGER, shippedEvents);
  if (appendResult.appended.length > 0) {
    console.log(`Shipped, from commit trailers: ${appendResult.appended.length}`);
  }
  writeLastRoutineRef();

  const diagnosis = latestDiagnosis();
  if (!diagnosis) {
    console.log('No diagnosis found after refresh. Nothing to file.');
    return 0;
  }

  const repo = targetRepo();
  if (!repo) {
    console.log(
      'RAINMAKER_TARGET_REPO not set. Findings were refreshed and shipped events appended, ' +
        'but no issues were filed. Set RAINMAKER_TARGET_REPO to file them.',
    );
    return 0;
  }

  const rebuilt = materialise(readLedger(LEDGER), now);
  const alreadyFiled = new Set(
    Object.entries(rebuilt.findings)
      .filter(([, finding]) => finding.status !== 'opened')
      .map(([id]) => id),
  );

  const planned = planIssues(diagnosis.findings, alreadyFiled);
  if (planned.length === 0) {
    console.log('Nothing new to file.');
    return 0;
  }

  const filed = fileIssues(repo, planned);
  console.log(`Filed ${filed.length} issue(s) in revenue order (${planned.length - filed.length} already open).`);

  if (filed.length > 0) {
    const acknowledged = filed.map((issue) => ({
      ts: now,
      id: issue.finding_id,
      event: 'acknowledged' as const,
      cause: 'routine',
    }));
    appendEvents(LEDGER, acknowledged);
  }

  return 0;
}
