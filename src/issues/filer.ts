import { execFileSync } from 'node:child_process';
import type { Finding } from '../analyze/checks.js';
import { normalisePath } from '../analyze/checks.js';

const LABEL = 'rainmaker';

export function targetRepo(): string {
  return process.env.RAINMAKER_TARGET_REPO ?? process.env.PAYDIRT_TARGET_REPO ?? '';
}

export interface PlannedIssue {
  finding_id: string;
  title: string;
  body: string;
  score: number;
}

/**
 * Decides what to file. Pure: no gh call, no clock beyond what the caller
 * supplies, so idempotency is testable without a network or a real repo.
 *
 * A finding is proposed only when it is not already filed and not already
 * acknowledged in the ledger. Running this twice in a day, or twice against
 * the same open-issue list, must produce zero duplicates.
 */
export function planIssues(findings: Finding[], alreadyFiledIds: ReadonlySet<string>): PlannedIssue[] {
  return findings
    .filter((finding) => finding.verdict === 'finding' && !alreadyFiledIds.has(finding.id))
    .sort((left, right) => right.revenue_score - left.revenue_score || left.id.localeCompare(right.id))
    .map((finding) => ({
      finding_id: finding.id,
      title: issueTitle(finding),
      body: issueBody(finding),
      score: finding.revenue_score,
    }));
}

/**
 * Never embeds the live metric value in the title. A value that changes every
 * run would make title-based dedupe treat the same finding as new each time,
 * exactly the duplicate-filing bug this lineage fixed once already back when
 * it was lazarus-pit.
 */
export function issueTitle(finding: Finding): string {
  return `[rainmaker] ${finding.check} — ${normalisePath(finding.url)} (tier ${finding.tier})`;
}

export function issueBody(finding: Finding): string {
  return [
    `**Finding:** \`${finding.id}\``,
    `**Tier:** ${finding.tier} (source: ${finding.tier_source}, confidence ${finding.tier_confidence})`,
    `**Severity:** ${finding.severity}`,
    `**Revenue score:** ${finding.revenue_score}`,
    `**Effort:** ${finding.effort_hours}h`,
    '',
    finding.message,
    '',
    '**Evidence:**',
    '```json',
    JSON.stringify(finding.evidence, null, 2),
    '```',
    '',
    `To mark this shipped once fixed, include \`rainmaker-fix: ${finding.id}\` in the commit message.`,
  ].join('\n');
}

function ghJson<T>(args: string[]): T {
  const out = execFileSync('gh', args, { encoding: 'utf-8' });
  return JSON.parse(out) as T;
}

export function existingOpenTitles(repo: string): Set<string> {
  const issues = ghJson<Array<{ title: string }>>([
    'issue', 'list', '--repo', repo, '--label', LABEL, '--state', 'open', '--json', 'title', '--limit', '200',
  ]);
  return new Set(issues.map((issue) => issue.title));
}

export function ensureLabelExists(repo: string): void {
  try {
    execFileSync('gh', ['label', 'list', '--repo', repo, '--search', LABEL, '--json', 'name'], { encoding: 'utf-8' });
    execFileSync(
      'gh',
      ['label', 'create', LABEL, '--repo', repo, '--color', '8B0000', '--description', 'Filed by Rainmaker', '--force'],
      { stdio: 'ignore' },
    );
  } catch {
    // label may already exist or repo permissions differ; non-fatal
  }
}

/**
 * Files planned issues, skipping any whose title is already open. Dedup by
 * title is defence in depth on top of planIssues' ledger-based filter; two
 * independent checks are cheaper than one duplicate issue in a real repo.
 */
export function fileIssues(repo: string, planned: PlannedIssue[]): PlannedIssue[] {
  ensureLabelExists(repo);
  const open = existingOpenTitles(repo);
  const filed: PlannedIssue[] = [];

  for (const issue of planned) {
    if (open.has(issue.title)) continue;
    execFileSync('gh', [
      'issue', 'create', '--repo', repo, '--label', LABEL, '--title', issue.title, '--body', issue.body,
    ]);
    filed.push(issue);
  }
  return filed;
}
