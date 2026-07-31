---
name: find-my-quick-wins
description: >
  Find the rankings closest to paying off: striking-distance queries, pages
  competing with each other, and impressions that are not converting into
  clicks. Reads Search Console snapshots the core already pulled.

  Use this skill whenever the user asks to:
  - See how their rankings are doing, or what is close to page one
  - Find quick wins or low-hanging fruit in search
  - Check whether two pages are competing for the same query
  - Understand why impressions are up but clicks are not
  - Review which queries are slipping

  Trigger even for casual requests like "what's close to ranking", "any quick
  wins", "are we cannibalising ourselves", "our traffic dropped, what
  happened", or when a user pastes a query and asks how they rank for it.
---

# find-my-quick-wins

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
| `data/snapshots/<latest>/gsc.json` | queries, positions, impressions | "No Search Console data. Run `rainmaker doctor` to see why, then `rainmaker fetch --source gsc`." |
| the previous `gsc.json` | movement needs two windows | report the current window only, and say a trend needs a second |
| `data/state.json` | tiers, so a win is framed by distance to money | run `rainmaker audit` |
| `context/glossary.md` | brand tokens, to exclude branded queries | say so: cannibalisation findings will be less reliable |

## Produces

Nothing.

## Refuses when

No Search Console data exists. Opportunity sizing without it is a flat constant, and calling that a quick win would be inventing a number.

## Procedure

1. Striking distance: queries at position 4 to 15 with 100 or more impressions in 28 days. Rank by impressions multiplied by the CTR gap to position 3, using the curve in `src/analyze/scoring.ts`.
2. Cannibalisation: only when all four hold. Non-branded query, two or more URLs each holding 5 percent of its impressions, both inside position 30, and the overlap present in two consecutive windows.
3. Clicks that are not arriving: impressions with zero clicks inside position 10 across two windows. That is a title and snippet problem, not a ranking problem, and saying so saves the wrong month of work.
4. Movement: position deltas between the two most recent snapshots, only where both windows carry 50 or more impressions.
5. Join every row to its tier. Collapse tier 3 and 4 movement into one summary line.

## Decision rules

- Never report an average position change under 1.0 as a change. Position is an average of averages, and smaller deltas are noise.
- Always 28 days. Never 30.
- Where `config.geographies` is set, filter to those markets before computing position. Otherwise say the position is blended across markets and drop confidence to 0.5.
- A striking-distance query on a tier 3 page is reported below a smaller opportunity on a tier 1 page, and the ordering is explained.

## Output

Report spine. Section 3 lists each opportunity as: query, URL, tier, current position, impressions, estimated click gap. The cannibalisation table names the URL to keep and the ones to consolidate into it, never just the pair.

## Done when

Every recommendation names one winning URL and one query. Nothing says "improve the content" without naming the query, the position and the gap.
