#!/usr/bin/env sh
# SessionStart. Decides whether this project has a Rainmaker journey in
# progress and, if so, states the next move. Runs on every session in every
# project, so it stays proportionate: a full invitation in a directory that is
# obviously free, one line in someone else's codebase.
#
# Filesystem checks and shell builtins only. No node, no npx, no network: a
# session must not wait on this.
#
# Everything here names the `rainmaker` skill, never a shell command. Telling
# the assistant to run `rainmaker init` made it shell out and stop, which is
# how the interactive workflow went missing: the skill is the entry point and
# runs `rainmaker init` itself as its own first step.

set -eu

root="${CLAUDE_PLUGIN_ROOT:-}"

trailer="
Use the model hosting this conversation. Never run \`rainmaker agent\` inside
Claude; it is a standalone API-key fallback. Never ask for a model API key.
Shared reference files live at:
  $root/skills/_shared
When a skill refers to \`skills/_shared/<file>\`, read it from that path."

# Crawl-provider state. Computed before any exit so the first run — the one
# moment the provider is actually chosen — can ask about it. This note used to
# live below the no-config branch, where it was unreachable exactly when it
# mattered.
provider_note=""
if [ -n "${FIRECRAWL_API_KEY:-}" ] || [ -n "${CONTEXT_DEV_API_KEY:-}" ]; then
  have=""
  [ -n "${FIRECRAWL_API_KEY:-}" ] && have="Firecrawl"
  [ -n "${CONTEXT_DEV_API_KEY:-}" ] && have="${have:+$have and }context.dev"
  provider_note="

A paid crawl-provider key is set: $have.
Before the first crawl, run \`rainmaker keys\` to read the live balance, tell
the user what they have, and ask which crawler to use: the built-in one, which
spends nothing, or the paid provider. Write the answer to \`crawl.provider\` in
rainmaker.config.yml so it is asked once and honoured afterwards. Never
activate a paid provider merely because a key exists."
fi

# SessionStart stdout is added to Claude's context verbatim.
emit() {
  printf '%s\n%s%s%s\n' "$1" "$trailer" "${connections_note:-}" "$provider_note"
  exit 0
}

# A project is "claimed" by Rainmaker once a config exists.
if [ ! -f rainmaker.config.yml ]; then
  # In someone else's codebase, say the minimum that makes the entry point
  # discoverable. Exiting silently here meant Rainmaker only ever announced
  # itself in bare directories like $HOME — the one place it should not be set
  # up — and stayed quiet in the site repos it is actually for.
  for marker in .git package.json go.mod Cargo.toml pyproject.toml Gemfile \
                pom.xml composer.json Makefile; do
    if [ -e "$marker" ]; then
      printf '%s\n' "Rainmaker is installed. This project has no rainmaker.config.yml.

If the user wants SEO or AEO work here, invoke the \`rainmaker\` skill; it
handles setup itself. Otherwise ignore this and carry on.$provider_note"
      exit 0
    fi
  done

  printf '%s\n' "Rainmaker is installed and this directory has no rainmaker.config.yml yet.

If the user wants to start, invoke the \`rainmaker\` skill. Do not run
\`rainmaker init\` yourself and do not interview them first: the skill asks for
the site URL, runs init, crawls, and opens the conversation from what it found.

Set it up in the directory for the site being worked on, not in a home
directory: init writes config, context/ and data/ into the working directory.

If they are here for something unrelated, ignore this and carry on.$provider_note"
  exit 0
fi

have_snapshot=no
if [ -d data/snapshots ]; then
  set -- data/snapshots/*
  [ -e "$1" ] && have_snapshot=yes
fi

# Credential state, read from the environment rather than guessed. These names
# come from KEY_TABLE in src/commands/keys.ts. Inventing plausible-looking ones
# here (GA4_PROPERTY_ID, GOOGLE_ADS_CUSTOMER_ID) produced a hook that reported
# every project as disconnected regardless of what was actually configured.
missing=""
grep -q '^gsc_site_url:' rainmaker.config.yml 2>/dev/null || missing="$missing Search Console,"
[ -n "${GOOGLE_APPLICATION_CREDENTIALS:-}" ] || missing="$missing Google Analytics,"
[ -n "${CLARITY_TOKEN:-}" ] || missing="$missing Clarity,"
missing="${missing# }"
missing="${missing%,}"

connections_note=""
if [ -n "$missing" ]; then
  connections_note="

Not connected yet: $missing.
Without these, opportunity scoring falls back to a flat value and every
finding says so. At a natural point in the conversation, offer to set them up
together, and walk the user through it one step at a time in plain language:
which page to open, which button to click, what to paste back. Do not hand
them a docs link or an environment variable name and leave. Wait at each step."
fi

if [ "$have_snapshot" = no ]; then
  emit "Rainmaker project, no audit has run yet.

Resume by invoking the \`rainmaker\` skill. It runs \`rainmaker audit\`, reads
the diagnosis, and opens the conversation from what the audit found rather
than from questions. Then it runs the know-my-buyer skill to write
context/business.md, which every judgment skill requires."
fi

if [ ! -f context/business.md ]; then
  emit "Rainmaker project. An audit has run; context/business.md is missing, so
every judgment skill will refuse until it exists.

Invoke the \`rainmaker\` skill, which resumes at the know-my-buyer interview.
Open with what the audit already found, then interview the user in their own
words. Do not ask them anything the crawl data can answer."
fi

emit "Rainmaker project, audit and business context both present.

Invoke the \`rainmaker\` skill to resume, or a specific skill if the user names
the job they want done."
