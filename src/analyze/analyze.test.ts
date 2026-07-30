import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findingId, normalisePath } from './checks.js';
import { assignTier, tierAll, tierZeroDistances, TIER_WEIGHT } from './tiering.js';
import { effortFor } from './effort.js';
import {
  computeOpportunity,
  ctrAt,
  deriveCtrCurve,
  revenueScore,
  sortFindings,
  valueMultiplier,
} from './scoring.js';
import type { RainmakerConfig } from '../config/schema.js';
import type { CrawlPage, Ga4Snapshot, GscSnapshot } from '../fetch/types.js';

const config: RainmakerConfig = {
  site: 'https://quillet.com',
  revenue_model: 'sales-led',
  primary_conversion: ['/demo'],
  secondary_conversion: ['/case-studies'],
  acv: 18000,
  sales_cycle_days: 45,
  icp_hint: 'legal ops leads',
  competitors: ['ironclad.com', 'lexion.com'],
};

const page = (url: string, extra: Partial<CrawlPage> = {}): CrawlPage => ({
  url,
  status: 200,
  title: null,
  meta_description: null,
  canonical: null,
  robots_meta: null,
  h1: [],
  word_count: 800,
  schema_types: [],
  internal_links_out: [],
  external_links_out: [],
  content_hash: 'a'.repeat(64),
  last_modified: null,
  ...extra,
});

const gsc = (rows: Array<[string, string, number, number, number]>): GscSnapshot => ({
  fetched_at: '2026-08-01T00:00:00Z',
  site_url: 'sc-domain:quillet.com',
  window_days: 28,
  start_date: '2026-07-01',
  end_date: '2026-07-28',
  rows: rows.map(([page, query, clicks, impressions, position]) => ({
    page,
    query,
    clicks,
    impressions,
    ctr: impressions ? clicks / impressions : 0,
    position,
  })),
});

const ga4 = (
  keyEvents: string[],
  pages: Array<[string, number]>,
): Ga4Snapshot => ({
  fetched_at: '2026-08-01T00:00:00Z',
  property_id: '1',
  window_days: 45,
  key_events_configured: keyEvents,
  pages: pages.map(([path, key_events]) => ({
    path,
    sessions: 100,
    engaged_sessions: 60,
    key_events,
    conversion_paths: 0,
  })),
  paths_sampled: 0,
});

const noDistances = new Map<string, number>();

test('paths normalise consistently for ids and coverage sets', () => {
  assert.equal(normalisePath('https://quillet.com/Demo/'), '/demo');
  assert.equal(normalisePath('https://quillet.com/demo?utm=x#top'), '/demo');
  assert.equal(normalisePath('https://quillet.com/'), '/');
  assert.equal(findingId(0, 'canonical', 'https://quillet.com/Demo/'), 't0:canonical:/demo');
});

test('rule 1: a page with key events on a single-event property is tier 0', () => {
  const assignment = assignTier(
    'https://quillet.com/free-audit',
    { config, pages: [page('https://quillet.com/free-audit')], ga4: ga4(['demo_request'], [['/free-audit', 4]]) },
    noDistances,
  );
  assert.deepEqual(assignment, { tier: 0, tier_source: 'ga4_key_event', tier_confidence: 0.9 });
});

test('rule 1: key events on a multi-event property that is not declared is tier 1', () => {
  const assignment = assignTier(
    'https://quillet.com/free-audit',
    {
      config,
      pages: [page('https://quillet.com/free-audit')],
      ga4: ga4(['demo_request', 'newsletter_signup'], [['/free-audit', 4]]),
    },
    noDistances,
  );
  assert.deepEqual(assignment, { tier: 1, tier_source: 'ga4_key_event_weak', tier_confidence: 0.6 });
});

test('rule 1: no key events configured means the rule is skipped entirely', () => {
  const assignment = assignTier(
    'https://quillet.com/blog/what-is-clm',
    { config, pages: [page('https://quillet.com/blog/what-is-clm')], ga4: ga4([], [['/blog/what-is-clm', 0]]) },
    noDistances,
  );
  assert.equal(assignment.tier_source, 'default');
});

test('rule 1: zero key events falls through rather than assigning', () => {
  const assignment = assignTier(
    'https://quillet.com/pricing',
    { config, pages: [page('https://quillet.com/pricing')], ga4: ga4(['demo_request'], [['/pricing', 0]]) },
    noDistances,
  );
  assert.equal(assignment.tier_source, 'url_pattern');
});

