import type { Check } from './checks.js';

/**
 * Fixed effort per finding type. Never estimated at runtime.
 *
 * Runtime estimation would make the same finding score differently between two
 * runs, which breaks the determinism the whole system rests on. A table is also
 * honest about what it is: a starting assumption a team can edit once, rather
 * than a confident guess regenerated every week.
 *
 * Hours are integers or half-hours. Anything finer is false precision.
 */
export const EFFORT_HOURS: Record<Check, number> = {
  noindex: 0.5,
  canonical: 0.5,
  redirect_chain: 0.5,
  status_error: 1,
  orphan: 1,
  depth: 1,
  duplicate: 3,
  cannibalisation: 3,
  title: 0.5,
  meta_description: 0.5,
  h1: 0.5,
  thin: 3,
  decay: 2,
  schema: 1,
  extractability: 2,
  llms_txt: 1,
  ai_crawler_blocked: 0.5,
  cwv: 2,
  position: 3,
  impressions: 2,
  indexation: 1,
  offsite: 2,
  citation: 3,
  // Building a page that does not exist yet, not editing one that does. A
  // pricing or comparison page is a week of decisions before it is a day of
  // writing, and understating that is how it stays undone.
  tier_zero_absent: 16,
  tier_one_absent: 12,
};

/** Never zero: a finding that costs nothing would divide the score to infinity. */
export function effortFor(check: Check): number {
  return Math.max(EFFORT_HOURS[check] ?? 1, 0.25);
}
