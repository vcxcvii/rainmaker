export type PostflightGateName =
  | 'indexed'
  | 'canonical_correct'
  | 'cwv_not_regressed'
  | 'internal_links_live'
  | 'impressions_appearing'
  | 'position_trend'
  | 'ai_citation'
  | 'conversion_contribution';

/** Days from `shipped` before each postflight gate may report pass or fail. */
export const POSTFLIGHT_WINDOWS: Record<PostflightGateName, number> = {
  canonical_correct: 0,
  internal_links_live: 0,
  cwv_not_regressed: 7,
  indexed: 14,
  impressions_appearing: 28,
  position_trend: 90,
  ai_citation: 90,
  conversion_contribution: 90,
};

export type GateStatus = 'pass' | 'fail' | 'not_yet_due' | 'unmeasured';

export interface PostflightResult {
  gate: PostflightGateName;
  status: GateStatus;
}

/**
 * Postflight status per gate. A gate due before its window elapses reports
 * `not_yet_due` rather than pass or fail, since a metric verdicted before its
 * window has not had time to move honestly either way.
 */
export function postflightStatus(
  shippedAt: string,
  now: string,
  measured: Partial<Record<PostflightGateName, boolean>>,
): PostflightResult[] {
  const elapsedDays = (Date.parse(now) - Date.parse(shippedAt)) / 86_400_000;

  return (Object.keys(POSTFLIGHT_WINDOWS) as PostflightGateName[]).map((gate) => {
    if (elapsedDays < POSTFLIGHT_WINDOWS[gate]) {
      return { gate, status: 'not_yet_due' as const };
    }
    const result = measured[gate];
    if (result === undefined) return { gate, status: 'unmeasured' as const };
    return { gate, status: result ? ('pass' as const) : ('fail' as const) };
  });
}
