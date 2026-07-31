---
name: stop-losing-visitors
description: >
  Find where arriving traffic leaks before it converts, using behavioural data
  the core already pulled, and rank the leaks by how close the page sits to
  revenue rather than by how dramatic the metric looks.

  Use this skill whenever the user asks to:
  - Understand why visitors leave, bounce or drop off
  - Investigate rage clicks, dead clicks or scroll depth
  - Find conversion leaks on pages that already get traffic
  - Work out whether a page has a traffic problem or a page problem

  Trigger even for casual requests like "why do people leave my pricing page",
  "we get traffic but no demos", "is my page broken for real users", or when a
  user shares a page and asks why it is not converting.
---

# stop-losing-visitors

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
| `data/snapshots/<latest>/clarity.json` | behavioural metrics | "No Clarity data. Set CLARITY_TOKEN, then `rainmaker fetch --source clarity`." |
| `data/snapshots/<latest>/ga4.json` | sessions and key events | say which conclusions are unavailable without it |
| `data/snapshots/<latest>/crawl.json` | forms, CTAs and word count, so a finding names a probable cause | run `rainmaker audit` |

## Produces

Nothing.

## Refuses when

Clarity data is absent, or the page has under 100 sessions in the window. Below that there is no distribution to compare against, and every percentage moves several points on a single visitor.

## Procedure

1. Rank pages by sessions multiplied by tier weight. Take the top 20.
2. For each, pull engagement rate, rage clicks per 1000 sessions, dead clicks per 1000, scroll depth and exit rate.
3. Flag a leak when a tier 0 or 1 page sits in the worst quartile on two or more of those five, measured against this site's own distribution and never against an industry benchmark.
4. Join to `crawl.json` so the finding names a probable cause: no form, one CTA below the fold, 4,000 words on a page meant to convert.
5. Report the affected session count beside every leak, so the reader can size it.

## Decision rules

- Minimum 100 sessions. Below that, report "insufficient sample" and nothing else.
- Never assert that a UX metric caused a revenue outcome. State the tier, the leak, and the traffic affected.
- A high exit rate on a tier 4 page is not a leak. Some pages are meant to be the end.

## Output

Report spine. Each flagged page names two failing metrics, its own site percentile for each, the session count, and the probable cause from the crawl.

## Done when

Every flagged page carries two measured failures, its percentile within this site, and a cause a developer can go and look at.
