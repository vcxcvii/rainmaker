import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  createGoogleTokenProvider,
  loadServiceAccount,
  type GoogleTokenProvider,
} from '../auth/google.js';
import { loadConfig } from '../config/load.js';
import { fetchClarity } from '../fetch/clarity.js';
import { fetchCrawl } from '../fetch/crawl.js';
import { fetchGa4 } from '../fetch/ga4.js';
import { fetchGsc } from '../fetch/gsc.js';
import type {
  ClaritySnapshot,
  CrawlSnapshot,
  Ga4Snapshot,
  GscSnapshot,
} from '../fetch/types.js';
import { createContextDevProvider } from '../providers/contextdev.js';
import { createFirecrawlProvider } from '../providers/firecrawl.js';
import type { CrawlProvider } from '../providers/types.js';
import { writeStableJson } from '../util/json.js';

type Source = 'ga4' | 'gsc' | 'clarity' | 'all';

export interface SourceSnapshots {
  crawl?: CrawlSnapshot;
  ga4?: Ga4Snapshot;
  gsc?: GscSnapshot;
  clarity?: ClaritySnapshot;
}

function source(argv: string[]): Source {
  const index = argv.findIndex((arg) => arg === '--source');
  const value = index >= 0 ? argv[index + 1] : 'all';
  if (value === 'ga4' || value === 'gsc' || value === 'clarity' || value === 'all') {
    return value;
  }
  throw new Error('--source must be ga4, gsc, clarity, or all');
}

function tokenProvider(env: NodeJS.ProcessEnv): GoogleTokenProvider | undefined {
  const path = env.GOOGLE_APPLICATION_CREDENTIALS;
  return path
    ? createGoogleTokenProvider({ credentials: loadServiceAccount(path) })
    : undefined;
}

function crawlProvider(
  provider: 'firecrawl' | 'contextdev',
  env: NodeJS.ProcessEnv,
): CrawlProvider | undefined {
  if (provider === 'contextdev') {
    return env.CONTEXT_DEV_API_KEY
      ? createContextDevProvider({ apiKey: env.CONTEXT_DEV_API_KEY })
      : undefined;
  }
  return env.FIRECRAWL_API_KEY
    ? createFirecrawlProvider({ apiKey: env.FIRECRAWL_API_KEY })
    : undefined;
}

export function writeSourceSnapshots(dir: string, snapshots: SourceSnapshots): string[] {
  mkdirSync(dir, { recursive: true });
  const written: string[] = [];
  for (const name of ['crawl', 'ga4', 'gsc', 'clarity'] as const) {
    const snapshot = snapshots[name];
    if (!snapshot) continue;
    const path = resolve(dir, `${name}.json`);
    writeStableJson(path, snapshot);
    written.push(path);
  }
  return written;
}

export async function runFetch(argv: string[]): Promise<number> {
  const selected = source(argv);
  const config = loadConfig();
  const now = new Date();
  const env = process.env;
  const google = tokenProvider(env);
  const snapshots: SourceSnapshots = {};
  const tasks: Array<Promise<void>> = [];

  if (selected === 'all') {
    const providerName = config.crawl?.provider ?? 'firecrawl';
    const provider = crawlProvider(providerName, env);
    if (provider) {
      tasks.push(fetchCrawl({
        provider,
        site: config.site,
        maxUrls: config.crawl?.max_urls ?? 500,
        exclude: config.crawl?.exclude ?? [],
        now,
      }).then((snapshot) => {
        snapshots.crawl = snapshot;
      }));
    } else {
      console.error(`Skipping crawl: ${providerName} credential missing.`);
    }
  }

  if (selected === 'ga4' || selected === 'all') {
    if (google && config.ga4_property_id) {
      tasks.push(fetchGa4({
        propertyId: config.ga4_property_id,
        salesCycleDays: config.sales_cycle_days,
        tokenProvider: google,
        now,
      }).then((snapshot) => {
        snapshots.ga4 = snapshot;
      }));
    } else {
      console.error('Skipping GA4: service account or ga4_property_id missing.');
    }
  }

  if (selected === 'gsc' || selected === 'all') {
    if (google && config.gsc_site_url) {
      tasks.push(fetchGsc({
        siteUrl: config.gsc_site_url,
        tokenProvider: google,
        now,
      }).then((snapshot) => {
        snapshots.gsc = snapshot;
      }));
    } else {
      console.error('Skipping GSC: service account or gsc_site_url missing.');
    }
  }

  if (selected === 'clarity' || selected === 'all') {
    if (env.CLARITY_TOKEN) {
      tasks.push(fetchClarity({
        token: env.CLARITY_TOKEN,
        dataDir: resolve(process.cwd(), 'data'),
        now,
      }).then((snapshot) => {
        snapshots.clarity = snapshot;
      }));
    } else {
      console.error('Skipping Clarity: CLARITY_TOKEN missing.');
    }
  }

  await Promise.all(tasks);
  const stamp = now.toISOString();
  const dir = resolve(process.cwd(), 'data', 'snapshots', stamp);
  const written = writeSourceSnapshots(dir, snapshots);
  if (!written.length) {
    console.error('No snapshots written. Run `rainmaker doctor` for setup details.');
    return 1;
  }
  for (const path of written) console.log(`Wrote ${path}`);
  return 0;
}
