---
name: get-cited-elsewhere
description: >
  Drill from cited domains to the specific URLs driving citations to the
  actual quoted answer text, then turn every finding into an action with an
  honest plausibility by how editable the placement actually is.

  Use this skill whenever the user asks to:
  - Find where they should get mentioned or cited
  - Build a citation or link-building strategy
  - Understand who AI engines trust in their category
  - Get listed on review sites or directories

  Trigger even for casual requests like "where should we get mentioned",
  "citation strategy", "who do AI engines trust in our space", "link
  building", "get us listed somewhere".
---

# get-cited-elsewhere

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
| `data/snapshots/<latest>/citations.json` | the raw citation scans from `get-mentioned-by-ai` | run `get-mentioned-by-ai` first |
| `data/competitors.json` | competitor context for cited pages | run `beat-my-competitors` for full coverage |
| `context/business.md` | the source of truth to check every existing mention against | required |

## Produces

`data/citation-graph.json`.

## Procedure

1. **Level 1, domains.** Pull the domains that co-occur with the brand or category in AI answers, with citation counts and type (review platform, community, media, competitor, directory). This gives the shape, not the action.
2. **Level 2, URLs.** Drill into each heavyweight domain for the specific pages driving its citations. Concentration is the finding: one page out-citing every other page on its domain 14 to 1 means that page owns the answer, not the domain.
3. **Level 3, answers.** Open the full AI responses behind the key citations: what is quoted, and for what (a comparison table, a pricing figure, a one-line verdict). This dictates what a competing or replacement page must actually contain. Never recommend an action from domain aggregates alone.
4. Convert every level-3 finding into one `Gap` with a named action (`claim_listing`, `earn_review`, `answer_thread`, `pitch_inclusion`, `build_better_page`, `correct_record`) and an honest `plausibility` by editability class: `self_serve` around 0.9, `pitch` 0.3 to 0.5, `earned` around 0.3, `closed` 0.1 with the only action being `build_better_page`.
5. Check every existing `Presence` row against `context/business.md`: category, one-liner, ICP, pricing model, named integrations. A mismatch becomes a `correct_record` gap and outranks new-placement gaps of equal score, since fixing a wrong description you already own is cheaper and faster than earning a new mention.

## Decision rules

- Never stop at domain aggregates. "Review sites matter" is not an action; "this one comparison post drives 14 times the citations of the rest of its domain" is.
- Plausibility is honest, not optimistic. A hit-list where everything is 0.9 has not been checked; a hit-list where everything is 0.1 is a list of excuses.
- Will not do: outreach at volume, link exchanges, paid link schemes, guest-post spam. These buy a short-term signal and a long-term liability.

## Output

```
## Citation graph

Domain: <domain> (<type>), <n> citations
  URL: <url>, <n> citations, cited for: <what>
    Action: <type>, plausibility <x>, effort <h>h

Correct-record gaps (existing mentions that misdescribe us):
  <url>: says "<wrong claim>", business.md says "<correct claim>"
```

## Done when

Every action names a URL, not just a domain, every plausibility is justified by its editability class, and every existing presence was checked against `business.md`.
