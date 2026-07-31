---
name: unblock-my-money-pages
description: >
  Find what is technically stopping the pages closest to revenue from working,
  ordered by distance to money rather than by severity. Reads the diagnosis the
  core already wrote; it never re-crawls.

  Use this skill whenever the user asks to:
  - Audit their site, or find what is broken
  - Work out why a page is not indexed or not showing in search
  - Check canonicals, redirects, orphan pages or crawl problems
  - Review technical SEO before or after a release
  - Understand which technical issues are actually worth fixing

  Trigger even for casual requests like "what's broken on my site", "why isn't
  my pricing page showing up", "is anything blocking Google", "run a technical
  audit", or when a user pastes a URL and asks why it is not ranking.
---

# unblock-my-money-pages

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
| `data/snapshots/<latest>/diagnosis.json` | the findings, already scored | "No diagnosis yet. Run `rainmaker audit`." |
| `data/snapshots/<latest>/crawl.json` | page-level evidence | same |
| `data/state.json` | what is already known and what was shipped | run `rainmaker ledger --rebuild` |

## Produces

Nothing. The diagnosis is written by `src/`, and a skill that re-derives a score is a defect.

## Refuses when

- No diagnosis exists: "No diagnosis yet. Run `rainmaker audit`. Reading a site I have not measured produces a checklist, not a finding."
- The latest diagnosis predates the latest crawl: say so, and run `rainmaker audit --refresh`.

## Procedure

1. Read `diagnosis.json`. Group findings by tier, never by check type. Tier 0 leads, always.
2. Within each tier, keep the order the core produced. It is already score descending, id ascending, and reordering it makes two reports of the same data disagree.
3. Report reachability first: noindex, canonical to an error, canonical chains, 4xx and 5xx. A page in that state cannot earn a score at all, which is the one case where ordering overrides the number.
4. Then structure: orphans, click depth over 3 for tier 0 and 1, duplication.
5. Then metadata and content: titles, meta descriptions, H1s, thin pages.
6. Report suspicions in their own section, each with what would confirm it. Never mix them into the ranked list.
7. Close with the confidence section: which capabilities were live, and what their absence weakens.

## Decision rules

- A tier 0 page that is unreachable outranks any tier 1 item regardless of score.
- Never report a finding without its `tier_source`. A tier from `url_pattern` is a guess and a reader who cannot see that will read it as measured.
- Never recommend a fix whose effort exceeds the finding's own listed hours without saying why the table is wrong.
- Say what is not broken. A reader who only ever sees problems cannot calibrate.

## Output

```
## 1. What changed
## 2. Why it matters
## 3. What to do
  <path>  tier <n>  <check>  <effort>h  score <x>
  <one sentence, the measured value, the file it came from>
## 4. What we are watching
## 5. Confidence
```

## Done when

Every line names a URL, a measured value, an effort figure and a tier source; suspicions are separated; and the confidence section lists the capabilities that were missing.
