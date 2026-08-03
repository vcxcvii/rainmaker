# Rainmaker: The Evidence Bar

**Status:** normative, v3.1. Written after a QA pass over v3. Where a check here conflicts with a threshold stated elsewhere, this wins.

---

## 1. Why this file exists

A false positive costs more than a miss. A missed finding is invisible. A false finding gets read, gets scheduled, gets someone's afternoon, and then quietly teaches the reader that this tool's output needs checking before it can be trusted. After two of those, the reports stop being read at all.

The target is under one percent of reported findings being wrong. That is only reachable by making every check state what would prove it wrong, and by separating three things that most tools collapse into one:

| Verdict | Meaning | How it is reported |
|---|---|---|
| **Finding** | The evidence establishes the problem | Full finding, scored, ledgered |
| **Suspicion** | Consistent with a problem, insufficient to establish it | Named as a suspicion, with what would confirm it, never scored above 0.5 |
| **Unmeasured** | We do not have the data to say | Named in the confidence section, never in the findings list |
| **Reading** | The assistant's own judgement, not a check that ran | Its own section, attributed to the assistant, never in the findings list |

Silence about the third category is the most common way a system reports a false positive without lying: reporting only what it can see, in a tone that implies it saw everything.

The fourth category is the second most common way, and it does not come from the CLI at all. The assistant driving Rainmaker reads the same crawl the checks read, and it will notice things no check covers. That is useful. It stops being useful the moment those observations are printed in the same list, in the same voice, as a scored finding, because the reader has no way left to tell which items carry evidence and which carry inference. Every verdict in the table above then inherits the credibility of the weakest item next to it.

A reading is not a lesser finding and must not be laundered into one. It is a different kind of claim: it did not pass a coverage rule, it has no `revenue_score`, it is not in the ledger, and it will not be checked again next run. Report it under its own heading, attributed, with what it is based on and what would show it wrong. Never number it into the tool's sequence. Never let a summary line total the two together.

## 2. The four rules

1. **No finding without coverage.** A check may only fire on a URL the crawler fetched in this run, with a 2xx or 4xx status. Never on an inferred, remembered or sitemap-only URL.
2. **No finding from a single observation of a noisy signal.** Position, impressions, AI citations and behavioural metrics all require two consecutive windows before a change is a finding.
3. **No finding where an intentional configuration explains it.** Every check that can be deliberately caused must consult the intent declarations in section 4 first.
4. **No aggregate without its split.** Any number averaged over engines, markets, devices or page types must report the split, because the average is where the false conclusion hides.

## 3. Corrections to v3 thresholds

Each of these was found in QA. The v3 threshold produced false positives in a case a real site will hit.

### 3.1 Orphan pages

**Was:** zero inbound internal links.

**Problem:** the crawl is capped by `crawl.max_urls` and excludes `/tag/`, `/author/`, `/page/`, `/feed/` by default. A page linked only from an excluded or uncrawled page is reported as orphaned when it is not.

**Now:** a finding only when the crawl covered 95 percent or more of discovered URLs and `budget_exhausted` is false. Below that, it is a suspicion, and the report states the coverage percentage. Links from excluded paths are counted for this check even though those pages are not otherwise analysed.

### 3.2 Duplicate content

**Was:** 3 or more pages sharing a 16-character `content_hash` prefix.

**Problem:** that detects byte-identical text only, which is rare, while the actual problem is near-duplication. It also fires on paginated series and on pages that already canonicalise to one another, both of which are correct configurations.

**Now:** near-duplicate detection over shingled text with a similarity threshold of 0.9. Excluded: pages whose canonical points at another page in the same set, paginated URLs (`?page=`, `/page/n`), and printer or AMP variants. A finding requires 2 or more pages surviving those exclusions.

### 3.3 Cannibalisation

**Was:** 2 or more URLs each holding 5 percent of a query's impressions, both inside position 30.

**Problem:** brand queries legitimately return several of your own pages, and Google deliberately does so. Single-window overlap also catches transient reshuffles.

**Now:** all four must hold. Non-branded query, meaning it contains no brand token from `context/glossary.md`. Both URLs inside position 30. Both hold 5 percent or more of impressions. The overlap persists across two consecutive 28-day windows. Where a blueprint exists, both URLs must also map to the same intent; different intents sharing a query is a SERP ambiguity finding, not a cannibalisation one.

### 3.4 Noindex and canonical on money pages

**Was:** noindex on any tier 0 or 1 URL is `blocking`.

**Problem:** thank-you pages, gated confirmations and staging paths are correctly noindexed, and URL-pattern tiering happily tiers `/demo/thank-you` as tier 0.

**Now:** suppressed when the URL matches `config.intentional_noindex`, when it is not linked from primary navigation and has zero external inbound links, or when its path segment matches a confirmation vocabulary (`thank-you`, `confirmation`, `success`, `booked`). A suppressed instance is listed once in the confidence section so the suppression itself is visible.

### 3.5 The declared conversion page with no key events

**Was:** the highest-value finding available.

**Problem:** it fires just as loudly when conversions happen off-domain, on a scheduling or checkout host, or when the relevant GA4 key event was never configured.

**Now:** requires `key_events_configured` to be non-empty, and requires the page to carry no outbound link to a host in `config.offsite_conversion_hosts` such as a scheduler or payment processor. Failing either, it is reported as unmeasured with the specific reason, not as a finding.

### 3.6 Core Web Vitals

