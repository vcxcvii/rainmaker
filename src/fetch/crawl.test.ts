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

test('does not itself refuse an over-budget crawl: that decision belongs to the caller', async () => {
  // src/agent/costguard.ts projectCrawlCost is what refuses and prints the
  // projection, so a CLI command can honour --allow-over-budget. fetchCrawl
  // stays a pure "do the crawl" call and trusts that decision was already made.
  const snapshot = await fetchCrawl({
    provider: provider('firecrawl'), // reports 100 credits remaining
    site: 'https://example.com',
    maxUrls: 101,
    exclude: [],
  });
  assert.equal(snapshot.provider, 'firecrawl');
});

test('normalises the standard HTML title when a provider does not supply one', async () => {
  const htmlOnly: CrawlProvider = {
    name: 'builtin',
    async remainingCredits() { return null; },
    async crawl() {
      return {
        urlsDiscovered: 1,
        budgetExhausted: false,
        pages: [{
          url: 'https://example.com/',
          status: 200,
          html: '<html><head><title>Example &amp; Company</title></head><body><h1>Home</h1></body></html>',
          links: [],
        }],
      };
    },
  };

  const snapshot = await fetchCrawl({
    provider: htmlOnly,
    site: 'https://example.com',
    maxUrls: 10,
    exclude: [],
  });

  assert.equal(snapshot.pages[0].title, 'Example & Company');
});
