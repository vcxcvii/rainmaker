import assert from 'node:assert/strict';
import { test } from 'node:test';
import { crawlHitLimit } from './firecrawl.js';

test('a provider response landing exactly on the cap is treated as partial', () => {
  assert.equal(crawlHitLimit({ discovered: 30, fetched: 30, maxUrls: 30 }), true);
  assert.equal(crawlHitLimit({ discovered: 29, fetched: 29, maxUrls: 30 }), false);
});
