import type { RainmakerConfig } from '../config/schema.js';
import type { CrawlPage, CrawlSnapshot, GscSnapshot } from '../fetch/types.js';
import { effortFor } from './effort.js';
import {
  combineConfidence,
  computeOpportunity,
  MEASUREMENT_CONFIDENCE,
  revenueScore,
  sortFindings,
} from './scoring.js';
import type { TierAssignment } from './tiering.js';
import { findingId, normalisePath, type Check, type Finding, type Severity, type Tier } from './checks.js';

/**
 * The site checks.
 *
 * Each one states what would prove it wrong, per spec/false-positives.md. A
 * false finding costs more than a missed one: it gets read, gets scheduled,
 * gets someone's afternoon, and teaches the reader to check everything else
 * this system says.
 */

const CONFIRMATION_WORDS = ['thank-you', 'thankyou', 'confirmation', 'success', 'booked', 'received'];
const NON_CONTENT_PATHS = [
  /(^|\/)sitemap(?:[-_.].*)?\.xml$/i,
  /(^|\/)robots\.txt$/i,
  /(^|\/)feed(?:\.xml|\/)?$/i,
  /(^|\/)rss(?:\.xml|\/)?$/i,
  /(^|\/)atom\.xml$/i,
];

function isContentDocument(url: string): boolean {
  const path = new URL(url).pathname;
  return !NON_CONTENT_PATHS.some((pattern) => pattern.test(path));
}

export interface CheckInput {
  config: RainmakerConfig;
  crawl: CrawlSnapshot;
  gsc?: GscSnapshot | null;
  tiers: Map<string, TierAssignment>;
  curve?: Record<number, number>;
}

interface Draft {
  check: Check;
  url: string;
  severity: Severity;
  message: string;
  evidence: Record<string, unknown>;
  measurement: number;
  verdict?: 'finding' | 'suspicion';
  confirm_with?: string;
}

function build(draft: Draft, input: CheckInput): Finding {
  const path = normalisePath(draft.url);
  const tier = input.tiers.get(path) ?? {
    tier: 3 as Tier,
    tier_source: 'default',
    tier_confidence: 0.1,
  };
  const opportunity = computeOpportunity({ url: draft.url, gsc: input.gsc, curve: input.curve });
  const effort = effortFor(draft.check);

  return {
    id: findingId(tier.tier, draft.check, draft.url),
    check: draft.check,
    url: draft.url,
    tier: tier.tier,
    tier_source: tier.tier_source,
    tier_confidence: tier.tier_confidence,
    severity: draft.severity,
    effort_hours: effort,
    opportunity: Math.round(opportunity * 100) / 100,
    revenue_score: revenueScore({
      tier: tier.tier,
      severity: draft.severity,
      effort_hours: effort,
      opportunity,
      acv: input.config.acv,
    }),
    confidence: combineConfidence(tier.tier_confidence, draft.measurement),
    evidence: draft.evidence,
    message: draft.message,
    verdict: draft.verdict ?? 'finding',
    ...(draft.confirm_with ? { confirm_with: draft.confirm_with } : {}),
  };
}

/**
 * URLs this run actually looked at.
 *
 * Excludes 5xx, redirect endpoints and soft 404s, because a finding may only
 * be closed on a URL whose absence is evidence. The ledger is append-only, so
 * a wrong close is permanent.
 */
export function coverageSet(crawl: CrawlSnapshot): Set<string> {
  const covered = new Set<string>();
  for (const page of crawl.pages) {
    if (page.status >= 500 || page.status === 0) continue;
    if (page.status >= 300 && page.status < 400) continue;
    if (page.status === 200 && page.word_count > 0 && page.word_count < 50) continue;
    covered.add(normalisePath(page.url));
  }
  return covered;
}

function isIntentionalNoindex(page: CrawlPage, config: RainmakerConfig, inboundLinks: number): boolean {
  const path = normalisePath(page.url);
  const declared = (config as { intentional_noindex?: string[] }).intentional_noindex ?? [];
  if (declared.some((pattern) => path.startsWith(pattern.replace(/\*$/, '')))) return true;
  if (CONFIRMATION_WORDS.some((word) => path.includes(word))) return true;
  return inboundLinks === 0;
}

export function inboundCounts(pages: CrawlPage[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const page of pages) {
    for (const link of page.internal_links_out) {
      const target = normalisePath(link);
      if (target === normalisePath(page.url)) continue;
      counts.set(target, (counts.get(target) ?? 0) + 1);
    }
  }
  return counts;
}

