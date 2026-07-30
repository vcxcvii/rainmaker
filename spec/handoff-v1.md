# paydirt — Implementation Handoff Specification

**Audience:** an autonomous coding agent (Codex) executing without further clarification.
**Authority:** this document. Where it conflicts with anything else, this wins.
**Rule:** if a detail is unspecified here, choose the option that is deterministic, testable, and cheapest to run, then record the choice in `DECISIONS.md`. Do not ask.

---

## 0. Current state

Repository: `<repo root>/lazarus-pit` (directory and GitHub repo still named `lazarus-pit`; npm package already renamed to `paydirt`). Remote: `https://github.com/vcxcvii/lazarus-pit.git`.

**Block 1 is complete and committed** (`e5d7845`). Do not redo it.

Already existing and working:

```
package.json                    name: paydirt, bin: paydirt -> dist/cli.js
tsconfig.json                   ES2022, ESNext modules, Bundler resolution, strict
.gitignore                      ignores node_modules/ dist/ .env data/ paydirt.config.yml
.env.example                    all key names documented
paydirt.config.example.yml
src/cli.ts                      command surface, only `init` wired
src/config/schema.ts            PaydirtConfig, REVENUE_MODELS, validateConfig
src/config/load.ts              loadConfig, ConfigError, CONFIG_FILENAME
src/config/schema.test.ts       6 passing tests
src/commands/init.ts            TTY-interactive + flag-driven
src/fetch/clarity.ts            legacy, from lazarus-pit
src/analyze/findings.ts         legacy, from lazarus-pit
src/analyze/component-mapper.ts legacy, from lazarus-pit
src/issues/filer.ts             legacy, from lazarus-pit
src/run.ts                      legacy chain, to be replaced by `paydirt routine`
PLAN.md                         design rationale, secondary to this document
```

Verify before starting: `npm install && npx tsc --noEmit && npm test` must all pass.

**First action:** rename the GitHub repo to `paydirt` via `gh repo rename paydirt`, then `git remote set-url origin https://github.com/vcxcvii/paydirt.git`. Rename the local directory to `<repo root>/paydirt`.

---

## 1. What this is

A GTM-native SEO / AEO / content system with one differentiating principle:

> Every finding is ranked by **distance to revenue**, never by technical severity.

Two layers, one repository, joined by a file contract:

| Layer | Path | Runs | Determinism |
|---|---|---|---|
| Deterministic core | `src/` | `npx paydirt`, GitHub Actions cron | Required. Identical input must produce byte-identical output. |
| Judgment layer | `skills/` | Claude | Not required. Reads what `src/` writes. Never re-crawls. |

---

## 2. Non-negotiable invariants

Violating any of these is a defect regardless of test status.

1. **Scoring is code, never inference.** `revenue_score` is computed in `src/analyze/scoring.ts`. No LLM produces or adjusts a score. Two runs over unchanged input produce identical scores.
2. **Skills never fetch what the core already fetched.** Skills read `data/`. If data is missing, a skill instructs the user to run the relevant CLI command and stops.
3. **Every report states its confidence.** A report built without GA4 key events must say so in a mandatory section. Silent degradation is a defect.
4. **The ledger is append-only.** Never rewrite or delete a line in `ledger.jsonl`. `state.json` is derived and must be reconstructible by replaying the ledger from line 1.
5. **Finding IDs are stable across wording changes.** Derived from nature plus location, never from message text.
6. **`data/` is never committed.** It contains real traffic, conversion counts and modelled pipeline. `data.example/` is committed with identical shapes and fabricated numbers.
7. **No credential is required for a first audit.** `paydirt audit` must produce a full technical, AI-search and competitor diagnosis with zero credentials configured.
8. **Correlation is labelled as correlation.** Never assert that an algorithm update, or any intervention, caused a metric change. State timing consistency and report the control.

---

## 3. Repository layout (target)

