---
name: brief-my-writer
description: >
  Turn one blueprint node into a complete content brief: the revenue argument,
  the buyer's own words that must appear, the proof to cite, the internal
  links, the schema, and what the piece will not say. Refuses to brief a node
  whose SERP has never been checked.

  Use this skill whenever the user asks to:
  - Write a content brief for a page or topic
  - Spec out an article before writing it
  - Turn a keyword or cluster into something a writer can execute against

  Trigger even for casual requests like "write a brief for this", "brief for
  <topic>", "spec this article", "what should this page cover".
---

# brief-my-writer

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
| `data/blueprint.json` node | parent, cluster, tier, SERP verdict | run `map-my-site` first |
| `data/strategy.json` | pain points, proof, buyer language | run `know-my-buyer` first |
| `context/voice.md` | tone the brief must specify for the writer | required, see context load |
| `data/snapshots/<latest>/crawl.json` | candidate internal link sources | run `rainmaker audit` |

## Produces

`briefs/<slug>.md`.

## Concurrency

Batch mode fans out one agent per brief, maximum 5. This is one of the three permitted fan-out points in the system.

## Refuses when

The target node's `serp_verdict` is `unchecked`, `KILL`, or `CONDITIONAL` with no recorded resolution. Call `src/blueprint/gates.ts canBrief(node)` and print its `reason` verbatim rather than re-deriving the same judgment by eye.

## Procedure

1. Confirm `canBrief(node)` allows it. If not, stop and print the reason, naming the exact command that unblocks it (`rainmaker serp`, then `can-i-actually-rank`).
2. State the node id, its parent path, its cluster and pain point ids, its tier, and the revenue argument in one sentence: why this page's tier and score justify the effort.
3. State the target query, current position if any, and the format the SERP capture says Google rewards, with the competing URLs.
4. Pull the buyer's own words from `strategy.json.pain_points[].buyer_language` that must appear in the piece, quoted exactly.
5. Cite proof ids with their source URLs. A brief citing no proof fails preflight; do not write one anyway and hope the writer finds proof later.
6. Name 3 or more internal link sources from `crawl.json`, matched to the node's `links_up` and `links_across` in the blueprint, with the target URL each should link from.
7. State the chosen schema type, the named author and their first-hand evidence, and 3 to 7 standalone claim sentences for extractability.
8. Copy the "What we will not say" section relevant to this topic from `business.md` verbatim.

## Decision rules

- Never brief a node the gate refused. There is no override; a node without a resolved verdict gets a resolved verdict before it gets a brief.
- A brief with zero proof ids is incomplete, not lenient. Say so and stop rather than shipping it.
- Internal links must be real URLs from `crawl.json` or real planned nodes from `blueprint.json`, never invented paths.

## Output

```
## Brief: <node.path>

Cluster: <id>   Pain points: <ids>   Tier: <n>   Revenue argument: <one sentence>
Target query: <q>   Current position: <n or "none">   Rewarded format: <format>
Competing: <url>, <url>

Must include, verbatim: "<buyer language>"
Proof to cite: <id>: <claim> (<source url>)
Internal links: from <url> to this page, from <url> to this page, from <url> to this page
Schema: <type>   Author: <name>, <first-hand evidence>
Standalone claims: <sentence>, <sentence>, <sentence>
Will not say: <text from business.md>
```

## Done when

`canBrief` passed or the skill stopped with its reason, the brief cites 3 or more internal link sources, at least one proof id, and the exact buyer-language quotes to include.
