---
name: beat-my-competitors
description: >
  Tear down named competitors on the same tiering rules used for this site, so
  the comparison is like for like, then produce a joint content-gap table
  ranked by the tier weight of what is missing.

  Use this skill whenever the user asks to:
  - Run a competitor analysis or content gap analysis
  - Understand how their site compares to a named competitor
  - Find what a competitor covers that they do not
  - Tear down a specific competitor's site or positioning

  Trigger even for casual requests like "how do we compare to ironclad", "what
  is our competitor doing that we're not", "content gap analysis", "teardown
  lexion.com", or when a user names a rival and asks how they stack up.
---

# beat-my-competitors

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
| `config.competitors` or `strategy.json.competitors` | who to tear down | ask the user for 3 to 5 domains and stop |
| `data/state.json` | our own tier distribution, for a like-for-like comparison | run `rainmaker audit` |
| `data/citation-graph.json` | which competitor pages answer engines cite | say the comparison omits AI citation |

## Produces

`data/competitors.json`. Appends `benchmark` proof points to `strategy.json` (owner: `beat-my-competitors`) and the competitor table in `context/business.md`.

## Refuses when

No competitors are named anywhere. Ask for 3 to 5 domains and stop; do not guess competitors from search results.

## Concurrency

One agent per competitor, maximum 5. This is one of the three permitted fan-out points in the system.

## Procedure

1. Per competitor: fetch their sitemap, classify every URL into our own tier rules from `src/analyze/tiering.ts`, so the comparison is like for like rather than borrowing their own labels.
2. Count pages per tier. A competitor with 40 tier 1 pages against our 3 is the finding; their domain rating is not, and is never used.
3. Pull their tier 0 and tier 1 pages. Extract positioning language, pricing presence, proof types and named integrations, in their own words.
4. Diff `strategy.json.clusters` against their coverage. A cluster we have not built that they cover becomes a candidate with `gap: 'missing'`.
5. Where GSC data exists, mark which of our queries they also rank for.
6. Where the citation graph exists, mark which of their pages answer engines cite. A competitor page that owns the answers matters more than one that merely exists.

## Decision rules

- Never report a third-party domain authority score. The core spec forbids vendor authority metrics anywhere in scoring or reporting.
- A gap counts only when the competitor's page is tier 0, 1 or 2. Tier 3 blog volume is one summary count, never a page-by-page list.
- Every competitor claim in `context/business.md` carries the domain and the page it came from.

## Output

Per competitor: a tier distribution table, a positioning summary in their own words, and a joint gap table ranked by the tier weight of the missing cluster.

## Done when

`competitors.json` validates against its schema, every gap row has a target tier and a pain point id or an explicit `unmapped` marker, and no domain authority score appears anywhere in the output.
