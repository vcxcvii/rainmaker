import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkSlop } from './slop.js';
import { preflightPasses, runPreflight, type BriefForGates } from './preflight.js';
import { postflightStatus } from './postflight.js';

const goodBrief: BriefForGates = {
  pain_point_ids: ['pp1'],
  cluster_id: 'c1',
  competing_urls: [],
  serp_verdict: 'QUALIFY',
  internal_link_sources: ['/a', '/b', '/c'],
  schema_type: 'Product',
  author: 'Jane Doe',
  first_hand_evidence: 'ran this process for 3 years',
  cited_source: 'https://example.com/source',
  standalone_claims: ['Claim one.', 'Claim two.', 'Claim three.'],
  proof_ids: ['pr1'],
  revenue_argument: 'Tier 0 page, closes deals directly.',
  draft_text: 'This page explains contract review clearly. It names the real cost. It states one fact per sentence.',
};

const badBrief: BriefForGates = {
  pain_point_ids: [],
  cluster_id: null,
  competing_urls: ['/existing-page'],
  serp_verdict: 'KILL',
  internal_link_sources: [],
  schema_type: null,
  author: null,
  first_hand_evidence: null,
  cited_source: null,
  standalone_claims: [],
  proof_ids: [],
  revenue_argument: null,
  draft_text: 'In today’s world, we leverage seamless robust solutions to unlock synergy — dive in!',
};

test('a good brief passes all 10 preflight gates', () => {
  const results = runPreflight(goodBrief);
  assert.equal(results.length, 10);
  assert.equal(preflightPasses(results), true, JSON.stringify(results.filter((r) => !r.pass)));
});

test('a deliberately bad brief fails all 10 preflight gates', () => {
  const results = runPreflight(badBrief);
  assert.equal(results.length, 10);
  assert.equal(preflightPasses(results), false);
  const failed = results.filter((result) => !result.pass).map((result) => result.gate);
  assert.equal(failed.length, 10, `expected all 10 gates to fail, only failed: ${failed.join(', ')}`);
});

test('cannibalisation fails only when a competing URL exists', () => {
  const clean = runPreflight({ ...goodBrief, competing_urls: [] }).find((r) => r.gate === 'cannibalisation');
  const dirty = runPreflight({ ...goodBrief, competing_urls: ['/other'] }).find((r) => r.gate === 'cannibalisation');
  assert.equal(clean?.pass, true);
  assert.equal(dirty?.pass, false);
});

test('intent_match fails on CONDITIONAL only when treated strictly, but passes here since CONDITIONAL is a survivor', () => {
  const conditional = runPreflight({ ...goodBrief, serp_verdict: 'CONDITIONAL' }).find((r) => r.gate === 'intent_match');
  const unchecked = runPreflight({ ...goodBrief, serp_verdict: 'unchecked' }).find((r) => r.gate === 'intent_match');
  assert.equal(conditional?.pass, true);
  assert.equal(unchecked?.pass, false);
});

test('the slop check catches em-dashes, cliche openings, and slop vocabulary density', () => {
  const result = checkSlop('In today’s world, we leverage seamless robust solutions — elevate everything.');
  assert.equal(result.passed, false);
  const rules = result.violations.map((v) => v.rule);
  assert.ok(rules.includes('opening_cliche'));
  assert.ok(rules.includes('em_dash'));
  assert.ok(rules.includes('slop_vocabulary'));
});

test('the slop check catches a sentence over 40 words', () => {
  const longSentence = `This is a very long sentence that keeps going and going ${'and adding more words '.repeat(6)}without ever stopping to make its point clearly or concisely at all.`;
  const result = checkSlop(longSentence);
  assert.ok(result.violations.some((v) => v.rule === 'long_sentence'));
});

test('clean prose passes the slop check', () => {
  const result = checkSlop('This page explains contract review. It states the real cost. It names one fact per sentence.');
  assert.deepEqual(result, { passed: true, violations: [] });
});

test('postflight gates report not_yet_due before their window elapses', () => {
  const shipped = '2026-08-01T00:00:00Z';
  const results = postflightStatus(shipped, '2026-08-03T00:00:00Z', { indexed: true, position_trend: true });
  const indexed = results.find((r) => r.gate === 'indexed');
  const canonical = results.find((r) => r.gate === 'canonical_correct');
  assert.equal(indexed?.status, 'not_yet_due', 'indexed has a 14 day window, only 2 days have passed');
  assert.equal(canonical?.status, 'unmeasured', 'canonical has no window but was never measured here');
});

test('postflight gates report pass or fail once due and measured', () => {
  const shipped = '2026-08-01T00:00:00Z';
  const results = postflightStatus(shipped, '2026-08-20T00:00:00Z', { indexed: true, cwv_not_regressed: false });
  assert.equal(results.find((r) => r.gate === 'indexed')?.status, 'pass');
  assert.equal(results.find((r) => r.gate === 'cwv_not_regressed')?.status, 'fail');
  assert.equal(results.find((r) => r.gate === 'impressions_appearing')?.status, 'not_yet_due', '28 day window, only 19 days passed');
});
