/**
 * `rainmaker keys`. A fast, offline listing of which credentials are set and
 * what each one unlocks. Deliberately makes no network call: that is what
 * `doctor` is for. This just answers "what do I have" in milliseconds.
 */

export interface KeyRow {
  env: string;
  unlocks: string;
  without: string;
}

export const KEY_TABLE: KeyRow[] = [
  {
    env: 'FIRECRAWL_API_KEY',
    unlocks: 'the default crawl provider',
    without: 'falls back to the built-in crawler: slower, no JavaScript rendering',
  },
  {
    env: 'CONTEXT_DEV_API_KEY',
    unlocks: 'brand retrieve and parse',
    without: 'skipped',
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

export function formatKeys(statuses: KeyStatus[]): string {
  const width = Math.max(...statuses.map((row) => row.env.length));
  const lines = statuses.map((row) => {
    const mark = (row.set ? 'set' : 'unset').padEnd(6);
    const detail = row.set ? row.unlocks : row.without;
    return `${row.env.padEnd(width)}  ${mark}  ${detail}`;
  });
  const setCount = statuses.filter((row) => row.set).length;
  lines.push('', `${setCount} of ${statuses.length} keys set.`);
  lines.push(
    setCount === 0
      ? 'Zero keys is a supported starting point: `rainmaker audit` still runs a full technical, structural and competitor diagnosis.'
      : 'Run `rainmaker doctor` to verify each set key actually works, not just that it is present.',
  );
  return lines.join('\n');
}

export function runKeys(argv: string[]): number {
  const statuses = checkKeys(process.env);
  if (argv.includes('--json')) {
    console.log(JSON.stringify(statuses, null, 2));
    return 0;
  }
  console.log(formatKeys(statuses));
  return 0;
}
