import type { CrawlProvider, ProviderCrawlResult, ProviderPage } from './types.js';

/**
 * The zero-credential crawl provider. Invariant 7: no credential is required
 * for a first audit, so this is what `audit` falls back to when neither
 * FIRECRAWL_API_KEY nor CONTEXT_DEV_API_KEY is set. Slower and shallower than
 * either paid provider (sequential same-origin fetches, no JavaScript
 * rendering), which is the honest tradeoff for not needing an account.
 */
export function createBuiltinProvider(options: {
  fetcher?: typeof fetch;
  pause?: (milliseconds: number) => Promise<void>;
} = {}): CrawlProvider {
  const fetcher = options.fetcher ?? fetch;
  const pause = options.pause ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));

  return {
    name: 'builtin',

    async remainingCredits() {
      return null; // no external budget to exhaust
    },

    async crawl({ site, maxUrls, exclude }) {
      const origin = new URL(site).origin;
      const isExcluded = (path: string) => exclude.some((pattern) => path.includes(pattern));

      const queue: string[] = [site];
      const seen = new Set<string>([normalise(site)]);
      const pages: ProviderPage[] = [];
      let budgetExhausted = false;

      while (queue.length > 0 && pages.length < maxUrls) {
        const url = queue.shift()!;
        let response: Response;
        try {
          response = await fetcher(url, { redirect: 'follow' });
        } catch {
          continue; // unreachable URL: skip rather than abort the whole crawl
        }

        const html = response.headers.get('content-type')?.includes('html') ? await response.text() : '';
        const links = html ? extractLinks(html, url, origin) : [];

        pages.push({
          url,
          status: response.status,
          html,
          links,
        });

        for (const link of links) {
          const key = normalise(link);
          if (seen.has(key) || isExcluded(new URL(link).pathname)) continue;
          seen.add(key);
          queue.push(link);
        }

        await pause(200); // polite default rate limit with no provider budget to enforce one
      }

      if (queue.length > 0 && pages.length >= maxUrls) budgetExhausted = true;

      return {
        pages,
        urlsDiscovered: seen.size,
        budgetExhausted,
      };
    },
  };
}

function normalise(url: string): string {
  const parsed = new URL(url);
  parsed.hash = '';
  parsed.search = '';
  return parsed.toString().replace(/\/$/, '');
}

function extractLinks(html: string, pageUrl: string, origin: string): string[] {
  const links = new Set<string>();
  const pattern = /<a\s[^>]*href=["']([^"'#]+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    try {
      const resolved = new URL(match[1], pageUrl);
      if (resolved.origin === origin) links.add(resolved.toString());
    } catch {
      // malformed href, skip
    }
  }
  return [...links];
}
