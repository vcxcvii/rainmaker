import assert from 'node:assert/strict';
import { test } from 'node:test';
import { crawlPreflight } from './crawl-preflight.js';

test('shared crawl preflight keeps ambient provider keys dormant', async () => {
  const provider = await crawlPreflight({
    args: [],
    env: { FIRECRAWL_API_KEY: 'secret' },
    maxUrls: 10,
  });
  assert.equal(provider?.name, 'builtin');
});

test('shared crawl preflight refuses an explicit provider without its key', async () => {
  const provider = await crawlPreflight({
    args: ['--provider', 'firecrawl'],
    env: {},
    maxUrls: 10,
  });
  assert.equal(provider, undefined);
});
