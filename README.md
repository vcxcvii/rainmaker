# lazarus-pit

Self-healing UX agent. Pulls Clarity session data, diagnoses friction, files GitHub issues with a proposed fix against the target site. Runs on autopilot weekly via GitHub Actions. Human approves before anything touches code — no blind auto-deploy.

## Modules

1. `src/fetch-clarity.ts` — pulls Clarity Data Export API metrics, tracks daily call budget (10/day limit, 3-day lookback max)
2. `src/finding-extractor.ts` — thresholds Clarity metrics (dead/rage clicks, quickback rate, scroll depth, script/click errors) into severity-ranked findings
3. `src/component-mapper.ts` — maps each finding to a suggested fix template
4. `src/pr-generator.ts` — opens a GitHub issue per finding on the target repo (dedupes against already-open `lazarus-pit`-labeled issues)

`src/run.ts` chains all three in order.

## Setup

```
npm install
cp .env.example .env   # fill in CLARITY_TOKEN
gh auth status          # must be logged in with repo scope on the target account
```

Target repo defaults to `vcxcvii/vcxcvii.github.io`; override with `LAZARUS_TARGET_REPO`.

## Usage

```
npm run fetch      # pull latest Clarity data → data/clarity-*.json
npm run diagnose   # extract findings → data/findings-*.json
npm run propose    # file GitHub issues from latest findings
npm run run        # all three in sequence
```

## Autopilot

`.github/workflows/weekly.yml` runs the full pipeline every Monday at 14:00 UTC (also triggerable manually via `workflow_dispatch`). It needs two repo secrets:

- `CLARITY_TOKEN` — same token as local `.env`
- `GH_PAT` — a personal access token with `repo` scope, used instead of the default `GITHUB_TOKEN` because issues are filed on a *different* repo (`vcxcvii/vcxcvii.github.io`) than the one the workflow runs in

Weekly cadence matches Clarity's 3-day lookback window and 10-calls/day budget — one run a week uses 2 of those 10 calls (fetch + nothing else hits the API) and stays well inside the window.

## Design decisions

- No auto-code-diff or auto-deploy — files issues, human reviews and merges. Escalate to PR-generation only once finding quality is trusted.
- Clarity API metrics in this export are site-wide, not per-page, so findings are site-level, not page-level.
- Issue creation is idempotent per run — same open finding won't get filed twice.
