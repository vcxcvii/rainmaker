import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { SKILL_NAMES } from '../context/types.js';

const ROOT = new URL('../../', import.meta.url).pathname;
const SHARED = join(ROOT, 'skills', '_shared');
const SKILLS = join(ROOT, 'skills');

/** The front-door orchestrator delegates writes; the 26 decision skills own them. */
function decisionSkillDirs(): string[] {
  return readdirSync(SKILLS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== '_shared' && entry.name !== 'rainmaker')
    .map((entry) => entry.name);
}

const read = (path: string) => readFileSync(path, 'utf8');

const SHARED_FILES = [
  'context-load.md',
  'revenue-tiers.md',
  'metric-definitions.md',
  'voice-rules.md',
  'evidence-rules.md',
];

/**
 * Every term the spec requires, by section. This list is the acceptance
 * criterion for block 7 turned into a test: a definition that goes missing
 * fails the build rather than being noticed in review a month later.
 */
const REQUIRED_TERMS: Record<string, string[]> = {
  'Google Analytics 4': [
    'Session',
    'Engaged session',
    'Key event',
    'Conversion',
    'Attribution window',
    'Data threshold',
    'Sampling',
    'Exploration versus report discrepancy',
  ],
  'Google Search Console': [
    'Impression',
    'Position',
    'CTR',
    'Coverage',
    'Discovered, currently not indexed',
    'Crawled, currently not indexed',
    'Canonical, Google-selected versus user-declared',
    '28-day window',
  ],
  Search: [
    'Crawl budget',
    'Index bloat',
    'Cannibalisation',
    'Striking distance',
    'E-E-A-T',
    'Domain authority',
    'PageRank',
    'Internal link equity',
    'Content decay',
    'Thin content',
  ],
  'AI search': [
    'AEO, GEO and SEO',
    'Extractability',
    'Citation',
    'Entity',
    'Ontology',
    'Knowledge graph',
    'Vector embedding',
    'Semantic similarity',
    'llms.txt',
  ],
  'Core Web Vitals': ['LCP', 'INP', 'CLS', 'Field versus lab data', 'TTFB'],
};

