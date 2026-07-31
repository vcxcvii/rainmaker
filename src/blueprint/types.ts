import type { Tier } from '../analyze/checks.js';
import type { Verdict } from '../serp/types.js';

export type PageType =
  | 'home' | 'category' | 'product' | 'service' | 'location'
  | 'comparison' | 'alternatives' | 'pricing' | 'use-case'
  | 'integration' | 'guide' | 'glossary' | 'article' | 'proof';

export type NodeStatus = 'live' | 'planned' | 'consolidate' | 'retire';

export interface BlueprintNode {
  id: string;
  parent_id: string | null;
  depth: number;
  path: string;
  status: NodeStatus;
  existing_url: string | null;
  page_type: PageType;
  intent: 'transactional' | 'commercial' | 'solution' | 'informational';
  tier: Tier;
  cluster_id: string | null;
  head_query: string;
  support_queries: string[];
  title: string;
  meta_description: string;
  links_up: string | null;
  links_down: string[];
  links_across: string[];
  serp_verdict: Verdict | 'unchecked';
  effort_hours: number;
  priority_score: number;
  /** Present only on permuted nodes. Each entry must differ from every sibling's. */
  substance_fields?: Record<string, string>;
}

export interface Collision {
  head_query: string;
  node_ids: string[];
}

export interface Blueprint {
  version: number;
  generated_at: string;
  context_hash: string;
  model: string;
  nodes: BlueprintNode[];
  orphans: string[];
  collisions: Collision[];
}
