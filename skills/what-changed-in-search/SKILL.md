---
name: what-changed-in-search
description: >
  Check what changed in search or answer engines recently, always fetched
  live and never answered from training data, then show what it means for
  this specific site in measured counts with a control check before blaming
  anything on it.

  Use this skill whenever the user asks to:
  - Understand a recent Google core update or algorithm change
  - Explain a traffic drop or spike
  - Check whether something the site shipped or an external update caused a
    metric to move

  Trigger even for casual requests like "what changed in search", "was there
  a core update", "did Google change something", "why did our traffic drop",
  "is this the algorithm or something we did".
---

# what-changed-in-search

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
| live web | source of the actual update information | this skill never answers from training data; if it cannot fetch, it says so and stops rather than guessing |
| `data/snapshots/<latest>/crawl.json` | which of our pages match the affected pattern | run `rainmaker audit` |
| `data/state.json` | tiers of the affected pages | run `rainmaker audit` |
| `data/snapshots/*/gsc.json` (2+ snapshots spanning the update window) | position and impression deltas across the window | run `rainmaker fetch --source gsc` again if only one snapshot exists |
| `data/ledger.jsonl` | what was shipped in the same window, for the control | run `rainmaker ledger --rebuild` |

## Produces

An `algo_update` ledger event (site-level, `id: "site"`), so `what-actually-worked` can later attribute a decline to a core update rather than to shipped work.

## Refuses when

It cannot fetch live sources. Never answers from training data or memory of past updates; a stale or hallucinated update name is worse than saying nothing.

## Procedure, three stages, all mandatory

1. **What changed.** Name, dates, confirmed or observed, what it targets. Sources are tiered: confirmed means the search engine's own status dashboard, official blog, or changelog; observed means volatility trackers or industry reporting. Every claim carries its tier.
2. **What it means here.** Cross-reference `crawl.json` for which of this site's pages match the pattern the update targets, `state.json` for their tiers, `gsc.json` for position and impression deltas across the update window, and `ledger.jsonl` for what was shipped in that same window. Concrete counts, never general advice: "14 of your tier 1 pages match this pattern, average position moved from 8.2 to 11.4 across the window" beats "you may be affected."
3. **What to do.** Ranked by `revenue_score`. Low-tier items are explicitly deprioritised with the reason shown, not silently dropped from the list.

## Control check, mandatory

Report whether non-matching pages also moved in the same window. If they did, state plainly that the update is unlikely to be the cause. This is the same correlation-labelling rule as everywhere else in the system: a timing coincidence is not a demonstrated cause.

## Decision rules

- Always fetch. Always stamp `fetched_at` on the finding.
- Never assert that the update caused a metric change without the control check alongside it.
- Write the `algo_update` event regardless of whether the site was affected; a null result ("checked, not applicable here") is itself useful for later retrospectives.

## Output

```
## What changed
<name>, <date range>, <confirmed|observed>, targets: <pattern>

## What it means here
<n> of our tier <n> pages match this pattern.
Average position: <before> to <after> across the window (gsc.json, <dates>).
Shipped in this window: <cause>, <n>h.

## What to do
<url> tier <n> score <x>: <action>
(deprioritised: <url> tier 4, low revenue impact)

## Control
Non-matching pages moved <n>% over the same window.
<Update is unlikely to be the cause. / Consistent with the update, not proven by it.>
```

## Done when

Every claim carries its source tier, the control check is present and answered either way, and an `algo_update` event was appended to the ledger so later retrospectives can attribute correctly.
