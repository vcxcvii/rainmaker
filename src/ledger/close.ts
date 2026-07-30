import type { LedgerEvent, State } from './types.js';

/** `t0:canonical:/demo` -> `/demo`. The path may contain colons; only the first two split. */
export function pathOfFinding(id: string): string | null {
  const parts = id.split(':');
  if (parts.length < 3) return null;
  return parts.slice(2).join(':');
}

export interface ClosurePlan {
  /** Findings the run may legally close: absent from this run and provably looked at. */
  close: string[];
  /** Absent, but the crawler never fetched the URL, so absence proves nothing. */
  coverage_gap: string[];
}

export interface CoverageInput {
  /** Normalised paths the crawler actually fetched and got a 2xx or 4xx for. */
  covered: Iterable<string>;
  /** Finding ids produced by this run. */
  present: Iterable<string>;
  /** True when the crawl stopped early. Forbids every close in this run. */
  budgetExhausted: boolean;
}

const OPEN_STATUSES = new Set(['opened', 'acknowledged', 'in_progress', 'shipped', 'verified', 'regressed']);

/**
 * Decides which open findings this run is entitled to close.
 *
 * The rule exists because the ledger is append-only, so a wrong close is
 * permanent. A truncated crawl, a provider outage or a transient 5xx all make
 * findings disappear from a run without anything being fixed. Absence is only
 * evidence when the URL was actually looked at.
 */
export function planClosures(state: State, coverage: CoverageInput): ClosurePlan {
  const covered = new Set(coverage.covered);
  const present = new Set(coverage.present);
  const plan: ClosurePlan = { close: [], coverage_gap: [] };

  for (const [id, finding] of Object.entries(state.findings)) {
    if (!OPEN_STATUSES.has(finding.status)) continue;
    if (present.has(id)) continue;

    const path = pathOfFinding(id);
    if (coverage.budgetExhausted || !path || !covered.has(path)) {
      plan.coverage_gap.push(id);
      continue;
    }
    plan.close.push(id);
  }

  plan.close.sort();
  plan.coverage_gap.sort();
  return plan;
}

export function closureEvents(plan: ClosurePlan, ts: string, cause: string): LedgerEvent[] {
  return plan.close.map((id) => ({ ts, id, event: 'closed' as const, cause }));
}
