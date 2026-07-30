# Rainmaker: Specification v3

**Audience:** an autonomous coding agent executing without further clarification.

**Name.** The project was `lazarus-pit`, then `paydirt`. It is now **Rainmaker**: the one who brings in revenue. npm package `rainmaker`, binary `rainmaker`, repo `vcxcvii/rainmaker`. The differentiating principle is unchanged and is what the name states:

> Every finding is ranked by distance to revenue, never by technical severity.

**Authority order.** This file, then `spec/false-positives.md`, `spec/context-layer.md`, `spec/site-blueprint.md`, `spec/offsite.md`, `spec/agent.md`, `spec/skills.md`, then `spec/handoff-v1.md`. Earlier wins. `PLAN.md` is rationale and loses to all of them.

**Rule:** if a detail is unspecified anywhere in that chain, choose the option that is deterministic, testable, and cheapest to run, then record the choice in `DECISIONS.md`. Do not ask.

---

## 0. Current state, as of 2026-07-30

Repository: `<repo root>/rainmaker`, public at `github.com/vcxcvii/rainmaker`. Committed and passing:

| Commit | Block | Contents |
|---|---|---|
| `e5d7845` | 1 | scaffold, CLI surface, config schema and loader, `init` |
| `6492568` | 2 | `auth/google.ts`, `auth/verify.ts`, `doctor` with 5 capability probes |
| `45e40f1` | 3 | GA4, GSC, Clarity fetchers, crawl, Firecrawl and context.dev providers, `fetch` |

Verify before starting: `npm install && npx tsc --noEmit && npm test`.

Block 4 completed the rename: package and bin `rainmaker`, config `rainmaker.config.yml`, directory and repository `rainmaker`. `paydirt` survives only in `spec/handoff-v1.md`, which is retained verbatim as the historical record.

---

## 1. What v3 adds, and why

v2 fixed seven defects in v1. v3 closes the gaps that separate a diagnosis tool from something that makes a business rank durably. Four are structural.

### 1.1 Nothing checked whether a target was winnable

v1 and v2 went from cluster to keyword to brief without ever reading a live SERP. Volume and intent classification say nothing about whether the top 10 is displaceable, what format Google actually rewards, or whether the searcher is even in our category.

`can-i-actually-rank` is now a required gate before anything is briefed, ending in QUALIFY, CONDITIONAL or KILL, followed by five commercial filters. Beatability is evidenced from our own GSC history rather than vendor authority scores, which the core spec forbids. Specified in `spec/skills.md`, phase 3.

### 1.2 There was no site, only pages

A keyword plan is a list; a site is a structure. Without an architecture artifact, pages accrete into a flat blog, compete with each other, and never accumulate authority on anything.

`spec/site-blueprint.md` adds `blueprint.json`: the whole intended site as a tree, one intent per URL, a parent for every node, depth ceilings for money pages, titles and metas generated as a consistent set, and a permutation guard so that `[service] in [area]` scaling does not become doorway spam. It also adds two things absent from every reference system we studied:

- **Authority budget.** Monthly publish rate bounded by the site's own demonstrated indexation and ranking rates. Publishing 200 pages into a site that gets 6 indexed produces 194 pages of crawl waste.
- **Topical completeness.** Coverage of a cluster's expected subtopic set, with a refusal to open a fourth cluster while any existing cluster is under 40 percent. This is the mechanism that makes ranking durable instead of spiky.

### 1.3 The system was entirely on-site

Search engines and answer engines decide what to rank and cite largely from properties you do not own. A system that only edits your own pages can diagnose everything and change almost nothing about how the category talks about you.

`spec/offsite.md` adds `citation-graph.json`, a three-level drill from cited domains to cited URLs to the quoted answer text, and turns every finding into an action with an honest plausibility by editability class. Plus community presence with hard platform-safety rules, entity consistency checks against `business.md`, bounded repurposing, and off-site work entering the same ledger with the same verification windows.

### 1.4 AI visibility was measured, not decomposed

v2 ran a 12-probe sample and reported it. That is an aggregate, and aggregates hide the thing that moved.

`get-mentioned-by-ai` now requires per-engine and per-market decomposition, a `methodology_version` on every scan with comparison across a version boundary forbidden, prompt refresh whenever buyer language changes, separation of invisible from visible-but-mispositioned, and citation mining that hands a ranked source list to `get-cited-elsewhere`.

