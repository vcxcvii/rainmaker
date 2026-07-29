import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ClaritySnapshot } from './types.js';

const DAILY_LIMIT = 10;

function recordCall(dataDir: string, now: Date): void {
  mkdirSync(dataDir, { recursive: true });
  const path = resolve(dataDir, 'clarity-call-log.json');
  const date = now.toISOString().slice(0, 10);
  let log: Record<string, number> = {};
  if (existsSync(path)) {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown;
    if (parsed && typeof parsed === 'object') log = parsed as Record<string, number>;
  }
  const used = log[date] ?? 0;
  if (used >= DAILY_LIMIT) throw new Error(`Clarity API daily limit (${DAILY_LIMIT}) hit`);
  log[date] = used + 1;
  writeFileSync(path, `${JSON.stringify(log, null, 2)}\n`, 'utf8');
}

export async function fetchClarity(options: {
  token: string;
  dataDir?: string;
  fetcher?: typeof fetch;
  now?: Date;
  windowDays?: 1 | 2 | 3;
  trackBudget?: boolean;
}): Promise<ClaritySnapshot> {
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? new Date();
  const windowDays = options.windowDays ?? 3;
  if (options.trackBudget !== false) recordCall(options.dataDir ?? 'data', now);

  const url = new URL('https://www.clarity.ms/export-data/api/v1/project-live-insights');
  url.searchParams.set('numOfDays', String(windowDays));
  const response = await fetcher(url, {
    headers: {
      authorization: `Bearer ${options.token}`,
      'content-type': 'application/json',
    },
  });
  if (!response.ok) throw new Error(`Clarity fetch failed: HTTP ${response.status}`);
  const payload = (await response.json()) as unknown;
  if (!Array.isArray(payload)) throw new Error('Clarity fetch returned a non-array response');

  return {
    fetched_at: now.toISOString(),
    window_days: windowDays,
    metrics: payload,
  };
}
