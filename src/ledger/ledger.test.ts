import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendEvents, parseEvent, readLedger, transitionProblem } from './append.js';
import { materialise, materialiseFile, isCurrent } from './materialise.js';
import { planClosures } from './close.js';
import { didNothing, pendingVerification, queryEvents, windowDaysFor } from './query.js';
import { stableJson } from '../util/json.js';
import type { LedgerEvent, State } from './types.js';

const FIXTURE = new URL('./__fixtures__/ledger-1000.jsonl', import.meta.url).pathname;
const EXPECTED = new URL('./__fixtures__/state-1000.json', import.meta.url).pathname;
const AT = '2026-08-01T00:00:00Z';

function tempLedger(lines: LedgerEvent[] = []): string {
  const path = join(mkdtempSync(join(tmpdir(), 'rainmaker-ledger-')), 'ledger.jsonl');
  writeFileSync(path, lines.map((line) => JSON.stringify(line)).join('\n') + (lines.length ? '\n' : ''));
  return path;
}

const opened = (id: string, extra: Partial<LedgerEvent> = {}): LedgerEvent => ({
  ts: '2026-01-01T00:00:00Z',
  id,
  event: 'opened',
  ...extra,
});

test('replaying the 1000-line fixture matches the committed state byte for byte', () => {
  const state = materialiseFile(FIXTURE, AT);
  assert.equal(stableJson(state), readFileSync(EXPECTED, 'utf8'));
});

test('replay is a pure fold: same events, same state, twice', () => {
  const events = readLedger(FIXTURE);
  assert.equal(stableJson(materialise(events, AT)), stableJson(materialise(events, AT)));
});

test('ledger_lines tracks staleness', () => {
  const path = tempLedger([opened('t0:canonical:/demo')]);
  const state = materialiseFile(path, AT);
  assert.equal(state.ledger_lines, 1);
  assert.equal(isCurrent(state, path), true);

  appendEvents(path, [{ ts: '2026-01-02T00:00:00Z', id: 't0:canonical:/demo', event: 'acknowledged' }]);
  assert.equal(isCurrent(state, path), false);
});

test('illegal transitions are rejected and never written', () => {
  const path = tempLedger([opened('t0:canonical:/demo')]);
  const result = appendEvents(path, [
    { ts: '2026-01-02T00:00:00Z', id: 't0:canonical:/demo', event: 'verified' },
  ]);

  assert.equal(result.appended.length, 0);
  assert.equal(result.rejected.length, 1);
  assert.match(result.rejected[0].reason, /illegal transition opened -> verified/);
  assert.equal(readLedger(path).length, 1);
});

test('one rejected event does not abandon the rest of the batch', () => {
  const path = tempLedger([opened('t0:canonical:/demo')]);
  const result = appendEvents(path, [
    { ts: '2026-01-02T00:00:00Z', id: 't0:canonical:/demo', event: 'shipped' },
    { ts: '2026-01-02T00:00:00Z', id: 't1:orphan:/vs/acme', event: 'opened' },
  ]);

  assert.equal(result.appended.length, 1);
  assert.equal(result.rejected.length, 1);
  assert.equal(readLedger(path).length, 2);
});

test('every legal transition in the state machine is accepted', () => {
  const path = tempLedger();
  const id = 't2:position:/blog/clm';
  const walk = ['opened', 'acknowledged', 'in_progress', 'shipped', 'verified', 'regressed', 'in_progress', 'shipped', 'regressed', 'acknowledged', 'closed', 'opened'] as const;

  walk.forEach((event, index) => {
    const result = appendEvents(path, [{ ts: `2026-02-${String(index + 1).padStart(2, '0')}T00:00:00Z`, id, event }]);
    assert.equal(result.rejected.length, 0, `${event} at step ${index} was rejected`);
  });
  assert.equal(materialiseFile(path, AT).findings[id].status, 'opened');
});

