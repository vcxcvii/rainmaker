import { GOOGLE_SCOPES, type GoogleTokenProvider } from '../auth/google.js';
import type { GscSnapshot } from './types.js';

interface GscApiRow {
  keys?: unknown;
  clicks?: unknown;
  impressions?: unknown;
  ctr?: unknown;
  position?: unknown;
}

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function gscWindow(now: Date): { startDate: string; endDate: string } {
  const end = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - 3,
  ));
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 27);
  return { startDate: dateOnly(start), endDate: dateOnly(end) };
}

function number(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function parseRows(value: unknown): GscSnapshot['rows'] {
  if (!Array.isArray(value)) return [];
  const rows: GscSnapshot['rows'] = [];
  for (const candidate of value) {
    if (!candidate || typeof candidate !== 'object') continue;
    const row = candidate as GscApiRow;
    if (!Array.isArray(row.keys)) continue;
    const page = row.keys[0];
    const query = row.keys[1];
    if (typeof page !== 'string' || typeof query !== 'string') continue;
    rows.push({
      page,
      query,
      clicks: number(row.clicks),
      impressions: number(row.impressions),
      ctr: number(row.ctr),
      position: number(row.position),
    });
  }
  return rows;
}

export async function fetchGsc(options: {
  siteUrl: string;
  tokenProvider: GoogleTokenProvider;
  fetcher?: typeof fetch;
  now?: Date;
}): Promise<GscSnapshot> {
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? new Date();
  const { startDate, endDate } = gscWindow(now);
  const token = await options.tokenProvider.getAccessToken([GOOGLE_SCOPES.gsc]);
  const rows: GscSnapshot['rows'] = [];
  const rowLimit = 25_000;

  for (let startRow = 0; startRow < 50_000; startRow += rowLimit) {
    const response = await fetcher(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(options.siteUrl)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          dimensions: ['page', 'query'],
          endDate,
          rowLimit,
          startDate,
          startRow,
          type: 'web',
        }),
      },
    );
    if (!response.ok) throw new Error(`GSC fetch failed: HTTP ${response.status}`);
    const payload = (await response.json()) as { rows?: unknown };
    const page = parseRows(payload.rows);
    rows.push(...page);
    if (page.length < rowLimit) break;
  }

  return {
    fetched_at: now.toISOString(),
    site_url: options.siteUrl,
    window_days: 28,
    start_date: startDate,
    end_date: endDate,
    rows,
  };
}
