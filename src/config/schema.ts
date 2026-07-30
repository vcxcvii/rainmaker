/**
 * rainmaker.config.yml schema and loader.
 *
 * This config is what lets universal tiering logic work on any site. The tier
 * rules are the same everywhere; this supplies the business context they need.
 */

export const REVENUE_MODELS = [
  'self-serve',
  'sales-led',
  'plg',
  'marketplace',
  'ads',
  'newsletter',
  'consulting',
] as const;

export type RevenueModel = (typeof REVENUE_MODELS)[number];

export interface RainmakerConfig {
  /** Root URL of the site under analysis. */
  site: string;

  /** How this business makes money. Shapes tier weights and report framing. */
  revenue_model: RevenueModel;

  /**
   * Paths or absolute URLs where money changes hands. These seed Tier 0 and are
   * the anchor for internal-link distance scoring. Always available, unlike GA4
   * conversion paths, so tiering degrades to this rather than failing.
   */
  primary_conversion: string[];

  /** Secondary value: docs, blog, newsletter. Seeds Tier 1 and 2. */
  secondary_conversion: string[];

  /** Average contract value. 0 means unknown and disables value-weighted scoring. */
  acv: number;

  /** Days from first touch to closed won. Used to size attribution windows. */
  sales_cycle_days: number;

  /** Free-text ICP. Read by grill-me and buyer-sharpener as a starting hypothesis. */
  icp_hint: string;

  /** Optional. Domains to benchmark against in competitor-teardown. */
  competitors?: string[];

  /** Optional. GA4 numeric property id. Discovered by doctor if omitted. */
  ga4_property_id?: string;

  /** Optional. GSC property, e.g. sc-domain:example.com. Discovered if omitted. */
  gsc_site_url?: string;

  /** Optional overrides for crawl behaviour. */
  crawl?: {
    /** Hard cap on URLs fetched per run. Protects Firecrawl credits. */
    max_urls?: number;
    /** Paths to skip entirely. */
    exclude?: string[];
    /** Crawl provider. Firecrawl is the shipped default. */
    provider?: 'firecrawl' | 'contextdev';
  };
}

export const DEFAULT_CRAWL = {
  max_urls: 500,
  exclude: ['/tag/', '/author/', '/page/', '/feed/'],
  provider: 'firecrawl' as const,
};

export interface ConfigProblem {
  field: string;
  message: string;
}

/**
 * Validates a parsed config. Returns problems rather than throwing so `doctor`
 * can report every issue at once instead of one per run.
 */
export function validateConfig(raw: unknown): ConfigProblem[] {
  const problems: ConfigProblem[] = [];
  const c = raw as Partial<RainmakerConfig> | null;

  if (!c || typeof c !== 'object') {
    return [{ field: '.', message: 'config is empty or not an object' }];
  }

  if (!c.site) {
    problems.push({ field: 'site', message: 'required' });
  } else if (!/^https?:\/\//.test(c.site)) {
    problems.push({ field: 'site', message: 'must start with http:// or https://' });
  }

  if (!c.revenue_model) {
    problems.push({ field: 'revenue_model', message: 'required' });
  } else if (!REVENUE_MODELS.includes(c.revenue_model)) {
    problems.push({
      field: 'revenue_model',
      message: `must be one of: ${REVENUE_MODELS.join(', ')}`,
    });
  }

  if (!c.primary_conversion?.length) {
    problems.push({
      field: 'primary_conversion',
      message:
        'at least one required. Without it, Tier 0 cannot be seeded and every ' +
        'finding scores against an unknown revenue path.',
    });
  }

  if (typeof c.acv !== 'number' || c.acv < 0) {
    problems.push({ field: 'acv', message: 'must be a number, 0 if unknown' });
  }

  if (typeof c.sales_cycle_days !== 'number' || c.sales_cycle_days <= 0) {
    problems.push({ field: 'sales_cycle_days', message: 'must be a positive number' });
  }

  if (!c.icp_hint) {
    problems.push({
      field: 'icp_hint',
      message: 'required. grill-me starts from this hypothesis and argues with it.',
    });
  }

  return problems;
}
