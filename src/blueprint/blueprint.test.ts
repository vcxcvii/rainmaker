import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectCollisions } from './collisions.js';
import { checkPermutation } from './permutation.js';
import { authorityBudget } from './budget.js';
import { sequenceCohorts } from './cohorts.js';
import type { BlueprintNode } from './types.js';

const node = (id: string, extra: Partial<BlueprintNode> = {}): BlueprintNode => ({
  id,
  parent_id: null,
  depth: 1,
  path: `/${id}/`,
  status: 'planned',
  existing_url: null,
  page_type: 'article',
  intent: 'informational',
  tier: 3,
  cluster_id: null,
  head_query: id,
  support_queries: [],
  title: id,
  meta_description: id,
  links_up: null,
  links_down: [],
  links_across: [],
  serp_verdict: 'unchecked',
  effort_hours: 1,
  priority_score: 0,
  ...extra,
});

test('one intent, one node: two nodes sharing a head query is a collision', () => {
  const nodes = [
    node('n1', { head_query: 'contract review software' }),
    node('n2', { head_query: 'Contract Review Software' }),
    node('n3', { head_query: 'best clm tools' }),
  ];
  const collisions = detectCollisions(nodes);
  assert.equal(collisions.length, 1);
  assert.deepEqual(collisions[0].node_ids.sort(), ['n1', 'n2']);
});

test('no collision when every node targets a distinct query', () => {
  const nodes = [node('n1', { head_query: 'a' }), node('n2', { head_query: 'b' })];
  assert.deepEqual(detectCollisions(nodes), []);
});

test('a permutation with fewer than the minimum substance fields is refused', () => {
  const result = checkPermutation({
    node: node('austin', { substance_fields: { area: 'Austin' } }),
    siblings: [],
    hasDemand: true,
    hasProof: true,
    minSubstanceFields: 3,
  });
  assert.equal(result.allowed, false);
  assert.match(result.reasons.join(' '), /only 1 substance field/);
});

test('a permutation that only swaps the area name against its sibling is refused', () => {
  const siblingFields = { area: 'Dallas', staff: 'Jane Doe', price: '$40' };
  const sibling = node('dallas', { substance_fields: siblingFields });
  const candidate = node('austin', {
    substance_fields: { area: 'Austin', staff: 'Jane Doe', price: '$40' },
  });

  const result = checkPermutation({
    node: candidate,
    siblings: [sibling],
    hasDemand: true,
    hasProof: true,
    minSubstanceFields: 3,
  });

  assert.equal(result.allowed, false, 'repeating staff and price identically is a doorway page with one word changed');
  assert.match(result.reasons.join(' '), /shares staff, price identically/);
});

test('a permutation with no measured demand is refused regardless of substance', () => {
  const result = checkPermutation({
    node: node('austin', { substance_fields: { area: 'Austin', staff: 'Jane', price: '$40' } }),
    siblings: [],
    hasDemand: false,
    hasProof: true,
    minSubstanceFields: 3,
  });
  assert.equal(result.allowed, false);
  assert.match(result.reasons.join(' '), /no measured demand/);
});

test('a permutation with no proof point is refused', () => {
  const result = checkPermutation({
    node: node('austin', { substance_fields: { area: 'Austin', staff: 'Jane', price: '$40' } }),
    siblings: [],
    hasDemand: true,
    hasProof: false,
    minSubstanceFields: 3,
  });
  assert.equal(result.allowed, false);
  assert.match(result.reasons.join(' '), /no proof point/);
});

test('a permutation that genuinely differs from every sibling on all four gates is allowed', () => {
  const siblings = [
    node('dallas', { substance_fields: { area: 'Dallas', staff: 'Jane Doe', price: '$40' } }),
    node('houston', { substance_fields: { area: 'Houston', staff: 'John Roe', price: '$45' } }),
  ];
  const result = checkPermutation({
    node: node('austin', { substance_fields: { area: 'Austin', staff: 'Amy Cole', price: '$38' } }),
    siblings,
    hasDemand: true,
    hasProof: true,
    minSubstanceFields: 3,
  });
  assert.deepEqual(result, { allowed: true, reasons: [] });
});

test('a new site with no publish history starts at the floor budget', () => {
  assert.equal(authorityBudget({ publishedLast90d: 0, indexedRate: 0 }), 4);
});

test('a site that published at volume with a low indexed rate is clamped to the floor', () => {
  // Closes the loophole where the v3 formula rewarded failure: 90 pages
  // published, none indexed, previously granted 15 pages a month.
  assert.equal(authorityBudget({ publishedLast90d: 90, indexedRate: 0.05 }), 4);
  assert.equal(authorityBudget({ publishedLast90d: 20, indexedRate: 0.29 }), 4);
});

test('a healthy indexation rate scales the budget up, within bounds', () => {
  const budget = authorityBudget({ publishedLast90d: 30, indexedRate: 0.9 });
  assert.ok(budget > 4, `expected a scaled budget above the floor, got ${budget}`);
});

test('the budget never falls below 4', () => {
  assert.equal(authorityBudget({ publishedLast90d: 3, indexedRate: 0.1 }), 4);
});

test('cohorts respect the authority budget and put tier 0 and 1 first', () => {
  const nodes = [
    node('a', { tier: 3, priority_score: 90 }),
    node('b', { tier: 0, priority_score: 10 }),
    node('c', { tier: 1, priority_score: 50 }),
    node('d', { tier: 0, priority_score: 20 }),
  ];
  const cohorts = sequenceCohorts(nodes, 2);
  assert.equal(cohorts.length, 2);
  assert.deepEqual(cohorts[0].node_ids, ['d', 'b'], 'tier 0 nodes come first, ordered by score within the tier');
  assert.deepEqual(cohorts[1].node_ids, ['c', 'a']);
});

test('cohorts only include planned nodes', () => {
  const nodes = [node('a', { status: 'live' }), node('b', { status: 'planned' })];
  const cohorts = sequenceCohorts(nodes, 4);
  assert.deepEqual(cohorts[0].node_ids, ['b']);
});

test('cohort sequencing is deterministic across repeated runs', () => {
  const nodes = [
    node('a', { tier: 2, priority_score: 5 }),
    node('b', { tier: 2, priority_score: 5 }),
    node('c', { tier: 0, priority_score: 1 }),
  ];
  const first = JSON.stringify(sequenceCohorts(nodes, 2));
  for (let run = 0; run < 20; run += 1) {
    assert.equal(JSON.stringify(sequenceCohorts(nodes, 2)), first);
  }
});
