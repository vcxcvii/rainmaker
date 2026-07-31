export type ReportWindow = 'pulse' | '28d' | 'month' | 'quarter' | 'half-year' | 'strategy';

export const WINDOW_DAYS: Record<ReportWindow, number> = {
  pulse: 7,
  '28d': 28,
  month: 30,
  quarter: 90,
  'half-year': 180,
  strategy: 90,
};

export interface WindowAvailability {
  available: boolean;
  /** Only present when unavailable: the date this window becomes coverable. */
  available_from?: string;
  /** Days of snapshot history actually on disk. */
  days_of_history: number;
}

/**
 * A window longer than available history is refused rather than
 * extrapolated, per spec/agent.md section 1.4. Comparing a full window
 * against a partial one is not a comparison, and the refusal names exactly
 * the date the window becomes honest.
 */
export function checkWindowAvailability(
  window: ReportWindow,
  earliestSnapshotAt: string | null,
  now: string,
): WindowAvailability {
  if (!earliestSnapshotAt) {
    return { available: false, days_of_history: 0 };
  }

  const daysOfHistory = (Date.parse(now) - Date.parse(earliestSnapshotAt)) / 86_400_000;
  const needed = WINDOW_DAYS[window];

  if (daysOfHistory >= needed) {
    return { available: true, days_of_history: Math.floor(daysOfHistory) };
  }

  const availableFrom = new Date(Date.parse(earliestSnapshotAt) + needed * 86_400_000).toISOString();
  return { available: false, available_from: availableFrom, days_of_history: Math.floor(daysOfHistory) };
}
