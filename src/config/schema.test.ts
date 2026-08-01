import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CRAWL, validateConfig } from './schema.js';

test('first crawl is free and bounded for an interactive session', () => {
  assert.equal(DEFAULT_CRAWL.provider, 'builtin');
  assert.equal(DEFAULT_CRAWL.max_urls, 100);
});

const valid = {
  site: 'https://quillet.com',
  revenue_model: 'sales-led',
  primary_conversion: ['/demo'],
  secondary_conversion: [],
  acv: 18000,
  sales_cycle_days: 45,
  icp_hint: 'legal ops leads',
};

test('accepts a complete config', () => {
  assert.deepEqual(validateConfig(valid), []);
});

test('reports every problem at once, not just the first', () => {
  const problems = validateConfig({
    site: 'quillet.com',
    revenue_model: 'freemium',
    primary_conversion: [],
    acv: -5,
    sales_cycle_days: 0,
  });
  assert.equal(problems.length, 4);
});

test('rejects a site without a scheme', () => {
  const problems = validateConfig({ ...valid, site: 'quillet.com' });
  assert.equal(problems[0].field, 'site');
});

test('acv of 0 is valid, meaning unknown', () => {
  assert.deepEqual(validateConfig({ ...valid, acv: 0 }), []);
});

test('a site-only scaffold is auditable before the assistant discovers business context', () => {
  const problems = validateConfig({ ...valid, primary_conversion: [], icp_hint: '' });
  assert.deepEqual(problems, []);
});

test('empty or non-object input does not throw', () => {
  assert.equal(validateConfig(null).length, 1);
  assert.equal(validateConfig('nope').length, 1);
});
