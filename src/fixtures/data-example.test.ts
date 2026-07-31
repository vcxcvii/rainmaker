import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateShape } from '../context/strategy.js';
import { tierAll } from '../analyze/tiering.js';
import { runChecks } from '../analyze/site-checks.js';
import { materialiseFile } from '../ledger/materialise.js';
import type { RainmakerConfig } from '../config/schema.js';
import type { CrawlSnapshot, Ga4Snapshot, GscSnapshot } from '../fetch/types.js';
import type { Strategy } from '../context/types.js';

/**
 * data.example/ ships in the npm package as the fixture set every skill
 * develops against with zero credentials. These tests exist because a fixture
 * that silently drifts from what the real pipeline produces is worse than no
 * fixture: it teaches a wrong shape. Caught two real inconsistencies while
 * building this set (a "fixed" title that the crawl fixture still showed as
 * broken, and a thin-content example whose tier didn't match its id) before
 * these tests existed to catch them mechanically.
 */

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const EXAMPLE = `${ROOT}data.example`;
const SNAPSHOT = `${EXAMPLE}/snapshots/2026-06-15T09-00-00Z`;

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

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

test('data.example/strategy.json passes the real shape validator', () => {
  const strategy = readJson<Strategy>(`${EXAMPLE}/strategy.json`);
  assert.deepEqual(validateShape(strategy), []);
});

test('data.example/ledger.jsonl replays without error and matches the committed state.json', () => {
  const state = materialiseFile(`${EXAMPLE}/ledger.jsonl`, '2026-06-15T09:00:00Z');
  const committed = readJson<typeof state>(`${EXAMPLE}/state.json`);
  assert.deepEqual(state, committed);
});

test('data.example diagnosis findings are exactly what the real pipeline produces from its own crawl, gsc and ga4 fixtures', () => {
  const crawl = readJson<CrawlSnapshot>(`${SNAPSHOT}/crawl.json`);
  const gsc = readJson<GscSnapshot>(`${SNAPSHOT}/gsc.json`);
  const ga4 = readJson<Ga4Snapshot>(`${SNAPSHOT}/ga4.json`);
  const diagnosis = readJson<{ findings: Array<{ id: string }> }>(`${SNAPSHOT}/diagnosis.json`);

  const tiers = tierAll({ config, pages: crawl.pages, gsc, ga4 });
  const findings = runChecks({ config, crawl, gsc, tiers }).filter((finding) => finding.verdict === 'finding');

  assert.deepEqual(
    findings.map((finding) => finding.id).sort(),
    diagnosis.findings.map((finding) => finding.id).sort(),
  );
});

test('every JSON file in data.example parses as valid JSON', () => {
  const files = [
    'strategy.json',
    'competitors.json',
    'citation-graph.json',
    'blueprint.json',
    'state.json',
    'snapshots/2026-06-15T09-00-00Z/crawl.json',
    'snapshots/2026-06-15T09-00-00Z/gsc.json',
    'snapshots/2026-06-15T09-00-00Z/ga4.json',
    'snapshots/2026-06-15T09-00-00Z/diagnosis.json',
    'snapshots/2026-06-15T09-00-00Z/serp.json',
    'snapshots/2026-06-15T09-00-00Z/citations.json',
  ];
  for (const file of files) {
    assert.doesNotThrow(() => JSON.parse(readFileSync(`${EXAMPLE}/${file}`, 'utf8')), file);
  }
});
