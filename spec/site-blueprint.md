# Rainmaker: Site Blueprint

**Status:** normative, v3. New module. Nothing in v1 or v2 covers it.

---

## 1. Why this exists

A keyword plan is a list. A site is a structure. The gap between them is where most SEO programs quietly fail: pages get published one at a time into a flat blog, each competing with the last, none of them adding up to authority on anything.

The blueprint is the missing artifact. It is the whole intended site, as a tree, before anything is written: every node carries its intent, its target query, its URL path, its parent, its tier, its title, its meta description, and its internal links. Publishing then becomes filling in a structure that was designed to cohere, rather than accreting pages and hoping.

This is also what makes the system work for businesses that are not B2B SaaS. A local service business ranking across 40 service-and-area permutations, an ecommerce catalogue, a marketplace with two-sided supply and demand pages: all of them are structure problems first and content problems second.

## 2. The artifact

`data/blueprint.json`. Written by `map-my-site`. Read by `brief-my-writer`, `write-the-page`, `check-before-i-publish`, and the internal-link checks in `src/`.

```ts
export interface Blueprint {
  version: number;
  generated_at: string;
  context_hash: string;              // ties to context/business.md, per spec/context-layer.md
  model: BusinessModel;              // see section 5
  nodes: BlueprintNode[];
  orphans: string[];                 // existing crawl URLs that fit no node
  collisions: Collision[];           // two nodes competing for one intent
}

export interface BlueprintNode {
  id: string;                        // n1, n2, ...
  parent_id: string | null;          // null only for the root
  depth: number;                     // root = 0. Hard ceiling of 3 for any node with a tier under 3.
  path: string;                      // /best-ice-cream-in-austin/cones/
  status: 'live' | 'planned' | 'consolidate' | 'retire';
  existing_url: string | null;       // matched from crawl.json when status is live
  page_type: PageType;
  intent: 'transactional' | 'commercial' | 'solution' | 'informational';
  tier: 0 | 1 | 2 | 3 | 4;
  cluster_id: string | null;         // from strategy.json
  head_query: string;
  support_queries: string[];
  title: string;                     // <= 60 chars, see section 6
  meta_description: string;          // <= 155 chars
  h1: string;
  links_up: string;                  // parent path. Always present except at root.
  links_down: string[];              // child paths
  links_across: string[];            // sibling or cross-cluster paths, 2 to 5
  serp_verdict: 'QUALIFY' | 'CONDITIONAL' | 'KILL' | 'unchecked';
  effort_hours: number;
  priority_score: number;            // from src/analyze/scoring.ts, never from a skill
}

export type PageType =
  | 'home' | 'category' | 'product' | 'service' | 'location'
  | 'comparison' | 'alternatives' | 'pricing' | 'use-case'
  | 'integration' | 'guide' | 'glossary' | 'article' | 'proof';
```

## 3. Construction rules

1. **One intent, one node, one URL.** Two nodes may not share a head query. A collision is recorded in `collisions` and must be resolved by merging or by re-pointing one node at a distinct intent. This is cannibalisation prevented at design time rather than diagnosed after publication.
2. **Every node has a parent.** A node with no parent other than the root is a flat-blog page pretending to be a strategy. If no parent exists, create the missing category node rather than orphaning the child.
3. **Depth ceiling.** No node of tier 0, 1 or 2 sits deeper than 3 clicks from the root. Money pages buried at depth 5 do not get crawled often or ranked well.
4. **Parents earn their children.** A category node must have 3 or more children to exist. Fewer, and the children attach directly to the grandparent. This prevents the thin hub pages that permutation spreadsheets produce by the hundred.
5. **Structure follows the SERP, not the org chart.** Page type comes from what actually ranks for the head query, per the `can-i-actually-rank` verdict. If the SERP rewards a comparison page and the blueprint says category page, the SERP wins.
6. **Existing pages are matched before new ones are planned.** Every node is matched against `crawl.json` by normalised path, then by title token overlap, then by head-query ranking in `gsc.json`. A node with a match is `live`. Planning a new URL when a live one already targets that intent is how sites cannibalise themselves.

## 4. The permutation guard

Permutation is the strongest and the most dangerous pattern in the blueprint. `[service] in [area]`, `[product] for [industry]`, `[feature] for [role]`: the ice-cream-shop spreadsheet is exactly this, and it is how local and vertical businesses genuinely win. It is also how sites get classified as doorway pages and lose everything at once.

A permuted node is only legal when all four hold:

| Gate | Requirement |
|---|---|
| Demand | The permuted query has measured impressions in `gsc.json`, or a SERP with a locally distinct top 3 |
| Substance | At least 3 facts on the page differ from every sibling: a named location, price, staff member, case, photo set, delivery window, regulation, or integration |
| Proof | At least one proof id from `strategy.json` that applies specifically to this permutation |
| Capacity | The publish rate stays inside the authority budget in section 7 |

