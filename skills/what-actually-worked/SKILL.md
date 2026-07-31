---
name: what-actually-worked
description: >
  Answer three questions in order: what did we believe, what did we do, what
  actually happened: and always include a mandatory "What did nothing"
  section, since a retrospective containing only wins is a defect.

  Use this skill whenever the user asks to:
  - Run a retrospective on their SEO or content work
  - Understand what is actually working versus what isn't
  - Find out if a past fix paid off
  - Update strategy based on what happened

  Trigger even for casual requests like "what's working", "did the work pay
  off", "retrospective", "where do we stand", "what should we stop doing".
---

# what-actually-worked

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
| `data/ledger.jsonl`, `data/state.json` | events with cause, baseline vs current | run `rainmaker audit` |
| `data/strategy.json` and `data/strategy-history/` | what we believed at the period's start | run `know-my-buyer` |

## Produces

Nothing persisted directly; may recommend a `decisions` entry demoting a pain point, applied via `say-it-their-way` or `know-my-buyer`.

## Procedure

1. **What did we believe?** Diff the current `strategy.json` against the version at the start of the period, using `strategy-history/`. Name every changed belief and the `reason` recorded for it.
2. **What did we do?** Every ledger event with a `cause` in the period, grouped by cause, effort hours summed, on-site and off-site work together.
3. **What happened?** `baseline` against `current` per finding, only for findings past their own verification window. Use `src/ledger/query.ts pendingVerification` to exclude anything not yet due, so nothing is judged early.
4. **What did nothing.** Mandatory. Call `src/ledger/query.ts didNothing`, which separates true failures (comparable metrics, no movement) from `unmeasured` (no comparable metric at all, so no verdict either way). List every shipped intervention whose target metric did not move beyond its window, with the effort spent. **A retrospective containing only wins is a defect and must be regenerated**, not published as-is.
5. **What we cannot attribute.** Findings that moved inside a window containing an `algo_update` event are reported as coincident and explicitly not causal, with the control: did non-matching pages move too?

## Decision rules

- Section 4 is never skipped, even when every shipped item worked. State plainly that nothing in the period did nothing, if that is genuinely true.
- Never assert causation. "Position improved after we shipped X" states timing; it does not claim X caused it unless the control (non-matching pages did not move) is also shown.
- Where a belief was contradicted twice across periods, recommend demoting it in `strategy.json` with a `decisions` entry, and name `know-my-buyer` as the next step if the drift conditions from `spec/site-blueprint.md` section 8 or the core spec's drift rule fire.

## Output

```
## What did we believe?
<belief>: <held / changed to X, reason: Y>

## What did we do?
<cause>: <n> events, <n>h effort

## What happened?
<finding id>: baseline <x> -> current <y>

## What did nothing
<finding id>: <n>h spent, shipped <date>, <baseline> unchanged

## What we cannot attribute
<finding id> moved inside a window containing an algo_update on <date>.
Control: non-matching pages moved <n>% over the same window, so this is
coincident, not established as causal.
```

## Done when

All five sections are present, section 4 is genuinely non-empty whenever any shipped item failed to move, and no sentence in the report asserts causation without showing its control.
