import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CrawlProvider } from '../providers/types.js';
import { fetchCrawl } from './crawl.js';

function provider(name: CrawlProvider['name']): CrawlProvider {
  return {
    name,
    async remainingCredits(): Promise<number | null> {
      return name === 'firecrawl' ? 100 : null;
    },
    async crawl() {
      return {
        urlsDiscovered: 1,
        budgetExhausted: false,
        pages: [{
          url: 'https://example.com/contact/',
          status: 200,
          title: 'Contact',
          html: '<h1>Contact us</h1><meta name="description" content="Talk"><a href="/">Home</a>',
          markdown: '# Contact us',
          links: ['https://example.com/'],
        }],
      };
    },
  };
}

test('provider swap changes only snapshot provider', async () => {
  const options = {
    site: 'https://example.com',
    maxUrls: 10,
    exclude: [],
    now: new Date('2026-07-29T00:00:00Z'),
  };
  const firecrawl = await fetchCrawl({ ...options, provider: provider('firecrawl') });
  const contextdev = await fetchCrawl({ ...options, provider: provider('contextdev') });
  assert.equal(firecrawl.provider, 'firecrawl');
  assert.equal(contextdev.provider, 'contextdev');
  assert.deepEqual(firecrawl.pages, contextdev.pages);
});

test('refuses a crawl whose maximum exceeds remaining credits', async () => {
  await assert.rejects(
    fetchCrawl({
      provider: provider('firecrawl'),
      site: 'https://example.com',
      maxUrls: 101,
      exclude: [],
    }),
    /needs up to 101 credits/,
  );
});
