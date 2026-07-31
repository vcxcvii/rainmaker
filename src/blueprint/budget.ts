function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export interface AuthorityBudgetInput {
  publishedLast90d: number;
  indexedRate: number;
}

/**
 * Monthly publish budget, bounded by what the site has actually demonstrated
 * it can get indexed and ranked. Publishing 200 pages into a site that gets 6
 * indexed produces 194 pages of crawl waste and a diluted internal link
 * graph, per spec/site-blueprint.md section 7.
 *
 * A new site with no history starts at 4 pages a month, per that section.
 *
 * The v3 formula scaled the budget upward with past publishing volume, which
 * rewarded failure: a site that published 90 pages and got none indexed was
 * granted 15 a month. spec/false-positives.md section 6 closes that loophole
 * by clamping to the floor whenever the site has published at real volume and
 * still shows a low indexed rate.
 */
export function authorityBudget(input: AuthorityBudgetInput): number {
  if (input.publishedLast90d === 0) return 4;

  if (input.publishedLast90d >= 20 && input.indexedRate < 0.3) {
    return 4;
  }

  const scaled = (input.publishedLast90d / 3) * clamp(input.indexedRate * 2, 0.5, 1.5);
  return Math.max(4, Math.round(scaled));
}
