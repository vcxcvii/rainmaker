---
name: what-to-target-next
description: >
  Turn qualified clusters into a specific keyword plan, slotted as new,
  refresh, consolidate or kill, capped at the site's own authority budget.

  Use this skill whenever the user asks to:
  - Build a keyword plan or content calendar
  - Decide which specific queries to target next
  - Understand whether a page needs a refresh or a rewrite

  Trigger even for casual requests like "keyword plan", "what should I target
  next", "which queries should we go after", "plan next month's content".
---

# what-to-target-next

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
| `data/strategy.json` clusters, with SERP verdicts from `can-i-actually-rank` | what to slot | run `pick-my-battles` then `can-i-actually-rank` first |
| `data/snapshots/<latest>/gsc.json` | positions and impressions per candidate | continue at reduced confidence |
| `data/snapshots/<latest>/crawl.json` | which URLs already exist, for slot classification | run `rainmaker audit` |
| `data/blueprint.json` | the site's own authority budget, if a blueprint exists | continue without a cap, and say so |

## Produces

`keyword_plan` (owner). `slot` is shared with `revive-old-pages`.

## Refuses when

A candidate has no SERP verdict at all (`unchecked`). Only QUALIFY and CONDITIONAL candidates from `can-i-actually-rank` may enter the plan; an unchecked or KILLed candidate is excluded, not silently downgraded.

## Procedure

1. For every cluster, take GSC queries whose text overlaps the head or support queries, plus any striking-distance queries from `find-my-quick-wins` mapped to that cluster.
2. Assign a slot:
   - `refresh` when a tier-appropriate URL exists and ranks 4 to 20.
   - `consolidate` when 2 or more URLs compete on the query, per the same overlap rule `find-my-quick-wins` and `revive-old-pages` use.
   - `new` when no URL exists.
   - `kill` when a URL exists, ranks beyond 50, has zero clicks in two consecutive windows, and its tier is 3 or 4.
3. `priority_score` comes from `src/analyze/scoring.ts` via the CLI; never invent it here.
4. Cap the plan at the site's authority budget from `data/blueprint.json` if one exists. A plan nobody can execute is not a plan.
5. State how many candidates were dropped for exceeding the cap, and the score of the highest dropped item, so the cutoff is visible rather than silent.

## Decision rules

- Only QUALIFY and CONDITIONAL verdicts enter the plan.
- Never assign `priority_score` by judgment; it is always the score the CLI computed.
- A `kill` slot always proposes a redirect target, matching `revive-old-pages`'s rule that a kill without a redirect is a broken link.

## Output

```
## Keyword plan

<query>: cluster <id>, slot <new|refresh|consolidate|kill>, score <x>
  target: <url or "none">

Capped at <n> slots (authority budget). Dropped <n>, highest dropped score <x>.
```

## Done when

Every slot has a cluster id, a slot type and a CLI-sourced priority score, the plan respects the authority budget when one exists, and every `kill` slot names a redirect target.