```
paydirt/
├── package.json
├── tsconfig.json
├── paydirt.config.yml            gitignored
├── paydirt.config.example.yml
├── .env / .env.example
├── README.md
├── PLAN.md
├── DECISIONS.md                  agent-recorded choices for unspecified details
│
├── src/
│   ├── cli.ts
│   ├── commands/
│   │   ├── init.ts               DONE
│   │   ├── doctor.ts
│   │   ├── audit.ts
│   │   ├── fetch.ts
│   │   ├── routine.ts
│   │   ├── report.ts
│   │   └── ledger.ts
│   ├── config/
│   │   ├── schema.ts             DONE
│   │   ├── load.ts               DONE
│   │   └── schema.test.ts        DONE
│   ├── auth/
│   │   ├── google.ts             service account -> GA4 + GSC clients
│   │   └── verify.ts             per-capability probes for doctor
│   ├── fetch/
│   │   ├── ga4.ts
│   │   ├── gsc.ts
│   │   ├── clarity.ts            legacy, refactor to Fetcher interface
│   │   └── crawl.ts              provider-agnostic
│   ├── providers/
│   │   ├── firecrawl.ts
│   │   ├── contextdev.ts
│   │   └── types.ts              CrawlProvider interface
│   ├── analyze/
│   │   ├── tiering.ts
│   │   ├── scoring.ts
│   │   ├── findings.ts           legacy, extend
│   │   ├── component-mapper.ts   legacy
│   │   └── *.test.ts
│   ├── ledger/
│   │   ├── types.ts
│   │   ├── append.ts
│   │   ├── materialise.ts
│   │   ├── query.ts
│   │   └── *.test.ts
│   ├── report/
│   │   ├── render.ts
│   │   ├── windows.ts
│   │   └── templates/
│   ├── issues/
│   │   └── filer.ts              legacy, extend with revenue ordering
│   └── util/
│       ├── url.ts                normalise, match paths
│       └── concurrency.ts        pool(n, tasks)
│
├── data/                         gitignored
│   ├── ledger.jsonl
│   ├── state.json
│   ├── strategy.json
│   ├── strategy-history/
│   └── snapshots/<ISO8601>/
│       ├── crawl.json
│       ├── ga4.json
│       ├── gsc.json
│       ├── clarity.json
│       └── diagnosis.json
│
├── data.example/                 committed, same shapes, fake numbers
├── skills/<skill-name>/
│   ├── SKILL.md
│   ├── scripts/*.mjs
│   └── references/*.md
└── .github/workflows/
    ├── weekly.yml
    └── monthly.yml
```

---

## 4. Revenue tiering

### 4.1 Tiers

```ts
export const TIER_WEIGHT = {
  0: 5.0,   // Transaction: pricing, demo, trial, signup, checkout, contact
  1: 3.0,   // Decision: comparisons, /vs/, alternatives, case studies, integrations, ROI
  2: 2.0,   // Solution: pain-point content, use cases, how-to-solve-X
  3: 1.0,   // Problem: awareness, educational, definitional
  4: 0.3,   // Ambient: brand, about, careers, general blog
} as const;
```

### 4.2 Assignment rules, in strict precedence order

Evaluate top to bottom. **First match wins.** Record which rule fired in `tier_source` and the confidence in `tier_confidence`.

| # | Rule | Condition | Assigns | `tier_source` | `tier_confidence` |
|---|---|---|---|---|---|
| 1 | GA4 conversion path | URL appears in >= 5% of paths preceding a key event, over the config'd `sales_cycle_days` window | 0 if it *is* a conversion page, else 1 | `ga4_path` | 0.95 |
| 2 | Declared primary | URL matches any `primary_conversion` entry | 0 | `declared_primary` | 1.0 |
| 3 | Declared secondary | URL matches any `secondary_conversion` entry | 2 | `declared_secondary` | 0.8 |
| 4 | URL pattern | see 4.3 | per table | `url_pattern` | 0.6 |
| 5 | GSC query intent | see 4.4 | per table | `query_intent` | 0.5 |
| 6 | On-page signals | see 4.5 | per table | `onpage` | 0.4 |
| 7 | Link distance | hops from nearest Tier 0 page: 1 hop -> 2, 2 hops -> 3, 3+ -> 4 | per rule | `link_distance` | 0.3 |
| 8 | Default | nothing matched | 3 | `default` | 0.1 |

### 4.3 URL patterns (rule 4)

Case-insensitive substring match on pathname.

```
Tier 0: /pricing /plans /demo /trial /signup /sign-up /register /checkout
        /contact /get-started /book /schedule /buy
Tier 1: /vs/ /versus/ /alternative /alternatives /compare /comparison
        /case-stud /customers/ /customer-stories /integrations/ /roi
        /why- /switch
Tier 2: /use-case /solutions/ /for-/ /how-to /guide/ /template
Tier 4: /about /careers /jobs /team /press /legal /privacy /terms
        /author/ /tag/ /category/ /page/
```

### 4.4 Query intent (rule 5)

Take the URL's top 10 GSC queries by impressions over 28 days. Classify each, then take the modal class.

