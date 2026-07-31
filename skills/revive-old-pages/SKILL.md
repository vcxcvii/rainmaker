---
name: revive-old-pages
description: >
  Classify every URL with search history into refresh, rewrite, consolidate
  or kill, excluding anything still inside its own shipped verification
  window so a fix is never judged before it has had time to work.

  Use this skill whenever the user asks to:
  - Find content decay, or which pages are dying
  - Decide whether to refresh, rewrite or delete old content
  - Clean up an old blog or content library

  Trigger even for casual requests like "what should I update", "content
  decay check", "which posts are dying", "should we refresh or rewrite this",
  "clean up our old blog posts".
---

# revive-old-pages

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
| `data/snapshots/<latest>/gsc.json` (2+ snapshots) | position and impression history | "Need at least two Search Console snapshots. Run `rainmaker fetch --source gsc` again after 28 days." |
| `data/snapshots/<latest>/crawl.json` | word count, links, canonical status | run `rainmaker audit` |
| `data/ledger.jsonl` | what was already shipped and its verification window | run `rainmaker ledger --rebuild` |
| `data/blueprint.json` | cluster completeness, to prioritise refreshing under-covered clusters | optional |

## Produces

Classification report; `keyword_plan[].slot` (shared owner with `what-to-target-next`).

## Refuses when

Fewer than two GSC snapshots exist. A single snapshot has no movement to classify against.

## Procedure

1. Classify every URL with GSC history into exactly one of:
   - **refresh**: position declined 3 or more places, impressions still above 100, tier 0 to 2, over 600 words.
   - **rewrite**: impressions fell 50 percent or more across two windows, cluster still `validated`.
   - **consolidate**: competes with another URL on a query, per the shared overlap detector, holding the smaller impression share.
   - **kill**: tier 3 or 4, zero clicks across two consecutive windows, no inbound links from tier 0 to 2, no proof cited on the page.
2. Join to `ledger.jsonl`: exclude any page shipped inside its own verification window from `src/ledger/types.ts VERIFICATION_WINDOWS`. Judging a fix before its window closes manufactures noise, and this is the same rule the ledger itself enforces on `shipped` to `verified`.
3. Rank by the score of the corresponding cluster.
4. For every `kill`, state the proposed redirect target. A kill without a redirect target is a broken link, not a cleanup.
5. Prefer refreshing a cluster below 80 percent completeness (per `map-my-site`) over starting a new one, when both are viable options for the same effort budget.

## Decision rules

- Every URL gets exactly one classification. A page that could plausibly be two things is resolved, not left ambiguous.
- Never classify a page still inside its verification window; report it separately as "pending", matching the ledger's own `pendingVerification`.
- A `kill` always names its redirect target.

## Output

```
## Content decay report

refresh (<n>):
  <url>: position <before> to <after>, <impressions> impressions

rewrite (<n>):
  <url>: impressions down <n>%, cluster status <validated|hypothesis>

consolidate (<n>):
  <url>: competes with <url>, keep the larger impression share

kill (<n>):
  <url>: 0 clicks over 2 windows, redirect to <target>

pending verification (<n>, excluded from the above):
  <url>: shipped <date>, window closes <date>
```

## Done when

Every URL with history has exactly one classification or sits in "pending", every kill names a redirect target, and nothing inside its own verification window was judged.
