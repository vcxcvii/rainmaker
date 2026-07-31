---
name: pick-my-battles
description: >
  Turn account intelligence into content clusters across seven signal types,
  not just pain points, with a balance check and a completeness gate that
  refuses a fourth simultaneous cluster while any existing one is under 40
  percent covered.

  Use this skill whenever the user asks to:
  - Build a content strategy or topic map
  - Decide what to write about next
  - Find content gaps against a competitor
  - Understand which topic clusters they should own

  Trigger even for casual requests like "what should we write about", "content
  strategy", "topic clusters", "what should we own in search".
---

# pick-my-battles

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
| `data/strategy.json` | pain points, personas, competitors as cluster signals | run `know-my-buyer` first |
| `data/snapshots/<latest>/gsc.json` | head queries and existing coverage | continue, clusters get `impressions: 0` |
| `data/competitors.json` | competitor-led and gap signals | run `beat-my-competitors` first for full coverage |
| `data/snapshots/<latest>/crawl.json` | existing URLs, so gaps are measured against reality | run `rainmaker audit` |

## Produces

`clusters` (owner). `target_tier` is shared with `follow-the-money`.

## Refuses when

Never refuses outright. With no strategy, clusters cannot cite a pain point and this skill should not run; direct the user to `know-my-buyer` first.

## Opportunity typology

Clusters come from seven signal types. A system that derives clusters only from pain points misses the fastest commercial content there is.

| Type | Signal source | Typical format |
|---|---|---|
| Competitor-led | named in interviews or in `competitors.json` | alternatives, comparison |
| Objection-led | objections in `business.md` | guide, proof, pricing explainer |
| Feature-led | capabilities that gate plans or recur in sales | feature page, integration page |
| Use-case-led | jobs customers hire the product for | use-case page |
| Vertical-led | industries named in the ICP | vertical landing page |
| Pain-led | `buyer_language` before they knew the category existed | solution article |
| Winner expansion | pages already ranking, from `gsc.json` | adjacent page in the same cluster |

## Procedure

1. One cluster per validated pain point, minimum. Pain points marked `hypothesis` produce clusters marked `gap: 'missing'`, ordered below validated ones.
2. Work through the other six signal types against `strategy.json`, `competitors.json` and `context/business.md`. Every cluster must trace to at least one pain point id or one named signal; a cluster that exists only because a keyword has volume is exactly what this skill exists to prevent.
3. For each cluster: choose a head query from GSC where an existing query matches the pain or signal language; otherwise propose one and mark `impressions: 0`.
4. Attach existing URLs from `crawl.json` by matching normalised path and title tokens. Set `gap`: `none` when a tier-appropriate page exists, `thin` when it exists under 600 words or without schema, `missing` otherwise.
5. Set `intent` from the query-intent table in `skills/_shared/revenue-tiers.md`.
6. Balance check: if any one signal type is more than half of all clusters, name the imbalance explicitly. Competitor-led content alone does not build topical authority; it trades on authority the site does not yet have.

## Decision rules

- No cluster without a pain point id or a named signal.
- **Completeness gate.** Before proposing a new cluster, check the completeness of every existing cluster per `spec/site-blueprint.md` section 8. Refuse to open a fourth simultaneous cluster while any existing one sits below 40 percent covered. Three half-covered clusters beat nothing; six quarter-covered clusters beat nothing at all.
- Where completeness cannot be computed because no SERP capture has run, say so; the gate reports "cannot evaluate" rather than silently passing or blocking.

## Output

```
## Clusters

<cluster id>: <head query>, intent <x>, target tier <n>, gap <none|thin|missing>
  Signal: <type>, <specific evidence>
  Existing: <url or "none">

Balance: <type> is <n>% of clusters (<flag if over 50%>)
Completeness gate: <passed / refused a new cluster, naming which existing cluster is under 40%>
```

## Done when

Every cluster maps to a pain point or a named signal, has an intent and a gap classification, the balance check ran, and the completeness gate either passed or named the blocking cluster.
