---
name: can-i-actually-rank
description: >
  Check whether a candidate keyword is actually winnable by reading the live
  SERP, then apply five commercial filters. Ends every candidate in QUALIFY,
  CONDITIONAL or KILL, kills freely, and never treats vendor authority scores
  as evidence.

  Use this skill whenever the user asks to:
  - Check whether they can rank for a keyword before building content
  - Qualify or kill a list of keyword candidates
  - Understand what format Google actually rewards for a query
  - Decide whether a topic is worth the effort

  Trigger even for casual requests like "can we rank for this", "check the
  SERPs for these keywords", "is this winnable", "should we bother with this
  keyword", "qualify this list".
---

# can-i-actually-rank

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
| candidate queries from `pick-my-battles` or `what-to-target-next` | what to check | ask the user for a query list |
| `data/snapshots/<latest>/serp.json` | the live SERP capture | run `rainmaker serp <query>` first for each candidate |
| `data/snapshots/<latest>/gsc.json` | our own demonstrated ceiling at similar volume | continue without the ceiling signal |
| `context/glossary.md` | category terms, for the category-match check | continue, category check assumes present |

## Produces

`keyword_plan[].verdict` (this skill), and `blueprint.nodes[].serp_verdict` once a blueprint exists.

## Refuses when

No SERP capture exists for a candidate. Say: "No SERP capture for '<query>'. Ask me to approve Firecrawl credits, then run `rainmaker serp --allow-paid \"<query>\"` and re-run this skill." Do not guess a verdict from Ahrefs-style volume data alone; the whole point of this skill is reading the actual SERP.

`rainmaker serp` spends Firecrawl credits. Ask for approval before running it.
After approval, use `rainmaker serp --allow-paid "<query>"`. Never infer approval
from an ambient `FIRECRAWL_API_KEY`.

## Procedure

1. For each candidate, load its `serp.json` capture and call the verdict engine (`src/serp/verdict.ts computeVerdict`), which is the tested, deterministic half of this skill. It returns intent consistency, category presence, the rewarded format, beatability evidence, and a verdict of QUALIFY, CONDITIONAL or KILL.
2. Read the People Also Ask and related searches from the capture when present; feed them into cluster completeness in `map-my-site`.
3. For every survivor (QUALIFY or CONDITIONAL), apply the five commercial filters, in order, against `context/business.md`:
   - **Pipeline, not traffic.** If this ranks and drives traffic, will any of those readers plausibly buy? Fail if the keyword attracts an audience the product does not serve, or the traffic signal comes from geographies the site does not sell into.
   - **ICP match.** Does the implied searcher match the ICP on two or more of role, industry, size, problem? Reference `strategy.json.icp` and `personas`.
   - **Honest product fit.** Can the product genuinely solve the implied problem without a claim it cannot honestly support? Check against "What we will not say" in `business.md`.
   - **Alignment.** Does the recommendation contradict anything the client has explicitly ruled out?
   - **Net new or overlap.** Does an existing URL already target this intent? If so, this is a refresh or consolidation, never a new page; check `blueprint.json` and `crawl.json` before proposing anything new.
4. A candidate failing any filter moves from QUALIFY or CONDITIONAL to KILL, with the failing filter named as the reason.
5. Summarise the two or three kill patterns that eliminated the most candidates. If half the pool died on "wrong category dominates the SERP", that is a positioning problem upstream of content, and it belongs in the summary, not buried in a per-row note.

## Decision rules

- Never verdict from volume and difficulty data alone. Read the actual SERP capture every time.
- Kill freely. This skill exists to reduce the candidate pool to only winnable, correctly targeted keywords; keeping marginal ones wastes briefing, writing and publishing effort on targets that will not rank or will not convert.
- "Beatable" requires the named evidence the verdict engine already computed: a lower-page-count competitor, an intent-mismatched result, this site's own demonstrated ceiling, a format gap, or stale top results. Optimism is not evidence and is never added as a sixth reason.
- A CONDITIONAL verdict always carries `condition` and `condition_resolved_by`. A condition that cannot be resolved is reclassified as KILL, not left as a permanent soft pass.
- Never cite a third-party domain authority score anywhere in this skill's reasoning or output.

## Output

```
## SERP qualification

Checked: <n>   QUALIFY: <n>   CONDITIONAL: <n>   KILL: <n>

<query>: QUALIFY
  rewarded format: <format>   evidence: <reason>, <reason>

<query>: CONDITIONAL
  condition: <text>
  resolved by: <text>

<query>: KILL
  reason: <text>

Most common kill reasons:
  <reason>: <n> candidates
```

## Done when

Every candidate has a verdict traceable to a real SERP capture, every CONDITIONAL carries both a condition and a resolution path, every KILL states which filter or which missing evidence eliminated it, and the summary names the dominant kill pattern.
