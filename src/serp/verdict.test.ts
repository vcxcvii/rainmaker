import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyFormat, computeVerdict, verdictBatch } from './verdict.js';
import type { SerpCapture, SerpResult } from './types.js';
import type { VerdictInput } from './verdict.js';

const NOW = '2026-08-01T00:00:00Z';

const result = (extra: Partial<SerpResult> = {}): SerpResult => ({
  position: 1,
  url: 'https://example.com/page',
  domain: 'example.com',
  title: 'Example',
  ...extra,
});

const capture = (query: string, results: SerpResult[]): SerpCapture => ({
  query,
  fetched_at: NOW,
  results,
  serp_features: [],
});

const baseInput = (capture: SerpCapture, extra: Partial<VerdictInput> = {}): VerdictInput => ({
  capture,
  categoryTerms: [],
  canProduce: [],
  now: NOW,
  ...extra,
});

test('a mixed-intent SERP produces KILL', () => {
  // An even split between transactional and informational intent, with no
  // majority reaching the 60% consistency threshold.
  const query = 'clm software';
  const results = [
    result({ position: 1, title: 'Get a CLM demo today', domain: 'a.example.com' }),
    result({ position: 2, title: 'Buy CLM software now', domain: 'b.example.com' }),
    result({ position: 3, title: 'What is CLM? A definition', domain: 'wikipedia.org' }),
    result({ position: 4, title: 'CLM tutorial and guide', domain: 'edu.example.com' }),
  ];
  const verdict = computeVerdict(baseInput(capture(query, results)));

  assert.equal(verdict.verdict, 'KILL');
  assert.equal(verdict.intent_consistent, false);
  assert.match(verdict.kill_reason ?? '', /mixed intent/);
});

test('a SERP dominated by a different product category is KILL', () => {
  const query = 'quillet contract review';
  const results = [
    result({ position: 1, title: 'Quillet Board Game Rules', domain: 'boardgames.example.com' }),
    result({ position: 2, title: 'Quillet Card Game Strategy Guide', domain: 'games.example.com' }),
  ];
  const verdict = computeVerdict(
    baseInput(capture(query, results), { categoryTerms: ['contract', 'clm', 'legal'] }),
  );

  assert.equal(verdict.verdict, 'KILL');
  assert.equal(verdict.category_present, false);
  assert.match(verdict.kill_reason ?? '', /different product category/);
});

test('no beatability evidence is KILL even with consistent intent and matching category', () => {
  const query = 'contract review software';
  const results = [
    result({ position: 1, title: 'Best contract review software', domain: 'ironclad.com' }),
    result({ position: 2, title: 'Top contract review tools', domain: 'lexion.com' }),
    result({ position: 3, title: 'Best contract review platforms', domain: 'docusign.com' }),
  ];
  const verdict = computeVerdict(baseInput(capture(query, results), { categoryTerms: ['contract'] }));

  assert.equal(verdict.verdict, 'KILL');
  assert.equal(verdict.beatable, false);
  assert.match(verdict.kill_reason ?? '', /no beatability evidence/);
});

test('a lower page-count competitor is beatability evidence, producing QUALIFY', () => {
  const query = 'contract review software';
  const results = [
    result({ position: 1, title: 'Best contract review software', domain: 'small-competitor.com' }),
    result({ position: 2, title: 'Top contract review tools', domain: 'ironclad.com' }),
  ];
  const verdict = computeVerdict(
    baseInput(capture(query, results), {
      categoryTerms: ['contract'],
      competitorClusterPages: { 'small-competitor.com': 2, 'ironclad.com': 40 },
      ourClusterPages: 10,
    }),
  );

  assert.equal(verdict.verdict, 'QUALIFY');
  assert.ok(verdict.evidence.some((e) => e.reason === 'lower_page_count_competitor'));
});

