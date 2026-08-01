# rainmaker

An SEO, AEO and content agent. Ranks every piece of work by **distance to revenue**, not technical severity. Diagnoses any site with no credentials, enriches with GA4 + GSC + Clarity when connected, remembers everything it has ever found, files GitHub issues on a schedule, and generates reports a founder can read without a glossary.

Name: **rainmaker**. Free on npm, verified. Mining term for ore rich enough to be worth extracting, which is the whole thesis. Repo renamed in place from `lazarus-pit`; GitHub 301s the old URL and the Clarity pipeline plus data history carry over.

---

## 1. The organizing principle

Every existing SEO tool ranks findings by technical severity. A missing meta description on a careers page outranks a slow pricing page, because severity is a property of the page, not the business.

This inverts that. Every URL gets a **revenue tier**, every finding is scored against it, and nothing surfaces without a revenue argument attached.

| Tier | Name | What lives here | Weight |
|---|---|---|---|
| 0 | Transaction | pricing, demo, trial, signup, checkout, contact | 5.0 |
| 1 | Decision | comparisons, `/vs/`, alternatives, case studies, integrations, ROI | 3.0 |
| 2 | Solution | pain-point content, use cases, "how to solve X" | 2.0 |
| 3 | Problem | awareness, educational, definitional | 1.0 |
| 4 | Ambient | brand, about, careers, general blog | 0.3 |

**Tiering signals, in descending confidence:** GA4 conversion paths, declared config, GSC query intent, URL patterns, on-page signals, internal link distance from a Tier 0 page. When GA4 key events are absent the system falls back and says so in the report. No silent degradation.

```
revenue_score = tier_weight × opportunity × severity ÷ effort_hours
```

Config supplies the business context, which is what lets the universal tiering logic work on sites of any size or shape:

```yaml
# rainmaker.config.yml
site: https://quillet.com
revenue_model: sales-led      # self-serve | sales-led | plg | marketplace | ads | newsletter | consulting
primary_conversion: [/demo, /pricing]
secondary_conversion: [/docs, /blog]
acv: 18000                    # 0 = unknown, disables value-weighted scoring
sales_cycle_days: 45
icp_hint: "GCs and legal ops leads, Series B+, 200-2000 employees"
```

---

## 2. Skills

Named so a marketer knows what each does without reading the docs.

```
DIAGNOSE ─ runs first, no strategy needed, works with zero credentials
│
├── site-health-check        crawlability, crawl budget, architecture, canonicals,
│                            duplicates, indexation, Core Web Vitals, pagespeed,
│                            internal link graph, llms.txt
│   scripts/ crawl.mjs · cwv.mjs · canonicals.mjs · linkgraph.mjs · robots.mjs
│
├── google-rankings-check    GSC: rankings, striking distance (8-15),
│                            cannibalisation, CTR gaps, query-page mismatch
│   scripts/ gsc-pull.mjs · striking-distance.mjs · cannibalisation.mjs
│
├── ai-search-check          whether AI answers cite you. Schema coverage, entity
│                            clarity, llms.txt quality, extractability of claims
│   scripts/ schema-audit.mjs · citation-probe.mjs
│
├── visitor-drop-off-audit   Clarity + GA4: friction, dead ends, rage and dead
│                            clicks, scroll depth against conversion, paths
│   scripts/ clarity-pull.mjs · ga4-paths.mjs
│
└── competitor-teardown      sitemap diff, content gaps, their AI-search presence,
                             topic coverage, publishing cadence, freshness posture
    scripts/ sitemap-diff.mjs · gap.mjs

DECIDE ─ needs a diagnosis, writes strategy.json
│
├── grill-me                 THE HINGE. Fires only after a diagnosis exists.
│                            Interrogates ICP, pain points, what actually closes
│                            deals, which pages matter and why. One question at a time.
├── buyer-sharpener          narrows ICP from evidence, not assertion
├── revenue-map              tiers every URL, maps conversion paths, sets weights
├── topic-map                pain-point clusters, entity map, vector graph
└── keyword-plan             clusters to page types to internal link plan to briefs

BUILD ─ needs a strategy
│
├── content-brief            brief from a gap and a pain point, never volume alone
├── content-writer           Ogilvy principles, pain-point-first, humanised
├── draft-punch-up           tightening, voice, slop removal
├── content-refresh          decay detection: refresh, rewrite, consolidate, or kill
└── ai-readable-setup        schema and llms.txt so AI answers can quote you

OPERATE
│
├── weekly-autopilot         cadence config, thresholds, what files issues
├── progress-report          WoW, MoM, 28-day, 90-day, quarterly, 6-month
├── publish-checklist        preflight and postflight gates
└── where-we-stand           reads the ledger. Where we were, where we are,
                             what worked, what did nothing, where to go next

REFERENCE ─ cited by everything
│
├── metrics-decoder          plain-English definitions. Crawl budget, index bloat,
│                            cannibalisation, E-E-A-T, domain authority (and why it
│                            is not Google's metric), ontology, entity, vector graph,
│                            striking distance, CTR gap, engaged session, key event,
│                            attribution window, AEO vs GEO vs SEO. Same pattern as
│                            michealangelo's design-vocabulary: precise definitions,
│                            common misuses, what to say instead.
│
└── whats-new-in-search      what changed, what it means for YOUR site, what to
                             do in revenue order. See section 3.
```

