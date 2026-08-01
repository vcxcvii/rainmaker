import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  INIT_FIELDS,
  describeInitFields,
  formatInitUsage,
  invocation,
  suspectPaths,
} from './init.js';

test('only site is required, so the rest can be omitted', () => {
  const required = INIT_FIELDS.filter((f) => f.required).map((f) => f.flag);
  assert.deepEqual(required, ['site']);
});

test('usage separates required from optional and shows the smallest useful run', () => {
  const usage = formatInitUsage();
  const requiredBlock = usage.slice(usage.indexOf('Required:'), usage.indexOf('Optional'));

  assert.match(requiredBlock, /--site/);
  assert.doesNotMatch(requiredBlock, /--acv/);
  assert.match(usage, /--acv 18000 {2}# default: 0/);
  assert.match(usage, /init --site \S+ --primary-conversion/);
});

test('next-step command matches how the package was actually invoked', () => {
  const npx = '/Users/x/.npm/_npx/a1b2c3/node_modules/.bin/rainmaker';
  assert.equal(invocation(npx, {}), 'npx @vcxcvii/rainmaker');
  assert.equal(invocation('/usr/local/bin/rainmaker', {}), 'rainmaker');
  assert.equal(invocation(undefined, {}), 'rainmaker');
});

test('the plugin wrapper overrides the argv guess, which it contradicts', () => {
  const npx = '/Users/x/.npm/_npx/a1b2c3/node_modules/.bin/rainmaker';
  // The wrapper execs npx but is itself on PATH, so argv alone gets this wrong.
  assert.equal(invocation(npx, { RAINMAKER_INVOCATION: 'rainmaker' }), 'rainmaker');
});

test('prose answers are flagged because they match no URL', () => {
  const answers = ['/pricing', 'not decided', 'help figure out', 'https://x.com/buy'];
  assert.deepEqual(suspectPaths(answers), ['not decided', 'help figure out']);
  assert.deepEqual(suspectPaths(['/demo', '/pricing']), []);
});

test('describe emits every field with its type and default', () => {
  const described = JSON.parse(describeInitFields()) as {
    fields: { flag: string; type: string; required: boolean; default: string | null }[];
  };

  assert.equal(described.fields.length, INIT_FIELDS.length);

  const byFlag = new Map(described.fields.map((f) => [f.flag, f]));
  assert.equal(byFlag.get('site')?.required, true);
  assert.equal(byFlag.get('primary-conversion')?.type, 'list');
  assert.equal(byFlag.get('sales-cycle-days')?.default, '30');
  assert.equal(byFlag.get('icp-hint')?.default, null);
});