```
Commercial (-> Tier 1): pricing, cost, price, vs, versus, alternative,
  alternatives, best, top, review, reviews, comparison, competitor
Transactional (-> Tier 0): buy, demo, trial, free trial, signup, sign up,
  get started, book a demo, pricing page
Solution (-> Tier 2): how to, how do i, solve, fix, reduce, improve,
  automate, streamline, prevent
Informational (-> Tier 3): what is, why is, definition, meaning, examples,
  guide, tutorial, statistics, trends
```

### 4.5 On-page signals (rule 6)

```
Tier 0 if: a <form> with an email or payment input, OR a pricing table
           (3+ sibling elements each containing a currency symbol and a
           CTA link), OR schema.org Product/Offer
Tier 1 if: schema.org Review/AggregateRating, OR a comparison <table>
           naming 2+ external brand names from config.competitors
Tier 2 if: schema.org HowTo or FAQPage
```

### 4.6 Confidence propagation

A finding's `confidence` is the product of its `tier_confidence` and its measurement confidence (1.0 for directly measured technical facts, 0.7 for API-reported figures, 0.5 for inferred). Reports must surface any finding with `confidence < 0.5` in a separate "low confidence" group.

---

## 5. Scoring

```ts
// src/analyze/scoring.ts
export function revenueScore(f: Finding, ctx: ScoringContext): number {
  const tier = TIER_WEIGHT[f.tier];
  const opportunity = computeOpportunity(f, ctx);   // >= 0.1
  const severity = SEVERITY[f.severity];            // 0.1 .. 1.0
  const effort = Math.max(f.effort_hours, 0.25);
  return round2((tier * opportunity * severity) / effort);
}
```

### 5.1 Opportunity

```
If GSC data exists for the URL:
  achievable_ctr = CTR_CURVE[round(target_position)]
  current_ctr    = clicks / impressions        (0 if impressions === 0)
  gap            = max(achievable_ctr - current_ctr, 0)
  opportunity    = max(impressions * gap, 0.1)

  target_position = max(current_position - 5, 3)

Else (no GSC data):
  opportunity = 1.0
```

`CTR_CURVE` (position -> CTR), interpolate linearly between listed points, clamp below 0.01 beyond position 20:

```
1: 0.276   2: 0.152   3: 0.099   4: 0.071   5: 0.054
6: 0.043   7: 0.035   8: 0.029   9: 0.025  10: 0.022
11: 0.019 12: 0.016  13: 0.014  14: 0.012  15: 0.011
16: 0.010 17: 0.009  18: 0.008  19: 0.007  20: 0.006
```

Source these constants in a comment as "aggregate industry CTR curve, replace with the site's own GSC-derived curve once 90 days of data exist." Implement `deriveCtrCurve(gscData)` and prefer it when >= 90 days of GSC history is present.

### 5.2 Severity

```ts
export const SEVERITY = {
  blocking: 1.0,   // page unreachable, noindexed by mistake, canonical to 404
  major:    0.7,   // CWV fail, duplicate cluster, orphan, missing canonical
  moderate: 0.4,   // thin schema, weak internal linking, title/meta issues
  minor:    0.15,  // cosmetic, non-ranking metadata
} as const;
```

### 5.3 Effort

Every finding type declares a fixed `effort_hours` in a lookup table in `src/analyze/effort.ts`. No estimation at runtime. Table entries are integers or 0.5 increments. Example rows:

```
canonical_to_404          0.5
orphan_page               1
missing_llms_txt          1
cwv_lcp_images            2
duplicate_cluster         3
thin_comparison_page      3
no_internal_path_to_tier1 0.5   per page
```

### 5.4 Value weighting

If `config.acv > 0`, multiply `revenue_score` by `min(log10(acv) / 4, 1.5)`. If `acv === 0`, skip. Document this in the report footnote when applied.

---

## 6. Ledger

### 6.1 Finding ID

```
<tier>:<check>:<path>

t0:canonical:/demo
t1:position:/blog/contract-review-checklist
t3:orphan:/blog/what-is-clm
```

`check` is the machine name of the check that produced it, from a closed enum in `src/analyze/checks.ts`. Path is the normalised pathname (lowercase, trailing slash stripped except root, query and fragment removed).

**The ID must not change when the tier changes.** Use the tier at first observation, and record tier changes as their own event type. Rationale: otherwise a re-tiered page appears as one finding closing and another opening.

### 6.2 Event schema

`data/ledger.jsonl`, one JSON object per line, newline-terminated, never rewritten.

