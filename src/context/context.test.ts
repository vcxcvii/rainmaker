import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashBody, parseBusiness, renderBusiness } from './business.js';
import { validateWrite } from './ownership.js';
import { emptyStrategy, validateShape } from './strategy.js';
import { stubBusiness, stubGlossary } from './scaffold.js';
import type { RainmakerConfig } from '../config/schema.js';
import type { Strategy, StrategyDecision } from './types.js';

const AT = '2026-08-01T00:00:00Z';

const config: RainmakerConfig = {
  site: 'https://quillet.com',
  revenue_model: 'sales-led',
  primary_conversion: ['/demo'],
  secondary_conversion: ['/case-studies'],
  acv: 18000,
  sales_cycle_days: 45,
  icp_hint: 'legal ops leads at 200 to 2000 person firms',
  competitors: ['ironclad.com'],
};

const base = (): Strategy => {
  const strategy = emptyStrategy(AT, 'hash-a');
  strategy.personas = [
    { id: 'p1', title: 'Legal ops lead', role_in_deal: 'champion', cares_about: ['cycle time'], objections: [] },
  ];
  strategy.pain_points = [
    {
      id: 'pp1',
      statement: 'Contract review is the bottleneck',
      buyer_language: ['legal takes two weeks to look at anything'],
      evidence: [{ type: 'interview', ref: '2026-07-02 call' }],
      persona_ids: ['p1'],
      tier_hint: 2,
      status: 'validated',
      retired_reason: null,
    },
  ];
  return strategy;
};

const decision = (field: string, source: StrategyDecision['source']): StrategyDecision => ({
  ts: AT,
  field,
  from: null,
  to: 'changed',
  reason: 'test',
  source,
});

test('the stub context parses, hashes, and round-trips', () => {
  const doc = stubBusiness(config, AT);
  const parsed = parseBusiness(renderBusiness(doc));

  assert.equal(parsed.frontmatter.confidence, 'stub');
  assert.equal(parsed.frontmatter.strategy_version, 1);
  assert.equal(hashBody(parsed.body), hashBody(doc.body));
});

test('the stub says plainly that nothing in it came from a buyer', () => {
  const doc = stubBusiness(config, AT);
  assert.match(doc.body, /Nothing here came from a buyer/);
  assert.match(doc.body, /confidence: stub/);
});

test('the glossary seeds brand tokens, which suppress false cannibalisation findings', () => {
  assert.match(stubGlossary(config), /- quillet/);
  assert.match(stubGlossary(config), /- ironclad\.com/);
});

test('the hash ignores frontmatter, so a version bump does not invalidate it', () => {
  const doc = stubBusiness(config, AT);
  const bumped = { ...doc, frontmatter: { ...doc.frontmatter, strategy_version: 7 } };
  assert.equal(hashBody(parseBusiness(renderBusiness(bumped)).body), hashBody(doc.body));
});

test('editing the prose changes the hash, which is what catches drift', () => {
  const doc = stubBusiness(config, AT);
  assert.notEqual(hashBody(`${doc.body}\nA new pain point.`), hashBody(doc.body));
});

test('a skill may not write a field it does not own', () => {
  const before = base();
  const after: Strategy = {
    ...structuredClone(before),
    version: 2,
    competitors: [
      { domain: 'ironclad.com', positioning: 'enterprise CLM', where_they_win: [], where_we_win: [], evidence_urls: [] },
    ],
    decisions: [decision('competitors.ironclad.com', 'pick-my-battles')],
  };

  const violations = validateWrite(before, after, 'pick-my-battles');
  assert.equal(violations.length, 1);
  assert.match(violations[0].reason, /may not write this\. Owners: beat-my-competitors/);
});