test('annotations never move a finding out of its status', () => {
  const path = tempLedger([opened('t3:schema:/guide', { to: { position: 30 } })]);
  appendEvents(path, [
    { ts: '2026-01-03T00:00:00Z', id: 't3:schema:/guide', event: 'retiered', to: { tier: 1 } },
    { ts: '2026-01-04T00:00:00Z', id: 'site', event: 'algo_update', note: 'august core update' },
  ]);

  const state = materialiseFile(path, AT);
  assert.equal(state.findings['t3:schema:/guide'].status, 'opened');
  assert.equal(state.findings['t3:schema:/guide'].tier, 1);
  assert.equal(state.site_events.length, 1);
});

test('recurrence rebaselines rather than starting a new finding', () => {
  const id = 't0:canonical:/pricing';
  const path = tempLedger([
    opened(id, { to: { position: 40 } }),
    { ts: '2026-02-01T00:00:00Z', id, event: 'closed' },
    { ts: '2026-03-01T00:00:00Z', id, event: 'opened', to: { position: 12 } },
  ]);

  const state = materialiseFile(path, AT);
  assert.equal(Object.keys(state.findings).length, 1);
  assert.equal(state.findings[id].first_seen, '2026-01-01T00:00:00Z');
  assert.equal(state.findings[id].baseline.position, 12);
});

test('dismissed without a note is refused', () => {
  assert.throws(
    () => parseEvent(JSON.stringify({ ts: '2026-01-01T00:00:00Z', id: 't4:schema:/about', event: 'dismissed' })),
    /dismissed requires a note/,
  );
});

test('malformed lines are rejected rather than repaired', () => {
  assert.throws(() => parseEvent('{not json'), /not valid JSON/);
  assert.throws(() => parseEvent(JSON.stringify({ id: 'x', event: 'opened' })), /ts must be/);
  assert.throws(() => parseEvent(JSON.stringify({ ts: '2026-01-01T00:00:00Z', id: 'x', event: 'invented' })), /event must be one of/);
});

test('transitionProblem names the legal moves', () => {
  assert.equal(transitionProblem(null, 'opened'), null);
  assert.match(String(transitionProblem(null, 'shipped')), /Legal from no prior event: opened/);
  assert.equal(transitionProblem('opened', 'retiered'), null);
});

const stateWith = (entries: Array<[string, string]>): State => ({
  generated_at: AT,
  ledger_lines: entries.length,
  findings: Object.fromEntries(
    entries.map(([id, status]) => [
      id,
      {
        status: status as State['findings'][string]['status'],
        tier: 0 as const,
        first_seen: '2026-01-01T00:00:00Z',
        last_event: '2026-01-01T00:00:00Z',
        current: {},
        baseline: {},
        score: 1,
        confidence: 1,
        cause_chain: [],
      },
    ]),
  ),
  site_events: [],
});

test('a finding whose URL was not crawled is never closed', () => {
  const state = stateWith([
    ['t0:canonical:/demo', 'opened'],
    ['t0:canonical:/pricing', 'opened'],
  ]);

  const plan = planClosures(state, {
    covered: ['/demo'],
    present: [],
    budgetExhausted: false,
  });

  assert.deepEqual(plan.close, ['t0:canonical:/demo']);
  assert.deepEqual(plan.coverage_gap, ['t0:canonical:/pricing']);
});

test('an exhausted crawl budget forbids every close in that run', () => {
  const state = stateWith([['t0:canonical:/demo', 'opened']]);
  const plan = planClosures(state, { covered: ['/demo'], present: [], budgetExhausted: true });

  assert.deepEqual(plan.close, []);
  assert.deepEqual(plan.coverage_gap, ['t0:canonical:/demo']);
});

test('findings still present in the run are left alone', () => {
  const state = stateWith([['t0:canonical:/demo', 'opened']]);
  const plan = planClosures(state, {
    covered: ['/demo'],
    present: ['t0:canonical:/demo'],
    budgetExhausted: false,
  });

  assert.deepEqual(plan.close, []);
  assert.deepEqual(plan.coverage_gap, []);
});

