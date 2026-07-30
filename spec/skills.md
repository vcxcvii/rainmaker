# Rainmaker: Skill Specifications

**Status:** normative, v3. Supersedes v2 `spec/skills.md` and section 9 of `spec/handoff-v1.md`.

Every skill is `skills/<name>/SKILL.md`, opening with the Context load block from `spec/context-layer.md` section 5, verbatim.

---

## 0. Naming

Skills are named for the outcome the user wants, in the words they would use. Nobody wakes up wanting a "SERP qualification pass". They want to know whether they can actually rank for something before they spend three weeks on it.

| v1 / v2 name | v3 name |
|---|---|
| `grill-me` / `buyer-grill` | `know-my-buyer` |
| `buyer-sharpener` | `say-it-their-way` |
| `site-health-check` | `unblock-my-money-pages` |
| `google-rankings-check` | `find-my-quick-wins` |
| `ai-search-check` | `get-mentioned-by-ai` |
| `visitor-drop-off-audit` | `stop-losing-visitors` |
| `competitor-teardown` | `beat-my-competitors` |
| `revenue-map` | `follow-the-money` |
| `topic-map` | `pick-my-battles` |
| `keyword-plan` | `what-to-target-next` |
| `content-brief` | `brief-my-writer` |
| `content-writer` | `write-the-page` |
| `draft-punch-up` | `make-it-sound-human` |
| `content-refresh` | `revive-old-pages` |
| `ai-readable-setup` | `make-me-quotable` |
| `publish-checklist` | `check-before-i-publish` |
| `weekly-autopilot` | `put-it-on-autopilot` |
| `progress-report` | `show-me-progress` |
| `where-we-stand` | `what-actually-worked` |
| `metrics-decoder` | `explain-this-number` |
| `whats-new-in-search` | `what-changed-in-search` |
| new | `can-i-actually-rank` |
| new | `map-my-site` |
| new | `get-cited-elsewhere` |
| new | `show-up-in-communities` |
| new | `spread-one-piece-everywhere` |

26 skills. Six phases: Ground, See, Decide, Build, Spread, Prove.

---

## 1. MECE: one decision per skill

Skills do not overlap, and together they cover the whole job. If two skills could answer the same question, one of them is wrong.

| Phase | Skill | The one decision it owns |
|---|---|---|
| **Ground** | `know-my-buyer` | Who buys, and in what words |
| | `say-it-their-way` | Whether our language matches theirs |
| | `explain-this-number` | What a metric means. Reference only, decides nothing |
| **See** | `unblock-my-money-pages` | What is technically stopping money pages from working |
| | `find-my-quick-wins` | Which existing rankings are closest to paying off |
| | `get-mentioned-by-ai` | Whether answer engines mention us, and why not |
| | `stop-losing-visitors` | Where arriving traffic leaks before converting |
| | `beat-my-competitors` | What the category covers that we do not |
| **Decide** | `follow-the-money` | Which tiers actually produce revenue here |
| | `pick-my-battles` | Which clusters we commit to, and in what order |
| | `can-i-actually-rank` | Whether a target is winnable, or should be killed |
| | `what-to-target-next` | Which specific queries, in which slots |
| | `map-my-site` | What the site's structure should be |
| **Build** | `brief-my-writer` | What a page must contain to win its target |
| | `write-the-page` | The draft itself |
| | `make-it-sound-human` | Whether it survives the voice and slop bar |
| | `make-me-quotable` | Whether machines can extract and cite it |
| | `revive-old-pages` | Refresh, rewrite, consolidate or kill |
| **Spread** | `get-cited-elsewhere` | Which off-site properties to earn presence on |
| | `show-up-in-communities` | Where to answer, and how without getting banned |
| | `spread-one-piece-everywhere` | Which proven pages to repurpose, into what |
| **Prove** | `check-before-i-publish` | Whether this ships, and whether it worked |
| | `put-it-on-autopilot` | What runs without a human |
| | `show-me-progress` | What changed in the period |
| | `what-actually-worked` | What to believe next, and what to stop doing |
| | `what-changed-in-search` | Whether the outside world moved |