### whats-new-in-search

Never answers from training data. Always fetches, always stamps a `fetched_at`.

**Sources, tiered and labelled.** First-party alone is insufficient: Google confirms updates days to weeks late and never confirms the unconfirmed ones, which are often the ones that moved your traffic.

| Tier | Source | Gives us |
|---|---|---|
| **Confirmed** | Search Status Dashboard (ranking/indexing feeds) | official start and end dates |
| **Confirmed** | Search Central blog + docs changelog | what actually changed, guidance |
| **Confirmed** | Bing Webmaster blog, OpenAI/Anthropic/Perplexity crawler docs | AI-search surface changes |
| **Observed** | SERP volatility trackers (Mozcast, Semrush Sensor, AWR) | unconfirmed updates, timing |
| **Observed** | Search Engine Roundtable | practitioner corroboration |

Every claim in the output carries its tier. "Confirmed by Google on 12 Aug" and "volatility spike 3 Aug, unconfirmed" are different statements and get shown as different statements.

**Three-stage output.** The skill is worthless if it stops at stage one, which is where every SEO newsletter stops.

```
1. WHAT CHANGED
   Update name, dates, confirmed or observed, what Google said,
   what it actually targets.

2. WHAT IT MEANS FOR YOU
   Cross-references YOUR data, not general advice:
     · site-health-check   -> which of your pages match the pattern
     · revenue-map         -> what tier those pages sit in
     · ledger              -> did your metrics move in that window
     · google-rankings-check -> position/impression deltas across the dates

   "This update targets thin affiliate-style comparison content.
    You have 23 pages matching. 4 are Tier 1. Your Tier 1 positions
    dropped 2.3 on average in the update window. Your Tier 3 pages
    were unaffected."

3. WHAT TO DO
   Ranked by revenue_score, same model as everything else.
   Never an undifferentiated checklist.

     1. /vs/ironclad          T1 · pos 6.2 -> 9.8 · 3h  · score 44.1
     2. /vs/luminance         T1 · pos 8.1 -> 11.4 · 3h · score 38.6
     3. /blog/clm-comparison  T3 · pos 14 -> 19 · 4h    · score 6.2
        ^ deprioritised: no conversion path in 90 days
```

**Correlation is stated as correlation.** If positions moved during an update window the skill says the timing is consistent, not that the update caused it. It checks whether non-matching pages also moved, which is the cheapest available control.

**Writes to the ledger.** Every update becomes an event, so `where-we-stand` can later say "this decline began at the August core update, not with anything we shipped."

---

## 3. Memory

Snapshots alone can diff two runs. They cannot say "where we were." That needs a ledger.

