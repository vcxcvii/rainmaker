import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig } from '../config/load.js';
import { readStrategy } from '../context/strategy.js';
import { hashBody, readBusiness } from '../context/business.js';
import { authorityBudget } from '../blueprint/budget.js';
import { sequenceCohorts } from '../blueprint/cohorts.js';
import { detectCollisions } from '../blueprint/collisions.js';
import type { Blueprint, BlueprintNode } from '../blueprint/types.js';
import type { GscSnapshot, CrawlSnapshot } from '../fetch/types.js';
import { normalisePath } from '../analyze/checks.js';
import { writeStableJson } from '../util/json.js';

const BLUEPRINT_PATH = join('data', 'blueprint.json');

function latestSnapshotDir(): string | null {
  const dir = join('data', 'snapshots');
  if (!existsSync(dir)) return null;
  const entries = readdirSync(dir).sort();
  return entries.length ? join(dir, entries[entries.length - 1]) : null;
}

function readJson<T>(path: string): T | null {
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as T) : null;
}

/** Estimates the site's own indexation rate from two GSC snapshots, if available. */
function estimateIndexedRate(snapshotDir: string | null): { publishedLast90d: number; indexedRate: number } {
  if (!snapshotDir) return { publishedLast90d: 0, indexedRate: 0 };
  const gsc = readJson<GscSnapshot>(join(snapshotDir, 'gsc.json'));
  if (!gsc || gsc.rows.length === 0) return { publishedLast90d: 0, indexedRate: 0 };
  // A conservative proxy in the absence of publish-date history: pages with
  // any impressions are treated as indexed among those Search Console knows.
  const distinctPages = new Set(gsc.rows.map((row) => normalisePath(row.page)));
  const withImpressions = new Set(
    gsc.rows.filter((row) => row.impressions > 0).map((row) => normalisePath(row.page)),
  );
  return {
    publishedLast90d: distinctPages.size,
    indexedRate: distinctPages.size > 0 ? withImpressions.size / distinctPages.size : 0,
  };
}

function buildNodes(config: ReturnType<typeof loadConfig>, strategy: ReturnType<typeof readStrategy>, crawl: CrawlSnapshot | null): BlueprintNode[] {
  const nodes: BlueprintNode[] = [];
  const existingByPath = new Map((crawl?.pages ?? []).map((page) => [normalisePath(page.url), page]));

  let index = 0;
  for (const cluster of strategy.clusters) {
    index += 1;
    const id = `n${index}`;
    const path = cluster.existing_urls[0]
      ? normalisePath(cluster.existing_urls[0])
      : `/${cluster.head_query.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}/`;
    const existing = existingByPath.get(path);

    nodes.push({
      id,
      parent_id: null,
      depth: 1,
      path,
      status: existing ? 'live' : 'planned',
      existing_url: existing ? existing.url : null,
      page_type: cluster.intent === 'transactional' ? 'pricing' : cluster.intent === 'commercial' ? 'comparison' : 'guide',
      intent: cluster.intent,
      tier: cluster.target_tier,
      cluster_id: cluster.id,
      head_query: cluster.head_query,
      support_queries: cluster.support_queries,
      title: cluster.head_query.slice(0, 60),
      meta_description: `${cluster.head_query}: see how ${config.site.replace(/^https?:\/\//, '')} covers it.`.slice(0, 155),
      links_up: null,
      links_down: [],
      links_across: [],
      serp_verdict: 'unchecked',
      effort_hours: cluster.gap === 'missing' ? 3 : cluster.gap === 'thin' ? 2 : 0.5,
      priority_score: 0,
    });
  }
  return nodes;
}

export function runBlueprint(args: string[]): number {
  const config = loadConfig();
  const strategy = readStrategy();
  const now = new Date().toISOString();
  const snapshotDir = latestSnapshotDir();
  const crawl = snapshotDir ? readJson<CrawlSnapshot>(join(snapshotDir, 'crawl.json')) : null;

  if (args.includes('--build')) {
    const nodes = buildNodes(config, strategy, crawl);
    const collisions = detectCollisions(nodes);

    const contextHash = existsSync(join('context', 'business.md')) ? hashBody(readBusiness().body) : '';
    const blueprint: Blueprint = {
      version: 1,
      generated_at: now,
      context_hash: contextHash,
      model: config.revenue_model,
      nodes,
      orphans: [],
      collisions,
    };

    mkdirSync('data', { recursive: true });
    writeStableJson(BLUEPRINT_PATH, blueprint);

    console.log(`Wrote ${BLUEPRINT_PATH}: ${nodes.length} node(s).`);
    if (collisions.length > 0) {
      console.log(`\n${collisions.length} collision(s), same head query targeted by more than one node:`);
      for (const collision of collisions) {
        console.log(`  "${collision.head_query}": ${collision.node_ids.join(', ')}`);
      }
      console.log('\nMerge these or re-point one node at a distinct intent before publishing either.');
    }
    return 0;
  }

  if (args.includes('--tree')) {
    const blueprint = readJson<Blueprint>(BLUEPRINT_PATH);
    if (!blueprint) {
      console.error('No blueprint yet. Run `rainmaker blueprint --build` first.');
      return 1;
    }

    const { publishedLast90d, indexedRate } = estimateIndexedRate(snapshotDir);
    const budget = authorityBudget({ publishedLast90d, indexedRate });
    const cohorts = sequenceCohorts(blueprint.nodes, budget);

    for (const node of blueprint.nodes) {
      console.log(`${node.path.padEnd(40)} ${node.page_type.padEnd(12)} tier ${node.tier}  ${node.status}`);
    }
    console.log(`\nNodes: ${blueprint.nodes.filter((n) => n.status === 'planned').length} planned, ${blueprint.nodes.filter((n) => n.status === 'live').length} live`);
    console.log(`Collisions: ${blueprint.collisions.length}`);
    console.log(`Authority budget: ${budget} pages per month (indexed_rate ${indexedRate.toFixed(2)}, published_last_90d ${publishedLast90d})`);
    for (const cohort of cohorts) {
      console.log(`Cohort ${cohort.month}: ${cohort.node_ids.join(', ') || '(none)'}`);
    }
    return 0;
  }

  console.error('Usage: rainmaker blueprint --build | --tree');
  return 1;
}