test('already closed and dismissed findings are not re-closed', () => {
  const state = stateWith([
    ['t0:canonical:/demo', 'closed'],
    ['t0:canonical:/trial', 'dismissed'],
  ]);
  const plan = planClosures(state, { covered: ['/demo', '/trial'], present: [], budgetExhausted: false });

  assert.deepEqual(plan.close, []);
  assert.deepEqual(plan.coverage_gap, []);
});

test('verification windows come from the check, not a global default', () => {
  assert.equal(windowDaysFor('t0:canonical:/demo'), 3);
  assert.equal(windowDaysFor('t1:cwv:/pricing'), 7);
  assert.equal(windowDaysFor('t2:indexation:/guide'), 14);
  assert.equal(windowDaysFor('t1:position:/vs/acme'), 28);
  assert.equal(windowDaysFor('t1:ai_citation:/vs/acme'), 90);
  assert.equal(windowDaysFor('t3:unknown-check:/x'), 28);
});

test('a verdict is withheld until the window elapses', () => {
  const id = 't1:position:/vs/acme';
  const events: LedgerEvent[] = [
    opened(id, { to: { position: 18 } }),
    { ts: '2026-07-20T00:00:00Z', id, event: 'acknowledged' },
    { ts: '2026-07-21T00:00:00Z', id, event: 'in_progress' },
    { ts: '2026-07-25T00:00:00Z', id, event: 'shipped', effort_h: 3 },
  ];
  const state = materialise(events, AT);

  assert.equal(pendingVerification(events, state, '2026-08-01T00:00:00Z').length, 1);
  assert.equal(pendingVerification(events, state, '2026-09-01T00:00:00Z').length, 0);
});

test('shipped work past its window whose numbers did not move is reported', () => {
  const moved = 't1:position:/moved';
  const flat = 't1:position:/flat';
  const events: LedgerEvent[] = [
    opened(moved, { to: { position: 18 } }),
    { ts: '2026-01-02T00:00:00Z', id: moved, event: 'acknowledged' },
    { ts: '2026-01-03T00:00:00Z', id: moved, event: 'in_progress' },
    { ts: '2026-01-04T00:00:00Z', id: moved, event: 'shipped', effort_h: 2 },
    { ts: '2026-03-04T00:00:00Z', id: moved, event: 'verified', to: { position: 6 } },
    opened(flat, { to: { position: 22 } }),
    { ts: '2026-01-02T00:00:00Z', id: flat, event: 'acknowledged' },
    { ts: '2026-01-03T00:00:00Z', id: flat, event: 'in_progress' },
    { ts: '2026-01-04T00:00:00Z', id: flat, event: 'shipped', effort_h: 9 },
  ];

  const nothing = didNothing(events, materialise(events, AT), AT);
  assert.deepEqual(nothing.did_nothing.map((row) => row.id), [flat]);
  assert.equal(nothing.did_nothing[0].effort_h, 9);
  assert.deepEqual(nothing.unmeasured, []);
});

test('a fix with no comparable metric is unmeasured, not a proven failure', () => {
  const id = 't0:canonical:/demo';
  const events: LedgerEvent[] = [
    opened(id),
    { ts: '2026-01-02T00:00:00Z', id, event: 'acknowledged' },
    { ts: '2026-01-03T00:00:00Z', id, event: 'in_progress' },
    { ts: '2026-01-04T00:00:00Z', id, event: 'shipped', effort_h: 1 },
  ];

  const nothing = didNothing(events, materialise(events, AT), AT);
  assert.deepEqual(nothing.did_nothing, []);
  assert.deepEqual(nothing.unmeasured.map((row) => row.id), [id]);
});

test('queries filter by id, status and date', () => {
  const events = readLedger(FIXTURE);
  const shipped = queryEvents(events, { status: 'shipped' });
  assert.ok(shipped.length > 0);
  assert.ok(shipped.every((event) => event.event === 'shipped'));

  const since = queryEvents(events, { since: '2026-06-01T00:00:00Z' });
  assert.ok(since.every((event) => Date.parse(event.ts) >= Date.parse('2026-06-01T00:00:00Z')));
  assert.ok(since.length < events.length);
});