### 1.5 Clusters came only from pain points

`pick-my-battles` now derives clusters from seven signal types: competitor, objection, feature, use case, vertical, pain, and winner expansion, with a balance check that names over-representation.

### 1.6 The system assumed B2B SaaS

`REVENUE_MODELS` gains `local-services`, `ecommerce` and `marketplace`. The blueprint spine and permutation axis switch by model. Tier rules are unchanged.

### 1.7 Skills were named for practitioners

26 skills, renamed for the outcome a non-specialist actually wants, and organised into six phases with one decision each, no overlap, and a declared consume-and-produce chain. Mapping table in `spec/skills.md` section 0.

---

## 2. What v2 fixed, still binding

1. Tiering rule 1 rewritten around GA4 page-level `keyEvents`, since the Data API exposes no ordered path sequences.
2. Findings may only be closed when the URL is in the run's crawl coverage set.
3. `shipped` detected by a `rainmaker-fix: <finding-id>` commit trailer or by re-measure.
4. Report windows longer than available history are refused.
5. AI citation probes are capped at confidence 0.5 and never produce a `verified` event.
6. `strategy.json` fully specified.
7. The shared context layer.

Full detail in the v2 sections retained below and in `spec/context-layer.md`.

---

## 3. Invariants

v1's eight stand. v2 added four. v3 adds five.

9. **One context, loaded identically.** Every judgment skill opens with the Context load block, verbatim.
10. **Prose and records move together.** Shared ids across `business.md` and `strategy.json`.
11. **Every number carries provenance.** File, field, window, confidence.
12. **Skills own their fields.** Enforced by `rainmaker context --validate`.
13. **One intent, one URL.** Enforced at blueprint time, not diagnosed after publication.
14. **Nothing gets briefed without a SERP verdict.** A `blueprint.nodes[].serp_verdict` of `unchecked` blocks `brief-my-writer`.
15. **Publish inside the authority budget.** Exceeding it requires an explicit override recorded in `DECISIONS.md` with the measured rates.
16. **No vendor authority scores, anywhere.** Feasibility is evidenced from our own measured history.
17. **Three verdicts, never two.** Finding, suspicion, unmeasured. A check that cannot establish its case reports a suspicion or says it has no data. Collapsing the third into silence is how a system implies it saw everything.
18. **Every finding is auditable.** `rainmaker audit --explain <id>` prints file, field, window, threshold and the rule that fired. A finding that cannot be explained that way should not have been reported.
19. **No manipulation.** No multi-account simulation of independent voices, no vote manipulation, no undisclosed affiliation, no paid or exchanged links, no doorway permutations. These buy a short signal and a long liability, and this system exists to make ranking durable.

---

## 4. CLI

v1 section 8 stands, renamed to `rainmaker`. Added in v2:

```
rainmaker context --check | --validate | --sync | --init
```

Added in v3:

```
rainmaker serp <query...>        live SERP capture into snapshots/<ts>/serp.json
rainmaker blueprint --build      write blueprint.json from keyword_plan and clusters
rainmaker blueprint --tree       print the tree and the monthly cohorts
rainmaker offsite --scan         refresh citation-graph.json from the latest citations.json
rainmaker campaign               run See through Decide as one supervised chain
```

`audit` prints `coverage_gap`. `routine` scans commits for `rainmaker-fix:` trailers.

---

## 5. Data artifacts

Beyond v1 section 7 and v2 section 4:

| File | Written by | Specified in |
|---|---|---|
| `context/business.md`, `voice.md`, `glossary.md` | `know-my-buyer` | `spec/context-layer.md` |
| `data/strategy.json` | strategy skills | `spec/context-layer.md` section 4 |
| `data/blueprint.json` | `map-my-site` | `spec/site-blueprint.md` section 2 |
| `data/citation-graph.json` | `get-cited-elsewhere` | `spec/offsite.md` section 2 |
| `data/competitors.json` | `beat-my-competitors` | v1 section 9 |
| `snapshots/<ts>/serp.json` | `rainmaker serp` | `spec/skills.md` phase 3 |
| `snapshots/<ts>/citations.json` | `get-mentioned-by-ai` | v2 section 1.5 |

