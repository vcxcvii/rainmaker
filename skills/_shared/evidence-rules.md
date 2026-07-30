# Evidence rules

Cited by every skill. A number without provenance is not a finding, it is an
assertion, and assertions are what this system exists to replace.

## Every number carries four things

```
1,240 impressions (gsc.json, 28d to 2026-08-09, confidence 0.7)
```

File, field, window, confidence. In that order. A skill that states a number
without them is producing a defect, not a report.

Where a number is derived rather than measured, name the inputs:

```
opportunity 41.2 (impressions 1,240 x ctr gap 0.033, gsc.json 28d to 2026-08-09, confidence 0.7)
```

## Confidence comes from the measurement, not from the mood

| Source | Confidence |
|---|---|
| Directly measured technical fact, from a page we fetched | 1.0 |
| API-reported figure: GSC, GA4, Clarity, PageSpeed field data | 0.7 |
| Inferred from patterns: URL tiering, query intent classification | 0.5 |
| Sampled non-deterministic output: AI assistant answers | 0.5 maximum, never higher |

A finding's confidence is its tier confidence multiplied by its measurement
confidence. Anything below 0.5 is reported in a separate low-confidence group,
never mixed into the ranked list.

## Three verdicts, never two

| Verdict | When | How it appears |
|---|---|---|
| Finding | The evidence establishes the problem | Ranked, scored, written to the ledger |
| Suspicion | Consistent with a problem, insufficient to establish it | Its own section, with what would confirm it |
| Unmeasured | We lack the data to say | Named in the confidence section |

Reporting only what you can see, in a tone that implies you saw everything, is
the most common way to be wrong without saying anything false.

## Windows

- Search Console is always 28 days. Never 30. Mixing window lengths manufactures trends that do not exist.
- Comparisons use two windows of identical length, both complete. A full window against a partial one is not a comparison.
- Nothing is re-checked faster than its verification window. The windows live in `src/ledger/types.ts` and are the same everywhere.

## Correlation

Never assert that an algorithm update, a competitor's move, or your own change
caused a metric to move. State the timing consistency, then state the control:
did pages that do not match the pattern move too? If they did, say the cause is
unlikely to be what you were about to blame.

The phrasing that is always available: "X changed on the 14th. Y moved between
the 14th and the 21st. Pages that do not match X moved by 2 percent over the
same window, so this is consistent with X and not established by it."
