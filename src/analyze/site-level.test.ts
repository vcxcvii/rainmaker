import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { RainmakerConfig } from '../config/schema.js';
import type { CrawlSnapshot } from '../fetch/types.js';
import { coverageSet } from './site-checks.js';
import { pathOfFinding, planClosures } from '../ledger/close.js';
import { siteLevelFindings } from './site-level.js';

const config = {
  site: 'https://example.com',
  revenue_model: 'consulting',
  primary_conversion: [],
  secondary_conversion: [],
  acv: 0,
  sales_cycle_days: 30,
  icp_hint: '',
  competitors: [],
} as unknown as RainmakerConfig;

const distribution = (over: Partial<Record<'0' | '1' | '2' | '3' | '4', number>>) => ({
  '0': 0, '1': 0, '2': 0, '3': 0, '4': 0, ...over,
});

test('an absent Tier 0 is a ranked finding, not a line of prose', () => {
  const [finding, ...rest] = siteLevelFindings({
    config,
    tierDistribution: distribution({ '2': 5, '3': 1 }),
    coverageComplete: true,
  });

  assert.equal(rest.length, 0);
  assert.equal(finding.check, 'tier_zero_absent');
  assert.equal(finding.verdict, 'finding');
  assert.ok(finding.revenue_score > 0, 'must be scored to rank against page-level work');
  assert.equal(finding.evidence.tier_0_pages, 0);
  assert.equal(finding.evidence.pages_analysed, 6);
});

test('an absent Tier 1 is reported only once Tier 0 exists', () => {
  const both = siteLevelFindings({
    config,
    tierDistribution: distribution({ '2': 5 }),
    coverageComplete: true,
  });
  // A site with neither has one problem, not two.
  assert.deepEqual(both.map((f) => f.check), ['tier_zero_absent']);

  const onlyOne = siteLevelFindings({
    config,
    tierDistribution: distribution({ '0': 1, '2': 13, '3': 6 }),
    coverageComplete: true,
  });
  assert.deepEqual(onlyOne.map((f) => f.check), ['tier_one_absent']);
});

test('a healthy distribution produces nothing', () => {
  assert.deepEqual(
    siteLevelFindings({
      config,
      tierDistribution: distribution({ '0': 1, '1': 2, '2': 13 }),
      coverageComplete: true,
    }),
    [],
  );
});

test('a partial crawl never turns absence into a site-wide claim', () => {
  assert.deepEqual(
    siteLevelFindings({
      config,
      tierDistribution: distribution({ '2': 5 }),
      coverageComplete: false,
    }),
    [],
  );
});

test('an empty crawl says nothing rather than everything', () => {
  assert.deepEqual(
    siteLevelFindings({ config, tierDistribution: distribution({}), coverageComplete: true }),
    [],
  );
});

test('the id is stable, so the ledger can close it when the page appears', () => {
  const run = () =>
    siteLevelFindings({
      config,
      tierDistribution: distribution({ '2': 5 }),
      coverageComplete: true,
    })[0].id;

  assert.equal(run(), run());
  assert.match(run(), /tier_zero_absent/);
});

test('effort reflects building a page, not editing one', () => {
  const [finding] = siteLevelFindings({
    config,
    tierDistribution: distribution({ '2': 5 }),
    coverageComplete: true,
  });
  assert.ok(finding.effort_hours >= 8, `got ${finding.effort_hours}h for building a Tier 0 page`);
});

test('the finding sits on a path the crawl covers, so the ledger can close it', () => {
  const [finding] = siteLevelFindings({
    config,
    tierDistribution: distribution({ '2': 5 }),
    coverageComplete: true,
  });

  // A real root page, above the soft-404 word floor coverageSet applies.
  const crawl = {
    pages: [{ url: 'https://example.com/', status: 200, word_count: 800 }],
  } as unknown as CrawlSnapshot;

  const covered = coverageSet(crawl);
  const path = pathOfFinding(finding.id);

  assert.ok(path, 'finding id must carry a path');
  assert.ok(
    covered.has(path),
    `site-level findings would never close: ${path} not in ${[...covered].join(', ')}`,
  );

  // Absent from the next run, on a covered path, is exactly the close condition.
  const plan = planClosures(
    { findings: { [finding.id]: { status: 'opened' } } } as never,
    { covered: [...covered], present: [], budgetExhausted: false },
  );
  assert.deepEqual(plan.close, [finding.id]);
});
