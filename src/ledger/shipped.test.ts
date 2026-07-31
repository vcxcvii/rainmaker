import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findingIdsInCommit, shippedFromCommits } from './shipped.js';

const NOW = '2026-08-01T00:00:00Z';

test('extracts a finding id from a commit trailer', () => {
  assert.deepEqual(
    findingIdsInCommit('Fix noindex on pricing\n\nrainmaker-fix: t0:noindex:/pricing'),
    ['t0:noindex:/pricing'],
  );
});

test('extracts multiple ids from one commit', () => {
  const message = 'Batch fix\n\nrainmaker-fix: t0:noindex:/a\nrainmaker-fix: t1:schema:/b';
  assert.deepEqual(findingIdsInCommit(message), ['t0:noindex:/a', 't1:schema:/b']);
});

test('a commit with no trailer yields nothing', () => {
  assert.deepEqual(findingIdsInCommit('Just a normal commit message'), []);
});

test('shipped fires only from acknowledged or in_progress, never from opened', () => {
  const events = shippedFromCommits({
    commits: [{ sha: 'abc123', message: 'rainmaker-fix: t0:noindex:/pricing' }],
    status: new Map([['t0:noindex:/pricing', 'opened']]),
    now: NOW,
  });
  assert.deepEqual(events, [], 'a finding nobody acknowledged should close on re-measure, not ship on a claim');
});

test('shipped fires from acknowledged', () => {
  const events = shippedFromCommits({
    commits: [{ sha: 'abc123', message: 'rainmaker-fix: t0:noindex:/pricing' }],
    status: new Map([['t0:noindex:/pricing', 'acknowledged']]),
    now: NOW,
  });
  assert.equal(events.length, 1);
  assert.equal(events[0].event, 'shipped');
  assert.equal(events[0].cause, 'abc123');
});

test('shipped fires from in_progress', () => {
  const events = shippedFromCommits({
    commits: [{ sha: 'def456', message: 'rainmaker-fix: t0:noindex:/pricing' }],
    status: new Map([['t0:noindex:/pricing', 'in_progress']]),
    now: NOW,
  });
  assert.equal(events.length, 1);
});

test('a finding with no ledger entry at all does not ship', () => {
  const events = shippedFromCommits({
    commits: [{ sha: 'abc', message: 'rainmaker-fix: t0:noindex:/never-opened' }],
    status: new Map(),
    now: NOW,
  });
  assert.deepEqual(events, []);
});

test('only the first commit naming an id counts within one scan', () => {
  const events = shippedFromCommits({
    commits: [
      { sha: 'first', message: 'rainmaker-fix: t0:noindex:/pricing' },
      { sha: 'second', message: 'rainmaker-fix: t0:noindex:/pricing' },
    ],
    status: new Map([['t0:noindex:/pricing', 'acknowledged']]),
    now: NOW,
  });
  assert.equal(events.length, 1);
  assert.equal(events[0].cause, 'first');
});
