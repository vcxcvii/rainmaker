import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig, CONFIG_FILENAME } from '../config/load.js';
import { fetchCrawl } from '../fetch/crawl.js';
import { crawlPreflight } from './crawl-preflight.js';
import type { CrawlSnapshot, Ga4Snapshot, GscSnapshot } from '../fetch/types.js';
import { coverageSet, runChecks } from '../analyze/site-checks.js';
import { TIERS, TIER_ORDER, tierAll, tierDistribution } from '../analyze/tiering.js';
import { normalisePath, type Finding } from '../analyze/checks.js';
import { siteLevelFindings } from '../analyze/site-level.js';
import {
  formatMeasurementWarning,
  measurementState,
  proposeKeyEvents,
} from '../analyze/measurement.js';
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
  /**
   * What this file does and does not claim.
   *
   * An assistant reading a diagnosis will notice things no check covers, and
   * saying so is useful. Printing it in the tool's voice, numbered into the
   * tool's list, is not: the reader loses the ability to tell which items
   * carry evidence, and every scored finding inherits the credibility of the
   * weakest guess beside it. This block states the complete set the checks
   * produced, so anything else is visibly outside it.
   */
  attribution: Attribution;
}

export interface Attribution {
  authored_by: 'rainmaker-cli';
  findings: number;
  suspicions: number;
  statement: string;
}

/**
 * Builds the closed statement of what the checks produced.
 *
 * The counts are here so the claim is checkable rather than rhetorical: a
 * report carrying more items than this attributes them to the wrong author.
 */
export function attribution(findings: Finding[], suspicions: Finding[]): Attribution {
  return {
    authored_by: 'rainmaker-cli',
    findings: findings.length,
    suspicions: suspicions.length,
    statement:
      `These ${findings.length} finding(s) and ${suspicions.length} suspicion(s) are the complete output ` +
      'of the checks that ran. Anything else in a report is the assistant\'s own reading: ' +
      'it belongs in its own attributed section, never merged into this list or numbered across it.',
  };
}

function latestSnapshot(): string | null {
  if (!existsSync(SNAPSHOTS)) return null;
  const entries = readdirSync(SNAPSHOTS).sort();
  return entries.length > 0 ? join(SNAPSHOTS, entries[entries.length - 1]) : null;
}

function readJson<T>(path: string): T | null {
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as T) : null;
}

/**
 * The newest snapshot that actually contains this measurement, and where it
 * came from.
 *
 * A crawl writes a new snapshot directory, so reading GA4 only from that
 * directory throws away a `rainmaker fetch` run from minutes earlier and
 * reports the capability as missing. Measurement and crawl are collected on
 * different schedules by design; the audit has to look back for the most
 * recent one rather than assume they landed together.
 */
export function readLatest<T>(name: 'gsc.json' | 'ga4.json'): { snapshot: T; from: string } | null {
  if (!existsSync(SNAPSHOTS)) return null;
  for (const entry of readdirSync(SNAPSHOTS).sort().reverse()) {
    const snapshot = readJson<T>(join(SNAPSHOTS, entry, name));
    if (snapshot) return { snapshot, from: entry };
  }
  return null;
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
    const maxUrls = Number(flagValue(args, '--max-urls') ?? config.crawl?.max_urls ?? 100);
    const provider = await crawlPreflight({
      args,
      env: process.env,
      maxUrls,
      configured: config.crawl?.provider,
    });
    if (!provider) return 1;

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

  const gscSource = readLatest<GscSnapshot>('gsc.json');
  const ga4Source = readLatest<Ga4Snapshot>('ga4.json');
  const gsc = gscSource?.snapshot ?? null;
  const ga4 = ga4Source?.snapshot ?? null;

  const currentSnapshot = snapshotDir ? snapshotDir.split('/').pop() : null;
  for (const [name, source] of [
    ['Search Console', gscSource],
    ['GA4', ga4Source],
  ] as const) {
    if (source && source.from !== currentSnapshot) {
      console.log(`${name} data carried forward from snapshot ${source.from}. Run \`rainmaker fetch\` to refresh it.`);
    }
  }

  const tiers = tierAll({ config, pages: crawl!.pages, gsc, ga4 });
  const all = [
    ...runChecks({ config, crawl: crawl!, gsc, tiers }),
    ...siteLevelFindings({
      config,
      tierDistribution: tierDistribution(tiers),
      coverageComplete: !crawl!.budget_exhausted,
    }),
  ];
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
    attribution: attribution(findings, suspicions),
  };
  writeStableJson(join(snapshotDir!, 'diagnosis.json'), diagnosis);

  if (json) {
    console.log(JSON.stringify(diagnosis, null, 2));
    return 0;
  }

  const tierZero = [...tiers.entries()]
    .filter(([, assignment]) => assignment.tier === 0)
    .map(([path]) => path);
  const measurementNotice = formatMeasurementWarning(
    measurementState(ga4),
    proposeKeyEvents(config, tierZero),
  );

  report(diagnosis, opened.length, closed.length, result.rejected.length, measurementNotice);
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
export function formatTierDistribution(
  tiers: Record<string, number>,
  total: number,
  coverageComplete = true,
): string {
  const lines = ['Tiers', `  How close each of your ${total} pages sits to revenue.`, ''];

  for (const tier of TIER_ORDER) {
    const count = tiers[String(tier)] ?? 0;
    const bar = count > 0 ? '#'.repeat(Math.min(count, 40)) : '';
    lines.push(
      `  Tier ${tier}  ${String(count).padStart(4)}  ${TIERS[tier].plain.padEnd(30)} ${bar}`,
    );
  }

  if (!coverageComplete) {
    lines.push(
      '',
      '  Partial crawl. Missing tiers mean "not found in this sample", not',
      '  "absent from the site". Raise max_urls before making a site-wide claim.',
    );
  }

  return lines.join('\n');
}

function report(
  diagnosis: Diagnosis,
  opened: number,
  closed: number,
  rejected: number,
  measurementNotice: string | undefined,
): void {
  const { tier_distribution: tiers, coverage } = diagnosis;
  const total = Object.values(tiers).reduce((sum, count) => sum + count, 0);

  console.log('');
  const coverageComplete = !coverage.budget_exhausted && coverage.fetched >= coverage.discovered;
  console.log(formatTierDistribution(tiers, total, coverageComplete));
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

  // A connected GA4 with nothing defined as a key event is not a degraded
  // capability, so it never appears above. It is worse than one: the property
  // answers every call, reports real sessions, and measures no conversion.
  if (measurementNotice) console.log(`\n${measurementNotice}`);

  console.log('\nClosest to revenue:\n');
  for (const finding of diagnosis.findings.slice(0, 5)) {
    console.log(
      `  ${normalisePath(finding.url).padEnd(32)} tier ${finding.tier}  ${finding.check.padEnd(16)} ` +
        `${String(finding.effort_hours).padStart(4)}h  score ${finding.revenue_score}`,
    );
    console.log(`    ${finding.message}`);
  }

  console.log('\nFull diagnosis written to the latest snapshot directory.');

  // Printed last, and by the CLI rather than left to the assistant, so the
  // boundary appears verbatim in the transcript the user reads.
  console.log(`\n${diagnosis.attribution.statement}`);
}
