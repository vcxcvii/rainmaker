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

## Open — from the four-angle review

These were found, judged real, and deliberately not fixed in the same pass:
each changes behaviour or adds surface rather than cleaning up what exists.

### Every CLI call costs ~1.3s for marketplace users

`dist/` is gitignored, so a marketplace install has no build and `bin/rainmaker`
falls through to `npx`. Measured with a warm cache: `npx … --version` takes
1.355s against 0.052s for `node dist/cli.js --version`. That is ~1.3s of npm
resolution on every command, in front of an agent that calls the CLI repeatedly
within one session.

Resolving once and memoising would remove ~96% of it, but the obvious place to
cache is `${CLAUDE_PLUGIN_ROOT}`, which the plugin docs explicitly describe as
ephemeral and not for state. Needs a real answer, not a quick one.

### The two best findings the audit produces cannot be tracked

"No Tier 0 pages" and "No Tier 1 pages" are site-level diagnoses, and the
latter's own text says it is "usually worth more than any single fix listed
below". Both exist only as `console.log` inside the printer: not in `Diagnosis`,
not in the `CHECKS` set, not scored, not in the ledger, invisible to `report`,
`routine`, and to any skill reading the diagnosis JSON. The highest-value output
of the system is the one thing that cannot be ordered, tracked or closed, and it
disappears the moment nobody is watching stdout.

### The hook re-derives project state the CLI already computes

`context --check` already reports present/missing/stale across business,
strategy and snapshots, and picks the next step. The hook re-derives a coarser
version in shell and hardcodes three paths that exist as exported constants. The
credential half of that duplication has already drifted once (see Fixed). The
"no node, no npx" constraint is about latency, not a reason to keep a second
state model — `context --check` is filesystem-only too. Wants
`context --check --json` and a hook reduced to invoke, print, and fall silent on
timeout.

## Fixed

### Provider keys implied consent

Old releases wrote `provider: firecrawl` by default and provider selection
also followed whichever key happened to exist. `FIRECRAWL_API_KEY` could
therefore spend quota during an ordinary audit. Built-in crawl is now always
the default. Paid or quota-backed crawling needs an explicit `--provider`
flag, and SERP capture needs `--allow-paid`.

### Interactive setup was tied to one assistant

`init` now installs the skills into both `.agents/skills/` and
`.claude/skills/`, writes a portable conversation protocol to `RAINMAKER.md`,
and safely adds one managed pointer to `AGENTS.md`. The current host assistant
is the model. No separate model key is required. The Claude plugin keeps its
session hook as an optional native enhancement.

### The front door asked the agent's questions in a terminal

`init` now requires only `--site`, scaffolds the rest, and sends the user into
an evidence-first conversation. The audit runs first; the assistant then
proposes conversion paths, competitors and buyer context for confirmation.

### Skills could only be installed while creating a config

`rainmaker install` now refreshes portable skills and assistant instructions
idempotently without rewriting `rainmaker.config.yml`.

### Machine endpoints were audited as content

Sitemaps, robots files and feed endpoints are excluded from content checks.
Thin content and absent schema are suspicions until corroborated, not ranked
revenue findings.

### Version and package identity were stale

The CLI reads its version from `package.json`. Package-lock metadata now names
`@vcxcvii/rainmaker` and its `rainmaker` binary instead of the old `paydirt`
identity.

### Routine automation reused stale measurements

`routine` now fetches a new crawl and connected measurements before audit.
Repository CI replaces the broken client schedules, and generated workflows
map secrets into job environment variables before testing them.

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
