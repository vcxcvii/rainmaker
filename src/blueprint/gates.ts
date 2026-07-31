import type { BlueprintNode } from './types.js';

export interface BriefGateResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Invariant 14: nothing gets briefed without a SERP verdict. A node whose
 * `serp_verdict` is still `unchecked` has never had its live SERP read, and
 * briefing it anyway is exactly the mistake can-i-actually-rank exists to
 * prevent — volume and intent classification say nothing about whether the
 * top 10 is displaceable.
 */
export function canBrief(node: BlueprintNode): BriefGateResult {
  if (node.serp_verdict === 'unchecked') {
    return {
      allowed: false,
      reason: `${node.path} has never had its SERP checked. Run \`rainmaker serp "${node.head_query}"\`, then \`can-i-actually-rank\`, before briefing it.`,
    };
  }
  if (node.serp_verdict === 'KILL') {
    return {
      allowed: false,
      reason: `${node.path} was verdicted KILL for "${node.head_query}". Briefing it spends effort on a target the evidence says will not rank.`,
    };
  }
  if (node.serp_verdict === 'CONDITIONAL' && !node.serp_condition_resolved_by) {
    // A CONDITIONAL verdict with no recorded resolution is a soft pass, which
    // spec/false-positives.md section 6 closes: it must not silently reach a
    // brief with its condition unresolved.
    return {
      allowed: false,
      reason: `${node.path} is CONDITIONAL ("${node.serp_condition ?? 'unstated condition'}") with no recorded resolution. Resolve it, or reclassify as KILL.`,
    };
  }
  return { allowed: true };
}
