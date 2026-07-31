---
name: say-it-their-way
description: >
  Diff the site's messaging against the vocabulary buyers actually use in
  search and in their own words, then rewrite the one-liner and
  differentiators using only vocabulary that is actually attested.

  Use this skill whenever the user asks to:
  - Sharpen their messaging or positioning
  - Rewrite their one-liner or homepage headline
  - Check whether their copy sounds like their buyers or like their category
  - Update pain points after new interviews or search data

  Trigger even for casual requests like "our copy feels generic", "sharpen
  our messaging", "rewrite our one-liner", "does this sound like a buyer
  wrote it or like a vendor did".
---

# say-it-their-way

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
| `data/strategy.json` with at least one pain point | the vocabulary to diff against | run `know-my-buyer` first |
| `data/snapshots/<latest>/gsc.json` | the top 100 non-branded queries | continue, note that drift cannot be measured |
| `data/snapshots/<latest>/ga4.json` | which queries actually convert | optional |
| `data/citation-graph.json` | vocabulary answer engines already use about the category | optional, often ahead of the site's own language |

## Produces

`messaging` (owner), `pain_points[].buyer_language` and `pain_points[].status` (shared owner with `know-my-buyer` and `what-actually-worked`), and matching prose in `context/business.md`.

## Refuses when

`strategy.json` has zero pain points. There is nothing to diff against; run `know-my-buyer` first.

## Procedure

1. Pull the top 100 non-branded GSC queries by impressions, using `context/glossary.md` brand tokens to exclude branded ones. Extract the recurring noun phrases.
2. Where `citation-graph.json` exists, add the phrasing answer engines use about the category, since it is often ahead of the site's own vocabulary.
3. Diff that vocabulary against `pain_points[].buyer_language` and `messaging`. Report the share of high-impression query language that appears nowhere in the strategy.
4. Where a phrase appears in search but not in the strategy, propose it as a `buyer_language` addition, with the query and impression count as evidence.
5. Where a strategy phrase appears in no query and on no converting page, demote the pain point from `validated` to `hypothesis`, with a `decisions` entry naming why.
6. Rewrite the one-liner and differentiators using only vocabulary present in `buyer_language` or the top queries. Show the before and after, and name which phrase came from where.

## Decision rules

- Never introduce a claim absent from `proof`. If the sharpest positioning needs a claim with no source, say so and add it to "Open questions" in `business.md` rather than writing it anyway.
- 40 percent is the drift threshold from `spec/site-blueprint.md` section 8 and the core spec's drift-detection rule: if 40 percent or more of converting query language is absent from the strategy, recommend re-running `know-my-buyer`.
- Only this skill and `know-my-buyer` may write `buyer_language`; only this skill and `what-actually-worked` may write `pain_points[].status`. Writing anything else in `pain_points` is out of scope for this skill.

## Output

```
## Messaging audit

Vocabulary coverage: <n>% of top-100 query language is attested in strategy.json
Drift: <fired / not fired>, threshold 40%

### Proposed additions
<phrase>: <query>, <impressions> impressions, 28d: add to pain_points.<id>.buyer_language

### Rewritten one-liner
Before: <text>
After:  <text>: <which phrase came from where>
```

## Done when

Every proposed phrase carries its source query and impression count, no claim in the rewrite lacks a proof id, and the drift recommendation fires or explicitly does not with the measured percentage shown.
