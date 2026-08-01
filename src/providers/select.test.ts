import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectCrawlProvider } from './select.js';

test('ambient paid-provider keys stay dormant', () => {
  const selection = selectCrawlProvider([], { FIRECRAWL_API_KEY: 'secret' });
  assert.equal(selection.requested, 'builtin');
  assert.equal(selection.provider?.name, 'builtin');
});

test('paid providers require both an explicit flag and their credential', () => {
  const missing = selectCrawlProvider(['--provider', 'firecrawl'], {});
  assert.equal(missing.provider, undefined);
  assert.equal(missing.missingCredential, 'FIRECRAWL_API_KEY');

  const approved = selectCrawlProvider(
    ['--provider', 'firecrawl'],
    { FIRECRAWL_API_KEY: 'secret' },
  );
  assert.equal(approved.provider?.name, 'firecrawl');
  assert.equal(
    selectCrawlProvider(['--provider=firecrawl'], { FIRECRAWL_API_KEY: 'secret' }).provider?.name,
    'firecrawl',
  );
});
