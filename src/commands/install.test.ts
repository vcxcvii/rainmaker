import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { installProject } from './install.js';

test('install refreshes portable skills and instructions without rewriting config', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rainmaker-install-'));
  const config = `site: https://example.com
revenue_model: sales-led
primary_conversion: []
secondary_conversion: []
acv: 0
sales_cycle_days: 30
icp_hint: ""
`;
  writeFileSync(join(dir, 'rainmaker.config.yml'), config);

  const first = installProject(dir);
  const second = installProject(dir);

  assert.ok(first.installed > 20);
  assert.equal(second.installed, first.installed);
  assert.equal(readFileSync(join(dir, 'rainmaker.config.yml'), 'utf8'), config);
  assert.match(readFileSync(join(dir, 'AGENTS.md'), 'utf8'), /RAINMAKER:START/);
  assert.match(readFileSync(join(dir, 'RAINMAKER.md'), 'utf8'), /conversation is the interface/i);
  assert.ok(readFileSync(join(dir, '.agents', 'skills', 'know-my-buyer', 'SKILL.md'), 'utf8'));
});
