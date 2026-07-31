---
name: show-me-progress
description: >
  Render the mandatory five-section report for a chosen window, refusing any
  window longer than available snapshot history rather than extrapolating a
  partial period into a full one.

  Use this skill whenever the user asks to:
  - Get a monthly report, weekly pulse, or quarterly review
  - Show progress to a client or their team
  - See what changed in a given period

  Trigger even for casual requests like "monthly report", "how did we do this
  month", "progress report", "show the client", "weekly pulse".
---

# show-me-progress

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
| `data/ledger.jsonl`, `data/state.json` | events and current status per finding | run `rainmaker audit` |
| `data/snapshots/` history | the earliest snapshot date, for the cold-start refusal | run `rainmaker audit` |

## Produces

`reports/<window>-<date>.md`, via `rainmaker report --window <window>`.

## Refuses when

The requested window exceeds available snapshot history. This is enforced in code by `src/report/windows.ts checkWindowAvailability`, not by judgment: a full window compared against a partial one is not a comparison, and the refusal names the exact date the window becomes honest.

## Procedure

1. Run `rainmaker report --window <pulse|28d|month|quarter|half-year|strategy>`.
2. If it refuses, relay the refusal exactly, including the availability date. Do not attempt to render a smaller, unrequested version of the report as a consolation; offer the smaller window explicitly and let the user choose.
3. Present all five sections in order: what changed (numbers only, no adjectives), why it matters (framed in tiers, never "rankings improved" without the tier and the conversion consequence), what to do (ranked by revenue score), what we are watching (leading indicators with numeric thresholds and due dates), and confidence (which capabilities were live).

## Decision rules

- Never render a report for a window longer than the tool allows. There is no manual override.
- Section 1 is numbers only, maximum 5 lines.
- Section 5 is never omitted, even when every capability was live; say so explicitly rather than leaving the section blank.

## Output

The five-section spine, verbatim from `rainmaker report`'s output, with no additional commentary layered on top that the tool did not itself produce.

## Done when

All five sections are present, every number carries provenance, and the window is fully covered by real snapshot history rather than any part of it being extrapolated.
