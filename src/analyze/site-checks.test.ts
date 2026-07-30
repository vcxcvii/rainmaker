import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coverageSet, inboundCounts, runChecks } from './site-checks.js';
import { tierAll } from './tiering.js';
import type { RainmakerConfig } from '../config/schema.js';
import type { CrawlPage, CrawlSnapshot } from '../fetch/types.js';

const config: RainmakerConfig = {
  site: 'https://quillet.com',
  revenue_model: 'sales-led',
  primary_conversion: ['/demo'],
  secondary_conversion: [],
  acv: 0,
  sales_cycle_days: 45,
  icp_hint: 'legal ops leads',
};

const page = (url: string, extra: Partial<CrawlPage> = {}): CrawlPage => ({
  url,
  status: 200,
  title: 'A title',
  meta_description: 'A description',
  canonical: url,
  robots_meta: null,
  h1: ['A heading'],
  word_count: 800,
  schema_types: ['Article'],
  internal_links_out: [],
  external_links_out: [],
  content_hash: 'a'.repeat(64),
  last_modified: null,
  ...extra,
});

const snapshot = (pages: CrawlPage[], extra: Partial<CrawlSnapshot> = {}): CrawlSnapshot => ({
  fetched_at: '2026-08-01T00:00:00Z',
  provider: 'firecrawl',
  site: 'https://quillet.com',
  urls_discovered: pages.length,
  urls_fetched: pages.length,
  budget_exhausted: false,
  pages,
  ...extra,
});

function check(pages: CrawlPage[], extra: Partial<CrawlSnapshot> = {}) {
  const crawl = snapshot(pages, extra);
  const tiers = tierAll({ config, pages, gsc: null, ga4: null });
  return runChecks({ config, crawl, tiers, gsc: null });
}

const ids = (findings: Array<{ id: string }>) => findings.map((finding) => finding.id);

test('a noindexed money page is blocking', () => {
  const findings = check([
    page('https://quillet.com/', { internal_links_out: ['https://quillet.com/demo'] }),
    page('https://quillet.com/demo', { robots_meta: 'noindex, follow' }),
  ]);

  const noindex = findings.find((finding) => finding.check === 'noindex');
  assert.ok(noindex, 'expected a noindex finding');
  assert.equal(noindex.severity, 'blocking');
  assert.equal(noindex.tier, 0);
  assert.equal(noindex.id, 't0:noindex:/demo');
});

test('a noindexed thank-you page is not a finding', () => {
  const findings = check([
    page('https://quillet.com/', { internal_links_out: ['https://quillet.com/demo/thank-you'] }),
    page('https://quillet.com/demo/thank-you', { robots_meta: 'noindex' }),
  ]);

  assert.equal(
    findings.filter((finding) => finding.check === 'noindex').length,
    0,
    'a confirmation page is correctly noindexed and must not be reported',
  );
});

test('a noindexed page nothing links to is treated as deliberate', () => {
  const findings = check([page('https://quillet.com/'), page('https://quillet.com/internal-preview', { robots_meta: 'noindex' })]);
  assert.equal(findings.filter((finding) => finding.check === 'noindex').length, 0);
});

test('a canonical pointing at a 404 is blocking', () => {
  const findings = check([
    page('https://quillet.com/', { internal_links_out: ['https://quillet.com/pricing', 'https://quillet.com/old'] }),
    page('https://quillet.com/pricing', { canonical: 'https://quillet.com/old' }),
    page('https://quillet.com/old', { status: 404, canonical: null }),
  ]);

  const canonical = findings.find((finding) => finding.check === 'canonical');
  assert.ok(canonical);
  assert.equal(canonical.severity, 'blocking');
  assert.match(canonical.message, /returns HTTP 404/);
});

test('an orphan is a suspicion when the crawl was truncated, and a finding when it was not', () => {
  const pages = [
    page('https://quillet.com/', { internal_links_out: ['https://quillet.com/a'] }),
    page('https://quillet.com/a'),
    page('https://quillet.com/lonely'),
  ];

  const complete = check(pages);
  const orphan = complete.find((finding) => finding.check === 'orphan');
  assert.equal(orphan?.verdict, 'finding');

  const truncated = check(pages, { urls_discovered: 400, urls_fetched: 3, budget_exhausted: true });
  const suspicion = truncated.find((finding) => finding.check === 'orphan');
  assert.equal(suspicion?.verdict, 'suspicion');
  assert.match(String(suspicion?.confirm_with), /Raise crawl\.max_urls/);
});

