import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkKeys, formatKeys } from './keys.js';

test('a key present in env is reported set with what it unlocks', () => {
  const statuses = checkKeys({ FIRECRAWL_API_KEY: 'fc-abc' } as NodeJS.ProcessEnv);
  const firecrawl = statuses.find((row) => row.env === 'FIRECRAWL_API_KEY');
  assert.equal(firecrawl?.set, true);
  assert.match(formatKeys(statuses), /dormant until.*--provider firecrawl/i);
});

test('an empty string is treated as unset', () => {
  const statuses = checkKeys({ FIRECRAWL_API_KEY: '' } as NodeJS.ProcessEnv);
  assert.equal(statuses.find((row) => row.env === 'FIRECRAWL_API_KEY')?.set, false);
});

test('zero keys set produces the zero-credential reassurance line', () => {
  const output = formatKeys(checkKeys({} as NodeJS.ProcessEnv));
  assert.match(output, /0 of \d+ keys set/);
  assert.match(output, /baseline crawl, URL tiering and structural diagnosis/);
});

test('every row shows what it unlocks when set, and what is lost when not', () => {
  const statuses = checkKeys({ CLARITY_TOKEN: 'tok' } as NodeJS.ProcessEnv);
  const output = formatKeys(statuses);
  assert.match(output, /CLARITY_TOKEN\s+set\s+behavioural leak analysis/);
  assert.match(output, /FIRECRAWL_API_KEY\s+unset\s+optional/);
});
