/**
 * Cadence recommendation, from spec/agent.md section 5.
 *
 * Recommended, not assumed: this function proposes, a human confirms. Three
 * rules drive it, each with a reason: never re-check anything faster than its
 * own verification window, AI citation probes are always monthly since the
 * answers are non-deterministic and cost money per run, and small sites get
 * less frequency, not less care, because there is no statistical signal to
 * read weekly under a low click floor.
 */

export type Cadence = 'monthly-only' | 'weekly-pulse' | 'full-weekly';

export interface SiteShape {
  urlCount: number;
  clicksPerMonth: number;
  pagesPublishedPerMonth: number;
}

export interface CadenceRecommendation {
  cadence: Cadence;
  weekly: string[];
  monthly: string[];
  quarterly: string[];
  reason: string;
}

export function recommendCadence(shape: SiteShape): CadenceRecommendation {
  if (shape.urlCount < 50 || shape.clicksPerMonth < 100) {
    return {
      cadence: 'monthly-only',
      weekly: [],
      monthly: ['audit', 'report --window month'],
      quarterly: ['strategy review, if drift fires'],
      reason:
        `${shape.urlCount} URLs and ${shape.clicksPerMonth} clicks a month is below the floor for a ` +
        'weekly signal. A weekly ranking report here would report sampling noise as news, and that ' +
        'erodes trust in the numbers that matter later.',
    };
  }

  if (shape.urlCount <= 500 && shape.pagesPublishedPerMonth < 4) {
    return {
      cadence: 'weekly-pulse',
      weekly: ['fetch', 'audit --refresh'],
      monthly: ['audit', 'report --window month', 'offsite --scan', 'AI citation probes'],
      quarterly: ['strategy review, if drift fires'],
      reason:
        `${shape.urlCount} URLs is enough for a weekly pulse on rankings, but publishing ` +
        `${shape.pagesPublishedPerMonth} pages a month does not justify a full weekly routine. ` +
        'AI citation probes stay monthly regardless: they cost money per run and the answers are ' +
        'non-deterministic, so a weekly line would mostly measure sampling variance.',
    };
  }

  return {
    cadence: 'full-weekly',
    weekly: ['routine'],
    monthly: ['report --window month', 'offsite --scan', 'AI citation probes', 'ledger --compact'],
    quarterly: ['strategy review, if drift fires'],
    reason:
      `${shape.urlCount} URLs and ${shape.pagesPublishedPerMonth} pages a month justify the full weekly ` +
      'routine: fetch, audit, shipped detection, issue filing, all in one pass.',
  };
}

export function formatCadence(shape: SiteShape, recommendation: CadenceRecommendation): string {
  const lines = [
    `Site shape: ${shape.urlCount} URLs, ${shape.clicksPerMonth} clicks/month, publishing ${shape.pagesPublishedPerMonth} pages/month.`,
    `Recommendation: ${recommendation.cadence}.`,
    recommendation.reason,
    '',
  ];
  if (recommendation.weekly.length > 0) lines.push(`Weekly: ${recommendation.weekly.join(', ')}`);
  lines.push(`Monthly: ${recommendation.monthly.join(', ')}`);
  lines.push(`Quarterly: ${recommendation.quarterly.join(', ')}`);
  return lines.join('\n');
}