test('identical pages are duplicates, unless one canonicalises to the other', () => {
  const duplicated = check([
    page('https://quillet.com/', { internal_links_out: ['https://quillet.com/a', 'https://quillet.com/b'] }),
    page('https://quillet.com/a', { content_hash: 'b'.repeat(64) }),
    page('https://quillet.com/b', { content_hash: 'b'.repeat(64) }),
  ]);
  assert.ok(duplicated.some((finding) => finding.check === 'duplicate'));

  const consolidated = check([
    page('https://quillet.com/', { internal_links_out: ['https://quillet.com/a', 'https://quillet.com/b'] }),
    page('https://quillet.com/a', { content_hash: 'b'.repeat(64) }),
    page('https://quillet.com/b', { content_hash: 'b'.repeat(64), canonical: 'https://quillet.com/a' }),
  ]);
  assert.equal(
    consolidated.filter((finding) => finding.check === 'duplicate').length,
    0,
    'a page that canonicalises to its twin is configured correctly, not duplicated',
  );
});

test('findings are ordered by score, and money outranks ambient', () => {
  const findings = check([
    page('https://quillet.com/', { internal_links_out: ['https://quillet.com/demo', 'https://quillet.com/about'] }),
    page('https://quillet.com/demo', { title: null }),
    page('https://quillet.com/about', { title: null }),
  ]);

  const titles = findings.filter((finding) => finding.check === 'title');
  assert.equal(titles[0].tier, 0, 'the tier 0 title finding must come first');
  assert.ok(titles[0].revenue_score > titles[1].revenue_score);
});

test('every finding carries provenance and a source for its tier', () => {
  const findings = check([page('https://quillet.com/'), page('https://quillet.com/demo', { title: null })]);
  for (const finding of findings) {
    assert.ok(finding.tier_source.length > 0, `${finding.id} has no tier_source`);
    assert.ok(finding.confidence > 0 && finding.confidence <= 1, `${finding.id} has an impossible confidence`);
    assert.ok(Object.keys(finding.evidence).length > 0, `${finding.id} has no evidence`);
    assert.ok(!/\b(bad|poor|terrible|great|excellent)\b/i.test(finding.message), `${finding.id} uses an adjective`);
  }
});

test('the coverage set excludes what absence cannot be read from', () => {
  const covered = coverageSet(
    snapshot([
      page('https://quillet.com/ok'),
      page('https://quillet.com/gone', { status: 404 }),
      page('https://quillet.com/broken', { status: 503 }),
      page('https://quillet.com/moved', { status: 301 }),
      page('https://quillet.com/soft404', { word_count: 12 }),
    ]),
  );

  assert.ok(covered.has('/ok'));
  assert.ok(covered.has('/gone'), 'a 404 is a real observation: the URL was looked at');
  assert.ok(!covered.has('/broken'), 'a 5xx proves nothing');
  assert.ok(!covered.has('/moved'), 'a redirect endpoint was not the URL we asked about');
  assert.ok(!covered.has('/soft404'), 'a 200 with no content is a soft 404');
});

test('inbound counts ignore self-links', () => {
  const counts = inboundCounts([
    page('https://quillet.com/a', { internal_links_out: ['https://quillet.com/a', 'https://quillet.com/b'] }),
  ]);
  assert.equal(counts.get('/a'), undefined);
  assert.equal(counts.get('/b'), 1);
});

test('checks are deterministic across 50 runs', () => {
  const pages = [
    page('https://quillet.com/', { internal_links_out: ['https://quillet.com/demo', 'https://quillet.com/blog/x'] }),
    page('https://quillet.com/demo', { title: null, schema_types: [] }),
    page('https://quillet.com/blog/x', { word_count: 120 }),
    page('https://quillet.com/lonely'),
  ];
  const first = JSON.stringify(ids(check(pages)));
  for (let run = 0; run < 50; run += 1) {
    assert.equal(JSON.stringify(ids(check(pages))), first, `run ${run} differed`);
  }
});