**Was:** field data first, lab where field is absent.

**Problem:** CrUX withholds field data below a traffic threshold, so on small sites every page silently falls back to a single lab run, which is a different measurement with different variance.

**Now:** a CWV finding requires field data. Lab numbers may be shown as context, labelled lab, never scored, and never entered into the ledger. On a site with no field data anywhere, the report says so once rather than producing a page-by-page list of lab failures.

### 3.7 Striking distance

**Was:** position 4 to 15 with 100 or more impressions.

**Problem:** GSC average position mixes devices and countries. A query averaging 8 can be 3 in your market and 30 outside it, and the opportunity is then imaginary.

**Now:** when `config.geographies` is set, filter GSC rows to those markets before computing position. When it is not, the finding carries the note that position is a blended average across all markets, and confidence drops to 0.5.

### 3.8 `shipped` by re-measure

**Was:** the check now passes and the finding is `acknowledged` or `in_progress`.

**Problem:** a transient 5xx, a cached response or crawl variance flips a check to passing for one run, which then starts a verification window against work nobody did.

**Now:** the check must pass in two consecutive runs. One passing run is recorded as a suspicion in the run log and nothing is appended to the ledger.

### 3.9 AI citation regression

**Was:** citation probes may append `opened` and `regressed`.

**Problem:** assistant answers are non-deterministic. A single scan missing your domain is well inside sampling variance, and `regressed` is a strong word that lands in the permanent record.

**Now:** `regressed` requires the miss across two consecutive monthly scans, on the same engine and market, at the same methodology version. A single miss is a suspicion.

### 3.10 The coverage set

**Was:** URLs fetched with a 2xx or 4xx.

**Problem:** a soft 404 returns 200, and a URL that now redirects elsewhere returns 200 at the end of the chain. Both count as covered, so their findings close as if fixed.

**Now:** the coverage set excludes URLs whose final response is a redirect to a different path, and URLs whose 200 response matches the site's soft-404 signature (title or H1 matching the known 404 page, or word count under 50 on a page that previously had more than 300).

## 4. Intent declarations

Config gains four fields whose only job is to stop the system reporting deliberate decisions as defects.

```yaml
intentional_noindex: ["/thank-you", "/app/*", "/preview/*"]
offsite_conversion_hosts: ["cal.com", "checkout.stripe.com"]
paginated_patterns: ["?page=", "/page/"]
known_duplicates: []      # pairs the owner has accepted, with a reason
```

`rainmaker init` does not ask for these. `audit` proposes them when a check would otherwise fire on something that looks deliberate, and the user accepts or rejects once. An accepted suppression is permanent and visible; it is written to config with the date and the finding id it suppressed.

## 5. Redundancy removed

QA found the same detection implemented in four places, which is how thresholds drift apart and one report contradicts another.

**Overlap detection** was specified separately in `find-my-quick-wins` (cannibalisation), `revive-old-pages` (consolidate), `can-i-actually-rank` (filter 5, net new versus overlap) and `map-my-site` (node collisions).

**Now:** one detector, `src/analyze/overlap.ts`, producing one `OverlapSet` list. The four skills consume it and differ only in the verb they apply: report it, consolidate it, refuse to plan against it, or refuse to create it. No skill re-derives overlap.

The same rule applies to two smaller cases. Titles and metas are owned by the blueprint, inherited by briefs, and enforced by the publish checklist; no one else may propose them. Cluster completeness is computed once in the blueprint and read everywhere else.

## 6. Loopholes closed

1. **CONDITIONAL was a soft pass.** A conditional SERP verdict could reach a brief with its condition unresolved. Now a `CONDITIONAL` node carries `condition` and `condition_resolved_by`, and `brief-my-writer` refuses while the second is empty.
2. **The permutation substance gate was unenforceable.** "Three facts differ" was prose. Now `substance_fields` is an explicit list per permuted node, minimum three, each with a value that differs from every sibling by string comparison. A node whose fields are present but identical fails.
3. **The authority budget rewarded failure.** The v3 formula scaled the budget by past publishing volume, so a site that published 90 pages and got none indexed was granted 15 a month. Now: when 20 or more pages were published in the window and `indexed_rate` is below 0.3, the budget is 4 and the recommendation is to fix indexation before publishing anything else. The formula otherwise stands.
4. **`build_better_page` gaps had no owner.** An off-site gap could create a page outside the blueprint. Now those gaps are handed to `pick-my-battles` as cluster candidates and enter the site the same way everything else does.
5. **Completeness with no SERP data was undefined.** Where SERP capture never ran, completeness is `null`, not 0. Gates that depend on it state that they cannot evaluate rather than blocking or passing silently.

## 7. Reporting rules that keep the rate honest

- Every finding shows `tier_source`. A tier from `url_pattern` or below is a guess, and a reader who cannot see that will treat it as measured.
- Suspicions are grouped in their own section, never mixed into the ranked list.
- The confidence section names every check that was skipped and why, so absence is visible rather than implied.
- `rainmaker audit --explain <finding-id>` prints the full evidence chain: the file, the field, the window, the threshold, and the rule that fired. Any finding a user cannot audit that way should not have been reported.

## 8. Measuring the rate

The target is not a slogan. `check-before-i-publish` and the ledger already make it measurable: a finding dismissed by a human with `note` starting `false-positive:` is counted. `show-me-progress` reports the running rate over the last 90 days, per check, and any check exceeding 1 percent gets its threshold reviewed rather than defended.
