import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig, CONFIG_FILENAME } from '../config/load.js';
import { fetchCrawl } from '../fetch/crawl.js';
import { createFirecrawlProvider } from '../providers/firecrawl.js';
import { createContextDevProvider } from '../providers/contextdev.js';
import { createBuiltinProvider } from '../providers/builtin.js';
import { formatProjection, projectCrawlCost } from '../agent/costguard.js';
import type { CrawlSnapshot, Ga4Snapshot, GscSnapshot } from '../fetch/types.js';
import { coverageSet, runChecks } from '../analyze/site-checks.js';
import { TIERS, TIER_ORDER, tierAll, tierDistribution } from '../analyze/tiering.js';
import { normalisePath, type Finding } from '../analyze/checks.js';
import { appendEvents, readLedger } from '../ledger/append.js';
import { closureEvents, planClosures } from '../ledger/close.js';
import { materialise } from '../ledger/materialise.js';
import type { LedgerEvent } from '../ledger/types.js';
import { writeStableJson } from '../util/json.js';

const DATA = 'data';
const SNAPSHOTS = join(DATA, 'snapshots');
const LEDGER = join(DATA, 'ledger.jsonl');
const STATE = join(DATA, 'state.json');

export interface Diagnosis {
  generated_at: string;
  config_hash: string;
  capabilities: Record<'crawl' | 'gsc' | 'ga4' | 'clarity' | 'pagespeed', 'live' | 'missing' | 'error'>;
  tier_distribution: Record<'0' | '1' | '2' | '3' | '4', number>;
  coverage: { discovered: number; fetched: number; budget_exhausted: boolean; coverage_gap: number };
  findings: Finding[];
  suspicions: Finding[];
}

function latestSnapshot(): string | null {
  if (!existsSync(SNAPSHOTS)) return null;
  const entries = readdirSync(SNAPSHOTS).sort();
  return entries.length > 0 ? join(SNAPSHOTS, entries[entries.length - 1]) : null;
}

function readJson<T>(path: string): T | null {
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as T) : null;
}

function flagValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

export async function runAudit(args: string[]): Promise<number> {
  const config = loadConfig();
  const now = new Date().toISOString();
  const refresh = args.includes('--refresh');
  const json = args.includes('--json');

  const configHash = createHash('sha256')
    .update(readFileSync(CONFIG_FILENAME, 'utf8'), 'utf8')
    .digest('hex');

  let snapshotDir = latestSnapshot();
  let crawl: CrawlSnapshot | null = snapshotDir ? readJson<CrawlSnapshot>(join(snapshotDir, 'crawl.json')) : null;

  if (refresh) {
    // --refresh re-tiers and re-scores the most recent snapshot without spending
    // a crawl. Useful after editing config, and free.
    if (!crawl) {
      console.error('Nothing to refresh: no crawl snapshot yet. Run `rainmaker audit` without --refresh.');
      return 1;
    }
  } else {
    const maxUrls = Number(flagValue(args, '--max-urls') ?? config.crawl?.max_urls ?? 500);
    const wanted = config.crawl?.provider ?? 'firecrawl';
    const firecrawlKey = process.env.FIRECRAWL_API_KEY;
    const contextKey = process.env.CONTEXT_DEV_API_KEY;

    // Invariant 7: no credential is required for a first audit. A configured
    // paid provider with no key falls back to the built-in crawler rather
    // than refusing to run, at lower throughput and no JavaScript rendering.
    let provider;
    if (wanted === 'contextdev' && contextKey) {
      provider = createContextDevProvider({ apiKey: contextKey });
    } else if (wanted === 'firecrawl' && firecrawlKey) {
      provider = createFirecrawlProvider({ apiKey: firecrawlKey });
    } else {
      console.log(
        `No ${wanted === 'contextdev' ? 'CONTEXT_DEV_API_KEY' : 'FIRECRAWL_API_KEY'} set. ` +
          'Falling back to the built-in crawler: slower, no JavaScript rendering. ' +
          'Run `rainmaker doctor` to see what a key would unlock.',
      );
      provider = createBuiltinProvider();
    }

    const remainingCredits = await provider.remainingCredits();
    const projection = projectCrawlCost(maxUrls, remainingCredits, args.includes('--allow-over-budget'));
    console.log(formatProjection(projection));
    if (!projection.allowed) {
      console.error(projection.reason);
      return 1;
    }

    console.log(`Crawling ${config.site} (max ${maxUrls} URLs, ${provider.name})...`);
    crawl = await fetchCrawl({
      provider,
      site: config.site,
      maxUrls,
      exclude: config.crawl?.exclude ?? [],
    });
    snapshotDir = join(SNAPSHOTS, now.replace(/[:.]/g, '-'));
    mkdirSync(snapshotDir, { recursive: true });
    writeStableJson(join(snapshotDir, 'crawl.json'), crawl);
    console.log(`  ${crawl.urls_fetched} of ${crawl.urls_discovered} URLs fetched via ${crawl.provider}.`);
  }

  const gsc = snapshotDir ? readJson<GscSnapshot>(join(snapshotDir, 'gsc.json')) : null;
  const ga4 = snapshotDir ? readJson<Ga4Snapshot>(join(snapshotDir, 'ga4.json')) : null;

  const tiers = tierAll({ config, pages: crawl!.pages, gsc, ga4 });
  const all = runChecks({ config, crawl: crawl!, gsc, tiers });
  const findings = all.filter((finding) => finding.verdict === 'finding');
  const suspicions = all.filter((finding) => finding.verdict === 'suspicion');

  // Ledger. Open what is new, close only what this run can prove is gone.
  const events = readLedger(LEDGER);
  const state = materialise(events, now);
  const known = new Set(Object.keys(state.findings));
  const present = all.map((finding) => finding.id);

  const opened: LedgerEvent[] = all
    .filter((finding) => !known.has(finding.id) && finding.verdict === 'finding')
    .map((finding) => ({
      ts: now,
      id: finding.id,
      event: 'opened' as const,
      to: { url: normalisePath(finding.url), severity: finding.severity, ...numeric(finding.evidence) },
      score: finding.revenue_score,
      confidence: finding.confidence,
    }));

  const plan = planClosures(state, {
    covered: coverageSet(crawl!),
    present,
    budgetExhausted: crawl!.budget_exhausted,
  });
  const closed = closureEvents(plan, now, `remeasure:${snapshotDir ?? 'refresh'}`);

  mkdirSync(DATA, { recursive: true });
  const result = appendEvents(LEDGER, [...opened, ...closed]);
  const rebuilt = materialise(readLedger(LEDGER), now);
  writeStableJson(STATE, rebuilt);

  const diagnosis: Diagnosis = {
    generated_at: now,
    config_hash: configHash,
    capabilities: {
      crawl: 'live',
      gsc: gsc ? 'live' : 'missing',
      ga4: ga4 ? 'live' : 'missing',
      clarity: existsSync(join(snapshotDir ?? '', 'clarity.json')) ? 'live' : 'missing',
      pagespeed: 'missing',
    },
    tier_distribution: tierDistribution(tiers),
    coverage: {
      discovered: crawl!.urls_discovered,
      fetched: crawl!.urls_fetched,
      budget_exhausted: crawl!.budget_exhausted,
      coverage_gap: plan.coverage_gap.length,
    },
    findings,
    suspicions,
  };
  writeStableJson(join(snapshotDir!, 'diagnosis.json'), diagnosis);

  if (json) {
    console.log(JSON.stringify(diagnosis, null, 2));
    return 0;
  }

  report(diagnosis, opened.length, closed.length, result.rejected.length);
  return 0;
}

