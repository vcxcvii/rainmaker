import { readFileSync } from 'node:fs';
import { tierAll, tierDistribution } from '../src/analyze/tiering.js';
import { runChecks } from '../src/analyze/site-checks.js';
import { attribution } from '../src/commands/audit.js';
import type { RainmakerConfig } from '../src/config/schema.js';
import type { CrawlSnapshot, Ga4Snapshot, GscSnapshot } from '../src/fetch/types.js';
import { writeStableJson } from '../src/util/json.js';

const dir = 'data.example/snapshots/2026-06-15T09-00-00Z';
const read = <T>(name: string): T => JSON.parse(readFileSync(`${dir}/${name}`, 'utf8')) as T;

const config: RainmakerConfig = {
  site: 'https://quillet.com',
  revenue_model: 'sales-led',
  primary_conversion: ['/demo', '/pricing'],
  secondary_conversion: ['/case-studies'],
  acv: 18000,
  sales_cycle_days: 45,
  icp_hint: 'legal ops leads at 200 to 2000 person firms',
  competitors: ['ironclad.com', 'lexion.com'],
};

const crawl = read<CrawlSnapshot>('crawl.json');
const gsc = read<GscSnapshot>('gsc.json');
const ga4 = read<Ga4Snapshot>('ga4.json');
const previous = read<Record<string, unknown>>('diagnosis.json');
const tiers = tierAll({ config, pages: crawl.pages, gsc, ga4 });
const all = runChecks({ config, crawl, gsc, tiers });

const findings = all.filter((finding) => finding.verdict === 'finding');
const suspicions = all.filter((finding) => finding.verdict === 'suspicion');

writeStableJson(`${dir}/diagnosis.json`, {
  ...previous,
  tier_distribution: tierDistribution(tiers),
  findings,
  suspicions,
  attribution: attribution(findings, suspicions),
});
