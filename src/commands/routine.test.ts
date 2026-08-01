import assert from 'node:assert/strict';
import { test } from 'node:test';
import { refreshForRoutine } from './routine.js';

test('routine fetches fresh inputs before auditing the new snapshot', async () => {
  const calls: string[] = [];
  const code = await refreshForRoutine({
    fetch: async (args) => {
      calls.push(`fetch ${args.join(' ')}`);
      return 0;
    },
    audit: async (args) => {
      calls.push(`audit ${args.join(' ')}`);
      return 0;
    },
  });

  assert.equal(code, 0);
  assert.deepEqual(calls, ['fetch --source all', 'audit --refresh --json']);
});

test('routine stops when no fresh snapshot can be written', async () => {
  let audited = false;
  const code = await refreshForRoutine({
    fetch: async () => 1,
    audit: async () => {
      audited = true;
      return 0;
    },
  });
  assert.equal(code, 1);
  assert.equal(audited, false);
});

test('routine forwards an explicitly approved provider to the fresh fetch', async () => {
  const calls: string[][] = [];
  await refreshForRoutine(
    {
      fetch: async (args) => {
        calls.push(args);
        return 0;
      },
      audit: async () => 0,
    },
    ['--provider', 'firecrawl'],
  );
  assert.deepEqual(calls[0], ['--source', 'all', '--provider', 'firecrawl']);
});
