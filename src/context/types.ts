/**
 * The context layer. One business context, loaded identically by every skill,
 * so 26 skills hold one opinion rather than 26.
 *
 * `context/business.md` is the prose a human argues with. This file types the
 * machine projection of the same commitments. They share ids and are tied
 * together by `context_hash`, because prose without records is invisible to
 * scoring and records without prose are unusable by a writing skill.
 */

export const SKILL_NAMES = [
  'know-my-buyer',
  'say-it-their-way',
  'explain-this-number',
  'unblock-my-money-pages',
  'find-my-quick-wins',
  'get-mentioned-by-ai',
  'stop-losing-visitors',
  'beat-my-competitors',
  'follow-the-money',
  'pick-my-battles',
  'can-i-actually-rank',
  'what-to-target-next',
  'map-my-site',
  'brief-my-writer',
  'write-the-page',
  'make-it-sound-human',
  'make-me-quotable',
  'revive-old-pages',
  'get-cited-elsewhere',
  'show-up-in-communities',
  'spread-one-piece-everywhere',
  'check-before-i-publish',
  'put-it-on-autopilot',
  'show-me-progress',
  'what-actually-worked',
  'what-changed-in-search',
  /** Not a skill. Reserved for `rainmaker context --init` and --sync. */
  'cli',
] as const;

export type SkillName = (typeof SKILL_NAMES)[number];

export type Tier = 0 | 1 | 2 | 3 | 4;

export interface Persona {
  id: string;
  title: string;
  role_in_deal: 'champion' | 'economic' | 'technical' | 'user' | 'blocker';
  cares_about: string[];
  objections: string[];
}

export interface PainPoint {
  id: string;
  statement: string;
  /** Verbatim phrasings. Empty after know-my-buyer is a defect, not a warning. */
  buyer_language: string[];
  evidence: Array<{
    type: 'interview' | 'gsc_query' | 'review' | 'support' | 'sales_call';
    ref: string;
  }>;
  persona_ids: string[];
  tier_hint: Tier;
  status: 'hypothesis' | 'validated' | 'retired';
  retired_reason: string | null;
}

export interface ProofPoint {
  id: string;
  kind: 'case_study' | 'metric' | 'quote' | 'benchmark';
  claim: string;
  source_url: string | null;
  strength: 'strong' | 'medium' | 'weak';
}

export interface Competitor {
  domain: string;
  positioning: string;
  where_they_win: string[];
  where_we_win: string[];
  evidence_urls: string[];
}

export interface Cluster {
  id: string;
  pain_point_ids: string[];
  intent: 'transactional' | 'commercial' | 'solution' | 'informational';
  target_tier: Tier;
  head_query: string;
  support_queries: string[];
  existing_urls: string[];
  gap: 'none' | 'thin' | 'missing';
}

export interface KeywordSlot {
  cluster_id: string;
  query: string;
  impressions: number;
  position: number | null;
  slot: 'new' | 'refresh' | 'consolidate' | 'kill';
  target_url: string | null;
  /** Computed in src/analyze/scoring.ts. A skill that sets this is a defect. */
  priority_score: number;
}

export interface StrategyDecision {
  ts: string;
  /** Dotted path, e.g. "pain_points.pp3.status". */
  field: string;
  from: string | null;
  to: string;
  /** <= 200 chars. Why the belief changed, not what changed. */
  reason: string;
  source: SkillName;
}

export interface Strategy {
  version: number;
  generated_at: string;
  /** sha256 of the body of context/business.md. See context/business.ts. */
  context_hash: string;
  written_by: SkillName[];
  icp: {
    segment: string;
    employee_range: [number, number] | null;
    industries: string[];
    geographies: string[];
    disqualifiers: string[];
  };
  personas: Persona[];
  pain_points: PainPoint[];
  proof: ProofPoint[];
  competitors: Competitor[];
  clusters: Cluster[];
  keyword_plan: KeywordSlot[];
  messaging: {
    one_liner: string;
    category: string;
    differentiators: string[];
    objection_handling: Array<{ objection: string; response: string; proof_id: string | null }>;
  };
  decisions: StrategyDecision[];
}

export type ConfidenceLevel = 'interviewed' | 'inferred' | 'stub';

export interface BusinessFrontmatter {
  generated_at: string;
  strategy_version: number;
  source: SkillName;
  confidence: ConfidenceLevel;
}

export class ContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContextError';
  }
}