```ts
export interface LedgerEvent {
  ts: string;              // ISO 8601 UTC, e.g. "2026-08-26T14:00:00Z"
  id: string;              // finding id, or "site" for site-level events
  event: EventType;
  from?: Record<string, number | string | null>;
  to?: Record<string, number | string | null>;
  cause?: string;          // GitHub issue ref "#220", commit sha, or "external:core-update-2026-08"
  effort_h?: number;
  score?: number;          // revenue_score at time of event
  confidence?: number;
  note?: string;           // <= 200 chars, no newlines
}

export type EventType =
  | 'opened'        // first observation
  | 'acknowledged'  // issue filed
  | 'in_progress'   // issue assigned or PR opened
  | 'shipped'       // fix deployed, detected by re-measure or commit link
  | 'verified'      // improvement confirmed after the verification window
  | 'regressed'     // previously verified, now failing again
  | 'closed'        // resolved and stable, or dismissed
  | 'dismissed'     // human decided not to act; requires `note`
  | 'retiered'      // tier assignment changed
  | 'algo_update';  // external event from whats-new-in-search
```

### 6.3 State machine

Legal transitions only. Reject and log anything else.

```
(none)      -> opened
opened      -> acknowledged | dismissed | closed
acknowledged-> in_progress | dismissed | closed
in_progress -> shipped | dismissed
shipped     -> verified | regressed
verified    -> regressed | closed
regressed   -> acknowledged | in_progress
closed      -> opened          (recurrence; keeps full history)
dismissed   -> opened
```

`retiered` and `algo_update` are orthogonal and may occur in any state without changing it.

### 6.4 Verification windows

After `shipped`, do not emit `verified` or `regressed` until the window elapses:

```
canonical, redirect, robots, internal links      3 days
indexation                                      14 days
CWV                                              7 days
position, impressions, clicks                   28 days
conversion contribution                         90 days
AI citation                                     90 days
```

### 6.5 state.json

Materialised view. Rebuildable from ledger with `paydirt ledger --rebuild`. Must be byte-identical to a fresh rebuild; add a test asserting this.

```ts
export interface State {
  generated_at: string;
  ledger_lines: number;      // for staleness detection
  findings: Record<string, {
    status: EventType;
    tier: 0|1|2|3|4;
    first_seen: string;
    last_event: string;
    current: Record<string, number | string | null>;
    baseline: Record<string, number | string | null>;  // values at `opened`
    score: number;
    confidence: number;
    cause_chain: string[];
  }>;
}
```

### 6.6 Retention

- `ledger.jsonl`: forever. Never prune.
- `data/snapshots/`: full fidelity for 90 days. Beyond that, downsample to one snapshot per ISO week, keeping the Monday one, deleting the rest. Implement as `paydirt ledger --compact`, run from the monthly workflow.

---

## 7. Data contract

Every file below is JSON, UTF-8, 2-space indented, keys sorted alphabetically for diff stability.

### 7.1 `snapshots/<ts>/crawl.json`

```ts
interface CrawlSnapshot {
  fetched_at: string;
  provider: 'firecrawl' | 'contextdev';
  site: string;
  urls_discovered: number;
  urls_fetched: number;
  budget_exhausted: boolean;
  pages: CrawlPage[];
}

interface CrawlPage {
  url: string;
  status: number;
  title: string | null;
  meta_description: string | null;
  canonical: string | null;
  robots_meta: string | null;
  h1: string[];
  word_count: number;
  schema_types: string[];
  internal_links_out: string[];
  external_links_out: string[];
  content_hash: string;      // sha256 of normalised text, for duplicate detection
  last_modified: string | null;
}
```

### 7.2 `snapshots/<ts>/gsc.json`

```ts
interface GscSnapshot {
  fetched_at: string;
  site_url: string;
  window_days: 28;
  start_date: string;
  end_date: string;
  rows: {
    page: string;
    query: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }[];
}
```

Always request 28 days. Never 30. GSC reports on a rolling 28-day basis and mixing windows manufactures trends that do not exist.

### 7.3 `snapshots/<ts>/ga4.json`

```ts
interface Ga4Snapshot {
  fetched_at: string;
  property_id: string;
  window_days: number;          // = config.sales_cycle_days, min 28
  key_events_configured: string[];   // empty array is the common case
  pages: {
    path: string;
    sessions: number;
    engaged_sessions: number;
    key_events: number;
    conversion_paths: number;   // count of key-event paths containing this page
  }[];
  paths_sampled: number;
}
```

If `key_events_configured` is empty, set every `key_events` and `conversion_paths` to 0 and record a site-level warning. Tiering rule 1 is then skipped.

### 7.4 `snapshots/<ts>/diagnosis.json`

