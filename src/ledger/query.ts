import { readLedger } from './append.js';
import { VERIFICATION_WINDOWS, type EventType, type LedgerEvent, type State } from './types.js';

export interface LedgerQuery {
  id?: string;
  /** ISO date. Events strictly before it are excluded. */
  since?: string;
  status?: EventType;
}

export function queryEvents(events: LedgerEvent[], query: LedgerQuery): LedgerEvent[] {
  return events.filter((event) => {
    if (query.id && event.id !== query.id) return false;
    if (query.status && event.event !== query.status) return false;
    if (query.since && Date.parse(event.ts) < Date.parse(query.since)) return false;
    return true;
  });
}

export function queryFile(path: string, query: LedgerQuery): LedgerEvent[] {
  return queryEvents(readLedger(path), query);
}

/** `t0:canonical:/demo` -> `canonical`, which selects the verification window. */
export function checkOfFinding(id: string): string {
  return id.split(':')[1] ?? '';
}

export function windowDaysFor(id: string): number {
  const check = checkOfFinding(id);
  for (const [prefix, days] of Object.entries(VERIFICATION_WINDOWS)) {
    if (check.startsWith(prefix)) return days;
  }
  return 28;
}

export interface PendingVerification {
  id: string;
  shipped_at: string;
  due_at: string;
  window_days: number;
}

/**
 * Findings that shipped but whose window has not elapsed. Reporting a verdict
 * before this date manufactures noise: the metric has not had time to move,
 * so both "it worked" and "it failed" are unearned.
 */
export function pendingVerification(
  events: LedgerEvent[],
  state: State,
  now: string,
): PendingVerification[] {
  const shippedAt = new Map<string, string>();
  for (const event of events) {
    if (event.event === 'shipped') shippedAt.set(event.id, event.ts);
  }

  const pending: PendingVerification[] = [];
  for (const [id, finding] of Object.entries(state.findings)) {
    if (finding.status !== 'shipped') continue;
    const shipped = shippedAt.get(id);
    if (!shipped) continue;
    const days = windowDaysFor(id);
    const due = new Date(Date.parse(shipped) + days * 86_400_000).toISOString();
    if (Date.parse(due) > Date.parse(now)) {
      pending.push({ id, shipped_at: shipped, due_at: due, window_days: days });
    }
  }
  return pending.sort((left, right) => left.due_at.localeCompare(right.due_at));
}

export interface DidNothing {
  id: string;
  shipped_at: string;
  effort_h: number;
  baseline: State['findings'][string]['baseline'];
  current: State['findings'][string]['current'];
}

/**
 * Shipped work past its window whose measured values did not move. This is the
 * mandatory "What did nothing" section: a retrospective reporting only wins is
 * a defect, because it leaves the failed assumption in place for next quarter.
 */
export function didNothing(events: LedgerEvent[], state: State, now: string): DidNothing[] {
  const shipped = new Map<string, LedgerEvent>();
  for (const event of events) {
    if (event.event === 'shipped') shipped.set(event.id, event);
  }

  const results: DidNothing[] = [];
  for (const [id, finding] of Object.entries(state.findings)) {
    const event = shipped.get(id);
    if (!event) continue;
    const due = Date.parse(event.ts) + windowDaysFor(id) * 86_400_000;
    if (due > Date.parse(now)) continue;

    const moved = Object.entries(finding.baseline).some(
      ([key, value]) => finding.current[key] !== undefined && finding.current[key] !== value,
    );
    if (!moved) {
      results.push({
        id,
        shipped_at: event.ts,
        effort_h: event.effort_h ?? 0,
        baseline: finding.baseline,
        current: finding.current,
      });
    }
  }
  return results.sort((left, right) => right.effort_h - left.effort_h);
}
