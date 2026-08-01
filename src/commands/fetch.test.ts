import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  chooseFetchProvider,
  createCrawlProvider,
  writeSourceSnapshots,
  type SourceSnapshots,
} from './fetch.js';

test('measurement fetch also keeps ambient paid-provider keys dormant', () => {
  assert.equal(chooseFetchProvider([], 'firecrawl'), 'builtin');
  assert.equal(chooseFetchProvider(['--provider', 'firecrawl'], 'builtin'), 'firecrawl');
  assert.equal(createCrawlProvider('builtin', { FIRECRAWL_API_KEY: 'secret' })?.name, 'builtin');
  assert.equal(createCrawlProvider('firecrawl', {})?.name, undefined);
});

test('fetch all fixture contract writes four valid snapshot files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rainmaker-fetch-'));
  const snapshots: SourceSnapshots = {
    crawl: {
      fetched_at: '2026-07-29T12:00:00.000Z',
      provider: 'firecrawl',
      site: 'https://example.com',
      urls_discovered: 0,
      urls_fetched: 0,
      budget_exhausted: false,
      pages: [],
    },
    ga4: {
      fetched_at: '2026-07-29T12:00:00.000Z',
      property_id: '123',
      window_days: 28,
      key_events_configured: [],
      pages: [],
      paths_sampled: 0,
    },
    gsc: {
      fetched_at: '2026-07-29T12:00:00.000Z',
      site_url: 'sc-domain:example.com',
      window_days: 28,
      start_date: '2026-06-29',
      end_date: '2026-07-26',
      rows: [],
    },
    clarity: {
      fetched_at: '2026-07-29T12:00:00.000Z',
      window_days: 3,
      metrics: [],
    },
  };
  const written = writeSourceSnapshots(dir, snapshots);
  assert.equal(written.length, 4);
  for (const path of written) assert.doesNotThrow(() => JSON.parse(readFileSync(path, 'utf8')));
});
