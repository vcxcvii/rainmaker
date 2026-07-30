# Metric definitions

Canonical. Owned by `explain-this-number`, cited by every other skill, restated
by none of them. Each entry has three parts: what it is, how it is usually
misused, and what to say instead.

---

## Google Analytics 4

### Session
A group of interactions from one user within a time window, ending after 30 minutes of inactivity or at midnight in the property's timezone.
**Misuse:** treated as a person. One person browsing across three days is three or more sessions.
**Say instead:** "sessions" when counting visits, "users" when counting people, and never swap them mid-report.

### Engaged session
A session lasting over 10 seconds, or with a key event, or with 2 or more pageviews.
**Misuse:** read as "the visitor was interested". A 10-second threshold is a low bar and a second pageview can be a misclick.
**Say instead:** "sessions that passed the engagement threshold", and name the threshold when it matters.

### Key event
An event marked as significant in the GA4 property. Replaced the term "conversion" in the GA4 interface.
**Misuse:** assumed to exist. Most properties have none configured, and the ones configured are often page views of a thank-you page, not the business outcome.
**Say instead:** name the event: "the `demo_request` key event fired 14 times". If none are configured, say that plainly rather than reporting zero conversions.

### Conversion
The business outcome. In GA4 reporting the word now maps to key events, and in Google Ads it retains its own separate meaning.
**Misuse:** used as though GA4, Ads and the CRM count the same thing. They rarely do, and the gaps are structural, not bugs.
**Say instead:** name the system and the definition: "14 `demo_request` key events in GA4, which the CRM shows as 9 qualified meetings".

### Attribution window
The lookback period during which a touchpoint can be credited for a key event. GA4 defaults to 30 days for acquisition and 90 for other events.
**Misuse:** ignored on long sales cycles. A 45-day sales cycle measured on a 30-day window structurally undercounts the first touch.
**Say instead:** state the window alongside the number, and compare it to `config.sales_cycle_days`.

### Data threshold
GA4 withholds rows when a report could reveal an individual, most often when demographics or signals are enabled on low traffic.
**Misuse:** the missing rows are read as zeros, so a small segment appears to have no traffic.
**Say instead:** "GA4 withheld rows for this segment under its data threshold", and turn off the offending dimension if the number matters.

### Sampling
Reporting on a subset of data rather than all of it, then extrapolating. Standard GA4 reports are unsampled; explorations over large ranges can be sampled.
**Misuse:** a sampled exploration is quoted to two decimal places.
**Say instead:** report the sampling rate if the interface shows one, and prefer the standard report for any number that will be acted on.

### Exploration versus report discrepancy
The same metric differs between a standard report and an exploration, usually because of sampling, different identity spaces, or cardinality limits collapsing rows into "(other)".
**Misuse:** treated as a bug, or one number is picked because it is higher.
**Say instead:** name which surface produced the number, and use one surface consistently for a trend line.

---

## Google Search Console

### Impression
A URL appeared in a result set for a query. It does not require the user to scroll to it.
**Misuse:** read as "someone saw us". An impression on page four was almost certainly never seen.
**Say instead:** pair impressions with position. Impressions at position 40 are not visibility.

### Position
The average rank of the URL for that query across all impressions in the window, across devices and countries.
**Misuse:** treated as a rank. It is an average of averages, so a page at 3 in one market and 30 in another reports around 16, a position it never actually held.
**Say instead:** "average position 16 blended across markets", and filter by market before drawing a conclusion.

### CTR
Clicks divided by impressions for the rows in view.
**Misuse:** compared against an industry benchmark. CTR depends on position, SERP features and query intent, so a cross-site comparison compares SERPs, not pages.
**Say instead:** compare a page's CTR against the CTR curve at its own position, and against its own prior window.

### Coverage
The set of index states Search Console reports for the site's URLs.
**Misuse:** "indexed" is read as "ranking". Indexed only means eligible.
**Say instead:** name the state: "indexed, not returning impressions" is a different problem from "not indexed".

