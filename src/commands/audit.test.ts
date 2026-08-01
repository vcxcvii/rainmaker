import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chooseCrawlProvider, formatTierDistribution } from './audit.js';

test('an ambient Firecrawl key never opts the user into paid crawling', () => {
  assert.equal(
    chooseCrawlProvider({ configured: undefined, cli: undefined, env: { FIRECRAWL_API_KEY: 'secret' } }),
    'builtin',
  );
});

test('a paid crawl provider is used only after explicit CLI selection', () => {
  assert.equal(
    chooseCrawlProvider({ configured: 'builtin', cli: 'firecrawl', env: { FIRECRAWL_API_KEY: 'secret' } }),
    'firecrawl',
  );
  assert.equal(
    chooseCrawlProvider({ configured: 'firecrawl', cli: undefined, env: { FIRECRAWL_API_KEY: 'secret' } }),
    'builtin',
  );
});

test('every tier is labelled, because the numbers alone mean nothing to a new user', () => {
  const output = formatTierDistribution({ '0': 1, '1': 2, '2': 13, '3': 6, '4': 0 }, 22);

  assert.match(output, /Tier 0 .*money changes hands here/);
  assert.match(output, /Tier 1 .*read right before buying/);
  assert.match(output, /Tier 4 .*no commercial role/);
  assert.match(output, /22 pages/);
});

test('no Tier 0 is called out as the config problem it is', () => {
  const output = formatTierDistribution({ '0': 0, '1': 3, '2': 5, '3': 1, '4': 0 }, 9);
  assert.match(output, /No Tier 0 pages/);
  assert.match(output, /primary_conversion/);
});

test('no Tier 1 is called out as the gap it is, not left for the user to spot', () => {
  const output = formatTierDistribution({ '0': 1, '1': 0, '2': 13, '3': 6, '4': 0 }, 20);
  assert.match(output, /No Tier 1 pages/);
  assert.doesNotMatch(output, /No Tier 0 pages/);
});

test('a partial crawl never turns absence into a site-wide claim', () => {
  const output = formatTierDistribution(
    { '0': 1, '1': 0, '2': 13, '3': 6, '4': 0 },
    20,
    false,
  );
  assert.match(output, /partial crawl/i);
  assert.doesNotMatch(output, /usually worth more than any single fix/i);
});
