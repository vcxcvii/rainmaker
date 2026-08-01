# Feedback

Running list from real first-run sessions. Fixed items stay here with their
cause, because the cause is usually more reusable than the fix.

Sorted against the definition of done in `SPEC.md`. An item is only open if it
breaks one of those five clauses; everything else is true, worth doing, and
queued. Without that split this file grows every session and reads as though
nothing is converging, which is a reporting artifact rather than a fact about
the product.

## Queued behind v1

These change behaviour or add surface rather than making the five clauses hold.

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

### Explain the vocabulary, every time

`RAINMAKER.md` now defines every tier where the reader meets it, and the audit
histogram renders the same plain-language table. What is still missing is the
three-part shape on every individual finding: what it is, why it happens, what
changes if they act. The doc requires it; the finding printer does not enforce
it.

## Open — blocks v1

Nothing. The definition of done in `SPEC.md` holds as of 0.6.0; see the note on
Google Ads under Queued, which is additive rather than blocking.

## Fixed

### A connected GA4 that measured nothing looked healthy

The highest-leverage fix available to a new site was the one thing nothing
mentioned. GA4 reports sessions whether or not any event is marked as a key
event, so a property with none looked connected and live. Tiering already
declined to use it, correctly and silently: scores fell back to URL patterns
and no output said why. A real first run showed 522 sessions over 30 days and
zero key events.

`audit` now names the state, and prints the events worth creating for this
revenue model with what each measures and why. The list is computed from the
revenue model and the Tier 0 pages, so it is reproducible across runs and
reviewable in a diff rather than invented per session. The skill handles it
before the interview, since an interview conducted on flat scores asks the
wrong questions.

Creating the events stays with the user. Rainmaker holds `analytics.readonly`
on purpose, and widening that scope to write conversion definitions is not a
trade worth making for an audit tool.

### The interview did not ask what was connected

`doctor` reported capabilities to a terminal before any conversation, in the
voice of a diagnostic, so a first-time user read it as noise and continued with
four of five degraded. The skill now runs `doctor` as step 5, says in plain
language what each degraded capability costs, and walks the user through
connecting one source at a time with the service account address in hand.

Google Ads is not part of this. It needs a new provider and a new credential,
and it sharpens SERP verdicts rather than making any clause of the definition
of done hold, so it is queued.


### A non-executable bin turned every call into a fork bomb

`tsc` emits `dist/cli.js` at mode 0644 and `package.json` points `bin` at it. A
bin target without the executable bit is skipped by PATH lookup entirely, so
resolution fell past the real CLI to the plugin wrapper, which has no build of
its own and ended in a bare `npx`. npm-exec resolves the command name against
PATH before installing, found the wrapper again, and re-exec'd: 280 processes,
load average 8. npm sets the bit itself for a published tarball, so it only bit
`npm link` and any rebuild landing after a link, which is why it looked
intermittent. A postbuild step now sets it, and the wrapper execs an explicit
file path at every branch instead of a command name.

### Every CLI call cost ~1.3s for marketplace users

Measured with a warm cache: `npx … --version` took 1.355s against 0.052s for
`node dist/cli.js --version`, on every command, in front of an agent that calls
the CLI repeatedly in one session. The wrapper now installs the package once
into a plugin-local runtime and execs `node` on that path: 0.96s on the first
call including the install, 0.14s cached. `CLAUDE_PLUGIN_ROOT` being ephemeral
is fine here because the runtime is a cache that rebuilds itself when missing,
not state.

### The front-door skill never reached the user

The orchestrator skill shipped in 0.3.1 while installs were pinned at 0.2.1,
which carried only the 26 decision skills. Each of those refuses without the
context the front door produces, so the whole interactive workflow was absent
with nothing saying why. Compounding it, the session hook told the assistant to
run `rainmaker init`, a shell command, so it shelled out and stopped; and the
steering pointer went only to `AGENTS.md`, which Claude Code does not read.
Every hook branch now names the skill, the pointer is written to `CLAUDE.md`
too, and `doctor` reports a plugin older than the CLI.

### Credentials could not be found without reading a key file

"GSC cannot access this site" was actionable only if you knew the fix was a
string inside a service account JSON. `doctor` now prints that address and the
GSC and GA4 properties it can already see, so the instruction carries both the
value to paste and the value to write into config. The private key beside it is
still never read.

### Assets were audited as pages

The crawler followed every link, so images and JSON endpoints entered the
snapshot, were tiered as awareness content, and failed every metadata check for
want of a title. On a 100-URL budget those are also real pages never crawled.
One predicate now decides what a document is, shared by the crawler, tiering and
the site checks: 59 pages became 49 real ones, 20 findings became 0.

### The agent rewrote the tool during a user's audit

A session on a live site spent ten minutes and 25k tokens editing this
codebase mid-interview, rebuilt it, and left the user a changed binary they had
not asked for. Nothing forbade it, and several rules that do exist were written
only in `README.md` or the generated `RAINMAKER.md`, which the model never
reads. The five that matter now sit in `skills/rainmaker/SKILL.md` with a test
asserting each. The recurring cause is worth more than the fix: a rule in an
artifact the model does not read is not a rule.

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