### Discovered, currently not indexed
Google knows the URL exists but has not crawled it, usually a crawl-scheduling or site-quality signal.
**Misuse:** read as a technical blocker to fix with a sitemap resubmission.
**Say instead:** "Google has chosen not to spend crawl on this yet", and look at internal linking and whether the page adds anything.

### Crawled, currently not indexed
Google fetched the page and decided not to index it, which is a quality or duplication judgement.
**Misuse:** treated as a bug, or fixed by requesting indexing repeatedly.
**Say instead:** "Google crawled it and declined", then check for near-duplication, thin content, or a better page on the same intent.

### Canonical, Google-selected versus user-declared
The user-declared canonical is the tag on your page. The Google-selected canonical is the URL Google actually consolidates to, which can differ.
**Misuse:** the tag is assumed to be obeyed.
**Say instead:** report both when they differ, because a page whose signals are being consolidated elsewhere cannot rank on its own.

### 28-day window
Search Console's rolling reporting window, with data typically lagging two to three days.
**Misuse:** compared against a 30-day window from another tool, which manufactures a trend from the window mismatch alone.
**Say instead:** always 28 days, always ending on the same lag, and say so beside every comparison.

---

## Search

### Crawl budget
The crawling capacity a search engine allocates to a site, driven by host load limits and by how much demand the engine has for the site's pages.
**Misuse:** invoked on small sites, where it is almost never the constraint.
**Say instead:** on a site under a few thousand URLs, say "this is not a crawl budget problem" and look at internal links and quality.

### Index bloat
A large number of low-value indexed URLs, typically from faceted navigation, parameters, tags, or paginated archives.
**Misuse:** used to justify mass deletion. Removing pages that carry links or serve real queries makes things worse.
**Say instead:** name the pattern producing the URLs, and the volume, before proposing anything.

### Cannibalisation
Two or more of your URLs competing for the same intent, splitting signals and swapping in the results.
**Misuse:** claimed whenever two URLs appear for one query. Brand queries legitimately return several of your pages, and Google does this deliberately.
**Say instead:** confirm same intent, non-branded query, both inside position 30, and persistence across two windows before using the word.

### Striking distance
Queries ranking just below the positions that earn meaningful clicks, conventionally positions 4 to 15.
**Misuse:** treated as a promise. Position 11 to 15 often needs the same work as a new page.
**Say instead:** state the impressions and the CTR gap, so the size of the opportunity is visible rather than implied.

### E-E-A-T
Experience, expertise, authoritativeness and trust: concepts from Google's search quality rater guidelines that describe what raters assess.
**Misuse:** described as a ranking factor with a score. There is no E-E-A-T metric in any system.
**Say instead:** name the concrete signal: a named author with relevant experience, first-hand evidence, cited sources.

### Domain authority
A third-party vendor's predictive score, such as Moz DA or Ahrefs DR. Not a Google metric.
**Misuse:** quoted as though it were an input to ranking, or used to declare a SERP unwinnable.
**Say instead:** Rainmaker does not use vendor authority scores. Evidence beatability from measured history and visible SERP gaps.

### PageRank
The original link-based algorithm scoring a page by the links pointing at it, recursively weighted.
**Misuse:** used as a synonym for authority, or referenced as the toolbar number that stopped being published years ago.
**Say instead:** talk about internal linking and which pages the site itself points at, which you can measure.

### Internal link equity
The value a page passes to the pages it links to. A useful model, not a measurable quantity.
**Misuse:** discussed with invented percentages, or used to justify hiding links.
**Say instead:** count the actual inbound internal links and the click depth from the homepage. Both are measurable.

### Content decay
A page losing traffic over time as intent shifts, competitors improve, or the content ages out.
**Misuse:** every decline is called decay, including seasonal drops and algorithm-driven volatility.
**Say instead:** compare like windows year on year where history allows, and check whether the whole cluster declined or only this page.

