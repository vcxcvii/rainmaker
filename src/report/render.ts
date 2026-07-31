import { pendingVerification } from '../ledger/query.js';
import type { LedgerEvent, State } from '../ledger/types.js';
import { checkWindowAvailability, WINDOW_DAYS, type ReportWindow } from './windows.js';

export interface ReportInput {
  window: ReportWindow;
  now: string;
  earliestSnapshotAt: string | null;
  state: State;
  events: LedgerEvent[];
  /** Which capabilities were live during the window, for the mandatory confidence section. */
  capabilities: Record<string, 'live' | 'missing' | 'error'>;
}

export interface ReportResult {
  ok: boolean;
  refusal?: string;
  sections?: {
    what_changed: string[];
    why_it_matters: string[];
    what_to_do: string[];
    what_we_are_watching: string[];
    confidence: string[];
  };
  text?: string;
}

function windowStart(now: string, window: ReportWindow): string {
  return new Date(Date.parse(now) - WINDOW_DAYS[window] * 86_400_000).toISOString();
}

function inWindow(ts: string, since: string, now: string): boolean {
  return Date.parse(ts) >= Date.parse(since) && Date.parse(ts) <= Date.parse(now);
}

/**
 * Renders the mandatory five-section spine. Refuses rather than extrapolates
 * when the window exceeds available history, per spec/agent.md section 1.4.
 */
export function renderReport(input: ReportInput): ReportResult {
  const availability = checkWindowAvailability(input.window, input.earliestSnapshotAt, input.now);
  if (!availability.available) {
    const refusal = input.earliestSnapshotAt
      ? `Requested ${input.window}, have ${availability.days_of_history} days of history since ${input.earliestSnapshotAt.slice(0, 10)}. ` +
        `Run a smaller window, or wait until ${availability.available_from?.slice(0, 10)}.`
      : `Requested ${input.window}, have no snapshot history at all. Run \`rainmaker audit\` first.`;
    return { ok: false, refusal };
  }

  const since = windowStart(input.now, input.window);
  const windowEvents = input.events.filter((event) => inWindow(event.ts, since, input.now));

  const counts = { opened: 0, shipped: 0, verified: 0, regressed: 0, closed: 0 };
  for (const event of windowEvents) {
    if (event.event in counts) counts[event.event as keyof typeof counts] += 1;
  }

  const whatChanged = [
    counts.opened > 0 ? `${counts.opened} finding(s) opened.` : null,
    counts.shipped > 0 ? `${counts.shipped} shipped.` : null,
    counts.verified > 0 ? `${counts.verified} verified improved.` : null,
    counts.regressed > 0 ? `${counts.regressed} regressed.` : null,
    counts.closed > 0 ? `${counts.closed} closed.` : null,
  ].filter((line): line is string => line !== null);

  const verifiedIds = new Set(
    windowEvents.filter((event) => event.event === 'verified').map((event) => event.id),
  );
  const whyItMatters = [...verifiedIds]
    .map((id) => input.state.findings[id])
    .filter(Boolean)
    .map((finding, index) => {
      const id = [...verifiedIds][index];
      return `${id}: tier ${finding.tier}, score ${finding.score}. Verified improvement inside its window.`;
    });

  const openFindings = Object.entries(input.state.findings)
    .filter(([, finding]) => finding.status === 'opened' || finding.status === 'acknowledged')
    .sort((left, right) => right[1].score - left[1].score || left[0].localeCompare(right[0]))
    .slice(0, 10);
  const whatToDo = openFindings.map(
    ([id, finding]) => `${id}  tier ${finding.tier}  score ${finding.score}`,
  );

  const pending = pendingVerification(input.events, input.state, input.now);
  const whatWeAreWatching = pending
    .slice(0, 10)
    .map((row) => `${row.id}: shipped ${row.shipped_at.slice(0, 10)}, verdict due ${row.due_at.slice(0, 10)}`);

  const missing = Object.entries(input.capabilities).filter(([, status]) => status !== 'live');
  const confidence =
    missing.length === 0
      ? ['All measured capabilities were live for this window.']
      : missing.map(([name, status]) => `${name}: ${status}. Findings depending on it carry reduced confidence.`);

  const sections = {
    what_changed: whatChanged.length ? whatChanged : ['No ledger events in this window.'],
    why_it_matters: whyItMatters.length ? whyItMatters : ['Nothing verified inside this window yet.'],
    what_to_do: whatToDo,
    what_we_are_watching: whatWeAreWatching.length ? whatWeAreWatching : ['Nothing pending verification.'],
    confidence,
  };

  const text = [
    `## 1. What changed`,
    ...sections.what_changed,
    ``,
    `## 2. Why it matters`,
    ...sections.why_it_matters,
    ``,
    `## 3. What to do`,
    ...sections.what_to_do,
    ``,
    `## 4. What we are watching`,
    ...sections.what_we_are_watching,
    ``,
    `## 5. Confidence`,
    ...sections.confidence,
  ].join('\n');

  return { ok: true, sections, text };
}
