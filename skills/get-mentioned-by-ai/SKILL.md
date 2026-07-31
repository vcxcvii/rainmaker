---
name: get-mentioned-by-ai
description: >
  Check whether AI assistants mention this site when answering the questions
  its buyers actually ask, decomposed per engine and per market rather than
  reported as one aggregate, and mine the cited sources into a target list.

  Use this skill whenever the user asks to:
  - Check if they show up in ChatGPT, Perplexity or other AI answers
  - Understand their AEO or AI-search visibility
  - Find out why a competitor wins the AI comparison answers
  - Set up llms.txt or improve AI readability
  - Audit schema markup for AI extraction

  Trigger even for casual requests like "am I showing up in ChatGPT", "do LLMs
  cite me", "AEO check", "GEO audit", "should I add llms.txt", or when a user
  asks why an AI answer named a competitor instead of them.
---

# get-mentioned-by-ai

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
| `data/snapshots/<latest>/crawl.json` | schema and extractability, offline half | run `rainmaker audit` |
| `context/business.md` | brand and category terms for probes | required, see context load |
| `data/strategy.json` | commercial head queries and named competitors for probes | optional; without it probes derive from `config.icp_hint` and the glossary, and the run is stamped `derived: config` |

## Produces

`data/snapshots/<ts>/citations.json`.

## Probe design

12 prompts minimum, in buyer language rather than brand language: 3 from the category phrasing in `messaging.category`, 3 commercial head queries from `clusters`, 3 comparison forms against the top 3 named competitors, 3 from the top-impression non-branded GSC queries. With no strategy, take all 12 from `icp_hint` plus glossary terms.

Run per engine configured via `.env` (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `PERPLEXITY_API_KEY`) and per market in `config.geographies`. Any absent key is skipped and named in the confidence section; zero keys skips the whole probe set and this skill still runs its offline half.

Refresh the prompt set whenever `say-it-their-way` changes `buyer_language`. Prompt drift silently invalidates a trend line, since a stale prompt set is answering a question buyers stopped asking.

## Reading the result

1. **Never report an aggregate without its decomposition.** A score move localises to one engine, one market or one prompt, and the aggregate hides it. Report per engine and per market always.
2. **Record `methodology_version` on every scan.** Never compare across a version boundary; that is the classic false alarm.
3. **Mine the citations, not just the mentions.** Which domains and URLs do the engines cite for these prompts? Hand that list to `get-cited-elsewhere`.
4. **Distinguish invisible from visible-but-mispositioned.** Being cited as the wrong category needs different work from not being cited at all.
5. Every citation claim carries: "Assistant answers are non-deterministic. Treat this as a sample of N probes on <date>, not a ranking." Confidence is capped at 0.5. Never write a `verified` ledger event from a probe; citation moves append `opened` and `regressed` only, and `regressed` itself requires two consecutive monthly misses at the same methodology version.

## Offline half

Schema coverage by tier: which tier 0 and 1 pages lack `Product`, `Offer`, `FAQPage`, `Organization`, `BreadcrumbList`. Extractability: tier 1 pages with fewer than 3 standalone claim sentences. `llms.txt` presence and whether it covers tier 0 and 1 URLs. Crawler access: does `robots.txt` block `GPTBot`, `ClaudeBot`, `PerplexityBot`, `OAI-SearchBot`, reported as a business consequence rather than a value judgement.

## Decision rules

- No probe set below 12 prompts.
- Confidence on any citation finding never exceeds 0.5.
- A single missed scan is a suspicion, not a regression.

## Output

Per engine, per market: visibility rate, top cited sources with citation counts, and one concrete content action per gap. The non-determinism sentence appears once per section, not once per row, so it is not lost in repetition but is never omitted either.

## Done when

Every citation claim carries its probe date, engine, market and the non-determinism sentence; the offline half ran regardless of API keys; and citation sources are exported in a form `get-cited-elsewhere` can consume directly.
