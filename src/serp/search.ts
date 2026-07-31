import type { SerpCapture, SerpResult } from './types.js';

/**
 * Live SERP capture via Firecrawl's search endpoint, the same provider the
 * crawl already depends on, so a working FIRECRAWL_API_KEY unlocks both
 * without a second account.
 */
export async function captureSerp(
  query: string,
  options: { apiKey: string; fetcher?: typeof fetch; now?: () => string },
): Promise<SerpCapture> {
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher('https://api.firecrawl.dev/v1/search', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${options.apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ query, limit: 10 }),
  });

  const payload = (await response.json()) as {
    success?: boolean;
    error?: string;
    data?: Array<{ url?: string; title?: string; position?: number }>;
  };
  if (!response.ok || payload.success === false) {
    throw new Error(`SERP capture for "${query}": ${payload.error ?? `HTTP ${response.status}`}`);
  }

  const results: SerpResult[] = (payload.data ?? [])
    .filter((row): row is { url: string; title?: string; position?: number } => typeof row.url === 'string')
    .map((row, index) => ({
      position: row.position ?? index + 1,
      url: row.url,
      domain: safeDomain(row.url),
      title: row.title ?? '',
    }));

  return {
    query,
    fetched_at: (options.now ?? (() => new Date().toISOString()))(),
    results,
    serp_features: [],
  };
}

function safeDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