test('rule 2 beats rule 4: a declared conversion outranks its URL pattern', () => {
  const assignment = assignTier(
    'https://quillet.com/demo',
    { config, pages: [page('https://quillet.com/demo')] },
    noDistances,
  );
  assert.deepEqual(assignment, { tier: 0, tier_source: 'declared_primary', tier_confidence: 1.0 });
});

test('rule 3: a declared secondary conversion is tier 2', () => {
  const assignment = assignTier(
    'https://quillet.com/case-studies',
    { config, pages: [page('https://quillet.com/case-studies')] },
    noDistances,
  );
  assert.deepEqual(assignment, { tier: 2, tier_source: 'declared_secondary', tier_confidence: 0.8 });
});

test('rule 4: URL patterns are checked money first', () => {
  const pricing = assignTier('https://quillet.com/pricing', { config, pages: [page('https://quillet.com/pricing')] }, noDistances);
  const versus = assignTier('https://quillet.com/vs/ironclad', { config, pages: [page('https://quillet.com/vs/ironclad')] }, noDistances);
  const about = assignTier('https://quillet.com/about', { config, pages: [page('https://quillet.com/about')] }, noDistances);

  assert.equal(pricing.tier, 0);
  assert.equal(versus.tier, 1);
  assert.equal(about.tier, 4);
});

test('rule 5: query intent takes the modal class of the top ten queries', () => {
  const url = 'https://quillet.com/resources/contract-review';
  const assignment = assignTier(
    url,
    {
      config,
      pages: [page(url)],
      gsc: gsc([
        [url, 'best contract review software', 2, 500, 8],
        [url, 'contract review alternatives', 1, 300, 9],
        [url, 'what is contract review', 0, 100, 20],
      ]),
    },
    noDistances,
  );
  assert.equal(assignment.tier, 1);
  assert.equal(assignment.tier_source, 'query_intent');
});

test('rule 5 ties resolve towards money', () => {
  const url = 'https://quillet.com/resources/x';
  const assignment = assignTier(
    url,
    {
      config,
      pages: [page(url)],
      gsc: gsc([
        [url, 'best clm', 1, 100, 9],
        [url, 'what is clm', 1, 100, 9],
      ]),
    },
    noDistances,
  );
  assert.equal(assignment.tier, 1, 'a 1-1 tie between commercial and informational must not land on informational');
});

test('rule 6: on-page schema assigns when nothing above it fired', () => {
  const url = 'https://quillet.com/product-x';
  const withSchema = assignTier(url, { config, pages: [page(url, { schema_types: ['Product'] })] }, noDistances);
  assert.deepEqual(withSchema, { tier: 0, tier_source: 'onpage', tier_confidence: 0.4 });

  const withoutSchema = assignTier(url, { config, pages: [page(url)] }, noDistances);
  assert.equal(withoutSchema.tier_source, 'default');
});

test('rule 7: link distance from a tier 0 page', () => {
  const pages = [
    page('https://quillet.com/demo', { internal_links_out: ['https://quillet.com/faq'] }),
    page('https://quillet.com/faq', { internal_links_out: ['https://quillet.com/deep'] }),
    page('https://quillet.com/deep'),
  ];
  const distances = tierZeroDistances(pages, config);
  assert.equal(distances.get('/faq'), 1);
  assert.equal(distances.get('/deep'), 2);

  assert.deepEqual(assignTier('https://quillet.com/faq', { config, pages }, distances), {
    tier: 2,
    tier_source: 'link_distance',
    tier_confidence: 0.3,
  });
});

test('rule 8: everything unmatched defaults to tier 3 at low confidence', () => {
  const assignment = assignTier('https://quillet.com/random', { config, pages: [page('https://quillet.com/random')] }, noDistances);
  assert.deepEqual(assignment, { tier: 3, tier_source: 'default', tier_confidence: 0.1 });
});

test('tiering is deterministic across 100 runs', () => {
  const pages = [
    page('https://quillet.com/demo', { internal_links_out: ['https://quillet.com/faq'] }),
    page('https://quillet.com/pricing'),
    page('https://quillet.com/vs/ironclad'),
    page('https://quillet.com/faq'),
    page('https://quillet.com/blog/what-is-clm'),
  ];
  const input = { config, pages, gsc: gsc([['https://quillet.com/faq', 'how to fix contracts', 1, 200, 12]]) };

  const first = JSON.stringify([...tierAll(input).entries()].sort());
  for (let run = 0; run < 100; run += 1) {
    assert.equal(JSON.stringify([...tierAll(input).entries()].sort()), first, `run ${run} differed`);
  }
});

