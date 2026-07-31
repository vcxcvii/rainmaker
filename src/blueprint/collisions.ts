import type { BlueprintNode, Collision } from './types.js';

/**
 * One intent, one node, one URL. Invariant 13 of the core spec.
 *
 * Two nodes targeting the same head query is cannibalisation designed into
 * the site before a single page is written, and it is far cheaper to catch
 * here than to diagnose after both pages are live and competing.
 */
export function detectCollisions(nodes: BlueprintNode[]): Collision[] {
  const byQuery = new Map<string, string[]>();
  for (const node of nodes) {
    if (!node.head_query) continue;
    const key = node.head_query.trim().toLowerCase();
    byQuery.set(key, [...(byQuery.get(key) ?? []), node.id]);
  }

  return [...byQuery.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([head_query, node_ids]) => ({ head_query, node_ids }))
    .sort((left, right) => left.head_query.localeCompare(right.head_query));
}
