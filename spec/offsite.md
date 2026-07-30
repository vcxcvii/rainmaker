# Rainmaker: Off-Site and Distribution

**Status:** normative, v3. New module. v1 and v2 were entirely on-site, which is half a system.

---

## 1. Why this exists

Both search engines and answer engines decide what to rank and what to cite largely from things that do not live on your site: who mentions you, where, in what words, and which third-party pages the engines already trust for your category. A system that only measures and edits your own pages can diagnose everything and change almost nothing about how the category talks about you.

The reference skills we studied are strong at measuring AI visibility and weak at the obvious follow-through: once you know that three review pages and two community threads produce the category's answers, the work is getting into those five places. That is an off-site programme, and it needs the same evidence discipline as the on-site half.

## 2. The citation graph

`data/citation-graph.json`. Written by `get-cited-elsewhere`, read by `get-mentioned-by-ai`, `show-me-progress` and `what-actually-worked`.

```ts
export interface CitationGraph {
  generated_at: string;
  window_days: number;
  sources: CitedSource[];
  our_presence: Presence[];
  gaps: Gap[];
}

export interface CitedSource {
  domain: string;
  type: 'review_platform' | 'community' | 'media' | 'competitor' | 'directory'
      | 'documentation' | 'social' | 'video' | 'academic';
  citation_count: number;             // times cited in answers to our probe set
  urls: { url: string; citation_count: number; cited_for: string }[];
  engines: string[];                  // which answer engines cited it
  brand_present: boolean;             // are we on that page at all
  editable: 'self_serve' | 'pitch' | 'earned' | 'closed';
}

export interface Presence {
  domain: string;
  url: string;
  kind: 'listing' | 'review' | 'thread' | 'mention' | 'guest_post' | 'profile';
  claims_accurate: boolean;           // does it describe us the way context/business.md does
  last_checked: string;
}

export interface Gap {
  source_domain: string;
  url: string;
  citation_count: number;
  action: 'claim_listing' | 'earn_review' | 'answer_thread' | 'pitch_inclusion'
        | 'build_better_page' | 'correct_record';
  plausibility: 0.1 | 0.3 | 0.5 | 0.7 | 0.9;
  effort_hours: number;
  priority_score: number;             // citation_count * plausibility / effort, computed in src/
}
```

## 3. The three-level drill, then the action

Level 1, domains: which domains co-occur with the category in answers, with counts and type. Level 2, URLs: which specific pages drive each domain's citations. Concentration is the finding, so report it as a ratio. One comparison post out-citing the rest of its domain 14 to 1 means that page owns the answer, not the domain. Level 3, answers: what the engine actually quoted from that page, which dictates what any competing or replacement page must contain.

Stopping at level 1 produces "review sites matter", which is not an action. Every recommendation must name a URL.

**Then the part the references leave out.** Every level-3 finding converts to one row in `gaps` with a named action and a plausibility, and plausibility is honest:

| `editable` | Meaning | Typical plausibility |
|---|---|---|
| `self_serve` | You can add or correct yourself: directory listing, profile, docs site | 0.9 |
| `pitch` | A human decides: roundup inclusion, guest contribution, niche publication | 0.3 to 0.5 |
| `earned` | Requires a customer or community to act: reviews, organic threads | 0.3 |
| `closed` | A competitor's own page or a locked property | 0.1, and the only action is `build_better_page` |

A hit-list where everything is 0.9 has not been checked. A hit-list where everything is 0.1 is a list of excuses.

## 4. Community presence

Communities are where a large share of category answers get sourced, and the fastest way to lose is to arrive as a vendor.

**Hard rules, and they are not stylistic:**

1. Never post promotional content into a community whose rules forbid it. `show-up-in-communities` reads the subreddit or forum rules first and prints them before drafting anything.
2. Never operate multiple accounts to simulate independent voices, never upvote your own posts from other accounts, and never post a recommendation of your own product without disclosing affiliation. These are the three things that get a domain banned across an entire platform, and the ban is not recoverable by an SEO fix.
3. Answer the question that was asked. A comment that helps only if the reader buys is an advertisement.
4. One link maximum, and only when the link is the answer.

**Procedure:** find threads where the category question is being asked, rank by thread traffic and by whether that thread already appears in `citation-graph.json`, draft an answer that would stand as useful with the product name removed, disclose affiliation, then track.

**Attribution, honestly.** Tag every posted link `?utm_source=<platform>&utm_medium=community&utm_campaign=<campaign>&utm_content=<community>`. Verify the parameters survive the platform's outbound redirect before trusting any number, because Reddit and several others route through intermediaries that strip them. Comment clicks, view-through effect and lurker influence are not measurable. Where measurement ends, correlate mention dates against traffic and signup timing, and label it correlation. Correlation honestly labelled beats fabricated precision, and the core spec already forbids asserting causation.

## 5. Entity consistency

Answer engines assemble a description of you from many sources. If your own site, your directory listings, your review profiles and your social bios disagree about what you are and who you serve, the engine picks whichever it trusts most, and it is often not yours.

`get-cited-elsewhere` checks every `Presence` row against `context/business.md`: category, one-liner, ICP, pricing model, named integrations. Any mismatch becomes a `correct_record` gap, ordered above new-placement gaps of equal score, because correcting a wrong description you already own is cheaper and lands faster than earning a new mention.

## 6. Repurposing

One researched page should become the raw material for the surfaces the buyer actually uses. This is the distribute column of the lifecycle, and it is bounded so it does not become a content treadmill.

Rules:
- Nothing is repurposed until the source page is live, indexed and past its 28-day window. Repurposing an unproven page multiplies a guess.
- Repurpose only pages whose cluster completeness is above 40 percent, so effort concentrates where authority is being built.
- Every derivative links back to the canonical node in the blueprint, and the derivative is recorded in `citation-graph.json` under `our_presence`.
- Video and audio derivatives carry a transcript on the canonical page. An untranscribed video is invisible to both search and answer engines.

Formats, in the order they usually pay: a community answer, a short video with transcript, a newsletter section, a social breakdown, a slide or graphic asset, a podcast talking point. Pick two per source page, not six.

## 7. Link acquisition, stated plainly

Links still matter and the honest version is narrow: be genuinely citable, then be present where citation happens. Rainmaker will:

- Report unlinked brand mentions found during citation drilling as `correct_record` gaps, because asking for a link on an existing mention is the highest-conversion ask in the discipline.
- Report competitor-cited pages you could plausibly replace as `build_better_page`.
- Report directory and listing gaps as `self_serve`.

Rainmaker will not generate outreach at volume, participate in link exchanges or paid link schemes, or produce guest-post spam. Those buy a short-term signal and a long-term liability, and this system exists to make ranking durable.

## 8. Off-site in the ledger

Off-site work enters the same ledger as everything else, with finding ids of the form `<tier>:offsite:<domain>/<path>`.

- `opened` when a gap is identified.
- `shipped` when the placement is live, evidenced by a URL.
- `verified` only after the 90-day window, and only when the source appears in a later citation scan or sends measurable referral traffic.
- Never `verified` from an AI citation probe alone, per the core spec.

That means `what-actually-worked` can finally answer the question the whole discipline dodges: of the off-site placements we earned, which ones actually entered the answer mix, and which ones did nothing.
