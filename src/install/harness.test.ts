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
  writeClaudeDoc,
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
  const entry = readFileSync(join(dir, '.agents', 'skills', 'rainmaker', 'SKILL.md'), 'utf8');
  assert.match(entry, /run rainmaker/i);
  assert.match(entry, /host.*model/i);
  assert.match(entry, /never run `rainmaker agent`/i);
  assert.ok(readFileSync(join(dir, '.claude', 'skills', 'rainmaker', 'SKILL.md'), 'utf8'));
  assert.ok(readFileSync(join(dir, '.claude', 'skills', 'know-my-buyer', 'SKILL.md'), 'utf8'));
  assert.ok(readFileSync(join(dir, '.agents', 'skills', 'know-my-buyer', 'SKILL.md'), 'utf8'));
  // Skills reference this path relative to the project root.
  assert.ok(readFileSync(join(dir, 'skills', '_shared', 'revenue-tiers.md'), 'utf8'));
});

test('portable Rainmaker instructions make the host model the interactive interface', () => {
  const doc = renderRainmakerDoc({ site: 'https://example.com', hasPrimaryConversion: false });
  assert.match(doc, /conversation is the interface/i);
  // Whitespace-tolerant: the doc is hard-wrapped, so the phrase legitimately
  // straddles a newline.
  assert.match(doc, /built-in\s+crawler/i);
  assert.match(doc, /Firecrawl/i);
  // Consent survives, but as a question the assistant must ask and a decision
  // it must persist — not a prohibition it satisfies by never mentioning the
  // provider at all.
  assert.match(doc, /Never use Firecrawl or context\.dev because a key happens to exist/i);
  assert.match(doc, /ask which crawler to use/i);
  assert.match(doc, /rainmaker keys --balances/);
  assert.match(doc, /`crawl\.provider`/);
  assert.doesNotMatch(doc, /ANTHROPIC_API_KEY|OPENAI_API_KEY/);
  assert.match(doc, /Never run `rainmaker agent` inside/i);
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
  assert.match(content, /run rainmaker/i);
  assert.match(content, /\.agents\/skills\/rainmaker\/SKILL\.md/);
  assert.ok(readFileSync(join(dir, 'RAINMAKER.md'), 'utf8'));
});

test('CLAUDE.md gets the pointer too, because Claude Code loads nothing else', () => {
  const dir = project();
  writeFileSync(join(dir, 'CLAUDE.md'), '# House rules\n\nUse tabs.\n', 'utf8');

  assert.equal(writeClaudeDoc(dir), 'updated');
  assert.equal(writeClaudeDoc(dir), 'kept');

  const content = readFileSync(join(dir, 'CLAUDE.md'), 'utf8');
  assert.match(content, /Use tabs\./);
  assert.match(content, /`rainmaker` skill/);
  assert.equal((content.match(/RAINMAKER:START/g) ?? []).length, 1);
});

test('the pointer sends the host to the skill rather than to the CLI', () => {
  const dir = project();
  writeClaudeDoc(dir);
  const content = readFileSync(join(dir, 'CLAUDE.md'), 'utf8');

  assert.match(content, /invoke the `rainmaker` skill/);
  assert.match(content, /Do not drive the `rainmaker` CLI by hand/);
});

test('install reports the skills it copied, not the target directory it copied into', () => {
  const dir = project();
  writeFileSync(join(dir, '.agents-decoy'), '', 'utf8');
  const first = installSkills(dir);
  // A second install into the same tree must report the same number: the count
  // describes Rainmaker's skills, not whatever else already lives there.
  const second = installSkills(dir);

  assert.equal(first.installed, second.installed);
  assert.ok(first.installed > 0);
  assert.ok(first.installed < 40, `expected Rainmaker's own skills, got ${first.installed}`);
});

test('install refreshes a legacy managed pointer so existing projects gain the trigger', () => {
  const dir = project();
  writeFileSync(
    join(dir, 'AGENTS.md'),
    'mine\n\n<!-- RAINMAKER:START -->\n## Rainmaker\n\nRead `RAINMAKER.md`.\n<!-- RAINMAKER:END -->\n',
    'utf8',
  );

  assert.equal(writeAgentsDoc(dir), 'updated');
  assert.equal(writeAgentsDoc(dir), 'kept');
  const content = readFileSync(join(dir, 'AGENTS.md'), 'utf8');
  assert.match(content, /^mine/m);
  assert.match(content, /run rainmaker/i);
  assert.equal((content.match(/RAINMAKER:START/g) ?? []).length, 1);
});
