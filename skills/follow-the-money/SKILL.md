---
name: follow-the-money
description: >
  Show where effort has actually gone versus where money is actually made, by
  comparing the share of pages, sessions and key events per tier, and assign
  every cluster the tier its content should occupy.

  Use this skill whenever the user asks to:
  - Understand what actually makes money on their site
  - Find out which pages matter versus which just exist
  - Rebalance where content effort goes
  - Check whether their declared conversion pages actually convert

  Trigger even for casual requests like "what actually makes money here",
  "where should we focus", "we have 400 blog posts, are they doing anything",
  "is our pricing page actually converting".
---

# follow-the-money

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
| `data/snapshots/<latest>/diagnosis.json` | tier distribution across all pages | run `rainmaker audit` |
| `data/snapshots/<latest>/ga4.json` | sessions and key events per tier | continue at confidence 0.5, ranking on sessions only |
| `data/state.json` | which findings are open, so this is grounded in current state | run `rainmaker audit` |

## Produces

`clusters[].target_tier` (shared owner with `pick-my-battles`), the revenue narrative section of `context/business.md`.

## Refuses when

Never refuses outright; degrades. With `key_events_configured` empty, state so in the confidence section, skip every step depending on key events, and rank on sessions with confidence 0.5.

## Procedure

1. Build the tier distribution table from `state.json`: how many pages sit in each tier.
2. Join sessions and key events per tier from `ga4.json`.
3. Compute, per tier: share of pages, share of sessions, share of key events. The gap between those three shares is the entire point of this skill.
4. State the imbalance in one sentence with numbers: for example, "Tier 3 is 78 percent of pages and 6 percent of key events."
5. Map every URL in `config.primary_conversion` to its measured key events. A declared conversion page with zero key events over the window is the single highest-value finding available here, and it is reported first, above any tier-distribution commentary.
6. Assign each cluster in `strategy.json.clusters` a `target_tier`: the tier its content should occupy, which is often not the tier its existing pages currently sit in.

## Decision rules

- Never assert the imbalance is a mistake. State the numbers and let the reader draw the conclusion; a 78/6 split might be a deliberate content-marketing strategy with a long payback, and this skill's job is to make the tradeoff visible, not to declare it wrong.
- A zero-key-event declared conversion page is only reported as a finding when `key_events_configured` is non-empty and the page carries no outbound link to a host in `config.offsite_conversion_hosts`. Otherwise it is unmeasured, not broken, per `spec/false-positives.md` section 3.5.
- `target_tier` on a cluster may also be set by `pick-my-battles`; where the two disagree, the more recent write wins and a `decisions` entry must explain why.

## Output

```
## Revenue map

Tier 0: <n>% of pages, <n>% of sessions, <n>% of key events
Tier 1: ...
...

Declared conversion pages with zero measured key events:
  <url>: 0 key events over <window>d (ga4.json, confidence <c>)

Cluster tier reassignments:
  <cluster id>: currently tier <n>, should be tier <n>, because <reason>
```

## Done when

The output states, in one sentence with numbers, where effort has gone and where money is made, every cluster has a `target_tier`, and the confidence section states plainly whether key events were configured.
