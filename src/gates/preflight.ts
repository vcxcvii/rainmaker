import { checkSlop } from './slop.js';
import type { Verdict } from '../serp/types.js';

export type PreflightGateName =
  | 'pain_point_provenance'
  | 'cluster_slot'
  | 'cannibalisation'
  | 'intent_match'
  | 'internal_links'
  | 'schema_planned'
  | 'eeat_signals'
  | 'extractability'
  | 'slop_check'
  | 'revenue_argument';

export interface BriefForGates {
  pain_point_ids: string[];
  cluster_id: string | null;
  /** Existing URLs already targeting the same intent. Non-empty is cannibalisation. */
  competing_urls: string[];
  serp_verdict: Verdict | 'unchecked';
  internal_link_sources: string[];
  schema_type: string | null;
  author: string | null;
  first_hand_evidence: string | null;
  cited_source: string | null;
  standalone_claims: string[];
  proof_ids: string[];
  revenue_argument: string | null;
  draft_text: string;
}

export interface GateResult {
  gate: PreflightGateName;
  pass: boolean;
  reason?: string;
}

/**
 * The 10 preflight gates from the core spec, all blocking. Never auto-
 * overridden: output is a pass/fail table plus a recommendation.
 */
export function runPreflight(brief: BriefForGates): GateResult[] {
  const results: GateResult[] = [];

  results.push({
    gate: 'pain_point_provenance',
    pass: brief.pain_point_ids.length > 0,
    reason: brief.pain_point_ids.length > 0 ? undefined : 'brief cites no pain point present in strategy.json',
  });

  results.push({
    gate: 'cluster_slot',
    pass: brief.cluster_id !== null,
    reason: brief.cluster_id !== null ? undefined : 'no matching slot in the keyword plan',
  });

  results.push({
    gate: 'cannibalisation',
    pass: brief.competing_urls.length === 0,
    reason:
      brief.competing_urls.length === 0
        ? undefined
        : `an existing URL already targets this intent: ${brief.competing_urls.join(', ')}`,
  });

  results.push({
    gate: 'intent_match',
    pass: brief.serp_verdict === 'QUALIFY' || brief.serp_verdict === 'CONDITIONAL',
    reason:
      brief.serp_verdict === 'QUALIFY' || brief.serp_verdict === 'CONDITIONAL'
        ? undefined
        : `SERP verdict is ${brief.serp_verdict}, which contradicts building this page`,
  });

  results.push({
    gate: 'internal_links',
    pass: brief.internal_link_sources.length >= 3,
    reason:
      brief.internal_link_sources.length >= 3
        ? undefined
        : `only ${brief.internal_link_sources.length} inbound link source(s) identified, needs 3`,
  });

  results.push({
    gate: 'schema_planned',
    pass: brief.schema_type !== null,
    reason: brief.schema_type !== null ? undefined : 'no schema.org type chosen',
  });

  const eeat = Boolean(brief.author && brief.first_hand_evidence && brief.cited_source);
  results.push({
    gate: 'eeat_signals',
    pass: eeat,
    reason: eeat
      ? undefined
      : 'missing one of: named author, first-hand evidence, cited source',
  });

  results.push({
    gate: 'extractability',
    pass: brief.standalone_claims.length >= 3,
    reason:
      brief.standalone_claims.length >= 3
        ? undefined
        : `only ${brief.standalone_claims.length} standalone claim(s), needs 3`,
  });

  const slop = checkSlop(brief.draft_text);
  results.push({
    gate: 'slop_check',
    pass: slop.passed,
    reason: slop.passed ? undefined : slop.violations.map((violation) => violation.detail).join('; '),
  });

  const hasRevenueArgument = Boolean(brief.revenue_argument) && brief.proof_ids.length > 0;
  results.push({
    gate: 'revenue_argument',
    pass: hasRevenueArgument,
    reason: hasRevenueArgument ? undefined : 'no stated tier and revenue rationale, or no proof cited',
  });

  return results;
}

export function preflightPasses(results: GateResult[]): boolean {
  return results.every((result) => result.pass);
}
