/**
 * Cost guard. An agent that can silently spend is not shippable, per
 * spec/agent.md section 3: every command that spends money prints its
 * projection first and refuses to exceed it without an explicit flag.
 */

export interface CostProjection {
  spend_kind: string;
  projected_units: number;
  unit_label: string;
  /** null when the provider exposes no balance check for this call. */
  remaining: number | null;
  allowed: boolean;
  reason?: string;
}

export function projectCrawlCost(
  maxUrls: number,
  remainingCredits: number | null,
  allowOverBudget = false,
): CostProjection {
  const overBudget = remainingCredits !== null && remainingCredits < maxUrls;
  return {
    spend_kind: 'crawl',
    projected_units: maxUrls,
    unit_label: 'URLs (roughly 1 credit each)',
    remaining: remainingCredits,
    allowed: !overBudget || allowOverBudget,
    reason:
      overBudget && !allowOverBudget
        ? `projected ${maxUrls} URLs exceeds the ${remainingCredits} credits remaining. ` +
          'Lower crawl.max_urls, or pass --allow-over-budget to proceed anyway.'
        : undefined,
  };
}

/**
 * Firecrawl's search endpoint exposes no separate balance check from the
 * shared credit pool the crawl already draws from, so this always allows and
 * relies on the crawl-side guard to catch a genuinely exhausted account.
 * `allowOverBudget` and a return type matching `projectCrawlCost` are kept
 * for interface symmetry with providers that do expose a search balance.
 */
export function projectSerpCost(queryCount: number, _allowOverBudget = false): CostProjection {
  return {
    spend_kind: 'serp',
    projected_units: queryCount,
    unit_label: 'search calls',
    remaining: null,
    allowed: true,
  };
}

export function formatProjection(projection: CostProjection): string {
  const balance =
    projection.remaining === null ? '' : `, ${projection.remaining} remaining`;
  return `Projected spend: ${projection.projected_units} ${projection.unit_label}${balance}.`;
}