function definitionSections(): Map<string, string> {
  const raw = read(join(SHARED, 'metric-definitions.md'));
  const sections = new Map<string, string>();
  const parts = raw.split(/^### /m).slice(1);
  for (const part of parts) {
    const [heading, ...rest] = part.split('\n');
    sections.set(heading.trim(), rest.join('\n'));
  }
  return sections;
}

test('the five shared reference files exist', () => {
  for (const file of SHARED_FILES) {
    assert.ok(existsSync(join(SHARED, file)), `missing skills/_shared/${file}`);
  }
});

test('every required term is defined', () => {
  const sections = definitionSections();
  const missing: string[] = [];
  for (const terms of Object.values(REQUIRED_TERMS)) {
    for (const term of terms) {
      if (!sections.has(term)) missing.push(term);
    }
  }
  assert.deepEqual(missing, [], `undefined terms: ${missing.join(', ')}`);
});

test('every definition carries all three parts', () => {
  const sections = definitionSections();
  const incomplete: string[] = [];

  for (const terms of Object.values(REQUIRED_TERMS)) {
    for (const term of terms) {
      const body = sections.get(term) ?? '';
      const hasDefinition = body.trim().split('\n')[0]?.trim().length > 20;
      const hasMisuse = body.includes('**Misuse:**');
      const hasReplacement = body.includes('**Say instead:**');
      if (!hasDefinition || !hasMisuse || !hasReplacement) incomplete.push(term);
    }
  }

  assert.deepEqual(incomplete, [], `terms missing definition, misuse or replacement: ${incomplete.join(', ')}`);
});

test('every shipped skill opens with the shared context load block, verbatim', () => {
  const block = read(join(SHARED, 'context-load.md')).split('---\n\n')[1]?.trim();
  assert.ok(block && block.startsWith('## Context load'), 'context-load.md lost its block');

  const dirs = decisionSkillDirs();

  for (const dir of dirs) {
    const path = join(SKILLS, dir, 'SKILL.md');
    assert.ok(existsSync(path), `${dir} has no SKILL.md`);
    assert.ok(
      read(path).includes(block),
      `${dir}/SKILL.md does not contain the shared context load block verbatim`,
    );
  }
});

test('every shipped skill directory is a known skill name', () => {
  const dirs = decisionSkillDirs();

  for (const dir of dirs) {
    assert.ok(
      (SKILL_NAMES as readonly string[]).includes(dir),
      `${dir} is not in SKILL_NAMES, so nothing can attribute a strategy write to it`,
    );
  }
});

test('no skill restates shared reference content', () => {
  // One distinctive sentence per shared file. If it appears inside a skill, the
  // skill has copied rather than referenced, and the two will drift apart.
  const fingerprints: Array<[string, string]> = [
    ['revenue-tiers.md', 'Eight rules, strict precedence, first match wins.'],
    ['evidence-rules.md', 'File, field, window, confidence. In that order.'],
    ['voice-rules.md', 'Each rule catches a machine tell rather than a taste preference.'],
    ['metric-definitions.md', 'A group of interactions from one user within a time window'],
  ];

  const dirs = decisionSkillDirs();

  for (const dir of dirs) {
    const body = read(join(SKILLS, dir, 'SKILL.md'));
    for (const [file, sentence] of fingerprints) {
      assert.ok(!body.includes(sentence), `${dir}/SKILL.md restates ${file} instead of citing it`);
    }
  }
});

test('skill frontmatter states trigger phrases a real user would type', () => {
  const dirs = decisionSkillDirs();

  for (const dir of dirs) {
    const body = read(join(SKILLS, dir, 'SKILL.md'));
    const frontmatter = /^---\n([\s\S]*?)\n---/.exec(body)?.[1] ?? '';
    assert.match(frontmatter, /^name: /m, `${dir} frontmatter has no name`);
    assert.match(frontmatter, /description: >/, `${dir} frontmatter has no description block`);
    assert.match(
      frontmatter,
      /Trigger even for casual requests/,
      `${dir} lists no casual trigger phrasings, so it will not fire when a user needs it`,
    );
  }
});

/**
 * The orchestrator's hard boundaries, as behaviours rather than wording.
 *
 * Each entry is here because it was observed going wrong, or because the rule
 * existed somewhere the model never reads. A boundary that lives only in
 * README.md or in the generated RAINMAKER.md is not a boundary: the model
 * reads this file.
 */
// SKILL.md is hard-wrapped, so every pattern matches across a line break.
const HARD_BOUNDARIES: Array<[string, RegExp]> = [
  ['rewriting its own source mid-run', /Never\s+modify\s+Rainmaker's\s+own\s+source/],
  ['editing the site while diagnosing', /Never\s+edit\s+the\s+user's\s+site\s+files\s+while\s+diagnosing/],
  ['shipping on behalf of the user', /Never\s+commit,\s+push,\s+open\s+a\s+pull\s+request,\s+deploy,\s+publish,\s+post,\s+or\s+send/],
  ['hand-writing measurements', /Never\s+write\s+into\s+`data\/`\s+by\s+hand/],
  ['estimating what the CLI produces', /Never\s+estimate\s+a\s+number\s+the\s+CLI\s+produces/],
  ['spending without consent', /never\s+pass\s+`--allow-paid`\s+or\s+`--allow-over-budget`/],
  ['a conversational interview', /at\s+most\s+one\s+CLI\s+call\s+and\s+one\s+question\s+per\s+turn/],
];

test('the orchestrator states every hard boundary it has been taught', () => {
  const body = read(join(SKILLS, 'rainmaker', 'SKILL.md'));

  for (const [behaviour, pattern] of HARD_BOUNDARIES) {
    assert.match(body, pattern, `rainmaker/SKILL.md no longer forbids ${behaviour}`);
  }
});

test('the orchestrator hands the user the service account address', () => {
  const body = read(join(SKILLS, 'rainmaker', 'SKILL.md'));

  // Finding this address used to mean reading a credentials file by hand, so
  // the skill has to name the command that prints it and say where it goes.
  assert.match(body, /rainmaker doctor/);
  assert.match(body, /prints\s+its\s+email\s+address/);
  assert.match(body, /identifier,\s+not\s+a\s+secret/);
  // And must still refuse the private key sitting beside it.
  assert.match(body, /never\s+read\s+it,\s+never\s+print\s+it/);
});

test('degraded measurement is explained before the interview, not after', () => {
  const body = read(join(SKILLS, 'rainmaker', 'SKILL.md'));
  const doctorStep = body.indexOf('rainmaker doctor');
  const interviewStep = body.indexOf('know-my-buyer');

  assert.ok(doctorStep > 0 && interviewStep > 0, 'both steps must exist');
  assert.ok(
    doctorStep < interviewStep,
    'connections are settled before the interview, or the interview runs on flat scores',
  );
  assert.match(body, /falls\s+back\s+to\s+a\s+flat\s+value/);
});
