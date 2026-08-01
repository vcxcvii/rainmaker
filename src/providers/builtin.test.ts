import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBuiltinProvider } from './builtin.js';

const PAGES: Record<string, { status: number; html: string }> = {
  'https://example.com/': {
    status: 200,
    html: `<html><head><title>Home</title></head><body>
      <a href="/pricing">Pricing</a>
      <a href="/about">About</a>
      <a href="https://external.com/other">External</a>
    </body></html>`,
  },
  'https://example.com/pricing': {
    status: 200,
    html: `<html><head><title>Pricing</title></head><body><a href="/">Home</a></body></html>`,
  },
  'https://example.com/about': {
    status: 200,
    html: `<html><head><title>About</title></head><body>no links here</body></html>`,
  },
};

function fakeFetcher(): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    const page = PAGES[url];
    if (!page) {
      return new Response('', { status: 404, headers: { 'content-type': 'text/html' } });
    }
    return new Response(page.html, { status: page.status, headers: { 'content-type': 'text/html' } });
  }) as typeof fetch;
}

test('the builtin provider requires no credentials to crawl', async () => {
  const provider = createBuiltinProvider({ fetcher: fakeFetcher(), pause: async () => {} });
  assert.equal(await provider.remainingCredits(), null);

  const result = await provider.crawl({ site: 'https://example.com/', maxUrls: 10, exclude: [] });
  assert.equal(result.pages.length, 3);
  assert.equal(result.budgetExhausted, false);
});

test('the builtin provider follows only same-origin links', async () => {
  const provider = createBuiltinProvider({ fetcher: fakeFetcher(), pause: async () => {} });
  const result = await provider.crawl({ site: 'https://example.com/', maxUrls: 10, exclude: [] });
  assert.ok(!result.pages.some((page) => page.url.includes('external.com')));
});

test('the builtin provider respects maxUrls and reports budget_exhausted', async () => {
  const provider = createBuiltinProvider({ fetcher: fakeFetcher(), pause: async () => {} });
  const result = await provider.crawl({ site: 'https://example.com/', maxUrls: 1, exclude: [] });
  assert.equal(result.pages.length, 1);
  assert.equal(result.budgetExhausted, true);
});

test('the builtin provider excludes matching paths', async () => {
  const provider = createBuiltinProvider({ fetcher: fakeFetcher(), pause: async () => {} });
  const result = await provider.crawl({ site: 'https://example.com/', maxUrls: 10, exclude: ['/about'] });
  assert.ok(!result.pages.some((page) => page.url.endsWith('/about')));
});

test('linked assets never enter the queue, so they never spend crawl budget', async () => {
  const requested: string[] = [];
  const withAssets: typeof fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    requested.push(url);
    if (url === 'https://example.com/') {
      return new Response(
        `<html><head><title>Home</title></head><body>
          <a href="/assets/hero.webp">Image</a>
          <a href="/api/site.json">Data</a>
          <a href="/llms.txt">llms</a>
          <a href="/pricing">Pricing</a>
        </body></html>`,
        { status: 200, headers: { 'content-type': 'text/html' } },
      );
    }
    return fakeFetcher()(input as never);
  }) as typeof fetch;

  const provider = createBuiltinProvider({ fetcher: withAssets, pause: async () => {} });
  const result = await provider.crawl({ site: 'https://example.com/', maxUrls: 10, exclude: [] });

  assert.deepEqual(requested, ['https://example.com/', 'https://example.com/pricing']);
  assert.equal(result.pages.length, 2);
  assert.equal(result.urlsDiscovered, 2, 'assets are not discovered pages either');
});

test('a URL that answers with a non-HTML body is not recorded as a page', async () => {
  const jsonEndpoint: typeof fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url === 'https://example.com/') {
      return new Response(
        `<html><head><title>Home</title></head><body><a href="/data">Data</a></body></html>`,
        { status: 200, headers: { 'content-type': 'text/html' } },
      );
    }
    return new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;

  const provider = createBuiltinProvider({ fetcher: jsonEndpoint, pause: async () => {} });
  const result = await provider.crawl({ site: 'https://example.com/', maxUrls: 10, exclude: [] });

  assert.deepEqual(result.pages.map((page) => page.url), ['https://example.com/']);
  assert.equal(result.urlsDiscovered, 1, 'a skipped body does not open a coverage gap');
});

test('an unreachable URL is skipped rather than aborting the whole crawl', async () => {
  const flaky: typeof fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('/about')) throw new Error('network error');
    return fakeFetcher()(input as never);
  }) as typeof fetch;

  const provider = createBuiltinProvider({ fetcher: flaky, pause: async () => {} });
  const result = await provider.crawl({ site: 'https://example.com/', maxUrls: 10, exclude: [] });
  assert.equal(result.pages.length, 2, 'the unreachable page is skipped, the rest still complete');
});
