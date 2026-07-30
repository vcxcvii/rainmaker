import type { GscSnapshot } from '../fetch/types.js';
import { SEVERITY, normalisePath, type Severity, type Tier } from './checks.js';
import { TIER_WEIGHT } from './tiering.js';

/**
 * Scoring. Code, never inference.
 *
 * No model produces or adjusts a revenue score anywhere in this system. Two
 * runs over unchanged input produce identical numbers, which is what makes a
 * ledger comparison over 90 days mean anything.
 */

/**
 * Aggregate industry CTR by position. Replace with the site's own curve once
 * 90 days of Search Console history exist: see deriveCtrCurve below, which the
 * caller should prefer whenever it returns a curve.
 */
export const CTR_CURVE: Record<number, number> = {
  1: 0.276, 2: 0.152, 3: 0.099, 4: 0.071, 5: 0.054,
  6: 0.043, 7: 0.035, 8: 0.029, 9: 0.025, 10: 0.022,
  11: 0.019, 12: 0.016, 13: 0.014, 14: 0.012, 15: 0.011,
  16: 0.010, 17: 0.009, 18: 0.008, 19: 0.007, 20: 0.006,
};

export function ctrAt(position: number, curve: Record<number, number> = CTR_CURVE): number {
  if (position <= 1) return curve[1];
  if (position >= 20) return 0.01 * 0.6; // clamped below 0.01 beyond position 20
  const low = Math.floor(position);
  const high = Math.ceil(position);
  if (low === high) return curve[low];
  const span = curve[low] - curve[high];
  return curve[low] - span * (position - low);
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Builds a CTR curve from the site's own history. Preferred over the industry
 * curve, because click behaviour varies enormously by category and a borrowed
 * curve silently mis-sizes every opportunity on the site.
 *
 * Returns null below the evidence bar: 90 days of history and 30 or more rows
 * per position bucket. A curve fitted to four rows is worse than the default.
 */
export function deriveCtrCurve(
  snapshots: GscSnapshot[],
  minDays = 90,
  minRows = 30,
): Record<number, number> | null {
  if (snapshots.length === 0) return null;

  const days = snapshots.reduce((total, snapshot) => total + snapshot.window_days, 0);
  if (days < minDays) return null;

  const buckets = new Map<number, { clicks: number; impressions: number; rows: number }>();
  for (const snapshot of snapshots) {
    for (const row of snapshot.rows) {
      const position = Math.round(row.position);
      if (position < 1 || position > 20) continue;
      const bucket = buckets.get(position) ?? { clicks: 0, impressions: 0, rows: 0 };
      bucket.clicks += row.clicks;
      bucket.impressions += row.impressions;
      bucket.rows += 1;
      buckets.set(position, bucket);
    }
  }

  const curve: Record<number, number> = {};
  for (let position = 1; position <= 20; position += 1) {
    const bucket = buckets.get(position);
    curve[position] =
      bucket && bucket.rows >= minRows && bucket.impressions > 0
        ? round4(bucket.clicks / bucket.impressions)
        : CTR_CURVE[position];
  }
  return curve;
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

export interface OpportunityInput {
  url: string;
  gsc?: GscSnapshot | null;
  curve?: Record<number, number>;
}

/**
 * Expected additional clicks if the page reached a realistic target position.
 *
 * Floored at 0.1 rather than 0 so that a finding on a page with no search data
 * still scores on tier, severity and effort. A zero here would silently delete
 * every finding on a page Search Console has never reported.
 */
export function computeOpportunity(input: OpportunityInput): number {
  const path = normalisePath(input.url);
  const rows = (input.gsc?.rows ?? []).filter((row) => normalisePath(row.page) === path);
  if (rows.length === 0) return 1.0;

  const impressions = rows.reduce((total, row) => total + row.impressions, 0);
  const clicks = rows.reduce((total, row) => total + row.clicks, 0);
  if (impressions === 0) return 0.1;

  const weighted = rows.reduce((total, row) => total + row.position * row.impressions, 0);
  const position = weighted / impressions;
  const target = Math.max(position - 5, 3);

  const achievable = ctrAt(target, input.curve ?? CTR_CURVE);
  const current = clicks / impressions;
  const gap = Math.max(achievable - current, 0);
  return Math.max(impressions * gap, 0.1);
}

export interface ScoreInput {
  tier: Tier;
  severity: Severity;
  effort_hours: number;
  opportunity: number;
  /** Average contract value. 0 disables value weighting. */
  acv?: number;
}

/**
 * Value weighting. A finding on a site selling 50,000 dollar contracts is worth
 * more than the same finding on a site selling 5 dollar ones, but not ten times
 * more: the log keeps a large ACV from flattening every other input.
 */
export function valueMultiplier(acv: number): number {
  if (!acv || acv <= 0) return 1;
  return Math.min(Math.log10(acv) / 4, 1.5);
}

export function revenueScore(input: ScoreInput): number {
  const tier = TIER_WEIGHT[input.tier];
  const opportunity = Math.max(input.opportunity, 0.1);
  const severity = SEVERITY[input.severity];
  const effort = Math.max(input.effort_hours, 0.25);
  const base = (tier * opportunity * severity) / effort;
  return round2(base * valueMultiplier(input.acv ?? 0));
}

/**
 * Findings sorted for a report: score descending, then id ascending.
 *
 * The id tiebreak is not cosmetic. Without it two runs over unchanged input can
 * emit the same findings in different orders, and every diff of a report
 * becomes unreadable.
 */
export function sortFindings<T extends { revenue_score: number; id: string }>(findings: T[]): T[] {
  return [...findings].sort(
    (left, right) => right.revenue_score - left.revenue_score || left.id.localeCompare(right.id),
  );
}

/** Confidence is the tier's confidence times the measurement's. */
export function combineConfidence(tierConfidence: number, measurement: number): number {
  return round2(tierConfidence * measurement);
}

export const MEASUREMENT_CONFIDENCE = {
  measured: 1.0,
  api: 0.7,
  inferred: 0.5,
  sampled: 0.5,
} as const;