```ts
interface Diagnosis {
  generated_at: string;
  config_hash: string;             // sha256 of paydirt.config.yml, detects config drift
  capabilities: Record<'crawl'|'gsc'|'ga4'|'clarity'|'pagespeed', 'live'|'missing'|'error'>;
  tier_distribution: Record<'0'|'1'|'2'|'3'|'4', number>;
  findings: Finding[];
}

interface Finding {
  id: string;
  check: string;
  url: string;
  tier: 0|1|2|3|4;
  tier_source: string;
  tier_confidence: number;
  severity: 'blocking'|'major'|'moderate'|'minor';
  effort_hours: number;
  opportunity: number;
  revenue_score: number;
  confidence: number;
  evidence: Record<string, unknown>;   // raw measured values, never prose
  message: string;                     // one sentence, no adjectives
}
```

`findings` is sorted by `revenue_score` descending, then `id` ascending for stability.

---

## 8. CLI specification

Exit codes: `0` success, `1` user error (bad config, missing credential where required), `2` internal error.

All commands accept `--json` to emit machine output on stdout and suppress human formatting.

### `paydirt init`
Done. Do not modify except to add flags if new config fields appear.

### `paydirt doctor`

Probes each capability independently. Never aborts on the first failure. Output:

```
CRAWL       ok       firecrawl, 1253 credits
PAGESPEED   ok       no key (5 req/min limit)
GSC         MISSING  google-rankings-check unavailable; opportunity scoring falls back to 1.0
GA4         MISSING  conversion-path tiering unavailable; rule 1 skipped
CLARITY     MISSING  visitor-drop-off-audit unavailable

3 of 5 capabilities degraded.
Audit will still run. Findings will carry reduced confidence.
```

Each probe: attempt the cheapest real API call, 10s timeout, catch all errors, report `ok` / `MISSING` / `ERROR <reason>`. For every non-ok capability, print exactly which skills or scoring behaviours degrade. Exit 0 even when everything is missing.

### `paydirt audit [--refresh] [--max-urls N]`

1. Load config (fail with exit 1 if invalid).
2. Run `doctor` probes silently, populate `capabilities`.
3. Crawl (respecting `crawl.max_urls`, `crawl.exclude`, robots.txt).
4. Fetch GSC, GA4, Clarity where live.
5. Write snapshot files.
6. Tier every URL.
7. Run all checks, produce findings.
8. Score and sort.
9. Write `diagnosis.json`.
10. Append `opened` events for new finding IDs; append `closed` for IDs absent from this run that were previously open.
11. Rebuild `state.json`.
12. Print summary plus top 5 findings.

`--refresh` re-runs tiering and scoring against the most recent snapshot without re-crawling.

### `paydirt fetch [--source ga4|gsc|clarity|all]`
Pull metrics into a new snapshot directory without crawling or scoring.

### `paydirt routine`
`fetch` + `audit --refresh` + file GitHub issues in `revenue_score` order + append ledger events. Idempotent: filing twice in one day must not duplicate issues. Reuse the existing dedupe logic in `src/issues/filer.ts`.

### `paydirt report --window <pulse|28d|month|quarter|half-year|strategy>`
Renders to `reports/<window>-<date>.md` and `.html`. See section 10.

### `paydirt ledger [--id X] [--since DATE] [--status S] [--rebuild] [--compact]`
Query and maintenance.

---

## 9. Skills

21 skills. Each is `skills/<name>/SKILL.md` with YAML frontmatter (`name`, `description`) plus optional `scripts/` and `references/`.

**Frontmatter `description` must state trigger phrases explicitly**, following the pattern in `seo-checker`: enumerate the casual phrasings a user might type.

**Every SKILL.md must open with a data-availability check**: which `data/` files it needs, and what to tell the user if they are absent. Skills never crawl or call APIs that the core already covers.

