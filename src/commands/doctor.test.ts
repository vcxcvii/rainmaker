import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CAPABILITIES, type CapabilityResult } from '../auth/verify.js';
import { formatDoctor } from './doctor.js';

test('formats five capability lines and degradation summary', () => {
  const results: CapabilityResult[] = CAPABILITIES.map((capability) => ({
    capability,
    status: capability === 'pagespeed' ? 'ok' : 'missing',
    detail: capability === 'pagespeed' ? 'no key (5 req/min limit)' : 'unavailable',
  }));

  const output = formatDoctor(results);
  const capabilityLines = output
    .split('\n')
    .filter((line) => CAPABILITIES.some((capability) => line.startsWith(capability.toUpperCase())));
  assert.equal(capabilityLines.length, 5);
  assert.match(output, /4 of 5 capabilities degraded\./);
});
