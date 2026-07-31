import type { Finding } from '../analyze/checks.js';
import { SEVERITY } from '../analyze/checks.js';
import { TIER_WEIGHT } from '../analyze/tiering.js';
import { normalisePath } from '../analyze/checks.js';

/**
 * The first artifact a new user sees, per spec/agent.md section 4. Not a
 * sixty-item audit, which is how every SEO tool loses the room: three fixes,
 * closest to revenue, shippable in the two weeks after install.
 */

/** TIER_WEIGHT * opportunity * severity. Never raw traffic. */
export function impactOf(finding: Finding): number {
  return TIER_WEIGHT[finding.tier] * finding.opportunity * SEVERITY[finding.severity];
}

const TWO_WEEKS_HOURS = 80;

/**
 * Selection: top findings by revenue_score, filtered to what fits inside two
 * weeks of combined effort, then three that are not all the same kind of
 * work. A user's first impression of this system should not be "fix five
 * missing meta descriptions"; it should show the system understands the
 * business has more than one kind of problem.
 */
export function selectTopFixes(findings: Finding[], count = 3): Finding[] {
  const ranked = [...findings]
    .filter((finding) => finding.verdict === 'finding')
    .sort((left, right) => right.revenue_score - left.revenue_score || left.id.localeCompare(right.id));

  const selected: Finding[] = [];
  const usedChecks = new Set<string>();
  let hoursUsed = 0;

  // First pass: prefer a distinct check type per pick, within the effort cap.
  for (const finding of ranked) {
    if (selected.length >= count) break;
    if (usedChecks.has(finding.check)) continue;
    if (hoursUsed + finding.effort_hours > TWO_WEEKS_HOURS) continue;
    selected.push(finding);
    usedChecks.add(finding.check);
    hoursUsed += finding.effort_hours;
  }

  // Second pass: if diversity left the list short, fill from the ranked order.
  for (const finding of ranked) {
    if (selected.length >= count) break;
    if (selected.includes(finding)) continue;
    if (hoursUsed + finding.effort_hours > TWO_WEEKS_HOURS) continue;
    selected.push(finding);
    hoursUsed += finding.effort_hours;
  }

  return selected;
}

function quadrant(finding: Finding, effortMedian: number, impactMedian: number): 'fix-now' | 'plan-it' | 'fill-in' | 'skip-for-now' {
  const highImpact = impactOf(finding) >= impactMedian;
  const lowEffort = finding.effort_hours <= effortMedian;
  if (highImpact && lowEffort) return 'fix-now';
  if (highImpact && !lowEffort) return 'plan-it';
  if (!highImpact && lowEffort) return 'fill-in';
  return 'skip-for-now';
}

const QUADRANT_LABEL: Record<ReturnType<typeof quadrant>, string> = {
  'fix-now': 'Fix now',
  'plan-it': 'Plan it',
  'fill-in': 'Fill in',
  'skip-for-now': 'Skip for now',
};

/**
 * Renders the effort-against-impact plot as plain ASCII, matching the rest
 * of this codebase's approach to diagrams: no rendering-engine dependency.
 */
export function renderFirstRun(all: Finding[]): string {
  const fixes = selectTopFixes(all);
  if (fixes.length === 0) {
    return 'No findings yet. Run `rainmaker audit`, then this will show the three closest to revenue.';
  }

  const effortValues = all.filter((finding) => finding.verdict === 'finding').map((finding) => finding.effort_hours);
  const impactValues = all.filter((finding) => finding.verdict === 'finding').map(impactOf);
  const effortMedian = median(effortValues);
  const impactMedian = median(impactValues);

  const lines: string[] = [];
  lines.push('IMPACT');
  for (const level of ['high', 'low'] as const) {
    const left = fixes.find((f) => quadrant(f, effortMedian, impactMedian) === (level === 'high' ? 'fix-now' : 'fill-in'));
    const right = fixes.find((f) => quadrant(f, effortMedian, impactMedian) === (level === 'high' ? 'plan-it' : 'skip-for-now'));
    const leftLabel = level === 'high' ? 'Fix now' : 'Fill in';
    const rightLabel = level === 'high' ? 'Plan it' : 'Skip for now';
    lines.push(`  ${level.padEnd(4)} | ${leftLabel.padEnd(14)}${left ? normalisePath(left.url) : ''}`);
    lines.push(`       | ${rightLabel.padEnd(14)}${right ? normalisePath(right.url) : ''}`);
  }
  lines.push('       +----------------------------------> EFFORT');
  lines.push('         low effort                high effort');
  lines.push('');

  fixes.forEach((finding, index) => {
    lines.push(
      `${index + 1}. ${normalisePath(finding.url)}  tier ${finding.tier}  ${finding.effort_hours}h  score ${finding.revenue_score}  [${QUADRANT_LABEL[quadrant(finding, effortMedian, impactMedian)]}]`,
    );
    lines.push(`   ${finding.message}`);
    lines.push(
      `   Evidence: ${finding.check} on ${normalisePath(finding.url)}, confidence ${finding.confidence} (tier source: ${finding.tier_source})`,
    );
  });

  const remaining = all.filter((finding) => finding.verdict === 'finding').length - fixes.length;
  if (remaining > 0) {
    lines.push('', `Not shown: ${remaining} further finding(s). \`rainmaker report --window 28d\` for all of them.`);
  }

  return lines.join('\n');
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
