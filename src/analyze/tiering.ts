import type { RainmakerConfig } from '../config/schema.js';
import type { CrawlPage, Ga4Snapshot, GscSnapshot } from '../fetch/types.js';
import { normalisePath, type Tier } from './checks.js';
import { classifyIntent, INTENT_TIER } from './intent.js';

/**
 * Revenue tiering. The ordering principle for the whole system, and the reason
 * a noindexed pricing page outranks a missing alt attribute on a careers page.
 *
 * Eight rules, strict precedence, first match wins. Every assignment records
 * which rule fired and how confident it is, because a tier from a URL pattern
 * is a guess and a reader who cannot see that will read it as measured.
 */

export const TIER_WEIGHT: Record<Tier, number> = {
  0: 5.0,
  1: 3.0,
  2: 2.0,
  3: 1.0,
  4: 0.3,
};

export const URL_PATTERNS: Array<{ tier: Tier; patterns: string[] }> = [
  {
    tier: 0,
    patterns: [
      '/pricing', '/plans', '/demo', '/trial', '/signup', '/sign-up', '/register',
      '/checkout', '/contact', '/get-started', '/book', '/schedule', '/buy', '/quote',
    ],
  },
  {
    tier: 1,
    patterns: [
      '/vs/', '/versus/', '/alternative', '/alternatives', '/compare', '/comparison',
      '/case-stud', '/customers/', '/customer-stories', '/integrations/', '/roi',
      '/why-', '/switch',
    ],
  },
  { tier: 2, patterns: ['/use-case', '/solutions/', '/for-', '/how-to', '/guide/', '/template'] },
  {
    tier: 4,
    patterns: [
      '/about', '/careers', '/jobs', '/team', '/press', '/legal', '/privacy', '/terms',
      '/author/', '/tag/', '/category/', '/page/',
    ],
  },
];

export interface TierAssignment {
  tier: Tier;
  tier_source: string;
  tier_confidence: number;
}

export interface TieringInput {
  config: RainmakerConfig;
  pages: CrawlPage[];
  gsc?: GscSnapshot | null;
  ga4?: Ga4Snapshot | null;
}

function declared(list: string[] | undefined, path: string): boolean {
  return (list ?? []).some((entry) => normalisePath(entry) === path);
}

/**
 * Rule 1, rewritten in v2.
 *
 * v1 tiered a URL by its share of GA4 paths preceding a key event. The Data API
 * exposes page-level key events, not ordered page sequences: path exploration
 * is a UI feature. Page-level key events are what is actually available.
 */
function ga4Rule(
  path: string,
  config: RainmakerConfig,
  ga4: Ga4Snapshot | null | undefined,
): TierAssignment | null {
  if (!ga4 || ga4.key_events_configured.length === 0) return null;

  const page = ga4.pages.find((row) => normalisePath(row.path) === path);
  if (!page || page.key_events <= 0) return null;

  const isDeclared = declared(config.primary_conversion, path);
  if (isDeclared || ga4.key_events_configured.length === 1) {
    return { tier: 0, tier_source: 'ga4_key_event', tier_confidence: 0.9 };
  }
  return { tier: 1, tier_source: 'ga4_key_event_weak', tier_confidence: 0.6 };
}

function patternRule(path: string): TierAssignment | null {
  for (const { tier, patterns } of URL_PATTERNS) {
    if (patterns.some((pattern) => path.includes(pattern))) {
      return { tier, tier_source: 'url_pattern', tier_confidence: 0.6 };
    }
  }
  return null;
}

function queryIntentRule(path: string, gsc: GscSnapshot | null | undefined): TierAssignment | null {
  if (!gsc) return null;

  const rows = gsc.rows
    .filter((row) => normalisePath(row.page) === path)
    .sort((left, right) => right.impressions - left.impressions)
    .slice(0, 10);
  if (rows.length === 0) return null;

  const votes = new Map<Tier, number>();
  for (const row of rows) {
    const intent = classifyIntent(row.query);
    if (!intent) continue;
    const tier = INTENT_TIER[intent];
    votes.set(tier, (votes.get(tier) ?? 0) + 1);
  }
  if (votes.size === 0) return null;

  // Ties resolve to the tier closest to money. Two rules disagreeing about a
  // page is not a reason to file it under awareness.
  const best = [...votes.entries()].sort(
    (left, right) => right[1] - left[1] || left[0] - right[0],
  )[0];
  return { tier: best[0], tier_source: 'query_intent', tier_confidence: 0.5 };
}