## 2. Chaining

No skill is an island. Each declares what it consumes and produces, and refuses to run on missing input by naming the upstream skill rather than guessing.

```
know-my-buyer ──> context/business.md + strategy.json
                        │
   audit (src) ──> diagnosis.json ──┤
                        │           │
     beat-my-competitors ──> competitors.json
                        │
                 follow-the-money ──> tier reality
                        │
                  pick-my-battles ──> clusters
                        │
              can-i-actually-rank ──> verdicts per target
                        │
             what-to-target-next ──> keyword_plan
                        │
                     map-my-site ──> blueprint.json + monthly cohorts
                        │
        brief-my-writer ──> write-the-page ──> make-it-sound-human ──> make-me-quotable
                        │
           check-before-i-publish ──> ledger: shipped
                        │
   get-cited-elsewhere / show-up-in-communities / spread-one-piece-everywhere
                        │
              show-me-progress + what-actually-worked ──> back into know-my-buyer
```

`rainmaker campaign` runs Ground through Decide as one supervised chain. Every skill also runs standalone.

**The loop is the product.** The reference systems we studied produce a plan and stop. This one closes: what we believed, what we shipped, what moved, what we now believe instead. That last arrow is why the strategy stays alive after month three.

## 3. The template every skill obeys

```markdown
---
name: <kebab-name>
description: >
  <two sentences: what it decides and what it produces>

  Use this skill whenever the user asks to:
  - <casual phrasing>
  ...
  Trigger even for casual requests like "<literal thing a user types>".
---

# <Title>

## Context load
<verbatim block from spec/context-layer.md section 5>

## Consumes / Produces
## Refuses when        <exact sentence, and the command or skill that unblocks>
## Procedure           <numbered, each step naming the file it reads>
## Decision rules      <numeric thresholds, no adjectives>
## Output              <literal skeleton>
## Done when           <self-check before finishing>
```

Three properties are non-negotiable everywhere:

1. **Provenance.** Every number carries file, field, window, confidence.
2. **Refusal over invention.** Missing data stops the skill and names the fix.
3. **Revenue framing.** Every recommendation states the tier and the conversion consequence.

---

# Phase 1: Ground

## `know-my-buyer`

**Triggers:** "grill me", "who are we actually for", "I don't know what to write about", "interview me", "our positioning is vague".

**Consumes:** `diagnosis.json`, `competitors.json`. **Produces:** `context/business.md`, `strategy.json`.

**Refuses when** no diagnosis exists: "Run `rainmaker audit` first. Interrogating you about a site I have not looked at produces generic questions."

**Procedure:**
1. Open with what the diagnosis found: tier distribution, top 3 findings by score, two sharpest contrasts against competitors. Three sentences, numbers only.
2. One question at a time. Never batch, never parallelise. Question N depends on answer N-1.
3. Minimum 12 questions covering: who pays, who blocks, what they did before, the words in the last deal won, the words in the last deal lost, what sales actually sends, which page closes, what the diagnosis contradicts, which competitor they were compared against, what you refuse to claim, what you would bet the quarter on, what would prove you wrong.
4. Every question cites a specific finding, number or competitor fact. A question that could be asked of any company is a defect.
5. Push back once on a generic answer, quoting their own words. Accept the second answer.
6. Write both artifacts, matching ids. A pain point with an empty `buyer_language` array is a defect: ask again rather than write one.
7. Record a `decisions` entry for every changed field, with a reason.

**Done when:** 12+ questions asked, both artifacts written, hash matches, and the closing summary names which prior beliefs changed.

## `say-it-their-way`

**Triggers:** "sharpen the messaging", "our copy feels generic", "rewrite our one-liner", "do we sound like our buyers".

**Consumes:** `strategy.json`, `gsc.json`, `ga4.json`, `citation-graph.json` when present. **Produces:** `messaging`, `pain_points[].buyer_language`, matching prose.

