import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import {
  EVENT_TYPES,
  LedgerError,
  TRANSITIONS,
  type EventType,
  type LedgerEvent,
  type StatusEvent,
} from './types.js';

const ANNOTATIONS: EventType[] = ['retiered', 'algo_update'];

export function isStatusEvent(event: EventType): event is StatusEvent {
  return !ANNOTATIONS.includes(event);
}

/**
 * Parses one JSONL line. Rejects rather than repairs: a ledger that silently
 * accepts malformed lines cannot be replayed into a trustworthy state.
 */
export function parseEvent(raw: string, line?: number): LedgerEvent {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new LedgerError('line is not valid JSON', line);
  }

  const event = value as Partial<LedgerEvent> | null;
  if (!event || typeof event !== 'object') throw new LedgerError('line is not an object', line);
  if (typeof event.ts !== 'string' || Number.isNaN(Date.parse(event.ts))) {
    throw new LedgerError('ts must be an ISO 8601 timestamp', line);
  }
  if (typeof event.id !== 'string' || !event.id) throw new LedgerError('id is required', line);
  if (!event.event || !EVENT_TYPES.includes(event.event)) {
    throw new LedgerError(`event must be one of: ${EVENT_TYPES.join(', ')}`, line);
  }
  if (event.event === 'dismissed' && !event.note) {
    throw new LedgerError('dismissed requires a note explaining the human decision', line);
  }
  if (event.note && (event.note.length > 200 || event.note.includes('\n'))) {
    throw new LedgerError('note must be <= 200 chars and single-line', line);
  }

  return event as LedgerEvent;
}

export function readLedger(path: string): LedgerEvent[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split('\n')
    .map((line, index) => ({ line: line.trim(), number: index + 1 }))
    .filter(({ line }) => line.length > 0)
    .map(({ line, number }) => parseEvent(line, number));
}

/**
 * Checks a transition against the state machine without writing anything.
 * Returns null when legal, and the reason when not.
 */
export function transitionProblem(current: StatusEvent | null, next: EventType): string | null {
  if (!isStatusEvent(next)) return null; // retiered and algo_update are orthogonal
  const legal = TRANSITIONS[current ?? 'null'] ?? [];
  if (legal.includes(next)) return null;
  const from = current ?? 'no prior event';
  return `illegal transition ${from} -> ${next}. Legal from ${from}: ${legal.join(', ') || 'none'}`;
}

/** Latest status per finding, derived by replay. Annotations never change it. */
export function statusIndex(events: LedgerEvent[]): Map<string, StatusEvent> {
  const index = new Map<string, StatusEvent>();
  for (const event of events) {
    if (isStatusEvent(event.event)) index.set(event.id, event.event);
  }
  return index;
}

export interface AppendResult {
  appended: LedgerEvent[];
  rejected: Array<{ event: LedgerEvent; reason: string }>;
}

/**
 * Appends events, rejecting illegal transitions rather than throwing, so one
 * bad event in a batch cannot abandon the rest of a run's history. Rejections
 * are returned for the caller to report; they are never written.
 */
export function appendEvents(path: string, incoming: LedgerEvent[]): AppendResult {
  const existing = readLedger(path);
  const status = statusIndex(existing);
  const appended: LedgerEvent[] = [];
  const rejected: AppendResult['rejected'] = [];

  for (const event of incoming) {
    parseEvent(JSON.stringify(event));
    const problem =
      event.id === 'site'
        ? null
        : transitionProblem(status.get(event.id) ?? null, event.event);
    if (problem) {
      rejected.push({ event, reason: problem });
      continue;
    }
    appended.push(event);
    if (isStatusEvent(event.event)) status.set(event.id, event.event);
  }

  if (appended.length > 0) {
    appendFileSync(path, `${appended.map((event) => JSON.stringify(event)).join('\n')}\n`, 'utf8');
  }
  return { appended, rejected };
}
