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

test('a set paid key prompts the ask-once question instead of being silently dormant', () => {
  const output = formatKeys(checkKeys({ FIRECRAWL_API_KEY: 'fc-abc' } as NodeJS.ProcessEnv));
  assert.match(output, /Ask the user which crawler/);
  assert.match(output, /`crawl\.provider`/);
  assert.match(output, /rainmaker keys --balances/);
});

test('balances render per provider, including the ones with no balance API', () => {
  const statuses = checkKeys({
    FIRECRAWL_API_KEY: 'fc-abc',
    CONTEXT_DEV_API_KEY: 'cd-abc',
  } as NodeJS.ProcessEnv);
  const output = formatKeys(statuses, {
    FIRECRAWL_API_KEY: { credits: 1000 },
    CONTEXT_DEV_API_KEY: { credits: null },
  });

  assert.match(output, /FIRECRAWL_API_KEY.*\[1000 credits remaining\]/);
  assert.match(output, /CONTEXT_DEV_API_KEY.*\[no balance API\]/);
  // The prompt to go fetch them is pointless once they are on screen.
  assert.doesNotMatch(output, /rainmaker keys --balances/);
});

test('a balance lookup failure is reported, not swallowed into a zero', () => {
  const statuses = checkKeys({ FIRECRAWL_API_KEY: 'fc-abc' } as NodeJS.ProcessEnv);
  const output = formatKeys(statuses, { FIRECRAWL_API_KEY: { error: '401 Unauthorized' } });
  assert.match(output, /balance unavailable: 401 Unauthorized/);
});
