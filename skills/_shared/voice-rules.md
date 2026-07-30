# Voice rules

The fixed floor. `context/voice.md` adds the site owner's specific rules and
samples on top; where the two disagree, `context/voice.md` wins, because it
describes a real person's writing and this file describes a minimum.

## The slop check

A draft fails on any of these.

| Rule | Threshold |
|---|---|
| Opening cliches | "In today's", "In the world of", "Let's dive in", "In an era where" |
| Filler triads | three-item lists used as rhetorical filler in 3 or more consecutive paragraphs |
| Slop vocabulary | leverage, utilize, seamless, robust, game-changer, unlock, elevate, supercharge, delve, landscape, realm, tapestry: more than 1 per 500 words |
| Em-dashes | any |
| Sentence length | any sentence over 40 words |
| Rhythm | more than 2 consecutive paragraphs with identical sentence counts |

The em-dash rule is absolute and applies to skill prose, report copy and
generated content alike.

## Why these and not a style opinion

Each rule catches a machine tell rather than a taste preference. Cliched
openings, triads, and the slop vocabulary are what a model reaches for when it
has nothing specific to say, so they are a proxy for missing substance. Fixing
them by swapping synonyms misses the point: if a sentence only exists to fill
rhythm, cut it.

## Positive rules

- Lead with the specific number already present in the data. Never invent one to lead with.
- One claim per sentence. If a sentence needs two clauses joined by "and", it is usually two sentences.
- Name the thing. "The pricing page" beats "the relevant conversion asset".
- Prefer the buyer's phrasing from `buyer_language` over the category's marketing phrasing, even when the category phrasing sounds more professional.
- Cut before adding. A punch-up that grows a draft by more than 10 percent has failed.

## What cannot be said

`context/business.md` has a "What we will not say" section. It is a hard block,
not a preference. A claim that appears there is removed, not softened, and the
skill says which claim it removed and where the rule came from.

Any claim that is not common knowledge needs a proof id from `strategy.json`.
Unsourced claims get cut. Softening an unsourced claim into a vaguer unsourced
claim is worse, because it hides the problem from review.
