import type { BlueprintNode } from './types.js';

export interface Cohort {
  month: number;
  node_ids: string[];
}

/**
 * Sequences planned nodes into monthly cohorts inside the authority budget,
 * tier 0 and 1 first. Nodes are ordered by priority_score within a tier, so
 * two runs over the same blueprint produce the same sequencing.
 */
export function sequenceCohorts(nodes: BlueprintNode[], budgetPerMonth: number): Cohort[] {
  const planned = nodes
    .filter((node) => node.status === 'planned')
    .sort(
      (left, right) =>
        left.tier - right.tier ||
        right.priority_score - left.priority_score ||
        left.id.localeCompare(right.id),
    );

  const cohorts: Cohort[] = [];
  for (let index = 0; index < planned.length; index += budgetPerMonth) {
    cohorts.push({
      month: cohorts.length + 1,
      node_ids: planned.slice(index, index + budgetPerMonth).map((node) => node.id),
    });
  }
  return cohorts;
}