/** Keeps only the numeric evidence, since a ledger baseline must be comparable. */
function numeric(evidence: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(evidence)) {
    if (typeof value === 'number') out[key] = value;
  }
  return out;
}

/**
 * `Tiers: 0:1 1:0 2:13` was the first thing a new user ever saw, and it is
 * unreadable without a definition they have not been given yet. Tier drives
 * every score in this system, so the one place it is guaranteed to be read is
 * the place it has to be explained.
 */
export function formatTierDistribution(tiers: Record<string, number>, total: number): string {
  const lines = ['Tiers', `  How close each of your ${total} pages sits to revenue.`, ''];

  for (const tier of TIER_ORDER) {
    const count = tiers[String(tier)] ?? 0;
    const bar = count > 0 ? '#'.repeat(Math.min(count, 40)) : '';
    lines.push(
      `  Tier ${tier}  ${String(count).padStart(4)}  ${TIERS[tier].plain.padEnd(30)} ${bar}`,
    );
  }

  if ((tiers['0'] ?? 0) === 0) {
    lines.push(
      '',
      '  No Tier 0 pages. Nothing on this site is where money changes hands,',
      '  so every score below is relative to nothing. Check primary_conversion',
      '  in rainmaker.config.yml.',
    );
  } else if ((tiers['1'] ?? 0) === 0) {
    lines.push(
      '',
      '  No Tier 1 pages. Buyers arrive at awareness content and reach the',
      '  point of paying with nothing in between to convince them. This is',
      '  usually worth more than any single fix listed below.',
    );
  }

  return lines.join('\n');
}

function report(diagnosis: Diagnosis, opened: number, closed: number, rejected: number): void {
  const { tier_distribution: tiers, coverage } = diagnosis;
  const total = Object.values(tiers).reduce((sum, count) => sum + count, 0);

  console.log('');
  console.log(formatTierDistribution(tiers, total));
  console.log(
    `Findings: ${diagnosis.findings.length}` +
      (diagnosis.suspicions.length ? `, plus ${diagnosis.suspicions.length} suspicion(s)` : ''),
  );
  console.log(`Ledger: ${opened} opened, ${closed} closed${rejected ? `, ${rejected} rejected` : ''}.`);

  if (coverage.coverage_gap > 0) {
    console.log(
      `Coverage gap: ${coverage.coverage_gap} open finding(s) whose URL this run never fetched. ` +
        'They were left untouched rather than closed, because absence is only evidence when the URL was looked at.',
    );
  }

  const missing = Object.entries(diagnosis.capabilities)
    .filter(([, status]) => status !== 'live')
    .map(([name]) => name);
  if (missing.length > 0) {
    console.log(
      `Degraded: ${missing.join(', ')} missing. Opportunity sizing falls back to a flat value and every affected finding says so.`,
    );
  }

  console.log('\nClosest to revenue:\n');
  for (const finding of diagnosis.findings.slice(0, 5)) {
    console.log(
      `  ${normalisePath(finding.url).padEnd(32)} tier ${finding.tier}  ${finding.check.padEnd(16)} ` +
        `${String(finding.effort_hours).padStart(4)}h  score ${finding.revenue_score}`,
    );
    console.log(`    ${finding.message}`);
  }

  console.log('\nFull diagnosis written to the latest snapshot directory.');
}
