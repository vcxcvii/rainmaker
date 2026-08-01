import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { TIERS, TIER_ORDER } from '../analyze/tiering.js';
import { formatTierDistribution } from '../commands/audit.js';
import {
  installSkills,
  renderRainmakerDoc,
  writeAgentsDoc,
  writeRainmakerDoc,
} from './harness.js';

const project = (): string => mkdtempSync(join(tmpdir(), 'rainmaker-harness-'));

test('the doc defines every tier, because audit output is unreadable without them', () => {
  const doc = renderRainmakerDoc({ site: 'https://example.com', hasPrimaryConversion: true });

  for (const tier of ['Tier 0', 'Tier 1', 'Tier 2', 'Tier 3', 'Tier 4']) {
    assert.match(doc, new RegExp(`\\*\\*${tier}`));
  }
  assert.match(doc, /SERP verdict/);
  assert.match(doc, /Authority budget/);
});

test('the doc and the audit histogram render one tier vocabulary, not two', () => {
  const doc = renderRainmakerDoc({ site: 'https://example.com', hasPrimaryConversion: true });
  const histogram = formatTierDistribution({ '0': 1, '1': 1, '2': 1, '3': 1, '4': 1 }, 5);

  // Two renderers, one table. They can only drift together.
  for (const tier of TIER_ORDER) {
    assert.ok(doc.includes(TIERS[tier].plain), `doc is missing tier ${tier}`);
    assert.ok(doc.includes(TIERS[tier].name), `doc is missing the term for tier ${tier}`);
    assert.ok(histogram.includes(TIERS[tier].plain), `histogram is missing tier ${tier}`);
  }
});

test('the doc requires a why with every recommendation', () => {
  const doc = renderRainmakerDoc({ site: 'https://example.com', hasPrimaryConversion: true });
  assert.match(doc, /What it is/);
  assert.match(doc, /Why it happens/);
  assert.match(doc, /What changes if they act/);
});

test('site-only setup starts with an audit, then discovers Tier 0 in conversation', () => {
  const seeded = renderRainmakerDoc({ site: 'https://example.com', hasPrimaryConversion: true });
  const unseeded = renderRainmakerDoc({ site: 'https://example.com', hasPrimaryConversion: false });

  assert.match(seeded, /`rainmaker audit`/);
  assert.match(unseeded, /`rainmaker audit`/);
  assert.match(unseeded, /propose.*conversion/i);
});

test('skills install into portable and Claude-compatible project locations', () => {
  const dir = project();
  const { installed } = installSkills(dir);

  assert.ok(installed > 20, `expected the full skill set, got ${installed}`);
  assert.ok(readFileSync(join(dir, '.claude', 'skills', 'know-my-buyer', 'SKILL.md'), 'utf8'));
  assert.ok(readFileSync(join(dir, '.agents', 'skills', 'know-my-buyer', 'SKILL.md'), 'utf8'));
  // Skills reference this path relative to the project root.
  assert.ok(readFileSync(join(dir, 'skills', '_shared', 'revenue-tiers.md'), 'utf8'));
});

test('portable Rainmaker instructions make the host model the interactive interface', () => {
  const doc = renderRainmakerDoc({ site: 'https://example.com', hasPrimaryConversion: false });
  assert.match(doc, /conversation is the interface/i);
  assert.match(doc, /built-in crawler/i);
  assert.match(doc, /explicit approval/i);
  assert.match(doc, /Firecrawl/i);
  assert.doesNotMatch(doc, /ANTHROPIC_API_KEY|OPENAI_API_KEY/);
});

test('an existing AGENTS.md is preserved and receives one managed pointer', () => {
  const dir = project();
  writeFileSync(join(dir, 'AGENTS.md'), 'mine\n', 'utf8');

  writeRainmakerDoc(dir, { site: 'https://example.com', hasPrimaryConversion: true });
  const first = writeAgentsDoc(dir);
  const second = writeAgentsDoc(dir);
  const content = readFileSync(join(dir, 'AGENTS.md'), 'utf8');

  assert.equal(first, 'updated');
  assert.equal(second, 'kept');
  assert.match(content, /^mine/m);
  assert.equal((content.match(/RAINMAKER:START/g) ?? []).length, 1);
  assert.ok(readFileSync(join(dir, 'RAINMAKER.md'), 'utf8'));
});
