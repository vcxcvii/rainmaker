import { createHash } from 'node:crypto';
import type { CrawlProvider, ProviderPage } from '../providers/types.js';
import type { CrawlPage, CrawlSnapshot } from './types.js';

function stripHtml(value: string): string {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function attribute(tag: string, name: string): string | null {
  const quoted = tag.match(new RegExp(`${name}\\s*=\\s*([\"'])(.*?)\\1`, 'i'));
  return quoted?.[2] ?? null;
}

function meta(html: string, key: string): string | null {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const name = attribute(tag, 'name') ?? attribute(tag, 'property');
    if (name?.toLowerCase() === key.toLowerCase()) return attribute(tag, 'content');
  }
  return null;
}

function canonical(html: string): string | null {
  const tags = html.match(/<link\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const rel = attribute(tag, 'rel');
    if (rel?.toLowerCase().split(/\s+/).includes('canonical')) return attribute(tag, 'href');
  }
  return null;
}

function headings(html: string): string[] {
  return [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)]
    .map((match) => stripHtml(match[1]))
    .filter(Boolean);
}

function schemaTypes(html: string): string[] {
  const types = new Set<string>();
  for (const match of html.matchAll(/"@type"\s*:\s*"([^"]+)"/g)) types.add(match[1]);
  return [...types].sort();
}

function links(page: ProviderPage, site: string): {
  internal: string[];
  external: string[];
} {
  const internal = new Set<string>();
  const external = new Set<string>();
  const siteHost = new URL(site).hostname.replace(/^www\./, '');
  for (const raw of page.links ?? []) {
    try {
      const url = new URL(raw, page.url);
      if (!['http:', 'https:'].includes(url.protocol)) continue;
      url.hash = '';
      const host = url.hostname.replace(/^www\./, '');
      (host === siteHost ? internal : external).add(url.toString());
    } catch {
      continue;
    }
  }
  return {
    internal: [...internal].sort(),
    external: [...external].sort(),
  };
}

function normalizePage(page: ProviderPage, site: string): CrawlPage {
  const html = page.html ?? '';
  const text = stripHtml(html || page.markdown || '');
  const pageLinks = links(page, site);
  return {
    url: page.url,
    status: page.status,
    title: page.title ?? meta(html, 'og:title') ?? null,
    meta_description: page.description ?? meta(html, 'description'),
    canonical: canonical(html),
    robots_meta: meta(html, 'robots'),
    h1: headings(html),
    word_count: text ? text.split(/\s+/).length : 0,
    schema_types: schemaTypes(html),
    internal_links_out: pageLinks.internal,
    external_links_out: pageLinks.external,
    content_hash: createHash('sha256').update(text.toLowerCase()).digest('hex'),
    last_modified: page.lastModified ?? null,
  };
}

/**
 * Normalization is provider-agnostic, so swapping adapters cannot change
 * analysis code.
 *
 * Spending the credit budget is decided by the caller, not here: the cost
 * guard in src/agent/costguard.ts is what prints the projection and honours
 * an override flag, and a CLI command needs that decision before it commits
 * to a crawl, not buried inside the crawl call itself.
 */
export async function fetchCrawl(options: {
  provider: CrawlProvider;
  site: string;
  maxUrls: number;
  exclude: string[];
  now?: Date;
}): Promise<CrawlSnapshot> {
  const result = await options.provider.crawl({
    site: options.site,
    maxUrls: options.maxUrls,
    exclude: options.exclude,
  });
  const pages = result.pages
    .map((page) => normalizePage(page, options.site))
    .sort((a, b) => a.url.localeCompare(b.url));

  return {
    fetched_at: (options.now ?? new Date()).toISOString(),
    provider: options.provider.name,
    site: options.site,
    urls_discovered: result.urlsDiscovered,
    urls_fetched: pages.length,
    budget_exhausted: result.budgetExhausted,
    pages,
  };
}