```
data/                        GITIGNORED ENTIRELY
├── ledger.jsonl             append-only, every state transition, never rewritten
├── state.json               materialised current view, rebuildable from ledger
├── snapshots/<ts>/          raw pulls, immutable
├── strategy.json            current
└── strategy-history/        every superseded version, with diff and reason

data.example/                COMMITTED — same shapes, fabricated numbers
```

**Stable finding IDs.** Derived from nature and location, not wording: `t0:canonical:/demo`. A reworded finding is the same finding.

**Findings have a life:** `opened → acknowledged → in_progress → shipped → verified → regressed → closed`.

**Every transition is one line, and it carries causality:**

```json
{"ts":"2026-08-26","id":"t1:position:/blog/contract-review-checklist",
 "event":"verified","from":{"pos":11.4,"clicks":19},"to":{"pos":7.8,"clicks":71},
 "cause":"#220","effort_h":1.5}
```

That `cause` field is the whole point. Without a link from finding to intervention to outcome, "where we were vs where we are" collapses into two numbers side by side, which is what dashboards already do badly.

**Retention:** ledger forever, it is small and it is the actual asset. Raw snapshots at full fidelity for 90 days, then downsampled to weekly aggregates. Keeps the repo from growing without bound.

**Counterfactual honesty:** `where-we-stand` cross-references `whats-new-in-search`. If a page improved during a core update, the report says attribution is contaminated. Otherwise you take credit for Google's weather.

**`where-we-stand` answers three questions in order:** what did we believe, what did we do, what actually happened. It must be willing to report that an intervention did nothing, or it becomes a highlight reel.

---

## 4. Concurrency

Parallel subagents suit one shape of work: many independent units, each needing real reasoning, no shared state, merged at the end. That is true in exactly three places.

| Fan out | Why | Gain |
|---|---|---|
| `competitor-teardown` | 5 competitors, 5 deep independent research jobs | ~5x wall clock |
| `content-brief` at volume | 16 briefs, each independent judgment | ~N x |
| `ai-search-check` | independent citation probes across LLM surfaces | ~N x |

Everywhere else it is wrong, for specific reasons:

- **Measurement is not reasoning.** Crawling 340 URLs, computing CWV, building link graphs: `scripts/*.mjs` with a concurrency pool. Agents would be slower, cost money, and return different numbers each run.
- **`grill-me` is inherently serial.** Question 3 depends on the answer to question 2. That is the value.
- **Scoring must be deterministic.** If `revenue_score` came from an agent's judgment, two runs on an unchanged site would disagree, and the ledger would record phantom regressions. Tiering and scoring stay in code. Agents interpret the ranking, they never produce it.
- **Subagents start cold.** Anything needing `strategy.json` plus the diagnosis plus the ledger costs more to brief than to just do.

Shape: **deterministic core, parallel fan-out at three named points, serial where reasoning compounds.**

---

## 5. Repo

```
rainmaker/
├── package.json                  # bin: rainmaker
├── rainmaker.config.yml            # gitignored
├── rainmaker.config.example.yml
├── .env / .env.example
│
├── src/                          # deterministic, runs without Claude
│   ├── cli.ts                    # init | doctor | audit | fetch | routine | report
│   ├── auth/google.ts            # service account, GA4 + GSC
│   ├── auth/verify.ts            # doctor
│   ├── fetch/{ga4,gsc,clarity,crawl}.ts
│   ├── analyze/{tiering,scoring,findings}.ts
│   ├── ledger/{append,materialise,query}.ts
│   ├── report/render.ts
│   ├── issues/filer.ts           # from lazarus-pit, extended with revenue ordering
│   └── providers/{firecrawl,contextdev}.ts
│
├── data/                         # gitignored
├── data.example/                 # committed
├── skills/<skill>/{SKILL.md,scripts/,references/}
└── .github/workflows/{weekly,monthly}.yml
```

---

## 6. Reports

One spine, every window:

```
1. WHAT CHANGED         numbers only, no adjectives
2. WHY IT MATTERS       framed in revenue tiers, not rankings
3. WHAT TO DO           ranked by revenue_score, effort noted
4. WHAT WE'RE WATCHING  leading indicators, stated thresholds
5. CONFIDENCE           which signals were available, which were missing
```

