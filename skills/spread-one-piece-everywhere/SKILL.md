---
name: spread-one-piece-everywhere
description: >
  Repurpose a proven page into two derivative formats, bounded so it never
  becomes a content treadmill: only pages that are live, indexed, past their
  verification window, and inside a cluster above 40 percent completeness.

  Use this skill whenever the user asks to:
  - Repurpose a post into video, social, or a newsletter
  - Get more distribution out of an existing page
  - Turn one piece of content into several formats

  Trigger even for casual requests like "repurpose this", "turn this into a
  video", "get more mileage out of this post", "distribute this piece
  further".
---

# spread-one-piece-everywhere

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
| `data/ledger.jsonl` | whether the source page is past its verification window | run `rainmaker ledger --rebuild` |
| `data/blueprint.json` | the source page's cluster and its completeness | run `map-my-site` |
| `data/snapshots/<latest>/gsc.json` | confirms the page is indexed and getting impressions | run `rainmaker audit` |

## Produces

Derivative drafts (video script, social breakdown, newsletter section, etc.), plus an entry in `data/citation-graph.json` under `our_presence` for each.

## Refuses when

- The source page is not yet live and indexed, per `gsc.json`.
- The source page is still inside its own verification window from `src/ledger/types.ts VERIFICATION_WINDOWS`. Repurposing an unproven page multiplies a guess rather than amplifying a result.
- The page's cluster is below 40 percent completeness. Repurposing effort belongs where authority is already being built, not where the cluster itself is still a spot hit.

## Procedure

1. Confirm all three gates above pass; if not, name which one failed and the date it will clear.
2. Pick exactly two derivative formats, not more, from: a community answer, a short video with transcript, a newsletter section, a social breakdown, a slide or graphic asset, a podcast talking point.
3. Every derivative links back to the canonical blueprint node.
4. Video and audio derivatives require a transcript on the canonical page; an untranscribed video is invisible to both search and answer engines.
5. Record each derivative in `data/citation-graph.json` under `our_presence`.

## Decision rules

- Two formats per source page, never six. A repurposing plan that touches every format every time is a treadmill, not a strategy.
- No derivative of a page still inside its verification window.
- No derivative of a page in a cluster below 40 percent completeness.

## Output

```
## Repurposing: <source url>

Gates: live+indexed <yes/no>, past verification window <yes, cleared <date> / no, clears <date>>, cluster completeness <n>% (<pass/fail>)

Chosen formats: <format 1>, <format 2>
  <format 1>: <draft or outline>, links to <canonical url>
  <format 2>: <draft or outline>, links to <canonical url>

Transcript required: <yes, attached / no>
```

## Done when

All three gates are confirmed rather than assumed, exactly two formats were produced, each links back to the canonical page, and any video or audio derivative has a transcript on that page.
