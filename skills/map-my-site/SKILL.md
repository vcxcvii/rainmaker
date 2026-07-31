---
name: map-my-site
description: >
  Turn the keyword plan into the whole intended site as a tree: one intent per
  URL, a parent for every node, titles and metas generated as a consistent
  set, permutations gated against doorway-page risk, and a publish rate
  bounded by what the site has demonstrated it can get indexed.

  Use this skill whenever the user asks to:
  - Plan their site structure or URL architecture
  - Decide how to organise services, locations, or product pages
  - Check whether their site is scaling permutations safely
  - Understand how many pages they can realistically publish per month

  Trigger even for casual requests like "site structure", "how should we
  organise the site", "map my site", "should each city get its own page", "how
  many pages can we publish a month".
---

# map-my-site

## Context load

Run `rainmaker context --check` first. It prints what exists, what is stale, and exits 1 if anything this skill requires is missing.

Then read, in this order:

1. `context/business.md` in full. If absent, stop: "No business context. Run `rainmaker audit`, then the `know-my-buyer` skill."
2. `context/voice.md` if this skill writes prose. If absent, stop and say so.
3. `context/glossary.md` if this skill names products, features or competitors.
4. `data/strategy.json` if this skill reads or writes strategy.
5. Only the `data/` files listed in this skill's Consumes table. Never crawl or call an API the core already covers.

If `strategy.json.context_hash` does not match the current hash of `context/business.md`, say exactly:

"Business context was edited after the strategy was written. Re-run `know-my-buyer`, or run `rainmaker context --sync` to accept the prose as authoritative."

Then stop.

If `context/business.md` carries `confidence: stub`, continue, and stamp every output with: "Built on a stub context. Nothing in it came from a buyer. Run `know-my-buyer` to replace it."

## Consumes

| File | Why | If missing |
|---|---|---|
| `data/strategy.json` keyword_plan and clusters | what the tree is built from | run `what-to-target-next` first |
| `data/snapshots/<latest>/crawl.json` | existing pages, matched before planning new ones | run `rainmaker audit` |
| SERP verdicts from `can-i-actually-rank` | page type follows what actually ranks | unchecked nodes are written but flagged, never briefed |
| `config.revenue_model` | selects the spine and permutation axis | required in `rainmaker.config.yml` |

## Produces

`data/blueprint.json` via `rainmaker blueprint --build`, monthly cohorts via `rainmaker blueprint --tree`.

## Refuses when

No keyword plan exists yet, or `config.revenue_model` is unset. Both are required to select a spine; run `what-to-target-next` and check `rainmaker.config.yml` first.

## Procedure

1. Run `rainmaker blueprint --build`. This assembles nodes from `keyword_plan` and `clusters`, matches each against `crawl.json` by normalised path (setting `status: live` on a match), and runs collision detection deterministically in code. Do not re-derive collisions by hand, and never allow two nodes to share a head query.
2. Select the spine and permutation axis for `config.revenue_model` from `spec/site-blueprint.md` section 5: `sales-led` roots in solutions and comparisons, `local-services` roots in services and areas, `ecommerce` in categories and collections, and so on.
3. For every candidate permutation (`[service] in [area]`, `[product] for [industry]`), check all four gates before it becomes its own URL: measured demand, three or more substance fields that genuinely differ from every sibling, a proof point specific to the permutation, and remaining capacity inside the authority budget. Use `src/blueprint/permutation.ts checkPermutation`, which enforces the substance comparison byte for byte; do not eyeball it. A node failing any gate becomes a section on its parent, never its own URL.
4. Assign a parent to every node. A category node needs 3 or more children to exist as its own page; fewer, and the children attach directly to the grandparent.
5. Enforce the depth ceiling: no tier 0, 1 or 2 node sits deeper than 3 clicks from the root.
6. Generate titles (60 chars) and meta descriptions (155 chars) for the whole node set together, so duplicates are caught across the set rather than per page.
7. Run `rainmaker blueprint --tree` to print the tree, the collision list, the authority budget (derived from the site's own measured indexation rate, never assumed), and the monthly cohorts.
8. Report how many permutations were refused and why. A blueprint that produces many nodes and refuses none is a defect: it means the gates were not actually applied.

## Decision rules

- One intent, one node, one URL, enforced by `detectCollisions`, not by judgment.
- No node of tier 0, 1 or 2 below depth 3.
- No permuted node without all four gates passing.
- No cohort exceeding the authority budget from `src/blueprint/budget.ts`, which is itself clamped to the floor whenever the site has published at volume with a low indexed rate, so past failure never earns a bigger budget.

## Output

The tree, then the cohorts, then the refusal counts:

```
/                                        home        tier 0  live
├── /services/                           category    tier 1  planned
│   └── /services/lobby-displays/        service     tier 1  live

Nodes: <n> planned, <n> live
Permutations refused: <n> (<reason breakdown>)
Collisions: <n>
Authority budget: <n> pages per month (indexed_rate <x>, published_last_90d <n>)
Cohort 1: <node ids>
```

## Done when

Collision detection ran and is reported, every permuted node passed all four gates or was demoted to a section, no tier 0-2 node sits below depth 3, and cohorts respect the computed authority budget.