Section 5 is non-negotiable. A report built without GA4 key events must say so or it implies precision it does not have.

| Report | Window | Purpose |
|---|---|---|
| Pulse | WoW | operational drift, did anything break |
| Standard | 28-day | GSC's native window, avoids partial-data artefacts |
| Month | MoM | trend, content shipped vs planned |
| Quarter | 90-day | cluster performance, topic ROI, tier movement |
| Strategy review | quarterly | is `strategy.json` still true, triggers `grill-me` |
| Half-year | 6-month | which clusters earned their build cost |

28-day not 30-day, because GSC reports on a rolling 28 and mixing them manufactures trends that are not there. No dashboards: static files, versioned, diffable.

---

## 7. Gates

**Preflight** blocks a brief when: no pain point in `strategy.json` backs it, no slot exists in `keyword-plan`, an existing URL already targets the intent, page type contradicts SERP composition, fewer than N inbound links identified, no schema chosen, no author or evidence or first-hand claim, key claims not answerable in isolation, slop markers present, or no stated tier and revenue reason.

**Postflight** checks on cron: indexed (14d), canonical resolves (immediate), CWV not regressed (7d), internal links live (immediate), impressions appearing (28d), position trend (90d), AI citation check (90d), conversion contribution (90d). Failures file issues tagged to the originating brief.

---

## 8. Credentials

Console steps, in order. Blocking dependency for the GA4/GSC path.

1. Pick a GCP project or create one
2. Enable **Google Analytics Data API** and **Search Console API**
3. Create service account, download JSON key
4. GA4 → Admin → Property Access Management → add service account email as **Viewer**
5. Search Console → Settings → Users and permissions → add same email as **Full**
6. Key local and gitignored; add as `GOOGLE_SA_KEY` repo secret
7. `npx @vcxcvii/rainmaker doctor`

Service account not OAuth: no refresh-token expiry, no consent-screen publishing, survives unattended cron indefinitely.

Other keys: Clarity (held), Firecrawl (1,253 credits, 1,000/mo recurring, shipped default), context.dev (optional adapter, no balance endpoint exists), PageSpeed Insights (free, raises rate limits).

---

## 9. Originality posture

Reference skills are read for structure and failure modes, not copied.

- Multi-mode data detection with graceful degradation is a pattern, not IP. Worth adopting.
- Every threshold, weight, tier, checklist item and report spine derives from the revenue-proximity model, which is ours.
- No reference skill ranks by revenue proximity, files issues, persists strategy, keeps a causal ledger, or detects drift. That is the differentiation.
- Grow & Convert's pain-point method and Ogilvy's principles are cited in `references/` with links, not absorbed silently.

State this in the README. Attribution is what separates building on prior art from taking it.

---

## 10. Build order

| # | Block | Unblocks |
|---|---|---|
| 1 | Rename, scaffold, config schema, CLI skeleton | everything |
| 2 | Console steps, `auth/google.ts`, `doctor` | all GA4/GSC work |
| 3 | Fetchers: GA4, GSC, Clarity, crawl adapter | all analysis |
| 4 | Ledger: append, materialise, query | all memory and reporting |
| 5 | `metrics-decoder` + definitions | every skill cites it |
| 6 | `tiering.ts` + `scoring.ts` | the ranking model |
| 7 | `site-health-check` + `google-rankings-check` | first real diagnosis |
| 8 | `competitor-teardown` + `ai-search-check` | benchmarking for grill-me |
| 9 | `grill-me` → `strategy.json` | all DECIDE and BUILD |
| 10 | `buyer-sharpener`, `revenue-map`, `topic-map`, `keyword-plan` | briefs |
| 11 | `content-brief`, `content-writer`, `draft-punch-up`, `content-refresh` | shipping |
| 12 | `publish-checklist` | quality enforcement |
| 13 | `weekly-autopilot` + issue filing in revenue order | automation |
| 14 | `progress-report` + `where-we-stand` + six cadences | visible output |
| 15 | `ai-readable-setup`, `whats-new-in-search` | AI-search currency |
| 16 | npx packaging, README, blog post | distribution |