A permuted node failing any gate becomes a section on its parent, never its own URL. `map-my-site` reports how many permutations it refused and why. A blueprint that produces 300 nodes and refuses none is a defect.

## 5. Business models

The tree shape is not universal. The model comes from `config.revenue_model` and selects the spine.

| Model | Root spine | Tier 0 nodes | Permutation axis |
|---|---|---|---|
| `sales-led` | solutions, product, comparisons, proof | demo, pricing, contact | industry, role, use case |
| `plg` / `self-serve` | product, use cases, integrations, docs | signup, pricing, templates | integration, job to be done |
| `local-services` | services, areas, proof | book, quote, call | service by area |
| `ecommerce` | categories, collections, products | cart, product pages | attribute, occasion, compatibility |
| `marketplace` | supply side, demand side, categories | list, browse, join | category by geography |
| `media` / `newsletter` | topics, archives, about | subscribe, sponsor | topic by format |
| `consulting` | services, results, method | contact, book | service by vertical |

`local-services`, `ecommerce` and `marketplace` are additions to `REVENUE_MODELS` in `src/config/schema.ts`. The tier rules in the core spec are unchanged; only the spine and the permutation axis change.

## 6. Titles and meta descriptions

Generated per node, at blueprint time, not at writing time, so the whole set is internally consistent and free of duplicates.

- Title: 60 characters or fewer. Head query first, brand last, separator ` | `. No two titles in the blueprint may be identical, and no two may differ only by a permutation token when the pages sit in different clusters.
- Meta description: 155 characters or fewer. Must contain the head query once, one concrete differentiating fact from the node's substance gate, and one action. No superlatives without a proof id.
- Both are proposals with provenance. `check-before-i-publish` fails a page whose live title differs from the blueprint without a recorded decision.

## 7. Authority budget

The rule nobody in the reference material has, and the one that makes ranking durable rather than a spike.

A site can only earn coverage as fast as it has demonstrated it can. Measure the site's own last 90 days from `gsc.json` and `crawl.json`:

```
indexed_rate     = new URLs that gained 1+ impression within 30 days of first crawl
                   / new URLs published in that window
ranked_rate      = new URLs reaching position <= 20 within 90 days
                   / new URLs published in that window
```

The monthly publish budget is:

```
budget = max(4, round(published_last_90d / 3 * clamp(indexed_rate * 2, 0.5, 1.5)))
```

`map-my-site` sequences the blueprint into monthly cohorts inside that budget, tier 0 and 1 nodes first. Exceeding the budget is permitted only when the user overrides explicitly, and the override is recorded in `DECISIONS.md` with the measured rates at the time.

A new site with no history starts at 4 pages per month and re-measures after the first cohort. The point is not caution for its own sake. Publishing 200 pages into a site that has demonstrated it can get 6 indexed produces 194 pages of crawl waste and a diluted internal link graph.

## 8. Topical completeness

Ranking sustainably for a cluster means covering it, not spot-hitting it.

For each cluster, derive the expected subtopic set from three sources: the H2 structure of the top 3 ranking pages for the head query, the People Also Ask and related searches captured during SERP qualification, and the support queries in `gsc.json`. Completeness is the share of that set covered by blueprint nodes with `status: live`.

- Below 40 percent: the cluster is a spot hit. New pages inside it outrank new clusters in priority.
- 40 to 80 percent: fill remaining subtopics before starting a new cluster.
- Above 80 percent: the cluster is defensible. Move to depth on the money nodes, then start the next cluster.

`pick-my-battles` reports completeness per cluster and refuses to open a fourth simultaneous cluster while any existing cluster sits below 40 percent. Three half-covered clusters beat nothing; six quarter-covered clusters beat nothing at all.

## 9. Output the user sees

`map-my-site` prints the tree, then the cohorts:

```
/                                        home        tier 0  live
├── /commercial-real-estate-signage/     category    tier 1  planned   c3   n7
│   ├── /lobby-directory-displays/       use-case    tier 1  live      c3   n8
│   └── /tenant-wayfinding-screens/      use-case    tier 2  planned   c3   n9
└── /vs/                                 category    tier 1  live
    └── /vs/screencloud/                 comparison  tier 1  planned   c1   n4

Nodes: 34 planned, 12 live, 3 consolidate, 2 retire
Permutations refused: 18 (11 no demand, 7 no substance)
Collisions resolved: 2
Authority budget: 6 pages per month (indexed_rate 0.71, published_last_90d 19)
Cohort 1 (Aug): n4, n7, n8, n12, n15, n21
```

Every planned node then has everything a brief needs, and every brief inherits a parent, a set of internal links, and a title that was checked against the whole set rather than invented in isolation.
