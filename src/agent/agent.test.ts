import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatProjection, projectCrawlCost, projectSerpCost } from './costguard.js';
import { formatCadence, recommendCadence } from './cadence.js';
import { impactOf, renderFirstRun, selectTopFixes } from './firstrun.js';
import type { Finding } from '../analyze/checks.js';

const finding = (id: string, extra: Partial<Finding> = {}): Finding => ({
  id,
  check: 'noindex',
  url: `https://example.com${id.split(':').pop()}`,
  tier: 0,
  tier_source: 'declared_primary',
  tier_confidence: 1,
  severity: 'blocking',
  effort_hours: 0.5,
  opportunity: 10,
  revenue_score: 10,
  confidence: 1,
  evidence: {},
  message: 'A finding.',
  verdict: 'finding',
  ...extra,
});

test('a crawl within budget is allowed and reports the projection', () => {
  const projection = projectCrawlCost(50, 200);
  assert.equal(projection.allowed, true);
  assert.equal(projection.projected_units, 50);
  assert.match(formatProjection(projection), /50 URLs.*200 remaining/);
});

test('a crawl over budget is refused, naming the shortfall', () => {
  const projection = projectCrawlCost(500, 100);
  assert.equal(projection.allowed, false);
  assert.match(projection.reason ?? '', /500 URLs exceeds the 100 credits remaining/);
  assert.match(projection.reason ?? '', /--allow-over-budget/);
});

test('--allow-over-budget overrides the refusal but the projection still shows the shortfall', () => {
  const projection = projectCrawlCost(500, 100, true);
  assert.equal(projection.allowed, true);
  assert.equal(projection.reason, undefined);
});

test('a provider with no exposed balance never blocks a crawl', () => {
  const projection = projectCrawlCost(500, null);
  assert.equal(projection.allowed, true);
});

test('SERP cost always projects and never blocks, since Firecrawl exposes no separate search balance', () => {
  const projection = projectSerpCost(12);
  assert.equal(projection.allowed, true);
  assert.equal(projection.projected_units, 12);
  assert.match(formatProjection(projection), /12 search calls/);
});

test('a small, low-traffic site is recommended monthly only', () => {
  const recommendation = recommendCadence({ urlCount: 30, clicksPerMonth: 80, pagesPublishedPerMonth: 1 });
  assert.equal(recommendation.cadence, 'monthly-only');
  assert.deepEqual(recommendation.weekly, []);
});

test('a mid-size, low-publish-rate site gets a weekly pulse, not the full routine', () => {
  const recommendation = recommendCadence({ urlCount: 200, clicksPerMonth: 5000, pagesPublishedPerMonth: 2 });
  assert.equal(recommendation.cadence, 'weekly-pulse');
  assert.deepEqual(recommendation.weekly, ['fetch', 'audit --refresh']);
});

test('a large, actively publishing site gets the full weekly routine', () => {
  const recommendation = recommendCadence({ urlCount: 5000, clicksPerMonth: 50000, pagesPublishedPerMonth: 10 });
  assert.equal(recommendation.cadence, 'full-weekly');
  assert.deepEqual(recommendation.weekly, ['routine']);
});

test('AI citation probes are always monthly, never weekly, regardless of cadence', () => {
  for (const shape of [
    { urlCount: 30, clicksPerMonth: 80, pagesPublishedPerMonth: 1 },
    { urlCount: 200, clicksPerMonth: 5000, pagesPublishedPerMonth: 2 },
    { urlCount: 5000, clicksPerMonth: 50000, pagesPublishedPerMonth: 10 },
  ]) {
    const recommendation = recommendCadence(shape);
    assert.ok(!recommendation.weekly.some((task) => /citation/i.test(task)));
  }
});

test('formatCadence names the site shape and every cadence bucket', () => {
  const shape = { urlCount: 200, clicksPerMonth: 5000, pagesPublishedPerMonth: 2 };
  const output = formatCadence(shape, recommendCadence(shape));
  assert.match(output, /200 URLs/);
  assert.match(output, /Weekly:/);
  assert.match(output, /Monthly:/);
  assert.match(output, /Quarterly:/);
});

test('impact is tier weight times opportunity times severity, never raw traffic', () => {
  const f = finding('t0:noindex:/x', { tier: 0, opportunity: 10, severity: 'blocking' });
  assert.equal(impactOf(f), 5.0 * 10 * 1.0);
});

test('selectTopFixes prefers three different kinds of work over the top three by score alone', () => {
  const findings = [
    finding('t0:noindex:/a', { check: 'noindex', revenue_score: 40 }),
    finding('t0:noindex:/b', { check: 'noindex', revenue_score: 35 }),
    finding('t0:noindex:/c', { check: 'noindex', revenue_score: 30 }),
    finding('t1:schema:/d', { check: 'schema', revenue_score: 20, tier: 1 }),
    finding('t2:thin:/e', { check: 'thin', revenue_score: 10, tier: 2 }),
  ];
  const top3 = selectTopFixes(findings, 3);
  const checks = new Set(top3.map((f) => f.check));
  assert.equal(checks.size, 3, 'expected three distinct check types, not three noindex findings');
});

test('selectTopFixes never exceeds the two-week combined effort budget', () => {
  const findings = Array.from({ length: 10 }, (_, i) =>
    finding(`t0:check${i}:/p${i}`, { check: `check${i}` as Finding['check'], effort_hours: 30, revenue_score: 100 - i }),
  );
  const top3 = selectTopFixes(findings, 3);
  const totalHours = top3.reduce((sum, f) => sum + f.effort_hours, 0);
  assert.ok(totalHours <= 80, `expected combined effort under 80 hours, got ${totalHours}`);
});

test('selectTopFixes ignores suspicions', () => {
  const findings = [finding('t0:orphan:/a', { verdict: 'suspicion', confirm_with: 'x' })];
  assert.deepEqual(selectTopFixes(findings, 3), []);
});

test('renderFirstRun shows a message rather than an empty plot with zero findings', () => {
  const output = renderFirstRun([]);
  assert.match(output, /Run `rainmaker audit`/);
});

test('renderFirstRun names each fix, its evidence, and how many findings are not shown', () => {
  const findings = [
    finding('t0:noindex:/a', { check: 'noindex', revenue_score: 40 }),
    finding('t1:schema:/b', { check: 'schema', revenue_score: 20, tier: 1 }),
    finding('t2:thin:/c', { check: 'thin', revenue_score: 10, tier: 2 }),
    finding('t3:h1:/d', { check: 'h1', revenue_score: 1, tier: 3 }),
  ];
  const output = renderFirstRun(findings);
  assert.match(output, /IMPACT/);
  assert.match(output, /\/a/);
  assert.match(output, /Evidence: noindex on \/a/);
  assert.match(output, /Not shown: 1 further finding/);
});
