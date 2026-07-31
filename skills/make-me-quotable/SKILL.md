---
name: make-me-quotable
description: >
  Generate llms.txt and JSON-LD schema from real, sourced facts only, output
  as a diff against what already exists, and flag schema types competitors
  use in cited pages that this site is missing.

  Use this skill whenever the user asks to:
  - Set up llms.txt
  - Add or audit structured data / schema markup
  - Make their site more readable to AI assistants
  - Improve extractability for answer engines

  Trigger even for casual requests like "add llms.txt", "make my site AI
  readable", "add schema markup", "get quoted by AI more".
---

# make-me-quotable

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
| `data/snapshots/<latest>/crawl.json` | current schema coverage per page | run `rainmaker audit` |
| `context/business.md` | real facts for llms.txt descriptions, never invented | required |
| `data/competitors.json` | schema types competitors use on cited pages | run `beat-my-competitors` for full coverage |
| `data/citation-graph.json` | which competitor pages are actually cited | optional, sharpens the gap |

## Produces

`llms.txt`, JSON-LD blocks, both as diffs against what exists.

## Procedure

1. Generate `llms.txt` listing tier 0 and tier 1 URLs, with one-line descriptions taken from `context/business.md`. Never invent a description; where `business.md` has nothing to say about a page, list the URL with the shortest true statement available (its title) rather than a fabricated summary.
2. Generate JSON-LD per page type, filling only fields with a real source in the crawl or the context. Never fabricate ratings, prices, or review counts; a missing field is omitted, not guessed.
3. Output as a diff against what already exists on the page, so the user sees exactly what changes rather than a wholesale replacement they must diff themselves.
4. Add extractability fixes surfaced by `get-mentioned-by-ai`: standalone claim sentences, a direct answer within the first 100 words of any question-shaped page, and tables for comparison content, since answer engines quote tables disproportionately.
5. Flag any schema type present across competitors' cited pages (from `citation-graph.json` where available, otherwise `competitors.json`) and absent from this site's own tier 0 and 1 pages.

## Decision rules

- Every generated field traces to a real value. A field with no source is omitted, never fabricated.
- Output is always a diff, never a wholesale file replacement, so a reviewer can see precisely what changed.
- `llms.txt` covers tier 0 and 1 only; do not pad it with every URL on the site.

## Output

```
## llms.txt diff
+ <url>: <one-line description, sourced from business.md>

## Schema diff, <url>
+ "@type": "<Type>"
+ "<field>": "<value>"   (source: <file>, real value)

## Competitor schema gap
<type> present on <competitor cited page>, absent on our tier <n> pages
```

## Done when

Every generated field traces to a real value, the output is a diff, and any competitor schema gap names the specific competitor page it came from.
