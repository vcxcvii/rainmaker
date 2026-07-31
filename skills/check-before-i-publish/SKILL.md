---
name: check-before-i-publish
description: >
  Run the 10 blocking preflight gates before a page ships, and the 8
  postflight gates on their own verification windows after. Never overrides a
  failing gate; a fail always names the specific fix.

  Use this skill whenever the user asks to:
  - Check if a page is ready to publish
  - Run a preflight or postflight check
  - Confirm whether something shipped actually worked

  Trigger even for casual requests like "ready to publish?", "check before I
  ship this", "preflight this page", "did it work", "postflight check".
---

# check-before-i-publish

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
| the brief and draft | preflight input | ask for the slug |
| `data/ledger.jsonl` | shipped timestamps, for postflight windows | run `rainmaker ledger --rebuild` |
| `data/snapshots/<latest>/*` | current measured values for postflight gates | run `rainmaker audit` |

## Produces

Nothing persisted; a pass/fail report.

## Procedure

1. **Preflight**, before anything ships. Call `src/gates/preflight.ts runPreflight(brief)`, which runs all 10 gates: pain point provenance, cluster slot, cannibalisation, intent match against the SERP verdict, 3+ internal link sources, schema planned, E-E-A-T signals, extractability, the slop check, and the revenue argument. Print the full pass/fail table, not just the failures; a reader needs to see what already passed to trust what didn't.
2. **Never auto-override a failing gate.** Every failure states the specific fix from the gate's own reason string.
3. **Postflight**, on a schedule after shipping. Call `src/gates/postflight.ts postflightStatus(shippedAt, now, measured)` per finding, which reports `pass`, `fail`, `not_yet_due`, or `unmeasured` per gate against its own window (indexed 14 days, canonical and internal links immediate, CWV 7 days, impressions 28 days, position trend, AI citation and conversion contribution 90 days).
4. A `not_yet_due` gate is not a failure; report it as pending with the date it becomes due.

## Decision rules

- No gate is ever skipped or overridden. A user asking to publish anyway gets the fail table and is told this skill does not have an override; the decision to ship over a failing gate belongs to the human, not to a bypass built into the tool.
- Postflight never reports pass or fail before its window elapses. Judging a metric before it has had time to move manufactures both false confidence and false alarm.

## Output

```
## Preflight: <slug>

pain_point_provenance     PASS
cluster_slot              PASS
cannibalisation           FAIL: an existing URL already targets this intent: /old-page
intent_match              PASS
internal_links            FAIL: only 1 inbound link source identified, needs 3
schema_planned            PASS
eeat_signals               PASS
extractability            PASS
slop_check                PASS
revenue_argument          PASS

2 of 10 gates failing. Not ready to publish.

## Postflight: <finding id>
indexed                   not_yet_due (due 2026-08-15)
canonical_correct         PASS
cwv_not_regressed         PASS
internal_links_live       PASS
impressions_appearing     not_yet_due (due 2026-08-29)
position_trend            not_yet_due (due 2026-10-30)
ai_citation               not_yet_due (due 2026-10-30)
conversion_contribution   not_yet_due (due 2026-10-30)
```

## Done when

Every gate reports pass, fail, or not-yet-due with its due date, and every failure names its specific remedy.
