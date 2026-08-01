#!/usr/bin/env sh
# SessionStart. Decides whether this project has a Rainmaker journey in
# progress and, if so, states the next move. Runs on every session in every
# project, so it stays silent unless it has something worth the context.
#
# Filesystem checks and shell builtins only. No node, no npx, no network: a
# session must not wait on this.

set -eu

root="${CLAUDE_PLUGIN_ROOT:-}"

trailer="
Use the model hosting this conversation. Never run \`rainmaker agent\` inside
Claude; it is a standalone API-key fallback. Never ask for a model API key.
Shared reference files live at:
  $root/skills/_shared
When a skill refers to \`skills/_shared/<file>\`, read it from that path."

# SessionStart stdout is added to Claude's context verbatim.
emit() {
  printf '%s\n%s%s\n' "$1" "$trailer" "${connections_note:-}"
  exit 0
}

# A project is "claimed" by Rainmaker once a config exists.
if [ ! -f rainmaker.config.yml ]; then
  # Don't interrupt work in someone else's codebase. .git and package.json
  # first: between them they cover almost every directory this opens in.
  for marker in .git package.json go.mod Cargo.toml pyproject.toml Gemfile \
                pom.xml composer.json Makefile; do
    [ -e "$marker" ] && exit 0
  done

  printf '%s\n' "Rainmaker is installed and this directory has no rainmaker.config.yml yet.

If the user wants to start, do not interview them first. Ask only for their
site URL, then run:

  rainmaker init --site <url>

That writes a config in seconds. Everything else (conversion paths,
competitors, ICP) is discovered afterwards by crawling and by the
know-my-buyer skill, not by asking the user to fill in a form.

If they are here for something unrelated, ignore this and carry on."
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
them a docs link or an environment variable name and leave. Wait at each step.
Firecrawl and context.dev are optional paid or quota-backed providers, not
missing requirements. Never activate either because a key exists. Ask for
explicit approval before using one."
fi

if [ -n "${FIRECRAWL_API_KEY:-}" ] || [ -n "${CONTEXT_DEV_API_KEY:-}" ]; then
  connections_note="$connections_note

A paid crawl-provider key is present but dormant. The built-in crawler remains
the default. Use a paid provider only after explicit approval in this
conversation, then pass --provider firecrawl or --provider contextdev."
fi

if [ "$have_snapshot" = no ]; then
  emit "Rainmaker project, no audit has run yet.

Start by running \`rainmaker audit\`. It crawls the site and produces the
diagnosis. Open the conversation from what the audit found, not from
questions. Then run the know-my-buyer skill to write context/business.md,
which every judgment skill requires."
fi

if [ ! -f context/business.md ]; then
  emit "Rainmaker project. An audit has run; context/business.md is missing, so
every judgment skill will refuse until it exists.

Run the know-my-buyer skill. Open with what the audit already found, then
interview the user in their own words. Do not ask them anything the crawl
data can answer."
fi

emit "Rainmaker project, audit and business context both present."
