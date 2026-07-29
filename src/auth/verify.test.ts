import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CAPABILITIES,
  verifyCapabilities,
  type Capability,
  type CapabilityClients,
} from './verify.js';

test('probes every capability against its mocked client', async (t) => {
  for (const capability of CAPABILITIES) {
    await t.test(capability, async () => {
      const calls: Capability[] = [];
      const clients: CapabilityClients = {};
      for (const name of CAPABILITIES) {
        clients[name] = {
          async check(): Promise<string> {
            calls.push(name);
            return `${name} live`;
          },
        };
      }

      const results = await verifyCapabilities(clients, 100);
      const result = results.find((candidate) => candidate.capability === capability);
      assert.deepEqual(calls.sort(), [...CAPABILITIES].sort());
      assert.deepEqual(result, {
        capability,
        status: 'ok',
        detail: `${capability} live`,
      });
    });
  }
});

test('reports all missing capabilities without failing', async () => {
  const results = await verifyCapabilities({}, 100);
  assert.equal(results.length, 5);
  assert.ok(results.every((result) => result.status === 'missing'));
});

test('isolates one probe error and still completes the rest', async () => {
  const clients: CapabilityClients = Object.fromEntries(
    CAPABILITIES.map((capability) => [
      capability,
      {
        async check(): Promise<string> {
          if (capability === 'gsc') throw new Error('permission denied');
          return 'live';
        },
      },
    ]),
  );

  const results = await verifyCapabilities(clients, 100);
  assert.equal(results.find((result) => result.capability === 'gsc')?.status, 'error');
  assert.equal(results.filter((result) => result.status === 'ok').length, 4);
});