### Thin content
A page with little substantive value for its intent. Not a word count.
**Misuse:** defined purely by length, so a 300-word answer that fully resolves the query is flagged and a 2,000-word padded page is not.
**Say instead:** name what is missing relative to what ranks: no original data, no first-hand evidence, no answer to the actual question.

---

## AI search

### AEO, GEO and SEO
Search engine optimisation targets ranked links. Answer engine optimisation targets being used and cited in generated answers. Generative engine optimisation is the same idea under a different label.
**Misuse:** sold as three separate disciplines with separate budgets. The underlying work overlaps heavily.
**Say instead:** name the surface: "ranked results" or "generated answers", and say what differs for that surface.

### Extractability
How easily a machine can lift a self-contained, quotable claim from a page.
**Misuse:** treated as a schema task. Markup helps discovery, but an unquotable paragraph stays unquotable.
**Say instead:** count the standalone sentences that answer the question with subject, verb and a number.

### Citation
A source an answer engine links or names in a generated answer.
**Misuse:** counted as a ranking. Citations vary between runs of the same prompt.
**Say instead:** report the prompt, the engine, the market, the date and the sample size, and call it a sample.

### Entity
A distinct thing an engine can identify and hold facts about: a company, a person, a product, a concept.
**Misuse:** used as a synonym for keyword.
**Say instead:** talk about whether your descriptions agree across the properties that describe you, which is the part you can change.

### Ontology
A formal structure describing types of things and the relationships between them.
**Misuse:** used to dress up a keyword list.
**Say instead:** "the relationships between our products, use cases and industries", and show the structure.

### Knowledge graph
A store of entities and their relationships used to answer queries. Google's is one of several.
**Misuse:** treated as something you submit to.
**Say instead:** describe the inputs you control: consistent naming, structured data, and third-party sources that agree with you.

### Vector embedding
A numeric representation of text placing similar meanings near each other in a high-dimensional space.
**Misuse:** invoked to imply keywords no longer matter.
**Say instead:** name the practical consequence: covering a topic in the words buyers actually use beats repeating one phrase.

### Semantic similarity
How close two pieces of text are in meaning, often measured as cosine distance between embeddings.
**Misuse:** quoted as a score with no stated model, which makes it uncomparable to any other score.
**Say instead:** name the model and the threshold, or describe the overlap in plain terms.

### llms.txt
A proposed plain-text file at the site root listing key pages for language models, with short descriptions.
**Misuse:** described as a standard that engines obey. It is a proposal, and support is not guaranteed.
**Say instead:** "a low-cost, unproven convention", and never claim a traffic effect from adding it.

---

## Core Web Vitals

### LCP
Largest Contentful Paint: when the largest visible element finishes rendering. Good is 2.5 seconds or less.
**Misuse:** confused with full page load, or optimised by shrinking the element rather than delivering it sooner.
**Say instead:** name the element that is the LCP candidate, since fixing it starts with knowing what it is.

### INP
Interaction to Next Paint: responsiveness across all interactions in a visit, at the 75th percentile. Good is 200ms or less. Replaced First Input Delay.
**Misuse:** still reported as FID, which measured only the first interaction and only its delay.
**Say instead:** "INP at the 75th percentile", and name the interaction that is slow.

### CLS
Cumulative Layout Shift: how much visible content moves unexpectedly. Good is 0.1 or less.
**Misuse:** measured only on load, missing shifts triggered later by lazy content or injected banners.
**Say instead:** name the element that shifts and what injects it.

### Field versus lab data
Field data is what real users experienced, from the Chrome UX Report. Lab data is a synthetic run in controlled conditions.
**Misuse:** a lab score is reported as the site's performance. Lab is one run on one connection profile with no real users in it.
**Say instead:** field data where it exists. Where CrUX withholds it for low traffic, say so once rather than reporting a page-by-page list of lab failures.

### TTFB
Time to First Byte: from request to the first byte of the response. Not a Core Web Vital, but it constrains LCP.
**Misuse:** treated as the whole performance story, or ignored entirely while optimising images.
**Say instead:** report it as the floor under LCP: no amount of front-end work beats a slow first byte.
