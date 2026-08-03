import { test } from 'node:test';
import assert from 'node:assert/strict';

import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { attribution } from './commands/audit.js';
import { isEntrypoint, unknownFlags, wantsHelp } from './cli.js';

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

test('attribution states the complete tool output, with checkable counts', () => {
  const finding = (id: string) => ({ id }) as never;
  const block = attribution([finding('a'), finding('b')], [finding('c')]);

  assert.equal(block.authored_by, 'rainmaker-cli');
  assert.equal(block.findings, 2);
  assert.equal(block.suspicions, 1);
  assert.match(block.statement, /complete output/);
  assert.match(block.statement, /assistant's own reading/);
});

test('attribution counts an empty diagnosis rather than going silent', () => {
  const block = attribution([], []);

  assert.equal(block.findings, 0);
  assert.equal(block.suspicions, 0);
  assert.match(block.statement, /0 finding\(s\) and 0 suspicion\(s\)/);
});

test('a symlinked entry point still counts as the program being run', () => {
  // The regression this exists for: an npm global install puts a symlink on
  // PATH, so argv[1] is the link while import.meta.url is the resolved file.
  // Comparing them without realpath made `rainmaker <anything>` exit 0 silently.
  const dir = mkdtempSync(join(tmpdir(), 'rainmaker-entry-'));
  const real = join(dir, 'cli.js');
  const link = join(dir, 'rainmaker');
  writeFileSync(real, '');
  symlinkSync(real, link);

  assert.equal(isEntrypoint(link, pathToFileURL(real).href), true);
  assert.equal(isEntrypoint(real, pathToFileURL(real).href), true);

  rmSync(dir, { recursive: true, force: true });
});

test('an unrelated entry point is not the program being run', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rainmaker-entry-'));
  const real = join(dir, 'cli.js');
  const other = join(dir, 'other.js');
  writeFileSync(real, '');
  writeFileSync(other, '');

  assert.equal(isEntrypoint(other, pathToFileURL(real).href), false);
  assert.equal(isEntrypoint(undefined, pathToFileURL(real).href), false);
  assert.equal(isEntrypoint(join(dir, 'missing.js'), pathToFileURL(real).href), false);

  rmSync(dir, { recursive: true, force: true });
});