**Procedure:**
1. Pull the top 100 non-branded GSC queries by impressions and extract recurring noun phrases.
2. Where the citation graph exists, add the phrasing that answer engines use about the category, which is often ahead of the site's own language.
3. Diff that vocabulary against `buyer_language` and `messaging`. Report the share of high-impression query language absent from the strategy.
4. Phrases in search but not in strategy become `buyer_language` additions with query and impression count as evidence.
5. Strategy phrases appearing in no query and on no converting page get demoted from `validated` to `hypothesis` with a decisions entry.
6. Rewrite the one-liner and differentiators using only vocabulary present in `buyer_language` or the top queries.

**Decision rules:** never introduce a claim absent from `proof`. At 40 percent absent language, recommend re-running `know-my-buyer`.

## `explain-this-number`

**Triggers:** "what does this metric mean", "why don't GA4 and GSC agree", "what is INP", "explain average position", "what is a citation".

Reference only. Produces nothing. The definitions live at `skills/_shared/metric-definitions.md`, not inside this skill, because every other skill cites them and a copy inside one skill would drift. Every term in v1 section 9.2 plus the AEO terms, each with a one-sentence definition, the common misuse, and what to say instead. Enforced by `src/skills/shared.test.ts`, which fails the build if a term loses any of its three parts.

---

# Phase 2: See

The 360 view is four surfaces: your site, Google, answer engines, and everywhere else. One skill each, plus the money layer.

## `unblock-my-money-pages`

**Triggers:** "audit my site", "what's broken", "why isn't this page indexed", "technical SEO".

**Consumes:** `crawl.json`, `diagnosis.json`. **Produces:** nothing.

**Scripts:** `crawl.mjs`, `cwv.mjs`, `canonicals.mjs`, `linkgraph.mjs`, `robots.mjs`.

**Procedure:** group findings by tier, not check type. Report internal path depth over 3 hops for tier 0 and 1, zero-inbound-link orphans, canonical to 404 or redirect, canonical chains, Google-selected canonical differing from declared, noindex on any tier 0 or 1 page as `blocking` regardless of the check table, and CWV field data first with lab data labelled as lab.

**Decision rules:** a tier 0 page that is unreachable outranks any tier 1 item on score, because an unreachable page cannot earn a score at all. Orphan means zero inbound internal links. Duplicate cluster means 3+ pages sharing a 16-char `content_hash` prefix.

## `find-my-quick-wins`

**Triggers:** "how are my rankings", "what's close to page one", "am I cannibalising", "quick wins".

**Consumes:** `gsc.json` (2+ snapshots), `state.json`. **Produces:** nothing.

**Decision rules:**
- Striking distance: position 4 to 15, 100+ impressions in 28 days, ranked by `impressions * (CTR_CURVE[3] - current_ctr)`.
- Cannibalisation: 2+ URLs each holding 5 percent or more of a query's impressions, both inside position 30.
- Movement reported only at 50+ impressions in both snapshots, and never for an average position change under 1.0. GSC position is an average of averages.
- Impressions with zero clicks inside position 10 across two snapshots is a title and meta problem, not a ranking problem.

## `get-mentioned-by-ai`

**Triggers:** "am I showing up in ChatGPT", "AEO", "do LLMs cite me", "why does the competitor win the AI answers", "llms.txt".

**Consumes:** `crawl.json`, `context/business.md`, `strategy.json`, `citation-graph.json`. **Produces:** `snapshots/<ts>/citations.json`.

**Probe design:** 12 prompts minimum, in buyer language rather than brand language: 3 category prompts, 3 commercial head queries from clusters, 3 comparisons against named competitors, 3 from top non-branded GSC queries. Run per engine and per market configured in `.env`. Refresh the prompt set whenever `say-it-their-way` changes `buyer_language`, since prompt drift silently invalidates a trend line.

