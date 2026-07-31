---
name: show-up-in-communities
description: >
  Find where the buyer's question is already being asked in communities, draft
  an answer that would stand on its own with the product name removed, and
  track it honestly given that most community platforms offer no native
  click-level attribution.

  Use this skill whenever the user asks to:
  - Find where their audience is talking, like Reddit or forums
  - Draft a community answer or comment
  - Decide whether to post in a specific subreddit or forum
  - Track whether community activity is producing anything

  Trigger even for casual requests like "should we post on Reddit", "where is
  our audience talking", "draft a forum answer", "is our Reddit activity
  working".
---

# show-up-in-communities

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
| `data/citation-graph.json` | which threads already appear in AI answer citations, to rank targets | optional, rank by traffic alone without it |
| `context/business.md` | buyer language and what we will not say | required |

## Produces

Draft answers for human review, plus attribution setup notes. Never posts anything itself.

## Hard rules: not stylistic, platform-safety

1. **Read and print the community's rules before drafting anything.** Never post promotional content into a community whose rules forbid it.
2. **Never simulate independent voices.** No multiple accounts, no upvoting your own posts from another account. This is the fastest way to get an entire domain banned, and the ban does not respond to an SEO fix.
3. **Always disclose affiliation.** A recommendation of your own product with no disclosure is an advertisement wearing a community member's voice.
4. **Answer the question that was asked.** A comment that only helps if the reader buys is not an answer.
5. **One link maximum, and only when the link is the answer**, not a bolt-on at the end.

## Procedure

1. Find threads where the category question is being asked. Rank candidates by thread traffic and by whether the thread already appears in `citation-graph.json`, since a thread already feeding AI answers is worth more than an equally busy one that is not.
2. Read the community's posting rules first. Print them before drafting anything.
3. Draft an answer that would stand as useful with the product name removed. If it would not, it is not ready.
4. Disclose affiliation plainly.
5. Tag any posted link with the standard scheme: `?utm_source=<platform>&utm_medium=community&utm_campaign=<campaign>&utm_content=<community>`. Verify the parameters survive the platform's outbound redirect chain before trusting any downstream number; some platforms route through intermediaries that strip tags silently.
6. Where clicks cannot be tracked (most comment-level activity, structurally), correlate mention dates against traffic and signup timing, and label the result as correlation, never as measured conversion.

## Decision rules

- A draft is never posted by this skill. It goes to a human for review and manual posting, per invariant: publishing to any community, forum or social platform is never automated.
- A community whose rules forbid promotional content is not worked around with vaguer promotion; it is skipped.
- Every attribution claim states plainly what could and could not be tracked.

## Output

```
## Community targets

<community>: rules: <summary>, posting allowed: <yes/no and why>
  Thread: <url>, traffic <estimate>, cited in AI answers: <yes/no>
  Draft: <text, product name removable>
  Disclosure: <text>
  Link: <tagged url or "none, answer stands alone">

## Attribution
Tagged sessions: <n>, redirect survival: <verified / not verified>
Correlation (not measured): <mention dates vs traffic/signup timing>
```

## Done when

Every draft stands without the product name, every disclosure is present, every posted link is tagged and redirect-verified before being trusted, and correlation-based claims are labelled as such rather than presented as measured.
