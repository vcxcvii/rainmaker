---
name: explain-this-number
description: >
  Explain what a search, analytics or AI-visibility metric actually means, how
  it is commonly misread, and what to say instead. Reference only: it decides
  nothing and writes nothing, and every other Rainmaker skill cites it rather
  than restating a definition.

  Use this skill whenever the user asks to:
  - Understand what a metric means: sessions, impressions, average position, INP, key events
  - Work out why two tools disagree, most often GA4 against Search Console
  - Check whether a number in a report is being read correctly
  - Sanity-check a claim someone made using a metric
  - Understand an AI-search term: citation, extractability, entity, llms.txt

  Trigger even for casual requests like "what does average position actually
  mean", "why doesn't GA4 match Search Console", "is domain authority real",
  "what's INP", "our CTR dropped, is that bad", or when a user pastes a number
  from a dashboard and asks whether it is good.
---

# Explain this number

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

**This skill is the one exception to the stop rules above.** A user asking what a metric means is entitled to an answer whether or not a context exists. Skip straight to the procedure, and mention the missing context only if the question is about their own numbers rather than about the metric.

## Consumes

| File | Why | If missing |
|---|---|---|
| `skills/_shared/metric-definitions.md` | the canonical definitions | this skill cannot run; the file is part of the package |
| `data/snapshots/<latest>/*.json` | only when the user asks about their own number | answer the general question and say the site data is absent |

## Produces

Nothing. This skill decides nothing and writes nothing. It exists so that no
other skill has to carry a definition, and so that every number in every report
traces back to one agreed meaning.

## Procedure

1. Identify which term is actually in play. Users often name a different metric from the one they are looking at: "traffic" might be sessions, users, clicks or impressions, and the answer differs for each.
2. Read the entry in `skills/_shared/metric-definitions.md`. Give all three parts: what it is, how it is usually misread, and what to say instead. The second part is usually the one they needed.
3. If the question is about the user's own number, read the relevant snapshot and quote the actual value with full provenance per `skills/_shared/evidence-rules.md`. Never invent an illustrative figure when a real one is available.
4. If two tools disagree, name the structural reason rather than calling it a bug. Most disagreements are definitional: different identity models, different windows, different attribution, different sampling, or bot filtering applied at different points.
5. If the term is missing from the definitions file, say so, answer carefully from first principles, and flag that the file needs the term added. Do not quietly invent an entry.

## Decision rules

- Never say a number is good or bad without its comparison basis. Good against what: the site's own prior window, the CTR curve at that position, or the threshold published by the tool.
- Never compare a metric across tools without naming the definitional gap first.
- Never quote a vendor authority score as an input to ranking. Say what it is: a third-party prediction.
- Where a metric is an average of averages, say so before anything else. Average position is the common case and the most consequential.

## Output

Short. Three parts, then the user's actual number if there is one.

```
Average position is the average rank of your URL for that query across every
impression in the window, blended across devices and countries.

Commonly misread as a rank. A page sitting at 3 in the UK and 30 in the US
reports around 16, a position it has never actually held.

Say instead: "average position 16, blended across markets", and filter by
market before drawing any conclusion.

Yours: /pricing averages 8.4 for "clm pricing" (gsc.json, 28d to 2026-08-09,
confidence 0.7). You sell into the UK and the US, and those two markets are
not separated in that number.
```

## Done when

The user knows what the metric measures, the most likely way they were about to
misread it, and the sentence to use instead. If their own number was involved,
it carries file, field, window and confidence.
