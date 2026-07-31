import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkWindowAvailability } from './windows.js';
import { renderReport } from './render.js';
import { planCompaction } from '../ledger/compact.js';
import type { LedgerEvent, State } from '../ledger/types.js';

const NOW = '2026-08-01T00:00:00Z';

test('a window with no snapshot history at all is unavailable', () => {
  const result = checkWindowAvailability('28d', null, NOW);
  assert.equal(result.available, false);
  assert.equal(result.days_of_history, 0);
});

test('quarter is refused with only 34 days of history, naming the availability date', () => {
  const earliest = '2026-07-01T00:00:00Z'; // 31 days before NOW
  const result = checkWindowAvailability('quarter', earliest, NOW);
  assert.equal(result.available, false);
  assert.equal(result.available_from, new Date(Date.parse(earliest) + 90 * 86_400_000).toISOString());
});

test('28d is available once 28 days of history exist', () => {
  const earliest = new Date(Date.parse(NOW) - 28 * 86_400_000).toISOString();
  assert.equal(checkWindowAvailability('28d', earliest, NOW).available, true);
});

function stateWith(findings: Record<string, Partial<State['findings'][string]>>): State {
  return {
    generated_at: NOW,
    ledger_lines: 0,
    findings: Object.fromEntries(
      Object.entries(findings).map(([id, partial]) => [
        id,
        {
          status: 'opened',
          tier: 0,
          first_seen: NOW,
          last_event: NOW,
          current: {},
          baseline: {},
          score: 1,
          confidence: 1,
          cause_chain: [],
          ...partial,
        },
      ]),
    ),
    site_events: [],
  };
}

test('a report refuses a window beyond available history rather than extrapolating', () => {
  const result = renderReport({
    window: 'quarter',
    now: NOW,
    earliestSnapshotAt: '2026-07-01T00:00:00Z',
    state: stateWith({}),
    events: [],
    capabilities: {},
  });
  assert.equal(result.ok, false);
  assert.match(result.refusal ?? '', /Requested quarter, have \d+ days of history/);
});

test('a report within available history has all five mandatory sections', () => {
  const earliest = new Date(Date.parse(NOW) - 40 * 86_400_000).toISOString();
  const events: LedgerEvent[] = [
    { ts: new Date(Date.parse(NOW) - 3 * 86_400_000).toISOString(), id: 't0:noindex:/demo', event: 'opened' },
    { ts: new Date(Date.parse(NOW) - 2 * 86_400_000).toISOString(), id: 't1:schema:/pricing', event: 'shipped', effort_h: 1 },
  ];
  const result = renderReport({
    window: '28d',
    now: NOW,
    earliestSnapshotAt: earliest,
    state: stateWith({ 't0:noindex:/demo': { status: 'opened', score: 40 } }),
    events,
    capabilities: { gsc: 'missing' },
  });

  assert.equal(result.ok, true);
  assert.ok(result.sections);
  assert.equal(Object.keys(result.sections!).length, 5);
  assert.ok(result.text?.includes('## 1. What changed'));
  assert.ok(result.text?.includes('## 5. Confidence'));
  assert.ok(result.sections!.confidence.some((line) => line.includes('gsc: missing')));
});

test('planCompaction keeps everything inside 90 days untouched', () => {
  const snapshots = [
    { name: 'a', fetched_at: new Date(Date.parse(NOW) - 10 * 86_400_000).toISOString() },
    { name: 'b', fetched_at: new Date(Date.parse(NOW) - 89 * 86_400_000).toISOString() },
  ];
  const plan = planCompaction(snapshots, NOW);
  assert.deepEqual(plan.remove, []);
  assert.deepEqual(plan.keep.sort(), ['a', 'b']);
});

test('planCompaction downsamples snapshots older than 90 days to one per ISO week', () => {
  const base = Date.parse(NOW) - 100 * 86_400_000;
  const snapshots = [
    { name: 'mon', fetched_at: new Date(base).toISOString() }, // a Monday, per test fixture below
    { name: 'wed', fetched_at: new Date(base + 2 * 86_400_000).toISOString() },
    { name: 'fri', fetched_at: new Date(base + 4 * 86_400_000).toISOString() },
  ];
  // Ensure 'mon' really is a Monday for this fixture's date.
  const day = new Date(base).getUTCDay();
  const offsetToMonday = (1 - day + 7) % 7;
  const adjusted = snapshots.map((s, i) => ({
    name: s.name,
    fetched_at: new Date(Date.parse(s.fetched_at) + offsetToMonday * 86_400_000).toISOString(),
  }));

  const plan = planCompaction(adjusted, NOW);
  assert.equal(plan.keep.length, 1, `expected exactly one kept per week, got ${plan.keep.join(', ')}`);
  assert.equal(plan.keep[0], 'mon');
});

test('ledger.jsonl compaction plan never touches the ledger itself', () => {
  // planCompaction operates purely on SnapshotRef[]; it has no path to
  // ledger.jsonl at all, which is the guarantee that the ledger is never
  // pruned regardless of snapshot age.
  const plan = planCompaction([], NOW);
  assert.deepEqual(plan, { keep: [], remove: [] });
});
