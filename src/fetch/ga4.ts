import { GOOGLE_SCOPES, type GoogleTokenProvider } from '../auth/google.js';
import type { Ga4Snapshot } from './types.js';

interface Ga4Value {
  value?: unknown;
}

interface Ga4Row {
  dimensionValues?: unknown;
  metricValues?: unknown;
}

function value(values: unknown, index: number): string {
  if (!Array.isArray(values)) return '';
  const candidate = values[index];
  if (!candidate || typeof candidate !== 'object') return '';
  const raw = (candidate as Ga4Value).value;
  return typeof raw === 'string' ? raw : '';
}

function count(values: unknown, index: number): number {
  const raw = Number(value(values, index));
  return Number.isFinite(raw) ? raw : 0;
}

async function runReport(options: {
  body: Record<string, unknown>;
  fetcher: typeof fetch;
  propertyId: string;
  token: string;
}): Promise<Ga4Row[]> {
  const response = await options.fetcher(
    `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(options.propertyId)}:runReport`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${options.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(options.body),
    },
  );
  if (!response.ok) throw new Error(`GA4 fetch failed: HTTP ${response.status}`);
  const payload = (await response.json()) as { rows?: unknown };
  return Array.isArray(payload.rows) ? (payload.rows as Ga4Row[]) : [];
}

export async function fetchGa4(options: {
  propertyId: string;
  salesCycleDays: number;
  tokenProvider: GoogleTokenProvider;
  fetcher?: typeof fetch;
  now?: Date;
}): Promise<Ga4Snapshot> {
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? new Date();
  const windowDays = Math.max(options.salesCycleDays, 28);
  const token = await options.tokenProvider.getAccessToken([GOOGLE_SCOPES.ga4]);
  const dateRanges = [{ startDate: `${windowDays}daysAgo`, endDate: 'yesterday' }];

  const [pageRows, eventRows] = await Promise.all([
    runReport({
      fetcher,
      propertyId: options.propertyId,
      token,
      body: {
        dateRanges,
        dimensions: [{ name: 'pagePath' }],
        limit: 100_000,
        metrics: [
          { name: 'sessions' },
          { name: 'engagedSessions' },
          { name: 'keyEvents' },
        ],
      },
    }),
    runReport({
      fetcher,
      propertyId: options.propertyId,
      token,
      body: {
        dateRanges,
        dimensions: [{ name: 'eventName' }],
        limit: 10_000,
        metrics: [{ name: 'keyEvents' }],
      },
    }),
  ]);

  const pages = pageRows
    .map((row) => ({
      path: value(row.dimensionValues, 0),
      sessions: count(row.metricValues, 0),
      engaged_sessions: count(row.metricValues, 1),
      key_events: count(row.metricValues, 2),
      // Data API page reports do not expose arbitrary preceding-page sequences.
      conversion_paths: 0,
    }))
    .filter((page) => page.path)
    .sort((a, b) => a.path.localeCompare(b.path));

  const keyEvents = eventRows
    .filter((row) => count(row.metricValues, 0) > 0)
    .map((row) => value(row.dimensionValues, 0))
    .filter(Boolean)
    .sort();

  return {
    fetched_at: now.toISOString(),
    property_id: options.propertyId,
    window_days: windowDays,
    key_events_configured: keyEvents,
    pages,
    paths_sampled: 0,
  };
}
