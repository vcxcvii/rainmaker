import type { ChatMessage, ModelProvider } from '../model/provider.js';
import type { Persona, PainPoint, Strategy, StrategyDecision } from '../context/types.js';

/**
 * The chat loop for `rainmaker agent`'s interview step. Deliberately thin:
 * the actual interview behaviour (twelve questions, one at a time, each
 * citing a real finding) lives entirely in the know-my-buyer SKILL.md system
 * prompt, the same file Claude Code or any other assistant reads. This code
 * is the shell that carries that conversation for someone with no assistant
 * at all, not a second copy of the interview logic.
 */

export const COMPLETION_MARKER = '[INTERVIEW COMPLETE]';

export interface InterviewIO {
  print(text: string): void;
  ask(prompt: string): Promise<string>;
}

/**
 * Runs the conversation until the model's own message contains the
 * completion marker, or maxTurns is hit as a hard stop against a runaway
 * loop burning through API calls.
 */
export async function runInterview(
  provider: ModelProvider,
  system: string,
  io: InterviewIO,
  maxTurns = 20,
): Promise<ChatMessage[]> {
  const messages: ChatMessage[] = [{ role: 'user', content: 'Begin.' }];

  for (let turn = 0; turn < maxTurns; turn += 1) {
    const reply = await provider.complete(system, messages);
    messages.push({ role: 'assistant', content: reply });

    const visible = reply.replace(COMPLETION_MARKER, '').trim();
    if (visible) io.print(visible);

    if (reply.includes(COMPLETION_MARKER)) break;

    const answer = await io.ask('> ');
    messages.push({ role: 'user', content: answer });
  }

  return messages;
}

/**
 * Deliberately excludes `messaging`: that field is owned by say-it-their-way,
 * not know-my-buyer, per the ownership table in src/context/ownership.ts.
 * The interview establishes who the buyer is; sharpening the one-liner
 * against real search behaviour is a separate skill's job, run later, once
 * there is search behaviour to sharpen against.
 */
export interface InterviewResult {
  business_md_body: string;
  icp?: Strategy['icp'];
  personas?: Persona[];
  pain_points?: PainPoint[];
}

const EXTRACTION_PROMPT = `The interview is complete. Reply with nothing except one JSON object, no prose before or after, matching exactly:
{
  "business_md_body": "<the full markdown body for context/business.md, following the template you were given>",
  "icp": {"segment": "", "employee_range": null, "industries": [], "geographies": [], "disqualifiers": []},
  "personas": [{"id": "p1", "title": "", "role_in_deal": "champion", "cares_about": [], "objections": []}],
  "pain_points": [{"id": "pp1", "statement": "", "buyer_language": ["verbatim quotes only"], "evidence": [], "persona_ids": [], "tier_hint": 2, "status": "validated", "retired_reason": null}]
}
Do not include a "messaging" field. Sharpening the one-liner is a separate step that runs later, against real search behaviour.
A pain point with an empty buyer_language array must be status "hypothesis", never "validated".`;

/**
 * A second, separate call rather than trying to parse structure out of the
 * conversational transcript: asking the model to switch from "interviewing"
 * to "reporting structured output" in the same turn produces worse output on
 * every provider this was designed against than asking for each in its own
 * turn.
 */
export async function extractInterviewResult(
  provider: ModelProvider,
  system: string,
  transcript: ChatMessage[],
): Promise<InterviewResult> {
  const messages: ChatMessage[] = [...transcript, { role: 'user', content: EXTRACTION_PROMPT }];
  const reply = await provider.complete(system, messages);
  const jsonText = extractJsonObject(reply);
  return JSON.parse(jsonText) as InterviewResult;
}

/** Models sometimes wrap JSON in prose or a fenced code block despite being asked not to. */
export function extractJsonObject(text: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  if (fenced) return fenced[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) throw new Error('No JSON object found in model output');
  return text.slice(start, end + 1);
}

/**
 * Merges an interview result into the strategy, additively, with one
 * decisions entry per changed top-level field so field-ownership validation
 * in src/context/strategy.ts can attribute every change without the model
 * having to know the dotted-path ownership rules itself.
 */
export function applyInterviewResult(
  previous: Strategy,
  result: InterviewResult,
  now: string,
): Strategy {
  const decisions: StrategyDecision[] = [...previous.decisions];
  const source = 'know-my-buyer' as const;
  const note = (field: string) => decisions.push({ ts: now, field, from: null, to: 'from the interview', reason: `set by the know-my-buyer interview on ${now.slice(0, 10)}`, source });

  const next: Strategy = { ...previous, decisions };

  if (result.icp) {
    next.icp = result.icp;
    note('icp');
  }
  if (result.personas) {
    next.personas = mergeById(previous.personas, result.personas);
    note('personas');
  }
  if (result.pain_points) {
    next.pain_points = mergeById(previous.pain_points, result.pain_points);
    note('pain_points');
  }

  next.version = previous.version + 1;
  return next;
}

function mergeById<T extends { id: string }>(previous: T[], incoming: T[]): T[] {
  const byId = new Map(previous.map((row) => [row.id, row]));
  for (const row of incoming) byId.set(row.id, row);
  return [...byId.values()];
}