| Skill | Reads | Writes | Scripts |
|---|---|---|---|
| `site-health-check` | crawl, diagnosis | — | `crawl.mjs` `cwv.mjs` `canonicals.mjs` `linkgraph.mjs` `robots.mjs` |
| `google-rankings-check` | gsc, diagnosis | — | `gsc-pull.mjs` `striking-distance.mjs` `cannibalisation.mjs` |
| `ai-search-check` | crawl, diagnosis | — | `schema-audit.mjs` `citation-probe.mjs` |
| `visitor-drop-off-audit` | clarity, ga4 | — | `clarity-pull.mjs` `ga4-paths.mjs` |
| `competitor-teardown` | config, crawl | `competitors.json` | `sitemap-diff.mjs` `gap.mjs` |
| `grill-me` | diagnosis, competitors | `strategy.json` | — |
| `buyer-sharpener` | strategy, ga4, gsc | `strategy.json` | — |
| `revenue-map` | diagnosis, ga4 | `strategy.json` | — |
| `topic-map` | strategy, gsc, competitors | `strategy.json` | — |
| `keyword-plan` | strategy, gsc, crawl | `strategy.json` | — |
| `content-brief` | strategy | `briefs/<slug>.md` | — |
| `content-writer` | briefs, strategy | `drafts/<slug>.md` | — |
| `draft-punch-up` | drafts | `drafts/<slug>.md` | — |
| `content-refresh` | gsc, crawl, ledger | — | `decay.mjs` |
| `ai-readable-setup` | crawl, strategy | — | `schema-gen.mjs` `llms-txt-gen.mjs` |
| `weekly-autopilot` | config | workflow files | — |
| `progress-report` | ledger, snapshots | `reports/` | — |
| `publish-checklist` | briefs, strategy, crawl | — | `preflight.mjs` `postflight.mjs` |
| `where-we-stand` | ledger, state, strategy | — | — |
| `metrics-decoder` | — | — | — |
| `whats-new-in-search` | live web, ledger, diagnosis | ledger | `fetch-updates.mjs` |

### 9.1 `grill-me` (the hinge)

- **Refuses to run without a `diagnosis.json`.** Print: "Run `paydirt audit` first. Interrogating you about a site I have not looked at produces generic questions."
- Opens by stating what the diagnosis found and how it compares to `competitors.json`.
- **One question at a time.** Never batch. Each question must reference a specific finding or number.
- Minimum 12 questions, covering: ICP, pain points in the buyer's own words, what actually closes deals, which pages the sales team sends, what the diagnosis contradicts.
- Writes `strategy.json`, moving any prior version to `strategy-history/<ts>.json` with a `reason` field.

### 9.2 `metrics-decoder`

Reference-only skill, cited by all others. `references/definitions.md` must cover, each with: one-sentence definition, common misuse, what to say instead.

```
GA4: session, engaged session, key event, conversion, attribution window,
     data threshold, sampling, exploration vs report discrepancy
GSC: impression, position (and why it is an average of averages), CTR,
     coverage, discovered-not-indexed, crawled-not-indexed, canonical (Google-selected
     vs user-declared), 28-day window
SEO: crawl budget, index bloat, cannibalisation, striking distance, E-E-A-T,
     domain authority (third-party, not Google's), PageRank, internal link equity,
     content decay, thin content
AEO/GEO: AEO vs GEO vs SEO, extractability, citation, entity, ontology,
     knowledge graph, vector embedding, semantic similarity, llms.txt
CWV: LCP, INP, CLS, field vs lab data, TTFB
```

### 9.3 `whats-new-in-search`

Never answers from training data. Always fetches. Always stamps `fetched_at`.

**Sources, tiered, and every claim carries its tier:**

| Tier | Source |
|---|---|
| Confirmed | Google Search Status Dashboard (ranking and indexing feeds) |
| Confirmed | Google Search Central blog and documentation changelog |
| Confirmed | Bing Webmaster blog; OpenAI, Anthropic, Perplexity crawler docs |
| Observed | SERP volatility trackers (Mozcast, Semrush Sensor, AWR) |
| Observed | Search Engine Roundtable |

**Three-stage output, all three mandatory:**

1. **What changed** — name, dates, confirmed or observed, what it targets.
2. **What it means for you** — cross-reference `crawl.json` (which of your pages match the pattern), `state.json` (their tiers), `gsc.json` (position and impression deltas across the update window), `ledger.jsonl` (what you shipped in that window). Concrete counts, never general advice.
3. **What to do** — ranked by `revenue_score`. Low-tier items explicitly deprioritised with the reason shown.

**Control check:** report whether non-matching pages also moved in the same window. If they did, state that the update is unlikely to be the cause.

**Writes an `algo_update` ledger event** so `where-we-stand` can later attribute a decline to a core update rather than to shipped work.

### 9.4 `where-we-stand`

Answers three questions, in this order, and must be willing to report failure:

1. What did we believe? (`strategy.json` and its history)
2. What did we do? (ledger events with `cause`)
3. What actually happened? (`baseline` vs `current` per finding)

Must include a section titled "What did nothing", listing shipped interventions whose target metric did not move beyond its verification window. A retrospective that only reports wins is a defect.

---

## 10. Reports

### 10.1 Mandatory spine

Every report, every window, exactly these five sections in this order:

```
## 1. What changed
Numbers only. No adjectives. Maximum 5 lines.

## 2. Why it matters
Framed in revenue tiers. Never "rankings improved" without the tier and the
conversion consequence.

## 3. What to do
Ranked by revenue_score. Each line: URL, tier, metric delta, effort, score.

## 4. What we're watching
Leading indicators with stated numeric thresholds.

## 5. Confidence
Which capabilities were live, which were missing, and precisely what that
weakens. Non-negotiable.
```

