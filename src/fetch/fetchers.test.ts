import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { GoogleTokenProvider } from '../auth/google.js';
import { fetchClarity } from './clarity.js';
import { fetchGa4 } from './ga4.js';
import { fetchGsc } from './gsc.js';

function fixture(name: string): unknown {
  return JSON.parse(
    readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), 'utf8'),
  ) as unknown;
}

const tokenProvider: GoogleTokenProvider = {
  async getAccessToken(): Promise<string> {
    return 'fixture-token';
  },
};

function response(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

test('GSC fixture becomes a 28-day query-page snapshot', async () => {
  const snapshot = await fetchGsc({
    siteUrl: 'https://www.example.com/',
    tokenProvider,
    now: new Date('2026-07-29T12:00:00Z'),
    fetcher: async () => response(fixture('gsc-response.json')),
  });
  assert.equal(snapshot.window_days, 28);
  assert.equal(snapshot.start_date, '2026-06-29');
  assert.equal(snapshot.end_date, '2026-07-26');
  assert.equal(snapshot.rows[0]?.query, 'b2b saas marketing consultant');
});

test('GA4 fixtures become page metrics and active key events', async () => {
  let call = 0;
  const payloads = [fixture('ga4-pages.json'), fixture('ga4-events.json')];
  const snapshot = await fetchGa4({
    propertyId: '123456',
    salesCycleDays: 30,
    tokenProvider,
    now: new Date('2026-07-29T12:00:00Z'),
    fetcher: async () => {
      const payload = payloads[call];
      call += 1;
      return response(payload);
    },
  });
  assert.deepEqual(snapshot.key_events_configured, ['cal_booking_clicked']);
  assert.equal(snapshot.pages[0]?.key_events, 3);
  assert.equal(snapshot.pages[0]?.conversion_paths, 0);
});

test('Clarity fixture becomes a bounded snapshot without spending test quota', async () => {
  const snapshot = await fetchClarity({
    token: 'fixture-token',
    now: new Date('2026-07-29T12:00:00Z'),
    trackBudget: false,
    fetcher: async () => response(fixture('clarity-response.json')),
  });
  assert.equal(snapshot.window_days, 3);
  assert.equal(snapshot.metrics.length, 1);
});
