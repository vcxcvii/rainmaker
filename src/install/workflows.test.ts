import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

test('source repository runs CI instead of client-site schedules', () => {
  assert.equal(existsSync('.github/workflows/weekly.yml'), false);
  assert.equal(existsSync('.github/workflows/monthly.yml'), false);

  const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
  assert.match(ci, /pull_request:/);
  assert.match(ci, /push:/);
  assert.match(ci, /npm test/);
  assert.match(ci, /npm run typecheck/);
});
