export type PageFormat =
  | 'listicle'
  | 'alternatives'
  | 'comparison'
  | 'landing'
  | 'documentation'
  | 'guide'
  | 'category'
  | 'other';

export interface SerpResult {
  position: number;
  url: string;
  domain: string;
  title: string;
  /** ISO date, when known. Absent means freshness cannot be assessed for this row. */
  last_modified?: string;
}

export interface SerpCapture {
  query: string;
  fetched_at: string;
  results: SerpResult[];
  /** e.g. 'ai_overview', 'featured_snippet', 'map_pack', 'video_carousel'. */
  serp_features: string[];
}

export type Verdict = 'QUALIFY' | 'CONDITIONAL' | 'KILL';

export interface BeatabilityEvidence {
  reason:
    | 'lower_page_count_competitor'
    | 'intent_mismatched_result'
    | 'own_demonstrated_ceiling'
    | 'stale_top_results'
    | 'format_gap';
  detail: string;
}

export interface VerdictResult {
  query: string;
  verdict: Verdict;
  intent_consistent: boolean;
  category_present: boolean;
  rewarded_format: PageFormat | null;
  beatable: boolean;
  evidence: BeatabilityEvidence[];
  /** Present on CONDITIONAL. A verdict left CONDITIONAL with this unset is a soft pass. */
  condition?: string;
  condition_resolved_by?: string;
  kill_reason?: string;
}
