import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyInterviewResult,
  extractInterviewResult,
  extractJsonObject,
  runInterview,
  COMPLETION_MARKER,
  type InterviewResult,
} from './interview.js';
import { emptyStrategy } from '../context/strategy.js';
import { validateWrite } from '../context/ownership.js';
import type { ModelProvider } from '../model/provider.js';
import type { Strategy } from '../context/types.js';

const NOW = '2026-08-01T00:00:00Z';

function scriptedProvider(replies: string[]): ModelProvider {
  let index = 0;
  return {
    name: 'anthropic',
    async complete() {
      const reply = replies[Math.min(index, replies.length - 1)];
      index += 1;
      return reply;
    },
  };
}

function scriptedIO(answers: string[]): { io: { print(t: string): void; ask(p: string): Promise<string> }; printed: string[] } {
  const printed: string[] = [];
  let index = 0;
  return {
    printed,
    io: {
      print(text: string) {
        printed.push(text);
      },
      async ask() {
        return answers[Math.min(index++, answers.length - 1)];
      },
    },
  };
}

test('the loop stops as soon as the model emits the completion marker', async () => {
  const provider = scriptedProvider(['Question one?', `Thanks. ${COMPLETION_MARKER}`]);
  const { io, printed } = scriptedIO(['answer one']);

  const transcript = await runInterview(provider, 'system', io, 20);

  assert.equal(printed.length, 2);
  assert.equal(printed[0], 'Question one?');
  assert.equal(printed[1], 'Thanks.');
  // user 'Begin.' + assistant q1 + user answer + assistant completion = 4
  assert.equal(transcript.length, 4);
});

test('the marker itself is never shown to the user', async () => {
  const provider = scriptedProvider([`All done. ${COMPLETION_MARKER}`]);
  const { io, printed } = scriptedIO([]);
  await runInterview(provider, 'system', io, 20);
  assert.ok(!printed.some((line) => line.includes(COMPLETION_MARKER)));
});

test('maxTurns is a hard stop against a runaway loop', async () => {
  const provider = scriptedProvider(['keep asking']);
  const { io } = scriptedIO(['keep answering']);
  const transcript = await runInterview(provider, 'system', io, 3);
  // 1 initial user + 3 * (assistant + user) = 7
  assert.equal(transcript.length, 7);
});

test('extractJsonObject handles a bare object, a fenced block, and surrounding prose', () => {
  assert.equal(extractJsonObject('{"a":1}'), '{"a":1}');
  assert.equal(extractJsonObject('```json\n{"a":1}\n```'), '{"a":1}');
  assert.equal(extractJsonObject('Here you go:\n{"a":1}\nHope that helps.'), '{"a":1}');
});

test('extractInterviewResult parses the model JSON into a typed result', async () => {
  const payload: InterviewResult = {
    business_md_body: '# Business Context\n...',
    personas: [{ id: 'p1', title: 'Ops Lead', role_in_deal: 'champion', cares_about: [], objections: [] }],
  };
  const provider = scriptedProvider([JSON.stringify(payload)]);
  const result = await extractInterviewResult(provider, 'system', []);
  assert.equal(result.business_md_body, payload.business_md_body);
  assert.equal(result.personas?.[0].id, 'p1');
});

test('applyInterviewResult adds personas and pain points additively with one decision per changed field', () => {
  const base = emptyStrategy(NOW, 'hash-a');
  const result: InterviewResult = {
    business_md_body: 'body',
    personas: [{ id: 'p1', title: 'Ops Lead', role_in_deal: 'champion', cares_about: [], objections: [] }],
    pain_points: [
      {
        id: 'pp1',
        statement: 'Contracts take too long',
        buyer_language: ['legal takes two weeks'],
        evidence: [],
        persona_ids: ['p1'],
        tier_hint: 2,
        status: 'validated',
        retired_reason: null,
      },
    ],
  };

  const next = applyInterviewResult(base, result, NOW);

  assert.equal(next.version, base.version + 1);
  assert.equal(next.personas.length, 1);
  assert.equal(next.pain_points.length, 1);
  assert.ok(next.decisions.some((d) => d.field === 'personas'));
  assert.ok(next.decisions.some((d) => d.field === 'pain_points'));
});

test('applyInterviewResult merges by id rather than duplicating on a repeated interview', () => {
  const base: Strategy = {
    ...emptyStrategy(NOW, 'hash-a'),
    personas: [{ id: 'p1', title: 'Old Title', role_in_deal: 'champion', cares_about: [], objections: [] }],
  };
  const result: InterviewResult = {
    business_md_body: 'body',
    personas: [{ id: 'p1', title: 'New Title', role_in_deal: 'champion', cares_about: [], objections: [] }],
  };

  const next = applyInterviewResult(base, result, NOW);

  assert.equal(next.personas.length, 1);
  assert.equal(next.personas[0].title, 'New Title');
});

test('a field the interview did not touch is left untouched with no decision entry', () => {
  const base = emptyStrategy(NOW, 'hash-a');
  const next = applyInterviewResult(base, { business_md_body: 'body' }, NOW);
  assert.deepEqual(next.messaging, base.messaging);
  assert.equal(next.decisions.length, base.decisions.length);
});

test('InterviewResult cannot carry messaging: that field belongs to say-it-their-way, not the interview', () => {
  // A type-level guard, not just a runtime one: if a future edit re-adds a
  // messaging field to the interview's output shape, this line stops
  // compiling, which is what actually caught this the first time.
  const result: import('./interview.js').InterviewResult = { business_md_body: 'body' };
  // @ts-expect-error messaging is not part of InterviewResult
  result.messaging = { one_liner: 'x', category: 'y', differentiators: [], objection_handling: [] };
});

test('every field applyInterviewResult can set is actually owned by know-my-buyer, end to end', () => {
  const base = emptyStrategy(NOW, 'hash-a');
  const result = {
    business_md_body: 'body',
    icp: { segment: 'legal ops', employee_range: null, industries: [], geographies: [], disqualifiers: [] },
    personas: [{ id: 'p1', title: 'Ops Lead', role_in_deal: 'champion' as const, cares_about: [], objections: [] }],
    pain_points: [
      {
        id: 'pp1',
        statement: 'x',
        buyer_language: ['y'],
        evidence: [],
        persona_ids: ['p1'],
        tier_hint: 2 as const,
        status: 'validated' as const,
        retired_reason: null,
      },
    ],
  };

  const next = applyInterviewResult(base, result, NOW);
  const violations = validateWrite(base, next, 'know-my-buyer');

  assert.deepEqual(violations, [], JSON.stringify(violations));
});
