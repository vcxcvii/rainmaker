import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectCrawlProvider } from './select.js';

test('ambient paid-provider keys stay dormant', () => {
  const selection = selectCrawlProvider([], { FIRECRAWL_API_KEY: 'secret' });
  assert.equal(selection.requested, 'builtin');
  assert.equal(selection.source, 'default');
  assert.equal(selection.provider?.name, 'builtin');
});

test('a configured provider is honoured, and reported as coming from the config', () => {
  const selection = selectCrawlProvider([], { FIRECRAWL_API_KEY: 'secret' }, 'firecrawl');
  assert.equal(selection.requested, 'firecrawl');
  assert.equal(selection.source, 'config');
  assert.equal(selection.provider?.name, 'firecrawl');
});

test('the flag beats the config, and the config beats the default', () => {
  const flagged = selectCrawlProvider(['--provider', 'builtin'], { FIRECRAWL_API_KEY: 'x' }, 'firecrawl');
  assert.equal(flagged.requested, 'builtin');
  assert.equal(flagged.source, 'flag');

  const configured = selectCrawlProvider([], { FIRECRAWL_API_KEY: 'x' }, 'builtin');
  assert.equal(configured.requested, 'builtin');
  assert.equal(configured.source, 'config');
});

test('a configured provider without its credential fails rather than falling back', () => {
  const selection = selectCrawlProvider([], {}, 'firecrawl');
  assert.equal(selection.provider, undefined);
  assert.equal(selection.missingCredential, 'FIRECRAWL_API_KEY');
  assert.equal(selection.source, 'config');
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
