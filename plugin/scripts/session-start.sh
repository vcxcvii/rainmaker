#!/usr/bin/env sh
# SessionStart. Decides whether this project has a Rainmaker journey in
# progress and, if so, states the next move. Runs on every session in every
# project, so it stays silent unless it has something worth the context.
#
# Filesystem checks only. No node, no npx, no network: a session must not wait
# on this.

set -eu

root="${CLAUDE_PLUGIN_ROOT:-}"
shared="$root/skills/_shared"

emit() {
  # SessionStart stdout is added to Claude's context verbatim.
  printf '%s\n' "$1"
  exit 0
}

# A project is "claimed" by Rainmaker once a config exists.
if [ ! -f rainmaker.config.yml ]; then
  # Don't interrupt work in someone else's codebase.
  for marker in package.json go.mod Cargo.toml pyproject.toml Gemfile pom.xml \
                composer.json Makefile .git; do
    [ -e "$marker" ] && exit 0
  done

  emit "Rainmaker is installed and this directory has no rainmaker.config.yml yet.

If the user wants to start, do not interview them first. Ask only for their
site URL, then run:

  rainmaker init --site <url>

That writes a config in seconds. Everything else (conversion paths,
competitors, ICP) is discovered afterwards by crawling and by the
know-my-buyer skill, not by asking the user to fill in a form.

If they are here for something unrelated, ignore this and carry on."
fi

have_snapshot=no
[ -d data/snapshots ] && [ -n "$(ls -A data/snapshots 2>/dev/null || true)" ] && have_snapshot=yes

have_business=no
[ -f context/business.md ] && have_business=yes

# Credential state, read from the config and environment rather than guessed.
missing_connections=""
grep -q '^gsc_site_url:' rainmaker.config.yml 2>/dev/null || missing_connections="$missing_connections Search Console,"
[ -n "${GA4_PROPERTY_ID:-}" ] || missing_connections="$missing_connections GA4,"
[ -n "${GOOGLE_ADS_CUSTOMER_ID:-}" ] || missing_connections="$missing_connections Google Ads,"
missing_connections=$(printf '%s' "$missing_connections" | sed 's/^ //; s/,$//')

connections_note=""
if [ -n "$missing_connections" ]; then
  connections_note="

Not connected yet: $missing_connections.
Without these, opportunity scoring falls back to a flat value and every
finding says so. At a natural point in the conversation, offer to set them up
together, and walk the user through it one step at a time in plain language:
which page to open, which button to click, what to paste back. Do not hand
them a docs link or an environment variable name and leave. Wait at each step."
fi

if [ "$have_snapshot" = no ]; then
  emit "Rainmaker project, no audit has run yet.

Start by running \`rainmaker audit\`. It crawls the site and produces the
diagnosis. Open the conversation from what the audit found, not from
questions. Then run the know-my-buyer skill to write context/business.md,
which every judgment skill requires.

Shared reference files live at:
  $shared
When a skill refers to \`skills/_shared/<file>\`, read it from that path.$connections_note"
fi

if [ "$have_business" = no ]; then
  emit "Rainmaker project. An audit has run; context/business.md is missing, so
every judgment skill will refuse until it exists.

Run the know-my-buyer skill. Open with what the audit already found, then
interview the user in their own words. Do not ask them anything the crawl
data can answer.

Shared reference files live at:
  $shared
When a skill refers to \`skills/_shared/<file>\`, read it from that path.$connections_note"
fi

emit "Rainmaker project, audit and business context both present.

Shared reference files live at:
  $shared
When a skill refers to \`skills/_shared/<file>\`, read it from that path.$connections_note"
