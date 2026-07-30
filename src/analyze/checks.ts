/**
 * The closed set of checks. A finding id embeds one of these, so adding a check
 * is a deliberate act: ids are permanent and the ledger keeps them forever.
 */
export const CHECKS = [
  // Reachability. A tier 0 page failing any of these cannot earn a score at all.
  'noindex',
  'canonical',
  'redirect_chain',
  'status_error',
  'orphan',
  'depth',
  // Duplication and overlap.
  'duplicate',
  'cannibalisation',
  // Metadata.
  'title',
  'meta_description',
  'h1',
  // Content.
  'thin',
  'decay',
  // Machine readability.
  'schema',
  'extractability',
  'llms_txt',
  'ai_crawler_blocked',
  // Performance.
  'cwv',
  // Search performance.
  'position',
  'impressions',
  'indexation',
  // Off-site.
  'offsite',
  'citation',
] as const;

export type Check = (typeof CHECKS)[number];

export const SEVERITY = {
  blocking: 1.0,
  major: 0.7,
  moderate: 0.4,
  minor: 0.15,
} as const;

export type Severity = keyof typeof SEVERITY;

export type Tier = 0 | 1 | 2 | 3 | 4;

export interface Finding {
  id: string;
  check: Check;
  url: string;
  tier: Tier;
  tier_source: string;
  tier_confidence: number;
  severity: Severity;
  effort_hours: number;
  opportunity: number;
  revenue_score: number;
  confidence: number;
  /** Raw measured values only. Never prose, never an adjective. */
  evidence: Record<string, unknown>;
  /** One sentence. No adjectives. */
  message: string;
  /** finding, suspicion or unmeasured. See spec/false-positives.md. */
  verdict: 'finding' | 'suspicion';
  /** Present on a suspicion: what would turn it into a finding. */
  confirm_with?: string;
}

/** Normalises a URL to the path form used in finding ids and coverage sets. */
export function normalisePath(url: string): string {
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    path = url.split('?')[0].split('#')[0];
  }
  path = path.toLowerCase();
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  return path || '/';
}

/**
 * `t0:canonical:/demo`.
 *
 * The tier here is the tier at first observation and never changes, so a
 * re-tiered page does not appear as one finding closing and another opening.
 */
export function findingId(tier: Tier, check: Check, url: string): string {
  return `t${tier}:${check}:${normalisePath(url)}`;
}