**Reading the result, and this is the half the market gets wrong:**
1. Never report an aggregate without its decomposition. A score move localises to one engine, one market or one prompt, and the aggregate hides it. Report per engine and per market always.
2. Record a `methodology_version` on every scan. Never compare across a version boundary. That is the classic false alarm.
3. Mine the citations, not just the mentions. Which domains and URLs do the engines cite for these prompts? That list is the actual work, and it is handed to `get-cited-elsewhere`.
4. Distinguish invisible from visible-but-mispositioned. Being cited as the wrong category needs different work from not being cited.
5. Every citation claim carries: "Assistant answers are non-deterministic. Treat this as a sample of N probes on <date>, not a ranking." Confidence capped at 0.5. Never write a `verified` ledger event from a probe.

**Offline half:** schema coverage by tier, extractability (tier 1 pages with fewer than 3 standalone claim sentences), `llms.txt` presence and coverage of tier 0 and 1, and whether robots.txt blocks `GPTBot`, `ClaudeBot`, `PerplexityBot`, `OAI-SearchBot`, reported as a business consequence rather than a value judgement.

## `stop-losing-visitors`

**Triggers:** "why do people leave", "drop off", "rage clicks", "conversion leak".

**Consumes:** `clarity.json`, `ga4.json`, `crawl.json`.

**Decision rules:** rank pages by `sessions * TIER_WEIGHT[tier]`, top 20. Flag a tier 0 or 1 page in the worst quartile on any two of engagement rate, rage clicks per 1000, dead clicks per 1000, scroll depth, exit rate, measured against the site's own distribution and never an industry benchmark. Minimum 100 sessions or the page reports "insufficient sample" and nothing else. Join to `crawl.json` so the finding names a probable cause, not a symptom.

## `beat-my-competitors`

**Triggers:** "competitor analysis", "content gap", "how do we compare", "teardown <domain>".

**Consumes:** `config.competitors` or `strategy.json.competitors`. **Produces:** `competitors.json`, appended `benchmark` proof, competitor prose.

**Concurrency:** one agent per competitor, max 5.

**Procedure:** classify their sitemap into our tiers so the comparison is like for like; count pages per tier (40 tier 1 pages against your 3 is the finding, not their domain rating); extract positioning language, pricing presence, proof types and named integrations from their tier 0 and 1 pages; diff clusters against their coverage; mark which of your queries they also rank for. Where the citation graph exists, mark which of their pages answer engines cite, because a competitor page that owns the answers matters more than one that merely exists.

**Decision rules:** never report third-party domain authority scores. A gap counts only when the competitor page is tier 0, 1 or 2; tier 3 blog volume is one summary line.

---

# Phase 3: Decide

## `follow-the-money`

**Triggers:** "what actually makes money", "which pages matter", "where should we focus".

**Consumes:** `diagnosis.json`, `ga4.json`, `state.json`. **Produces:** `clusters[].target_tier`, the revenue narrative.

**Procedure:** per tier, compute share of pages, share of sessions, share of key events. The gap between those three is the entire point. Name the imbalance in one sentence with numbers. Map every declared `primary_conversion` to measured key events: a declared conversion page with zero key events is the highest-value finding available and is reported first. Assign each cluster the tier its content should occupy, which is often not where its pages currently sit. With no configured key events, say so, skip the dependent steps, and rank on sessions at confidence 0.5.

## `pick-my-battles`

**Triggers:** "content strategy", "what should we write about", "topic clusters", "what should we own".

**Consumes:** `strategy.json`, `gsc.json`, `competitors.json`, `crawl.json`. **Produces:** `clusters`.

**Opportunity typology.** Clusters come from seven signal types, not only pain points. A system that derives everything from pain misses the fastest commercial content there is.

| Type | Signal source | Typical format |
|---|---|---|
| Competitor-led | named in interviews or in `competitors.json` | alternatives, comparison |
| Objection-led | objections in `business.md` | guide, proof, pricing explainer |
| Feature-led | capabilities that gate plans or recur in sales | feature page, integration page |
| Use-case-led | jobs customers hire the product for | use-case page |
| Vertical-led | industries named in the ICP | vertical landing page |
| Pain-led | `buyer_language` before they knew the category | solution article |
| Winner expansion | pages already ranking, from `gsc.json` | adjacent page in the same cluster |