`data.example/` carries a fabricated copy of every one of them, so any skill can be developed with zero credentials.

---

## 6. Build order

Blocks 1 to 3 complete. Each block ends with a commit; do not start one until the previous block's criteria pass.

| # | Block | Done when |
|---|---|---|
| 4 | Rename to Rainmaker | no `rainmaker` string remains outside `spec/handoff-v1.md` and `DECISIONS.md`; `npx tsc --noEmit` and tests pass |
| 5 | Ledger: types, append, materialise, query | 1000-line fixture replays byte-identically; illegal transitions rejected; a URL outside the coverage set is never closed |
| 6 | Context layer and `rainmaker context` | `--init` produces a valid stub; `--validate` rejects a non-owning write; `--check` catches a hash mismatch |
| 7 | `explain-this-number` and `skills/_shared/` | every term present with definition, misuse, replacement; five shared files exist and no skill restates them |
| 8 | `tiering.ts`, `scoring.ts`, `effort.ts` | 8 precedence rules unit-tested including the replacement rule 1; identical input yields identical scores across 100 runs |
| 9 | `audit` end to end | sorted `diagnosis.json` on a fixture site with zero credentials; `coverage_gap` printed; no false close on a truncated crawl |
| 10 | `unblock-my-money-pages`, `find-my-quick-wins`, `stop-losing-visitors` | verbatim context block; provenance on every number; refusals name the unblocking command |
| 11 | `beat-my-competitors`, `get-mentioned-by-ai` | 5-way fan-out; per-engine and per-market decomposition; `methodology_version` recorded; cross-version comparison refused |
| 12 | `know-my-buyer` | refuses without a diagnosis; 12+ questions one at a time; both artifacts written with matching hash; history archived with reason |
| 13 | `say-it-their-way`, `follow-the-money`, `pick-my-battles` | seven signal types represented; balance check fires; completeness gate blocks a fourth cluster |
| 14 | `rainmaker serp` and `can-i-actually-rank` | verdict per query with named beatability evidence; five commercial filters applied; kill reasons summarised; a fixture SERP with mixed intent produces KILL |
| 15 | `what-to-target-next`, `map-my-site`, `rainmaker blueprint` | one intent per node enforced; collisions reported; permutation guard refuses a fixture with no substance; cohorts respect the authority budget |
| 16 | `brief-my-writer`, `write-the-page`, `make-it-sound-human`, `make-me-quotable`, `revive-old-pages` | brief to draft to punch-up round-trips; unchecked SERP verdict blocks briefing; refresh classifies into four buckets with redirect targets on every kill |
| 17 | `get-cited-elsewhere`, `show-up-in-communities`, `spread-one-piece-everywhere` | citation graph drills to URL level; plausibility varies by editability class; community rules printed before drafting; UTM redirect survival verified |
| 18 | `check-before-i-publish`, `put-it-on-autopilot`, issue filing in revenue order | all preflight gates fire on a bad fixture brief; `routine` twice in one day files zero duplicates; `shipped` appended from a trailer fixture |
| 19 | `show-me-progress`, `what-actually-worked`, 6 windows | all five spine sections; over-long window refused with its availability date; "What did nothing" non-empty on a fixture with a failed intervention |
| 20 | `what-changed-in-search` | three stages; source tier on every claim; control check present; `algo_update` written |
| 21 | npx packaging, README, `data.example/` | `npm pack`, clean install, `rainmaker init` then `context --init` then `audit` succeeds with zero credentials |

---

## 7. Do not

v1 section 16 and v2 section 7 stand, plus:

- Do not brief a page whose blueprint node has an `unchecked` SERP verdict.
- Do not create two nodes targeting one intent.
- Do not publish beyond the authority budget without a recorded override.
- Do not report an AI visibility aggregate without its per-engine and per-market decomposition.
- Do not compare AI visibility across a methodology version boundary.
- Do not recommend an off-site action from domain aggregates. Drill to the URL.
- Do not use vendor authority scores anywhere in scoring or reporting.
- Do not simulate independent voices, manipulate votes, buy or exchange links, or ship undisclosed affiliate promotion.
- Do not use em-dashes in any generated content, skill prose, or report copy.