### 10.2 Windows

| `--window` | Period | Trigger | Output |
|---|---|---|---|
| `pulse` | week over week | weekly workflow | GitHub issue comment |
| `28d` | rolling 28 days | on demand | md + html |
| `month` | month over month | monthly workflow | md + html |
| `quarter` | 90 days | on demand | md + html |
| `strategy` | quarterly | monthly workflow, if drift detected | md, and triggers `grill-me` |
| `half-year` | 180 days | on demand | md + html |

### 10.3 Drift detection (`strategy` window)

Emit a strategy review when any holds:

- A pain point in `strategy.json` has shipped content and zero conversion paths after 90 days.
- Any pain point converts at >= 2x or <= 0.5x the strategy mean.
- >= 40% of converting queries carry phrasing absent from `icp_hint` and `strategy.json` pain points.
- >= 25% of URLs have been `retiered` since the strategy was written.

The report names which condition fired and recommends re-running `grill-me`.

### 10.4 HTML output

Single self-contained file. Inline CSS. No external requests. Light and dark via `prefers-color-scheme`. Tables scroll inside `overflow-x: auto`. No dashboards, no JS charting libraries; if a chart is needed, emit inline SVG.

---

## 11. Gates

### 11.1 Preflight (blocks a brief)

| Gate | Fails when |
|---|---|
| pain_point_provenance | brief cites no pain point present in `strategy.json` |
| cluster_slot | no matching slot in `keyword-plan` |
| cannibalisation | an existing URL in `crawl.json` already targets this intent |
| intent_match | page type contradicts SERP composition for the target query |
| internal_links | fewer than 3 inbound link sources identified |
| schema_planned | no schema.org type chosen |
| eeat_signals | no named author, no first-hand evidence, no cited source |
| extractability | key claims not answerable as standalone sentences |
| slop_check | see 11.3 |
| revenue_argument | no stated tier and no revenue rationale |

Output is a pass/fail table plus a recommendation. Never auto-override.

### 11.2 Postflight (cron)

| Gate | Window |
|---|---|
| indexed | 14 days |
| canonical_correct | immediate |
| cwv_not_regressed | 7 days |
| internal_links_live | immediate |
| impressions_appearing | 28 days |
| position_trend | 90 days |
| ai_citation | 90 days |
| conversion_contribution | 90 days |

Failures file an issue tagged with the originating brief slug.

### 11.3 Slop check

