import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { formatTierDistribution, readLatest } from './audit.js';

test('every tier is labelled, because the numbers alone mean nothing to a new user', () => {
  const output = formatTierDistribution({ '0': 1, '1': 2, '2': 13, '3': 6, '4': 0 }, 22);

  assert.match(output, /Tier 0 .*money changes hands here/);
  assert.match(output, /Tier 1 .*read right before buying/);
  assert.match(output, /Tier 4 .*no commercial role/);
  assert.match(output, /22 pages/);
});

test('no Tier 0 is called out as the config problem it is', () => {
  const output = formatTierDistribution({ '0': 0, '1': 3, '2': 5, '3': 1, '4': 0 }, 9);
  assert.match(output, /No Tier 0 pages/);
  assert.match(output, /primary_conversion/);
});

test('no Tier 1 is called out as the gap it is, not left for the user to spot', () => {
  const output = formatTierDistribution({ '0': 1, '1': 0, '2': 13, '3': 6, '4': 0 }, 20);
  assert.match(output, /No Tier 1 pages/);
  assert.doesNotMatch(output, /No Tier 0 pages/);
});

test('a partial crawl never turns absence into a site-wide claim', () => {
  const output = formatTierDistribution(
    { '0': 1, '1': 0, '2': 13, '3': 6, '4': 0 },
    20,
    false,
  );
  assert.match(output, /partial crawl/i);
  assert.doesNotMatch(output, /usually worth more than any single fix/i);
});

test('a crawl does not discard measurement fetched into an earlier snapshot', () => {
  const root = mkdtempSync(join(tmpdir(), 'rainmaker-audit-'));
  const previous = process.cwd();
  try {
    const snapshots = join(root, 'data', 'snapshots');
    // The measurement lands first, then a later crawl writes its own directory.
    mkdirSync(join(snapshots, '2026-08-01T10-00-00-000Z'), { recursive: true });
    mkdirSync(join(snapshots, '2026-08-01T11-00-00-000Z'), { recursive: true });
    writeFileSync(
      join(snapshots, '2026-08-01T10-00-00-000Z', 'ga4.json'),
      JSON.stringify({ property_id: '123' }),
    );
    writeFileSync(
      join(snapshots, '2026-08-01T11-00-00-000Z', 'crawl.json'),
      JSON.stringify({ pages: [] }),
    );

    process.chdir(root);
    const found = readLatest<{ property_id: string }>('ga4.json');
    assert.equal(found?.snapshot.property_id, '123');
    assert.equal(found?.from, '2026-08-01T10-00-00-000Z', 'the reader says where the data came from');
    assert.equal(readLatest('gsc.json'), null, 'never fetched stays absent');
  } finally {
    process.chdir(previous);
    rmSync(root, { recursive: true, force: true });
  }
});
