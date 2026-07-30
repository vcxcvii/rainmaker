/**
 * The ledger is the system's memory. Everything else can be recomputed from a
 * fresh crawl; only this records what we believed, what we shipped, and what
 * happened next. It is append-only for that reason: a rewritten history cannot
 * be used to judge whether past work paid off.
 */

export const EVENT_TYPES = [
  'opened',
  'acknowledged',
  'in_progress',
  'shipped',
  'verified',
  'regressed',
  'closed',
  'dismissed',
  'retiered',
  'algo_update',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

/** Events that change a finding's status. The other two annotate without moving it. */
export type StatusEvent = Exclude<EventType, 'retiered' | 'algo_update'>;

export type FieldMap = Record<string, number | string | null>;

export interface LedgerEvent {
  /** ISO 8601 UTC. */
  ts: string;
  /** Finding id, or "site" for site-level events such as an algorithm update. */
  id: string;
  event: EventType;
  from?: FieldMap;
  to?: FieldMap;
  /** Issue ref, commit sha, "remeasure:<snapshot>", or "external:<slug>". */
  cause?: string;
  effort_h?: number;
  /** revenue_score at the time of the event. */
  score?: number;
  confidence?: number;
  /** <= 200 chars, no newlines. Required on dismissed. */
  note?: string;
}

/**
 * Legal transitions. A finding not yet in the ledger is in state `null`.
 *
 * `opened` from `closed` or `dismissed` is recurrence, and it is deliberate:
 * the finding keeps its whole history rather than being reborn under a new id.
 */
export const TRANSITIONS: Record<string, readonly StatusEvent[]> = {
  null: ['opened'],
  opened: ['acknowledged', 'dismissed', 'closed'],
  acknowledged: ['in_progress', 'dismissed', 'closed'],
  in_progress: ['shipped', 'dismissed'],
  shipped: ['verified', 'regressed'],
  verified: ['regressed', 'closed'],
  regressed: ['acknowledged', 'in_progress'],
  closed: ['opened'],
  dismissed: ['opened'],
};

/** Days that must pass after `shipped` before a verdict is honest. */
export const VERIFICATION_WINDOWS: Record<string, number> = {
  canonical: 3,
  redirect: 3,
  robots: 3,
  internal_links: 3,
  cwv: 7,
  indexation: 14,
  position: 28,
  impressions: 28,
  clicks: 28,
  conversion: 90,
  ai_citation: 90,
  offsite: 90,
};

export interface FindingState {
  status: StatusEvent;
  tier: 0 | 1 | 2 | 3 | 4;
  first_seen: string;
  last_event: string;
  /** Latest measured values. */
  current: FieldMap;
  /** Values at the most recent `opened`, so a fix is judged against its own baseline. */
  baseline: FieldMap;
  score: number;
  confidence: number;
  /** Every `cause` seen on this finding, in order. */
  cause_chain: string[];
}

export interface State {
  generated_at: string;
  /** Staleness detection: a state built from fewer lines than the ledger holds is stale. */
  ledger_lines: number;
  findings: Record<string, FindingState>;
  /** Site-level events, kept out of `findings` so a rebuild stays deterministic. */
  site_events: LedgerEvent[];
}

export class LedgerError extends Error {
  constructor(
    message: string,
    readonly line?: number,
  ) {
    super(message);
    this.name = 'LedgerError';
  }
}
