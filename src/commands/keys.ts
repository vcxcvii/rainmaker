/**
 * `rainmaker keys`. A fast, offline listing of which credentials are set and
 * what each one unlocks. Deliberately makes no network call: that is what
 * `doctor` is for. This just answers "what do I have" in milliseconds.
 *
 * `--balances` is the one exception, and it is opt-in for that reason. Without
 * it there was no way to answer "how many Firecrawl credits do I have" before
 * committing to a provider: the balance call only happened inside the crawl
 * preflight, which already required `--provider firecrawl` to reach. The
 * number that should inform the choice was only available after making it.
 */

import { createContextDevProvider } from '../providers/contextdev.js';
import { createFirecrawlProvider } from '../providers/firecrawl.js';

export interface KeyRow {
  env: string;
  unlocks: string;
  without: string;
}

export const KEY_TABLE: KeyRow[] = [
  {
    env: 'FIRECRAWL_API_KEY',
    unlocks:
      'available but dormant until you choose it: `crawl.provider: firecrawl`, `--provider firecrawl`, or `serp --allow-paid`',
    without: 'optional; built-in crawl remains the default',
  },
  {
    env: 'CONTEXT_DEV_API_KEY',
    unlocks:
      'available but dormant until you choose it: `crawl.provider: contextdev` or `--provider contextdev`',
    without: 'optional; built-in crawl remains the default',
  },
  {
    env: 'GOOGLE_APPLICATION_CREDENTIALS',
    unlocks: 'Search Console and Analytics',
    without: 'no measured opportunity sizing, no key-event tiering, confidence drops',
  },
  {
    env: 'PAGESPEED_API_KEY',
    unlocks: 'higher Core Web Vitals rate limits',
    without: '5 requests per minute, unauthenticated',
  },
  {
    env: 'CLARITY_TOKEN',
    unlocks: 'behavioural leak analysis',
    without: 'stop-losing-visitors refuses to run',
  },
  {
    env: 'ANTHROPIC_API_KEY',
    unlocks: 'rainmaker agent, and AI citation probes on Claude',
    without: 'that engine is skipped in citation probes; the offline AEO half still runs',
  },
  {
    env: 'OPENAI_API_KEY',
    unlocks: 'rainmaker agent (fallback provider), and AI citation probes on ChatGPT',
    without: 'that engine is skipped in citation probes; the offline AEO half still runs',
  },
  {
    env: 'PERPLEXITY_API_KEY',
    unlocks: 'AI citation probes on Perplexity',
    without: 'that engine is skipped; the offline AEO half still runs',
  },
];

export interface KeyStatus extends KeyRow {
  set: boolean;
}

export function checkKeys(env: NodeJS.ProcessEnv): KeyStatus[] {
  return KEY_TABLE.map((row) => ({ ...row, set: Boolean(env[row.env] && env[row.env]!.length > 0) }));
}

/** Balance per provider env var: a number, `null` for "no balance API", or a failure. */
export type Balance = { credits: number } | { credits: null } | { error: string };

export type Balances = Record<string, Balance>;

export async function fetchBalances(env: NodeJS.ProcessEnv): Promise<Balances> {
  const providers: [string, () => { remainingCredits: () => Promise<number | null> }][] = [];
  if (env.FIRECRAWL_API_KEY) {
    providers.push([
      'FIRECRAWL_API_KEY',
      () => createFirecrawlProvider({ apiKey: env.FIRECRAWL_API_KEY! }),
    ]);
  }
  if (env.CONTEXT_DEV_API_KEY) {
    providers.push([
      'CONTEXT_DEV_API_KEY',
      () => createContextDevProvider({ apiKey: env.CONTEXT_DEV_API_KEY! }),
    ]);
  }

  const balances: Balances = {};
  await Promise.all(
    providers.map(async ([name, create]) => {
      try {
        balances[name] = { credits: await create().remainingCredits() };
      } catch (error) {
        balances[name] = { error: error instanceof Error ? error.message : String(error) };
      }
    }),
  );
  return balances;
}

function balanceSuffix(balance: Balance | undefined): string {
  if (!balance) return '';
  if ('error' in balance) return `  [balance unavailable: ${balance.error}]`;
  if (balance.credits === null) return '  [no balance API]';
  return `  [${balance.credits} credits remaining]`;
}

export function formatKeys(statuses: KeyStatus[], balances: Balances = {}): string {
  const width = Math.max(...statuses.map((row) => row.env.length));
  const lines = statuses.map((row) => {
    const mark = (row.set ? 'set' : 'unset').padEnd(6);
    const detail = row.set ? row.unlocks : row.without;
    return `${row.env.padEnd(width)}  ${mark}  ${detail}${row.set ? balanceSuffix(balances[row.env]) : ''}`;
  });
  const setCount = statuses.filter((row) => row.set).length;
  lines.push('', `${setCount} of ${statuses.length} keys set.`);
  lines.push(
    setCount === 0
      ? 'Zero keys is supported: `rainmaker audit` still runs a baseline crawl, URL tiering and structural diagnosis.'
      : 'Run `rainmaker doctor` to verify each set key actually works, not just that it is present.',
  );

  const paid = statuses.filter(
    (row) => row.set && (row.env === 'FIRECRAWL_API_KEY' || row.env === 'CONTEXT_DEV_API_KEY'),
  );
  if (paid.length > 0) {
    lines.push(
      '',
      'A paid crawl provider is available but not in use. Ask the user which crawler',
      'they want before the first crawl, then record the answer as `crawl.provider`',
      'in rainmaker.config.yml so it is honoured without asking again.',
    );
    if (Object.keys(balances).length === 0) {
      lines.push('Run `rainmaker keys --balances` for live credit balances.');
    }
  }
  return lines.join('\n');
}

export async function runKeys(argv: string[]): Promise<number> {
  const statuses = checkKeys(process.env);
  const balances = argv.includes('--balances') ? await fetchBalances(process.env) : {};
  if (argv.includes('--json')) {
    console.log(JSON.stringify({ keys: statuses, balances }, null, 2));
    return 0;
  }
  console.log(formatKeys(statuses, balances));
  return 0;
}
