export interface GscSnapshot {
  fetched_at: string;
  site_url: string;
  window_days: 28;
  start_date: string;
  end_date: string;
  rows: Array<{
    page: string;
    query: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
}

export interface Ga4Snapshot {
  fetched_at: string;
  property_id: string;
  window_days: number;
  key_events_configured: string[];
  pages: Array<{
    path: string;
    sessions: number;
    engaged_sessions: number;
    key_events: number;
    conversion_paths: number;
  }>;
  paths_sampled: number;
}

export interface CrawlPage {
  url: string;
  status: number;
  title: string | null;
  meta_description: string | null;
  canonical: string | null;
  robots_meta: string | null;
  h1: string[];
  word_count: number;
  schema_types: string[];
  internal_links_out: string[];
  external_links_out: string[];
  content_hash: string;
  last_modified: string | null;
}

export interface CrawlSnapshot {
  fetched_at: string;
  provider: 'firecrawl' | 'contextdev';
  site: string;
  urls_discovered: number;
  urls_fetched: number;
  budget_exhausted: boolean;
  pages: CrawlPage[];
}

export interface ClaritySnapshot {
  fetched_at: string;
  window_days: 1 | 2 | 3;
  metrics: unknown[];
}
