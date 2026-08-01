# Feedback

Running list from real first-run sessions. Fixed items stay here with their
cause, because the cause is usually more reusable than the fix.

## Open — plugin

### Set up the measurement before diagnosing anything

Before the first audit, read the site the user gave and work out what its key
events and conversions should be, then help them configure those in GA4. A
site with no conversion events defined produces an audit that cannot rank
anything by revenue, so every finding falls back to a flat score and the whole
premise of the product is unavailable on day one.

Order should be: read the site, propose the events that match how this
business actually makes money, set them up with the user, then audit. Not:
audit into an empty measurement layer and report low confidence.

Scaffold this as its own skill if it does not fit inside `know-my-buyer`.
It belongs in the proactive path, not as something the user has to request.

### Explain the vocabulary, every time

The first thing a new user sees is `Tiers: 0:1 1:0 2:13 3:6`. Nobody knows
what that means. Tier language is used throughout the audit output, the skills
and the config comments without ever being defined in the place the user reads
it.

Every skill and every recommendation needs to carry, in plain language:

- **What it is** — ELI5 first, then the real term, so the user learns the
  vocabulary rather than being handed jargon or being talked down to
- **Why it matters** — the mechanism, not the assertion
- **What the impact is** — what changes if they act on it, and what happens if
  they do not

This applies to output as much as documentation. A finding that says "no
structured data on a page buyers compare on" should say why structured data
affects that page's revenue, not assume the reader already agrees.

### Interview must ask what is actually connected, then set it up with the user

`doctor` reports GA4, GSC, Clarity and PageSpeed as MISSING, but it reports
them to a terminal, before any conversation has happened, in the voice of a
diagnostic. A first-time user does not read that as "you have homework"; they
read it as noise and continue with four of five capabilities degraded, which
silently caps the quality of every finding from then on.

The interview should ask directly, early:

- Is Google Analytics 4 connected?
- Is Search Console connected?
- Is Google Ads connected? (paid keyword data sharpens every SERP verdict)

And when the answer is no, walk them through it *in the conversation* at
ELI5 level. Not a docs link. Not "set `GSC_CLIENT_EMAIL`". Literally: which
page to open, which button, what to paste back, one step at a time, waiting
for them at each step.

Rationale: these three connections are the difference between opportunity
scoring that falls back to a flat 1.0 and scoring that reflects the business.
It is the highest-leverage thing a new user can do in their first hour, and
today nothing asks them to do it.

Ads is additive to the existing GA4/GSC capability set and needs a provider.

At the same moment, ask whether they have their own Firecrawl or context.dev
account. Both are already supported providers, both are the kind of key a
user may already hold from other work, and a user's own key means their own
quota and billing rather than a shared or absent one. Asking costs one line
in a conversation that is already about connecting things.

### Proactive start

Nothing currently begins on its own. Skills are model-invoked: they fire when
a user's phrasing matches, so a new user facing an empty project has to
already know what to ask for. The plugin should ship:

- a `CLAUDE.md` that states the entry path, so it is in context from turn one
- a `SessionStart` hook running `rainmaker context --check`, so a project
  missing `context/business.md` opens the interview instead of waiting

### The front door is the CLI, and it should be the conversation

`init` interrogates the user for eight answers the agent is meant to
discover. A question-and-answer UI promises intelligence; behind this one sat
`readline` and `.split(',')`. Observed directly: a user answered "not decided,
help figure out" and "no idea, please search", because prompts invite the
answers you would give a person.

Target order: `init --site X` writes a config in seconds with TODOs, then the
conversation crawls, proposes conversion paths, discovers competitors, argues
with the ICP, and fills them in.

## Open — core

### sitemap.xml is audited as if it were a page

First audit of a 20-URL site produced 4 findings, 3 of them `no title`,
`no H1`, `orphan` against `/sitemap.xml`. All three are correct-by-design for
a sitemap. 75% of a new user's first output was noise about a file that works.

Exclude `sitemap.xml`, `robots.txt`, and feed URLs from tiering and checks.

### Version string is stale

`rainmaker --version` prints `0.1.0`; `package.json` says `0.2.1`.

## Fixed

### `rainmaker doctor` after an npx run

init's next-step said `rainmaker doctor`. Under npx the package runs from a
cache directory and the bin is never on PATH, so the first thing a user did
after a successful install was hit `zsh: command not found: rainmaker`.
Now derives the invocation from `process.argv[1]`.

### Non-interactive usage listed all eight flags as required

Only `--site` blocks writing a config, but the error printed all eight
together, so an agent or CI user reasonably concluded all eight were needed.
Usage now separates required from optional and shows defaults.

### `Number(raw) || fallback` swallowed a deliberate 0

A user answered `0` to sales cycle and the config recorded `30`, because `0`
is falsy. Answers are now parsed with a finite check.

### Prose answers were accepted in silence

`primary_conversion: [not decided, help figure out]` was written without
comment, seeding Tier 0 with strings matching no URL. init now flags entries
that are not paths.

### init aborted instead of scaffolding

Missing primary conversion returned exit 1 and wrote nothing, leaving an empty
directory. It now writes the config with a TODO; `validateConfig` already
rejects an empty `primary_conversion` by name, which is the better place for
that error to surface.
