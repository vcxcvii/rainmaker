export interface ProviderPage {
  url: string;
  status: number;
  title?: string;
  description?: string;
  html?: string;
  markdown?: string;
  links?: string[];
  lastModified?: string;
}

export interface ProviderCrawlResult {
  pages: ProviderPage[];
  urlsDiscovered: number;
  budgetExhausted: boolean;
}

export interface CrawlProvider {
  readonly name: 'firecrawl' | 'contextdev';
  remainingCredits(): Promise<number | null>;
  crawl(options: {
    site: string;
    maxUrls: number;
    exclude: string[];
  }): Promise<ProviderCrawlResult>;
}