Fail on any of: opening with "In today's...", "In the world of...", "Let's dive in"; three-item lists used as rhetorical filler in 3+ consecutive paragraphs; the words "leverage", "utilize", "seamless", "robust", "game-changer", "unlock", "elevate", "supercharge" above 1 per 500 words; **any em-dash** (the site owner's voice uses none, and their published posts contain none); sentences over 40 words; more than 2 consecutive paragraphs of identical sentence count.

---

## 12. Credentials

### 12.1 Console steps (human, blocking for GA4/GSC)

Document in README exactly as:

1. Choose a GCP project, or create one.
2. Enable **Google Analytics Data API** and **Google Search Console API**.
3. Create a service account. Create and download a JSON key.
4. GA4 → Admin → Property Access Management → add the service account `client_email` as **Viewer**.
5. Search Console → Settings → Users and permissions → add the same email as **Full**.
6. Save the key as `google-service-account.local.json` (gitignored). Add its contents as GitHub secret `GOOGLE_SA_KEY`.
7. Run `npx paydirt doctor`.

**Service account, not OAuth.** No refresh-token expiry, no consent-screen publishing, survives unattended cron indefinitely. Do not implement an OAuth flow.

### 12.2 Environment

```
GOOGLE_APPLICATION_CREDENTIALS   path to service account JSON
CLARITY_TOKEN                    Microsoft Clarity data export
FIRECRAWL_API_KEY                shipped default crawl provider
CONTEXT_DEV_API_KEY              optional adapter
PAGESPEED_API_KEY                optional, raises rate limits
PAYDIRT_TARGET_REPO              defaults to the repo paydirt runs in
```

### 12.3 Provider notes

- **Firecrawl** is the default. 1000 credits/month recurring. Respect `crawl.max_urls`; refuse to start a crawl projected to exceed remaining credits and print the projection.
- **context.dev** exposes no credit-balance endpoint (verified). Rate limit is 30/min via `x-ratelimit-*` headers. Use only for `/brand/retrieve` and `/parse`. Never make it the default.
- Both sit behind `CrawlProvider` in `src/providers/types.ts`. Adding a provider must not touch `src/fetch/crawl.ts`.

---

## 13. Concurrency

Fan out to parallel agents in exactly three places. Nowhere else.

| Location | Unit | Max parallel |
|---|---|---|
| `competitor-teardown` | one competitor | 5 |
| `content-brief` batch | one brief | 5 |
| `ai-search-check` | one citation probe | 5 |

Everywhere else: `src/util/concurrency.ts` `pool(n, tasks)` with n = 8 for network IO. Never spawn agents for measurement. Never parallelise `grill-me`; question N depends on the answer to N-1, and that dependency is the value.

---

## 14. Build order and acceptance criteria

Execute in order. Each block ends with a commit. Do not begin a block until the previous block's criteria pass.

| # | Block | Done when |
|---|---|---|
| 1 | Scaffold, config | **COMPLETE** (`e5d7845`) |
| 2 | `auth/google.ts`, `auth/verify.ts`, `doctor` | `doctor` exits 0 with zero credentials and prints 5 capability lines; each probe unit-tested against a mocked client |
| 3 | Fetchers: GA4, GSC, Clarity, crawl + 2 providers | `fetch --source all` writes 4 valid snapshot files against fixtures; provider swap requires no change to `crawl.ts` |
| 4 | Ledger: types, append, materialise, query | replaying a 1000-line fixture ledger produces `state.json` byte-identical to the committed expectation; illegal transitions rejected with a test |
| 5 | `metrics-decoder` + `references/definitions.md` | every term in 9.2 present with definition, misuse, replacement |
| 6 | `tiering.ts`, `scoring.ts`, `effort.ts` | 8 precedence rules unit-tested including ties; identical input yields identical scores across 100 runs |
| 7 | `site-health-check`, `google-rankings-check` + scripts | `audit` produces a sorted `diagnosis.json` on a fixture site with zero credentials |
| 8 | `competitor-teardown`, `ai-search-check` | 5-way fan-out completes; `competitors.json` written |
| 9 | `grill-me` | refuses without diagnosis; writes `strategy.json`; prior version archived with reason |
| 10 | `buyer-sharpener`, `revenue-map`, `topic-map`, `keyword-plan` | each mutates `strategy.json` additively, never destructively |
| 11 | `content-brief`, `content-writer`, `draft-punch-up`, `content-refresh` | brief -> draft -> punch-up round-trips; `content-refresh` classifies into refresh/rewrite/consolidate/kill |
| 12 | `publish-checklist` + scripts | all 10 preflight gates fire on a deliberately bad fixture brief |
| 13 | `weekly-autopilot`, issue filing in revenue order | running twice in one day files zero duplicate issues |
| 14 | `progress-report`, `where-we-stand`, 6 windows | every report contains all 5 spine sections; drift detection fires on a fixture meeting each of the 4 conditions |
| 15 | `ai-readable-setup`, `whats-new-in-search` | 3-stage output; source tier labelled on every claim; `algo_update` event written |
| 16 | npx packaging, README, `data.example/` | `npm pack` then install into a clean directory then `paydirt init` succeeds |

---

## 15. Engineering standards

- TypeScript strict. No `any`. No non-null assertions except immediately after an explicit guard.
- Every module in `src/analyze/`, `src/ledger/`, `src/config/` has a colocated `*.test.ts`. Target: every scoring, tiering and state-transition branch covered.
- `npx tsc --noEmit` and `npm test` must pass before every commit.
- No network calls in tests. Fixtures live in `src/**/__fixtures__/`.
- Comments explain **why**, never what. Match the density in `src/config/schema.ts`.
- Commit messages: imperative subject under 72 chars, body explaining rationale, and:
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
- Never commit `data/`, `.env`, `paydirt.config.yml`, or any `*.local.json`.

---

## 16. Do not

- Do not implement an OAuth flow for Google. Service account only.
- Do not let an LLM compute, adjust or re-rank `revenue_score`.
- Do not make context.dev the default crawl provider.
- Do not use a 30-day GSC window anywhere.
- Do not rewrite or prune `ledger.jsonl`.
- Do not commit `data/`.
- Do not copy text from any file under `~/Downloads/Skills/`. Read them for structure and failure modes only. Cite Grow & Convert and Ogilvy in `references/` with links.
- Do not build a web dashboard. Reports are static, versioned, diffable files.
- Do not use em-dashes in any generated content, skill prose, or report copy.
- Do not spawn subagents outside the three locations in section 13.
- Do not mark a block complete without its acceptance criteria passing.
