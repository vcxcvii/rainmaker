import type { CrawlProvider, ProviderCrawlResult, ProviderPage } from './types.js';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;
}

function collectUrls(site: string, payload: Record<string, unknown>, maxUrls: number): string[] {
  const brand = asRecord(payload.brand);
  const links = asRecord(brand?.links);
  const urls = new Set<string>([site]);
  if (links) {
    for (const value of Object.values(links)) {
      if (typeof value === 'string') urls.add(value);
    }
  }
  return [...urls].slice(0, maxUrls);
}

export function createContextDevProvider(options: {
  apiKey: string;
  fetcher?: typeof fetch;
}): CrawlProvider {
  const fetcher = options.fetcher ?? fetch;
  const headers = {
    authorization: `Bearer ${options.apiKey}`,
    'content-type': 'application/json',
  };

  const request = async (
    input: string,
    init?: RequestInit,
  ): Promise<Record<string, unknown>> => {
    const response = await fetcher(input, { ...init, headers });
    if (!response.ok) throw new Error(`context.dev HTTP ${response.status}`);
    const payload = (await response.json()) as unknown;
    const record = asRecord(payload);
    if (!record) throw new Error('context.dev returned invalid JSON');
    return record;
  };

  return {
    name: 'contextdev',
    async remainingCredits(): Promise<null> {
      return null;
    },
    async crawl({ site, maxUrls }): Promise<ProviderCrawlResult> {
      const domain = new URL(site).hostname;
      const brand = await request(
        `https://api.context.dev/v1/brand/retrieve?domain=${encodeURIComponent(domain)}`,
      );
      const urls = collectUrls(site, brand, maxUrls);
      const pages: ProviderPage[] = [];

      for (const url of urls) {
        const parsed = await request('https://api.context.dev/v1/parse', {
          method: 'POST',
          body: JSON.stringify({ url }),
        });
        pages.push({
          url,
          status: typeof parsed.statusCode === 'number' ? parsed.statusCode : 200,
          title: typeof parsed.title === 'string' ? parsed.title : undefined,
          description: typeof parsed.description === 'string' ? parsed.description : undefined,
          html: typeof parsed.html === 'string' ? parsed.html : undefined,
          markdown: typeof parsed.markdown === 'string' ? parsed.markdown : undefined,
          links: Array.isArray(parsed.links)
            ? parsed.links.filter((link): link is string => typeof link === 'string')
            : [],
        });
      }

      return {
        pages,
        urlsDiscovered: urls.length,
        budgetExhausted: false,
      };
    },
  };
}
