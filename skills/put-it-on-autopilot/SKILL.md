---
name: put-it-on-autopilot
description: >
  Generate GitHub Actions workflows for the recommended cadence, calling
  `rainmaker routine` and `rainmaker report`, and print the exact secrets the
  user needs to set before the workflow can run.

  Use this skill whenever the user asks to:
  - Set up automation, cron, or scheduled runs
  - Run Rainmaker weekly or monthly on autopilot
  - Configure GitHub Actions for their SEO work

  Trigger even for casual requests like "set up automation", "run this
  weekly", "put this on a cron job", "autopilot my SEO checks".
---

# put-it-on-autopilot

## Context load

Run `rainmaker context --check` first. It prints what exists, what is stale, and exits 1 if anything this skill requires is missing.

Then read, in this order:

1. `context/business.md` in full. If absent, stop: "No business context. Run `rainmaker audit`, then the `know-my-buyer` skill."
2. `context/voice.md` if this skill writes prose. If absent, stop and say so.
3. `context/glossary.md` if this skill names products, features or competitors.
4. `data/strategy.json` if this skill reads or writes strategy.
5. Only the `data/` files listed in this skill's Consumes table. Never crawl or call an API the core already covers.

If `strategy.json.context_hash` does not match the current hash of `context/business.md`, say exactly:

"Business context was edited after the strategy was written. Re-run `know-my-buyer`, or run `rainmaker context --sync` to accept the prose as authoritative."

Then stop.

If `context/business.md` carries `confidence: stub`, continue, and stamp every output with: "Built on a stub context. Nothing in it came from a buyer. Run `know-my-buyer` to replace it."

## Consumes

| File | Why | If missing |
|---|---|---|
| `rainmaker.config.yml` | site shape (URL count, publish rate), to recommend a cadence | required |
| `.env.example` | which secrets the workflow will need | present in every install |

## Produces

`.github/workflows/weekly.yml`, `.github/workflows/monthly.yml`.

## Procedure

1. Determine site shape from the latest crawl and GSC snapshot: URL count, clicks per month, and recent publish rate.
2. Recommend a cadence from `spec/agent.md` section 5:
   - Under 50 URLs or under 100 clicks/month: no weekly job, monthly audit and report, quarterly strategy review only if drift fires.
   - 50 to 500 URLs: weekly pulse (`fetch` plus `audit --refresh`), monthly full audit, report, off-site scan, AI probes.
   - Over 500 URLs or publishing 4+ pages a month: full `routine` weekly, monthly report and off-site scan, `ledger --compact`.
3. Never assume the cadence; present the recommendation and let the user confirm or override before writing any workflow.
4. Generate the workflow calling `rainmaker routine` (weekly) and `rainmaker report --window month` plus `rainmaker ledger --compact` (monthly).
5. Verify every secret the workflow needs is documented in the README's credentials section, and print the exact `gh secret set` commands. Never write a workflow depending on a secret the user has not been told to create.
6. AI citation probes are scheduled monthly, never weekly: they cost money per run and the answers are non-deterministic, so a weekly line would mostly measure sampling variance.
7. Built-in crawl is the workflow default. Include `--provider firecrawl` or `--provider contextdev` only after the user explicitly approves that provider and its quota or cost.
8. GitHub Actions does not allow `secrets.*` directly in a step `if:`. Map an optional secret into job-level `env`, then test `env.NAME != ''` in the condition.

## Decision rules

- Never re-check anything faster than its own verification window. A weekly ranking report on a 40-page site reports noise as news.
- Never schedule a workflow whose secrets are undocumented.
- Never activate a paid provider because its secret exists.
- Never emit `if: ${{ secrets.NAME != '' }}`. Use a job-level environment variable and `if: env.NAME != ''`.
- The cadence is a recommendation the user confirms, never a default silently applied.

## Output

```
## Recommended cadence

Site shape: <n> URLs, <n> clicks/month, publishing <n> pages/month
Recommendation: <weekly / monthly-only / full weekly>, because <reason>

Confirm, or tell me what to change.

## Workflows written
.github/workflows/weekly.yml
.github/workflows/monthly.yml

## Secrets still needed
gh secret set FIRECRAWL_API_KEY --repo <repo>
gh secret set GOOGLE_APPLICATION_CREDENTIALS --repo <repo>
```

## Done when

The cadence was confirmed by the user before anything was written, both workflow files validate, and every required secret was printed with its exact `gh secret set` command.