**Decision rules:**
- Every cluster maps to at least one pain point or one named signal. A cluster that exists only because a keyword has volume is exactly what this system exists to prevent.
- Balance check: if one type is more than half the clusters, name the imbalance. Competitor pages alone do not build topical authority, they trade on it.
- Completeness gate from `spec/site-blueprint.md` section 8: refuse to open a fourth simultaneous cluster while any existing cluster is below 40 percent complete.
- Gap classification per cluster: `none`, `thin` (page exists, under 600 words or no schema), `missing`.

## `can-i-actually-rank`

**New. The single largest logic gap in v1 and v2.**

**Triggers:** "can we rank for this", "check the SERPs", "is this winnable", "should we bother with this keyword".

**Consumes:** candidate queries from `pick-my-battles` or `what-to-target-next`, `gsc.json`, `crawl.json`, live search. **Produces:** a verdict per query, written to `keyword_plan[].verdict` and `blueprint.nodes[].serp_verdict`.

**Procedure per query:**
1. Read the live SERP. Record the dominant result format in the top 5, the SERP features present (AI overview, featured snippet, map pack, video carousel, shopping), and the top 3 titles.
2. Fetch the top 2 organic results and extract H1, H2 structure, format and approximate depth. Skip when format is unambiguous from titles and URLs.
3. Answer six questions: is intent consistent across the top 10, what format does Google reward, is our product category even represented, how competitive is it in evidence terms, can we produce the rewarded format, and are the top results fresh or stale.
4. Capture the People Also Ask and related searches; they feed cluster completeness in the blueprint.

**Competitiveness without vendor scores.** The core spec forbids third-party authority metrics, so beatability is evidenced from our own data:

```
our_demonstrated_ceiling = 90th percentile position achieved by our pages
                           on queries of similar impression volume, from gsc.json
```

A SERP is beatable when at least one of these holds, and the evidence is named:
- A ranking page in the top 10 sits on a domain with fewer indexed pages in this cluster than ours.
- A top-5 result clearly does not serve the stated intent (wrong format, wrong category, stale by more than 24 months).
- Our demonstrated ceiling for this volume band is inside the top 10.
- The SERP has a format gap: no result covers the rewarded format well.

Optimism is not evidence. If none hold, the verdict is not QUALIFY.

**Verdicts:**

| Verdict | Criteria |
|---|---|
| QUALIFY | Consistent intent, we can produce the rewarded format, at least one beatability condition holds with named evidence, our category is present in the SERP |
| CONDITIONAL | One specific, stated, resolvable concern. The condition is written down. A condition that cannot be resolved is a KILL, not a soft pass. |
| KILL | Mixed intent, wrong category dominates, every position held by properties we cannot displace with no gap, or the query does not survive contact with the actual SERP |

**Then the commercial filter, applied to every survivor:**

1. **Pipeline, not traffic.** If this ranks, can any of those readers plausibly buy? Traffic for the wrong audience is a cost.
2. **ICP match.** Does the implied searcher match the ICP on two or more of role, industry, size, problem?
3. **Honest product fit.** Can the product genuinely solve the implied problem without a claim we cannot support?
4. **Alignment.** Does it contradict the "what we will not say" section of `business.md`?
5. **Net new or overlap.** Does an existing URL already target this intent? If so, this is a refresh or a consolidation, never a new page.

**Kill freely, and document every cut.** A candidate pool that survives intact was not filtered. Report the two or three patterns that killed the most, because those patterns are strategy information: if half the pool died on "wrong category dominates the SERP", the positioning problem is upstream of content.

## `what-to-target-next`

**Triggers:** "keyword plan", "what should I target", "which queries next".

**Consumes:** `clusters`, verdicts, `gsc.json`, `crawl.json`. **Produces:** `keyword_plan`.

