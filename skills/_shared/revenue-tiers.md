# Revenue tiers

The ordering principle for the whole system. Cited by every skill, computed in
`src/analyze/tiering.ts`, never re-derived by a skill.

## The tiers

| Tier | What lives there | Weight | The test |
|---|---|---|---|
| 0 | Money changes hands | 5.0 | Can someone become a customer on this page? |
| 1 | Decision | 3.0 | Is a buyer comparing options here? |
| 2 | Solution | 2.0 | Is someone with the problem looking for a way out? |
| 3 | Problem | 1.0 | Is someone learning that the problem exists? |
| 4 | Ambient | 0.3 | Does this exist for reasons other than demand? |

Tier 0 is pricing, demo, trial, signup, checkout, contact, booking. Tier 1 is
comparisons, alternatives, case studies, integrations, ROI. Tier 2 is use cases
and how-to-solve-X. Tier 3 is definitional and educational. Tier 4 is about,
careers, press, legal, tag and author archives.

## Assignment

Eight rules, strict precedence, first match wins. Each records `tier_source`
and `tier_confidence`, and both appear in every report line, because a tier
from a URL pattern is a guess and a reader who cannot see that will read it as
measured.

| # | Rule | Confidence |
|---|---|---|
| 1 | GA4 page-level key events | 0.9 or 0.6 |
| 2 | Declared primary conversion | 1.0 |
| 3 | Declared secondary conversion | 0.8 |
| 4 | URL pattern | 0.6 |
| 5 | GSC query intent | 0.5 |
| 6 | On-page signals | 0.4 |
| 7 | Internal link distance from tier 0 | 0.3 |
| 8 | Default to tier 3 | 0.1 |

## How to talk about a tier

Never report a ranking, a fix or an opportunity without its tier and the
conversion consequence. "Position improved from 14 to 6" says nothing.
"Position improved from 14 to 6 on a tier 1 comparison page that sales sends
before every close" says what happened.

The reverse also holds. A tier 4 finding with a high severity is still a tier 4
finding, and saying so out loud is how the reader learns to trust the ordering.

## The one exception

A tier 0 page that is unreachable, noindexed or canonicalised away outranks
every other finding regardless of score. It cannot earn a score at all while
it is invisible, so score-based ordering underrates it by construction.