test('a format the site cannot produce is CONDITIONAL, not a soft pass', () => {
  const query = 'best contract review software';
  const results = [
    result({ position: 1, title: 'Best contract review software: our top 10 picks', domain: 'g2.com' }),
    result({ position: 2, title: 'Top 10 contract review tools ranked', domain: 'capterra.com' }),
    result({ position: 3, title: 'Best contract review software of 2026', domain: 'g2.com' }),
  ];
  const verdict = computeVerdict(
    baseInput(capture(query, results), {
      categoryTerms: ['contract'],
      canProduce: ['landing', 'documentation'],
      competitorClusterPages: { 'g2.com': 3 },
      ourClusterPages: 10,
    }),
  );

  assert.equal(verdict.verdict, 'CONDITIONAL');
  assert.ok(verdict.condition, 'a CONDITIONAL verdict must state its condition');
  assert.ok(verdict.condition_resolved_by, 'a CONDITIONAL verdict must state how to resolve it');
});

test('our own demonstrated ceiling is sufficient evidence for QUALIFY', () => {
  const query = 'contract review checklist';
  const results = [
    result({ position: 1, title: 'Contract review checklist guide', domain: 'competitor.com' }),
    result({ position: 2, title: 'How to review contracts: a checklist', domain: 'another.com' }),
  ];
  const verdict = computeVerdict(
    baseInput(capture(query, results), { categoryTerms: ['contract'], ownDemonstratedCeiling: 7 }),
  );

  assert.equal(verdict.verdict, 'QUALIFY');
  assert.ok(verdict.evidence.some((e) => e.reason === 'own_demonstrated_ceiling'));
});

test('stale top results are beatability evidence', () => {
  const query = 'contract review workflow';
  const results = [
    result({ position: 1, title: 'Contract review workflow guide', domain: 'a.com', last_modified: '2022-01-01T00:00:00Z' }),
    result({ position: 2, title: 'How to build a contract review workflow', domain: 'b.com', last_modified: '2021-06-01T00:00:00Z' }),
  ];
  const verdict = computeVerdict(baseInput(capture(query, results), { categoryTerms: ['contract'] }));

  assert.equal(verdict.verdict, 'QUALIFY');
  assert.ok(verdict.evidence.some((e) => e.reason === 'stale_top_results'));
});

test('classifyFormat recognises the common SERP shapes', () => {
  assert.equal(classifyFormat('Best CRM Software: Top 10 Picks', 'https://x.com/best-crm'), 'listicle');
  assert.equal(classifyFormat('Ironclad Alternatives', 'https://x.com/alternatives'), 'alternatives');
  assert.equal(classifyFormat('Ironclad vs Docusign', 'https://x.com/vs'), 'comparison');
  assert.equal(classifyFormat('API Documentation', 'https://x.com/docs/api'), 'documentation');
  assert.equal(classifyFormat('How to review a contract', 'https://x.com/guide'), 'guide');
  assert.equal(classifyFormat('Pricing', 'https://x.com/pricing'), 'landing');
});

test('kill reasons are summarised across a batch', () => {
  const mixedIntent = capture('clm software', [
    result({ position: 1, title: 'Best CLM Software', domain: 'g2.com' }),
    result({ position: 2, title: 'What is CLM? A definition', domain: 'wikipedia.org' }),
    result({ position: 3, title: 'How to fix contract chaos', domain: 'blog.example.com' }),
  ]);
  const wrongCategory = capture('quillet', [
    result({ position: 1, title: 'Quillet Board Game', domain: 'games.example.com' }),
  ]);

  const { killReasons } = verdictBatch([
    baseInput(mixedIntent),
    baseInput(wrongCategory, { categoryTerms: ['contract'] }),
  ]);

  assert.equal(killReasons.size, 2);
});

test('verdicts are deterministic across repeated runs', () => {
  const query = 'contract review software';
  const results = [
    result({ position: 1, title: 'Best contract review software', domain: 'small.com' }),
    result({ position: 2, title: 'Top contract review tools', domain: 'ironclad.com' }),
  ];
  const input = baseInput(capture(query, results), {
    categoryTerms: ['contract'],
    competitorClusterPages: { 'small.com': 2, 'ironclad.com': 40 },
    ourClusterPages: 10,
  });

  const first = JSON.stringify(computeVerdict(input));
  for (let run = 0; run < 20; run += 1) {
    assert.equal(JSON.stringify(computeVerdict(input)), first);
  }
});