function onPageRule(page: CrawlPage | undefined, config: RainmakerConfig): TierAssignment | null {
  if (!page) return null;
  const schema = page.schema_types.map((type) => type.toLowerCase());

  if (schema.includes('product') || schema.includes('offer')) {
    return { tier: 0, tier_source: 'onpage', tier_confidence: 0.4 };
  }
  if (schema.includes('review') || schema.includes('aggregaterating')) {
    return { tier: 1, tier_source: 'onpage', tier_confidence: 0.4 };
  }
  const competitors = (config.competitors ?? []).map((domain) => domain.split('.')[0].toLowerCase());
  const title = (page.title ?? '').toLowerCase();
  if (competitors.length >= 2 && competitors.filter((name) => title.includes(name)).length >= 2) {
    return { tier: 1, tier_source: 'onpage', tier_confidence: 0.4 };
  }
  if (schema.includes('howto') || schema.includes('faqpage')) {
    return { tier: 2, tier_source: 'onpage', tier_confidence: 0.4 };
  }
  return null;
}

function linkDistanceRule(path: string, distances: Map<string, number>): TierAssignment | null {
  const hops = distances.get(path);
  if (hops === undefined) return null;
  const tier: Tier = hops === 1 ? 2 : hops === 2 ? 3 : 4;
  return { tier, tier_source: 'link_distance', tier_confidence: 0.3 };
}

/** Breadth-first hop count from every declared tier 0 page. */
export function tierZeroDistances(pages: CrawlPage[], config: RainmakerConfig): Map<string, number> {
  const outgoing = new Map<string, string[]>();
  for (const page of pages) {
    outgoing.set(normalisePath(page.url), page.internal_links_out.map(normalisePath));
  }

  const distances = new Map<string, number>();
  let frontier = (config.primary_conversion ?? []).map(normalisePath).filter((path) => outgoing.has(path));
  const seen = new Set(frontier);

  for (let hop = 1; frontier.length > 0 && hop <= 4; hop += 1) {
    const next: string[] = [];
    for (const path of frontier) {
      for (const target of outgoing.get(path) ?? []) {
        if (seen.has(target)) continue;
        seen.add(target);
        distances.set(target, hop);
        next.push(target);
      }
    }
    frontier = next;
  }
  return distances;
}

/**
 * Assigns one page. Pure: same inputs, same output, every time. Nothing here
 * reads the clock, the filesystem, or a model.
 */
export function assignTier(
  url: string,
  input: TieringInput,
  distances: Map<string, number>,
): TierAssignment {
  const path = normalisePath(url);
  const page = input.pages.find((candidate) => normalisePath(candidate.url) === path);

  return (
    ga4Rule(path, input.config, input.ga4) ??
    (declared(input.config.primary_conversion, path)
      ? { tier: 0, tier_source: 'declared_primary', tier_confidence: 1.0 }
      : null) ??
    (declared(input.config.secondary_conversion, path)
      ? { tier: 2, tier_source: 'declared_secondary', tier_confidence: 0.8 }
      : null) ??
    patternRule(path) ??
    queryIntentRule(path, input.gsc) ??
    onPageRule(page, input.config) ??
    linkDistanceRule(path, distances) ?? { tier: 3, tier_source: 'default', tier_confidence: 0.1 }
  );
}

export function tierAll(input: TieringInput): Map<string, TierAssignment> {
  const distances = tierZeroDistances(input.pages, input.config);
  const assignments = new Map<string, TierAssignment>();
  for (const page of input.pages) {
    assignments.set(normalisePath(page.url), assignTier(page.url, input, distances));
  }
  return assignments;
}

export function tierDistribution(
  assignments: Map<string, TierAssignment>,
): Record<'0' | '1' | '2' | '3' | '4', number> {
  const counts = { '0': 0, '1': 0, '2': 0, '3': 0, '4': 0 };
  for (const { tier } of assignments.values()) counts[String(tier) as '0'] += 1;
  return counts;
}
