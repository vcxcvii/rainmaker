import { test } from 'node:test';
import assert from 'node:assert/strict';
import { issueTitle, planIssues } from './filer.js';
import type { Finding } from '../analyze/checks.js';

const finding = (id: string, url: string, score: number, extra: Partial<Finding> = {}): Finding => ({
  id,
  check: 'noindex',
  url,
  tier: 0,
  tier_source: 'declared_primary',
  tier_confidence: 1,
  severity: 'blocking',
  effort_hours: 0.5,
  opportunity: 10,
  revenue_score: score,
  confidence: 1,
  evidence: { robots_meta: 'noindex' },
  message: 'Excluded from search.',
  verdict: 'finding',
  ...extra,
});

test('issues are planned in revenue order', () => {
  const findings = [
    finding('t0:noindex:/a', '/a', 5),
    finding('t0:noindex:/b', '/b', 40),
    finding('t0:noindex:/c', '/c', 15),
  ];
  const planned = planIssues(findings, new Set());
  assert.deepEqual(planned.map((issue) => issue.finding_id), ['t0:noindex:/b', 't0:noindex:/c', 't0:noindex:/a']);
});

test('a finding already filed or acknowledged is not replanned', () => {
  const findings = [finding('t0:noindex:/a', '/a', 5), finding('t0:noindex:/b', '/b', 40)];
  const planned = planIssues(findings, new Set(['t0:noindex:/b']));
  assert.deepEqual(planned.map((issue) => issue.finding_id), ['t0:noindex:/a']);
});

test('running the plan twice against the same already-filed set produces zero duplicates', () => {
  const findings = [finding('t0:noindex:/a', '/a', 5)];
  const first = planIssues(findings, new Set());
  const alreadyFiled = new Set(first.map((issue) => issue.finding_id));
  const second = planIssues(findings, alreadyFiled);
  assert.equal(second.length, 0);
});

test('suspicions are never planned as issues', () => {
  const findings = [finding('t0:orphan:/a', '/a', 20, { verdict: 'suspicion', confirm_with: 'raise crawl.max_urls' })];
  assert.equal(planIssues(findings, new Set()).length, 0);
});

test('issue titles never embed the live metric value, so they stay stable across runs', () => {
  const stale = finding('t0:noindex:/a', '/a', 10, { evidence: { inbound_internal_links: 3 } });
  const fresh = finding('t0:noindex:/a', '/a', 40, { evidence: { inbound_internal_links: 9 } });
  assert.equal(issueTitle(stale), issueTitle(fresh));
});

test('issue titles differ by finding, so distinct problems are distinct issues', () => {
  const a = finding('t0:noindex:/a', '/a', 10);
  const b = finding('t0:canonical:/b', '/b', 10);
  assert.notEqual(issueTitle(a), issueTitle(b));
});
