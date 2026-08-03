import { test } from 'node:test';
import assert from 'node:assert/strict';

import { unknownFlags, wantsHelp } from './cli.js';

test('--help is recognised so it never reaches a command that crawls', () => {
  assert.equal(wantsHelp(['--help']), true);
  assert.equal(wantsHelp(['-h']), true);
  assert.equal(wantsHelp(['--refresh', '--help']), true);
  assert.equal(wantsHelp(['--refresh']), false);
  assert.equal(wantsHelp([]), false);
});

test('accepted flags are not reported as unknown', () => {
  assert.deepEqual(unknownFlags('audit', ['--refresh', '--max-urls', '50', '--json']), []);
  assert.deepEqual(unknownFlags('ledger', ['--id', 't1:thin:/', '--json']), []);
  assert.deepEqual(unknownFlags('install', []), []);
});

test('a mistyped flag is caught rather than silently ignored', () => {
  assert.deepEqual(unknownFlags('audit', ['--refersh']), ['refersh']);
  assert.deepEqual(unknownFlags('audit', ['--allow-paid']), ['allow-paid']);
});

test('a flag valid on one command is unknown on another', () => {
  assert.deepEqual(unknownFlags('serp', ['--refresh']), ['refresh']);
  assert.deepEqual(unknownFlags('doctor', ['--balances']), ['balances']);
});

test('values are never mistaken for flags', () => {
  assert.deepEqual(unknownFlags('serp', ['b2b saas consultant', '--allow-paid']), []);
  assert.deepEqual(unknownFlags('report', ['--window', 'pulse']), []);
  assert.deepEqual(unknownFlags('init', ['--site', 'https://www.example.com']), []);
});

test('an inline value is checked as the flag name alone', () => {
  assert.deepEqual(unknownFlags('fetch', ['--source=ga4']), []);
  assert.deepEqual(unknownFlags('fetch', ['--sauce=ga4']), ['sauce']);
});

test('every unknown flag is reported once, in the order it appeared', () => {
  assert.deepEqual(unknownFlags('audit', ['--foo', '--bar', '--foo']), ['foo', 'bar']);
});