**Decision rules:** only QUALIFY and CONDITIONAL queries enter the plan. Slots: `refresh` when a tier-appropriate URL exists ranking 4 to 20; `consolidate` when 2+ URLs compete; `new` when no URL exists; `kill` when tier 3 or 4 with zero clicks across two windows, no inbound links from tier 0 to 2, and no proof cited. `priority_score` comes from `src/analyze/scoring.ts`, never from the skill. Cap the plan at the authority budget from `spec/site-blueprint.md` section 7, and state how many were dropped and the score of the highest dropped item.

## `map-my-site`

**New.** Full specification in `spec/site-blueprint.md`.

**Triggers:** "site structure", "URL structure", "site architecture", "how should we organise the site", "keyword map", "map my site".

**Consumes:** `keyword_plan`, `clusters`, `crawl.json`, verdicts, `config.revenue_model`. **Produces:** `blueprint.json`, monthly cohorts.

**In one line:** turns a keyword list into the whole intended site as a tree, with one intent per URL, a parent for every node, titles and metas generated as a consistent set, permutations gated against doorway-page risk, and a publish rate bounded by what the site has demonstrated it can get indexed.

---

# Phase 4: Build

## `brief-my-writer`

**Consumes:** `blueprint.json` node, `strategy.json`, `business.md`, `voice.md`, SERP notes. **Produces:** `briefs/<slug>.md`. **Fan-out:** max 5.

Mandatory contents: node id and parent, cluster and pain point ids, target tier and the revenue argument in one sentence; target query, current position, and the SERP-rewarded format with the competing URLs; buyer's own words to appear verbatim; proof ids with source URLs; the internal links from the blueprint, both up and across; schema type; named author and their first-hand evidence; 3 to 7 standalone claim sentences for extractability; the subtopics required for cluster completeness; and what this page will not say.

**Done when:** all preflight gates pass and the gate table is printed.

## `write-the-page`

**Refuses without a brief:** "No brief for <slug>. Run `brief-my-writer` first. Writing without a brief produces content nobody can defend at review."

Read `voice.md` samples before writing a sentence and match their sentence-length distribution, not a description of the voice. Write to the standalone claims first, build around them. Every non-obvious claim carries a proof id or a link; unsourced claims get removed, not softened. Use the quoted buyer language verbatim inside the first 200 words. Run the slop check on your own draft and report what you fixed.

## `make-it-sound-human`

Cut before adding, and report word count before and after: a punch-up that grows the draft more than 10 percent has failed. Kill every banned phrase from `voice.md` and the fixed list. Replace abstraction with a number already present in the data, never an invented one. Move the strongest claim into the first 100 words. Name the three weakest paragraphs and why, rather than silently rewriting everything.

## `make-me-quotable`

**Triggers:** "llms.txt", "schema", "make my site AI readable", "get quoted".

Generate `llms.txt` from tier 0 and 1 nodes with descriptions taken from `business.md`, never invented. Generate JSON-LD filling only fields with a real source; never fabricate ratings, prices or review counts. Output as a diff against what exists. Add extractability fixes from `get-mentioned-by-ai`: standalone claim sentences, a direct answer within the first 100 words of any question-shaped page, and tables for comparison content, since answer engines quote tables disproportionately. Flag schema types present across competitors' cited pages and absent from ours.

## `revive-old-pages`

**Consumes:** `gsc.json` (2+ snapshots), `crawl.json`, `ledger.jsonl`, `blueprint.json`.

| Classification | Criteria |
|---|---|
| refresh | position declined 3+ places, impressions still above 100, tier 0 to 2, over 600 words |
| rewrite | impressions fell 50 percent or more across two windows, cluster still validated |
| consolidate | competes with another URL on a query, holds the smaller impression share |
| kill | tier 3 or 4, zero clicks across two windows, no inbound links from tier 0 to 2, no proof cited |

Exclude any page shipped inside its verification window and say so: judging a fix before its window closes manufactures noise. Every kill names its redirect target; a kill without a redirect is a broken link. Rank by the cluster's score, and prefer refreshing a cluster below 80 percent completeness over starting a new one.

---

# Phase 5: Spread

Full specification in `spec/offsite.md`.

## `get-cited-elsewhere`