test('the owning skill may write the same field', () => {
  const before = base();
  const after: Strategy = {
    ...structuredClone(before),
    version: 2,
    competitors: [
      { domain: 'ironclad.com', positioning: 'enterprise CLM', where_they_win: [], where_we_win: [], evidence_urls: [] },
    ],
    decisions: [decision('competitors.ironclad.com', 'beat-my-competitors')],
  };

  assert.deepEqual(validateWrite(before, after, 'beat-my-competitors'), []);
});

test('a shared field resolves to the more specific rule', () => {
  const before = base();
  const after = structuredClone(before);
  after.version = 2;
  after.pain_points[0].status = 'hypothesis';
  after.decisions = [decision('pain_points.pp1.status', 'say-it-their-way')];

  // say-it-their-way owns status but not the pain point as a whole.
  assert.deepEqual(validateWrite(before, after, 'say-it-their-way'), []);

  const renamed = structuredClone(before);
  renamed.version = 2;
  renamed.pain_points[0].statement = 'Rewritten by the wrong skill';
  renamed.decisions = [decision('pain_points.pp1.statement', 'say-it-their-way')];
  const violations = validateWrite(before, renamed, 'say-it-their-way');
  assert.equal(violations.length, 1);
  assert.match(violations[0].reason, /Owners: know-my-buyer/);
});

test('records are retired, never deleted', () => {
  const before = base();
  const after = structuredClone(before);
  after.version = 2;
  after.pain_points = [];
  after.decisions = [decision('pain_points.pp1', 'know-my-buyer')];

  const violations = validateWrite(before, after, 'know-my-buyer');
  assert.ok(violations.some((problem) => /never deleted/.test(problem.reason)));
});

test('a change without a decisions entry is refused', () => {
  const before = base();
  const after = structuredClone(before);
  after.version = 2;
  after.pain_points[0].status = 'hypothesis';

  const violations = validateWrite(before, after, 'say-it-their-way');
  assert.equal(violations.length, 1);
  assert.match(violations[0].reason, /without a decisions entry/);
});

test('the version must increase, and decisions may not shrink', () => {
  const before = base();
  before.decisions = [decision('icp.segment', 'know-my-buyer')];
  const after = structuredClone(before);
  after.decisions = [];

  const violations = validateWrite(before, after, 'know-my-buyer');
  assert.ok(violations.some((problem) => /version must increase/.test(problem.reason)));
  assert.ok(violations.some((problem) => /append-only/.test(problem.reason)));
});

test('a validated pain point with no buyer language is a defect', () => {
  const strategy = base();
  strategy.pain_points[0].buyer_language = [];

  const problems = validateShape(strategy);
  assert.equal(problems.length, 1);
  assert.match(problems[0].reason, /never heard from a buyer/);
});

test('a cluster with no pain point is refused', () => {
  const strategy = base();
  strategy.clusters = [
    {
      id: 'c1',
      pain_point_ids: [],
      intent: 'commercial',
      target_tier: 1,
      head_query: 'contract review software',
      support_queries: [],
      existing_urls: [],
      gap: 'missing',
    },
  ];

  const problems = validateShape(strategy);
  assert.ok(problems.some((problem) => /only because a keyword had volume/.test(problem.reason)));
});

test('dangling references are caught', () => {
  const strategy = base();
  strategy.pain_points[0].persona_ids = ['p9'];
  strategy.keyword_plan = [
    { cluster_id: 'c9', query: 'clm pricing', impressions: 0, position: null, slot: 'new', target_url: null, priority_score: 0 },
  ];

  const problems = validateShape(strategy);
  assert.ok(problems.some((problem) => /unknown persona p9/.test(problem.reason)));
  assert.ok(problems.some((problem) => /unknown cluster c9/.test(problem.reason)));
});

test('a retired pain point needs a reason', () => {
  const strategy = base();
  strategy.pain_points[0].status = 'retired';

  const problems = validateShape(strategy);
  assert.ok(problems.some((problem) => /retired needs retired_reason/.test(problem.reason)));
});

test('the empty strategy passes its own validation', () => {
  assert.deepEqual(validateShape(emptyStrategy(AT, 'hash-a')), []);
});