test('scores are identical across 100 runs of the same input', () => {
  const input = { tier: 1 as const, severity: 'major' as const, effort_hours: 3, opportunity: 41.2, acv: 18000 };
  const first = revenueScore(input);
  for (let run = 0; run < 100; run += 1) assert.equal(revenueScore(input), first);
});

test('the score respects tier, severity, effort and opportunity in the right directions', () => {
  const base = { tier: 2 as const, severity: 'major' as const, effort_hours: 2, opportunity: 10, acv: 0 };
  assert.ok(revenueScore({ ...base, tier: 0 }) > revenueScore(base), 'tier 0 must outscore tier 2');
  assert.ok(revenueScore({ ...base, severity: 'blocking' }) > revenueScore(base), 'blocking must outscore major');
  assert.ok(revenueScore({ ...base, effort_hours: 8 }) < revenueScore(base), 'more effort must score lower');
  assert.ok(revenueScore({ ...base, opportunity: 100 }) > revenueScore(base), 'more opportunity must score higher');
});

test('effort never divides by zero', () => {
  assert.equal(effortFor('canonical'), 0.5);
  assert.ok(revenueScore({ tier: 0, severity: 'blocking', effort_hours: 0, opportunity: 1, acv: 0 }) > 0);
});

test('value weighting is logarithmic and capped', () => {
  assert.equal(valueMultiplier(0), 1);
  assert.ok(valueMultiplier(18000) > 1 && valueMultiplier(18000) < 1.5);
  assert.equal(valueMultiplier(10_000_000), 1.5);
});

test('opportunity is a click gap when GSC data exists, and 1.0 when it does not', () => {
  const url = 'https://quillet.com/vs/ironclad';
  const withData = computeOpportunity({ url, gsc: gsc([[url, 'ironclad alternatives', 5, 1000, 12]]) });
  assert.ok(withData > 20, `expected a meaningful gap, got ${withData}`);
  assert.equal(computeOpportunity({ url, gsc: gsc([]) }), 1.0);
  assert.equal(computeOpportunity({ url: 'https://quillet.com/x', gsc: null }), 1.0);
});

test('opportunity never goes negative when a page already beats its target CTR', () => {
  const url = 'https://quillet.com/brand';
  const value = computeOpportunity({ url, gsc: gsc([[url, 'quillet', 900, 1000, 1]]) });
  assert.ok(value >= 0.1);
});

test('the CTR curve interpolates and clamps', () => {
  assert.equal(ctrAt(1), 0.276);
  assert.equal(ctrAt(3), 0.099);
  assert.ok(ctrAt(3.5) < ctrAt(3) && ctrAt(3.5) > ctrAt(4));
  assert.ok(ctrAt(50) < 0.01);
});

test('a site curve is only derived once there is enough history', () => {
  const thin = [gsc([['https://quillet.com/a', 'q', 1, 10, 1]])];
  assert.equal(deriveCtrCurve(thin), null, '28 days is not 90');

  const rows: Array<[string, string, number, number, number]> = [];
  for (let index = 0; index < 40; index += 1) {
    rows.push([`https://quillet.com/p${index}`, `q${index}`, 10, 100, 1]);
  }
  const rich = [gsc(rows), gsc(rows), gsc(rows), gsc(rows)];
  const curve = deriveCtrCurve(rich);
  assert.ok(curve, 'four 28-day windows is enough history');
  assert.equal(curve?.[1], 0.1, 'position 1 curve comes from the site, not the default');
  assert.equal(curve?.[5], 0.054, 'positions with too few rows keep the industry default');
});

test('findings sort by score then id, so two runs produce identical reports', () => {
  const findings = [
    { id: 't1:position:/b', revenue_score: 10 },
    { id: 't0:canonical:/a', revenue_score: 10 },
    { id: 't2:thin:/c', revenue_score: 40 },
  ];
  assert.deepEqual(
    sortFindings(findings).map((finding) => finding.id),
    ['t2:thin:/c', 't0:canonical:/a', 't1:position:/b'],
  );
});

test('tier weights are the published ladder', () => {
  assert.deepEqual(TIER_WEIGHT, { 0: 5.0, 1: 3.0, 2: 2.0, 3: 1.0, 4: 0.3 });
});