**Triggers:** "where should we get mentioned", "citation strategy", "who do AI engines trust", "link building", "get listed".

**Consumes:** `citations.json`, `competitors.json`, `business.md`. **Produces:** `citation-graph.json`.

Three-level drill: cited domains, then the specific URLs driving each domain's citations with concentration reported as a ratio, then the full answers showing what the engine actually quoted. Never recommend from domain aggregates. Every finding becomes a gap row with a named action, an honest plausibility by editability class, effort, and a priority score. Check every existing presence against `business.md` for category, one-liner, ICP, pricing and integrations; mismatches become `correct_record` gaps and outrank new placements of equal score.

**Will not do:** outreach at volume, link exchanges, paid link schemes, guest-post spam.

## `show-up-in-communities`

**Triggers:** "Reddit", "should we post in communities", "forums", "where is our audience talking".

Read and print the community's rules before drafting anything. Never simulate independent voices across accounts, never vote-manipulate, always disclose affiliation, one link maximum and only when the link is the answer. Draft answers that would still be useful with the product name removed. Rank target threads by traffic and by whether the thread already appears in `citation-graph.json`. Tag links with the standard UTM scheme and verify the parameters survive the platform's outbound redirect before trusting any number. Where clicks cannot be tracked, correlate mention dates with traffic and signups and label it correlation.

## `spread-one-piece-everywhere`

**Triggers:** "repurpose this", "turn this into a video", "distribution", "get more from this post".

Only repurpose pages that are live, indexed, past their 28-day window, and inside a cluster above 40 percent completeness. Pick two formats per source page, not six. Every derivative links back to its blueprint node and is recorded in `citation-graph.json`. Video and audio derivatives require a transcript on the canonical page.

---

# Phase 6: Prove

## `check-before-i-publish`

Preflight gates, all blocking: pain point provenance, cluster slot, blueprint node exists and is unclaimed, no cannibalisation against an existing URL, intent match against the SERP verdict, 3+ inbound internal links named, schema planned, E-E-A-T signals (named author, first-hand evidence, cited source), extractability, slop check, revenue argument. Postflight, by window: indexed at 14 days, canonical correct immediately, CWV not regressed at 7 days, internal links live immediately, impressions appearing at 28 days, position trend at 90, AI citation at 90, conversion contribution at 90. Never auto-override. Every failure names its remedy.

## `put-it-on-autopilot`

Generate weekly and monthly workflows calling `rainmaker routine`, `rainmaker report --window month` and `rainmaker ledger --compact`. Verify every secret the workflow needs is documented, print the exact `gh secret set` commands, and never write a workflow depending on a secret the user has not been told to create.

## `show-me-progress`

Five-section spine, populated from ledger events inside the window. Refuse any window longer than available history, naming the earliest snapshot and the date the window becomes available. Never extrapolate, never compare a full window against a partial one.

## `what-actually-worked`

1. What did we believe? Diff `strategy.json` against the period's opening version, with every reason.
2. What did we do? Ledger events with a `cause`, grouped, effort summed, on-site and off-site together.
3. What happened? `baseline` against `current`, only past the verification window.
4. **What did nothing.** Mandatory. Every shipped intervention whose target metric did not move, with the effort spent. A retrospective containing only wins is a defect and must be regenerated.
5. What we cannot attribute. Anything moving inside a window containing an `algo_update`, reported as coincident and explicitly not causal, with the control.

Then the loop closes: any belief contradicted twice gets demoted in `strategy.json` with a decisions entry, and `know-my-buyer` is recommended when the drift conditions fire.

## `what-changed-in-search`

Never answers from training data. Always fetches, always stamps `fetched_at`, always labels each claim with its source tier (confirmed: search engine status dashboards, official blogs and changelogs, crawler documentation; observed: volatility trackers, industry reporting). Three stages, all mandatory: what changed; what it means here, in counts from our own files; what to do, ranked by score with low-tier items explicitly deprioritised. Control check mandatory: did non-matching pages also move? If so, the update is unlikely to be the cause. Writes an `algo_update` event so later retrospectives attribute correctly.
