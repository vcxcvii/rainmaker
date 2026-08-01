import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CAPABILITIES, type CapabilityResult } from '../auth/verify.js';
import { formatDoctor, formatVersionSkew, pluginVersion } from './doctor.js';

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

test('reports a plugin older than the CLI, and stays quiet when they match', () => {
  assert.match(formatVersionSkew('0.3.1', '0.2.1') ?? '', /Plugin 0\.2\.1 against CLI 0\.3\.1/);
  assert.equal(formatVersionSkew('0.3.1', '0.3.1'), undefined);
  assert.equal(formatVersionSkew('0.3.1', undefined), undefined);
});

test('plugin version is undefined outside a plugin install', () => {
  assert.equal(pluginVersion({}), undefined);
  assert.equal(pluginVersion({ CLAUDE_PLUGIN_ROOT: '/nonexistent' }), undefined);
});
