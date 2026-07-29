import type { CrawlProvider, ProviderCrawlResult, ProviderPage } from './types.js';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;
}

async function json(response: Response, label: string): Promise<Record<string, unknown>> {
  const payload = asRecord((await response.json()) as unknown);
  if (!response.ok) {
    const error = payload?.error;
    throw new Error(`${label}: ${typeof error === 'string' ? error : `HTTP ${response.status}`}`);
  }
  if (!payload) throw new Error(`${label}: invalid response`);
  return payload;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function parsePage(value: unknown): ProviderPage | null {
  const record = asRecord(value);
  const metadata = asRecord(record?.metadata);
  const url = metadata?.sourceURL ?? metadata?.url;
  if (typeof url !== 'string') return null;
  return {
    url,
    status: typeof metadata?.statusCode === 'number' ? metadata.statusCode : 200,
    title: typeof metadata?.title === 'string' ? metadata.title : undefined,
    description: typeof metadata?.description === 'string' ? metadata.description : undefined,
    html: typeof record?.html === 'string' ? record.html : undefined,
    markdown: typeof record?.markdown === 'string' ? record.markdown : undefined,
    links: stringArray(record?.links),
    lastModified: typeof metadata?.lastModified === 'string'
      ? metadata.lastModified
      : undefined,
  };
}

export function createFirecrawlProvider(options: {
  apiKey: string;
  fetcher?: typeof fetch;
  pause?: (milliseconds: number) => Promise<void>;
}): CrawlProvider {
  const fetcher = options.fetcher ?? fetch;
  const headers = {
    authorization: `Bearer ${options.apiKey}`,
    'content-type': 'application/json',
  };
  const pause = options.pause ?? ((milliseconds) => new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  }));

  return {
    name: 'firecrawl',

    async remainingCredits(): Promise<number | null> {
      const response = await fetcher('https://api.firecrawl.dev/v2/team/credit-usage', {
        headers,
      });
      const payload = await json(response, 'Firecrawl credit check');
      const data = asRecord(payload.data);
      return typeof data?.remainingCredits === 'number' ? data.remainingCredits : null;
    },

    async crawl({ site, maxUrls, exclude }): Promise<ProviderCrawlResult> {
      const started = await json(
        await fetcher('https://api.firecrawl.dev/v2/crawl', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            allowExternalLinks: false,
            allowSubdomains: false,
            excludePaths: exclude,
            ignoreQueryParameters: true,
            ignoreRobotsTxt: false,
            limit: maxUrls,
            maxConcurrency: 8,
            scrapeOptions: {
              formats: ['markdown', 'html', 'links'],
              onlyMainContent: false,
            },
            sitemap: 'include',
            url: site,
          }),
        }),
        'Firecrawl crawl start',
      );
      if (typeof started.id !== 'string') throw new Error('Firecrawl crawl start omitted id');

      let nextUrl = `https://api.firecrawl.dev/v2/crawl/${encodeURIComponent(started.id)}`;
      const pages: ProviderPage[] = [];
      let discovered = 0;
      let status = 'scraping';
      for (let poll = 0; poll < 300; poll += 1) {
        const payload = await json(
          await fetcher(nextUrl, { headers }),
          'Firecrawl crawl status',
        );
        status = typeof payload.status === 'string' ? payload.status : 'failed';
        discovered = typeof payload.total === 'number' ? payload.total : discovered;
        const data = Array.isArray(payload.data) ? payload.data : [];
        pages.push(...data.map(parsePage).filter((page): page is ProviderPage => page !== null));

        if (status === 'failed' || status === 'cancelled') {
          throw new Error(`Firecrawl crawl ${status}`);
        }
        if (typeof payload.next === 'string') {
          nextUrl = payload.next;
          continue;
        }
        if (status === 'completed') break;
        await pause(2_000);
      }
      if (status !== 'completed') throw new Error('Firecrawl crawl timeout');

      const unique = new Map(pages.map((page) => [page.url, page]));
      return {
        pages: [...unique.values()],
        urlsDiscovered: discovered || unique.size,
        budgetExhausted: discovered > maxUrls,
      };
    },
  };
}
