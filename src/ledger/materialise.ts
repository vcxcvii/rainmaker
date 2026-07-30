import { isStatusEvent, readLedger } from './append.js';
import type { FieldMap, FindingState, LedgerEvent, State } from './types.js';

function tierOf(id: string, fallback: FindingState['tier']): FindingState['tier'] {
  const match = /^t([0-4]):/.exec(id);
  return match ? (Number(match[1]) as FindingState['tier']) : fallback;
}

function merge(base: FieldMap, incoming: FieldMap | undefined): FieldMap {
  return incoming ? { ...base, ...incoming } : base;
}

/**
 * Replays the ledger into the materialised view.
 *
 * Deliberately a pure fold over the events in file order: state.json must be
 * reconstructible from line 1 at any time, so nothing here may read the clock,
 * the filesystem, or a previous state.json.
 */
export function materialise(events: LedgerEvent[], generatedAt: string): State {
  const findings: Record<string, FindingState> = {};
  const siteEvents: LedgerEvent[] = [];

  for (const event of events) {
    if (event.id === 'site') {
      siteEvents.push(event);
      continue;
    }

    const existing = findings[event.id];

    if (!existing) {
      // Only `opened` can create a finding. Anything else arriving first is an
      // orphan annotation, recorded but not invented into a status.
      findings[event.id] = {
        status: isStatusEvent(event.event) ? event.event : 'opened',
        tier: tierOf(event.id, 3),
        first_seen: event.ts,
        last_event: event.ts,
        current: event.to ?? {},
        baseline: event.to ?? {},
        score: event.score ?? 0,
        confidence: event.confidence ?? 0,
        cause_chain: event.cause ? [event.cause] : [],
      };
      continue;
    }

    existing.last_event = event.ts;
    existing.current = merge(existing.current, event.to);
    if (event.score !== undefined) existing.score = event.score;
    if (event.confidence !== undefined) existing.confidence = event.confidence;
    if (event.cause) existing.cause_chain.push(event.cause);

    if (event.event === 'retiered') {
      // The id keeps the tier at first observation on purpose, so a re-tiered
      // page does not appear as one finding closing and another opening.
      const next = Number(event.to?.tier);
      if (Number.isInteger(next) && next >= 0 && next <= 4) {
        existing.tier = next as FindingState['tier'];
      }
      continue;
    }

    if (!isStatusEvent(event.event)) continue;

    if (event.event === 'opened') {
      // Recurrence: a new baseline, because the fix is judged against the state
      // at the moment the problem came back, not at its first sighting years ago.
      existing.baseline = event.to ?? existing.current;
    }
    existing.status = event.event;
  }

  return {
    generated_at: generatedAt,
    ledger_lines: events.length,
    findings,
    site_events: siteEvents,
  };
}

export function materialiseFile(ledgerPath: string, generatedAt: string): State {
  return materialise(readLedger(ledgerPath), generatedAt);
}

/**
 * True when a state was built from the whole ledger. A shorter count means
 * events landed after the last rebuild and every derived number is stale.
 */
export function isCurrent(state: State, ledgerPath: string): boolean {
  return state.ledger_lines === readLedger(ledgerPath).length;
}