export function runChecks(input: CheckInput): Finding[] {
  const { crawl, config } = input;
  const pages = crawl.pages;
  const inbound = inboundCounts(pages);
  const byPath = new Map(pages.map((page) => [normalisePath(page.url), page]));
  const drafts: Draft[] = [];

  const coverage = crawl.urls_discovered > 0 ? crawl.urls_fetched / crawl.urls_discovered : 1;
  const coverageComplete = coverage >= 0.95 && !crawl.budget_exhausted;

  for (const page of pages) {
    if (!isContentDocument(page.url)) continue;
    const path = normalisePath(page.url);
    const tier = input.tiers.get(path)?.tier ?? 3;
    const robots = (page.robots_meta ?? '').toLowerCase();
    const inboundLinks = inbound.get(path) ?? 0;

    if (page.status >= 400) {
      drafts.push({
        check: 'status_error',
        url: page.url,
        severity: page.status >= 500 ? 'blocking' : 'major',
        message: `Returns HTTP ${page.status}.`,
        evidence: { status: page.status },
        measurement: MEASUREMENT_CONFIDENCE.measured,
      });
      continue;
    }

    if (robots.includes('noindex') && !isIntentionalNoindex(page, config, inboundLinks)) {
      drafts.push({
        check: 'noindex',
        url: page.url,
        severity: tier <= 1 ? 'blocking' : 'moderate',
        message: `Excluded from search by a robots meta tag: "${page.robots_meta}".`,
        evidence: { robots_meta: page.robots_meta, inbound_internal_links: inboundLinks },
        measurement: MEASUREMENT_CONFIDENCE.measured,
      });
    }

    if (page.canonical) {
      const target = normalisePath(page.canonical);
      const targetPage = byPath.get(target);
      if (target !== path && targetPage && targetPage.status >= 400) {
        drafts.push({
          check: 'canonical',
          url: page.url,
          severity: 'blocking',
          message: `Canonical points at ${target}, which returns HTTP ${targetPage.status}.`,
          evidence: { canonical: page.canonical, target_status: targetPage.status },
          measurement: MEASUREMENT_CONFIDENCE.measured,
        });
      } else if (
        target !== path &&
        targetPage?.canonical &&
        normalisePath(targetPage.canonical) !== target
      ) {
        drafts.push({
          check: 'canonical',
          url: page.url,
          severity: 'major',
          message: `Canonical chain: ${path} points at ${target}, which points elsewhere again.`,
          evidence: { canonical: page.canonical, next: targetPage.canonical },
          measurement: MEASUREMENT_CONFIDENCE.measured,
        });
      }
    }

    if (inboundLinks === 0 && path !== '/' && page.status === 200 && !robots.includes('noindex')) {
      drafts.push({
        check: 'orphan',
        url: page.url,
        severity: tier <= 1 ? 'major' : 'moderate',
        message: 'No internal links point at this page.',
        evidence: { inbound_internal_links: 0, crawl_coverage: Math.round(coverage * 100) / 100 },
        measurement: MEASUREMENT_CONFIDENCE.measured,
        verdict: coverageComplete ? 'finding' : 'suspicion',
        confirm_with: coverageComplete
          ? undefined
          : `Crawl covered ${Math.round(coverage * 100)} percent of discovered URLs, so a link may exist on a page that was never fetched. Raise crawl.max_urls and re-run.`,
      });
    }

    if (!page.title) {
      drafts.push({
        check: 'title',
        url: page.url,
        severity: tier <= 1 ? 'major' : 'moderate',
        message: 'No title tag.',
        evidence: { title: null },
        measurement: MEASUREMENT_CONFIDENCE.measured,
      });
    }

    if (!page.meta_description && tier <= 2) {
      drafts.push({
        check: 'meta_description',
        url: page.url,
        severity: 'moderate',
        message: 'No meta description, so the snippet is whatever Google decides to extract.',
        evidence: { meta_description: null },
        measurement: MEASUREMENT_CONFIDENCE.measured,
      });
    }

    if (page.h1.length === 0 && page.status === 200) {
      drafts.push({
        check: 'h1',
        url: page.url,
        severity: 'minor',
        message: 'No H1.',
        evidence: { h1_count: 0 },
        measurement: MEASUREMENT_CONFIDENCE.measured,
      });
    }

    if (tier <= 2 && page.word_count > 0 && page.word_count < 300) {
      drafts.push({
        check: 'thin',
        url: page.url,
        severity: 'moderate',
        message: `${page.word_count} words on a tier ${tier} page.`,
        evidence: { word_count: page.word_count },
        measurement: MEASUREMENT_CONFIDENCE.measured,
        verdict: 'suspicion',
        confirm_with: 'Compare required buyer questions and live SERP coverage before adding copy. Word count alone is not a defect.',
      });
    }

    if (tier <= 1 && page.schema_types.length === 0) {
      drafts.push({
        check: 'schema',
        url: page.url,
        severity: 'moderate',
        message: 'No structured data is present.',
        evidence: { schema_types: [] },
        measurement: MEASUREMENT_CONFIDENCE.measured,
        verdict: 'suspicion',
        confirm_with: 'Confirm an eligible schema type and a search-result benefit before implementing markup.',
      });
    }
  }

  // Duplication is a set problem, so it runs once across pages rather than per page.
  const byHash = new Map<string, CrawlPage[]>();
  for (const page of pages) {
    if (!isContentDocument(page.url)) continue;
    if (page.status !== 200 || page.word_count < 100) continue;
    const prefix = page.content_hash.slice(0, 16);
    byHash.set(prefix, [...(byHash.get(prefix) ?? []), page]);
  }
  for (const [prefix, group] of byHash) {
    // Pages that canonicalise to another member are correctly configured, not duplicates.
    const distinct = group.filter(
      (page) => !page.canonical || normalisePath(page.canonical) === normalisePath(page.url),
    );
    if (distinct.length >= 2) {
      const sorted = [...distinct].sort((left, right) => left.url.localeCompare(right.url));
      drafts.push({
        check: 'duplicate',
        url: sorted[0].url,
        severity: 'major',
        message: `${distinct.length} pages share identical content and none canonicalises to another.`,
        evidence: {
          content_hash_prefix: prefix,
          urls: sorted.map((page) => normalisePath(page.url)),
        },
        measurement: MEASUREMENT_CONFIDENCE.measured,
      });
    }
  }

  return sortFindings(drafts.map((draft) => build(draft, input)));
}
