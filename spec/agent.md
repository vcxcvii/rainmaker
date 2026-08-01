# Rainmaker: Agent, Packaging and First Run

**Status:** normative, v3. Covers how Rainmaker is distributed, how it behaves in the first ten minutes, and what "agent" means here concretely.

---

## 1. What makes this an agent, and what does not

An agent is four things: tools it can call, memory that survives the session, a loop that runs without being asked, and judgment about what to do next. Most "AI SEO agents" have the fourth and none of the first three, which is why they produce a confident plan and no second act.

Rainmaker has all four, and they are already specified:

| Property | Where it lives |
|---|---|
| Tools | the deterministic CLI: `audit`, `fetch`, `serp`, `blueprint`, `ledger`, `report`, `offsite` |
| Memory | `ledger.jsonl` (append-only), `state.json`, `strategy.json` with history, `context/business.md` with history |
| Loop | `routine` on a schedule, verification windows, drift detection, `what-actually-worked` feeding back into belief |
| Judgment | 26 skills, one decision each, refusing rather than guessing |

What has to be built for it to actually run itself is small and named in section 6. What must not be automated is named in section 7, and that list is the difference between an agent and a liability.

## 2. Three install surfaces, one system

### 2.1 The core, for anyone

```
npx @vcxcvii/rainmaker init
npx @vcxcvii/rainmaker audit
```

Plain Node. No model, no key, no account. It crawls, measures, tiers, scores and writes JSON and Markdown. Everything deterministic lives here, which is why the same input always produces the same output and why any LLM can sit on top of it without changing the numbers.

### 2.2 The skills, for any assistant

```
npx @vcxcvii/rainmaker init --site https://example.com
npx @vcxcvii/rainmaker install
```

There is no universal LLM plugin API. Rainmaker installs a portable project
protocol in `RAINMAKER.md`, adds an idempotent pointer to `AGENTS.md`, and
copies the 26 Markdown skills into `.agents/skills/` and `.claude/skills/`.
Assistants that read those project conventions use the host conversation as
the model interface. Native adapters, such as the Claude Code plugin and its
session hook, are optional enhancements over the same CLI and files.

### 2.3 The agent, for hands-off operation

```
npx @vcxcvii/rainmaker agent          interactive, in the terminal
npx @vcxcvii/rainmaker routine        unattended, from cron or GitHub Actions
```

`agent` is a loop over the same skills and the same CLI, driven by whichever model the user brings. It exists so Rainmaker works for someone who does not already live inside an AI coding tool.

## 3. Bring your own key

No hosted service, no proxy, no telemetry. Keys are read from the environment or `.env`, never transmitted anywhere except the API they belong to, and never written into `data/` or any report.

| Key | Unlocks | Without it |
|---|---|---|
| none | crawl, technical audit, tiering, scoring, blueprint, reports | full first audit still runs |
| `FIRECRAWL_API_KEY` | optional Firecrawl crawl and paid SERP capture | dormant until `--provider firecrawl` or `serp --allow-paid` |
| `CONTEXT_DEV_API_KEY` | brand retrieve and parse | skipped |
| `GOOGLE_APPLICATION_CREDENTIALS` | GSC and GA4 | no opportunity sizing, no key-event tiering, confidence drops and says so |
| `PAGESPEED_API_KEY` | higher CWV rate limits | 5 requests per minute |
| `CLARITY_TOKEN` | behavioural leak analysis | `stop-losing-visitors` refuses |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `PERPLEXITY_API_KEY` | the agent loop, and AI citation probes per engine | probes skipped, offline AEO half still runs |
| `SERP_API_KEY` or Firecrawl search | live SERP capture for `can-i-actually-rank` | verdicts stay `unchecked`, which blocks briefing by design |

`rainmaker keys` prints which are set, what each unlocks, and what degrades. `rainmaker doctor` proves each one with the cheapest real call and never aborts on the first failure.

**Cost and consent guard.** The built-in crawler is always the default, even
when provider keys exist. Paid or quota-backed providers require explicit
approval in the current conversation and an explicit CLI flag. Every crawl
path, including `audit`, `fetch` and `routine`, prints its projection first and
refuses to exceed remaining Firecrawl credits without
`--allow-over-budget`. SERP capture also requires `--allow-paid`.

## 4. First run

The job to be done, stated the way the user would state it:

> "I have a site and a revenue target. Tell me what to fix first, and prove it was worth it."

Ten minutes, four moves.

### Move 1: one fact, then scaffold

`rainmaker init --site X` asks only for the site. It writes a config whose
business model, conversion paths, value, cycle, ICP and competitors are marked
as unconfirmed starting state. It also writes stub context and strategy files,
installs the portable conversation layer, and leaves discovery to the host
assistant after the crawl.

### Move 2: the conversation starts the crawl

After `init`, the host assistant runs `audit` as the next command and explains
what it is doing. `init` does not leave a hidden background process behind.
This matters for a reason the v1 spec got right and most onboarding gets wrong:
**the interview must not happen first.** `know-my-buyer` refuses to run without
a diagnosis, because interrogating someone about a site the system has not
looked at produces the same twelve generic questions every consultant asks.

So the order is: measure, then interrogate, grounded. While the crawl runs, the agent explains what it is doing and what each capability will unlock.

### Move 3: the grounded interview

When the audit lands, `know-my-buyer` opens with three sentences of fact: tier distribution, the top three findings by score, the sharpest contrast against a competitor. Then twelve questions minimum, one at a time, each citing a real number from the audit. It writes `context/business.md` and `strategy.json`.

`init` already writes a stub marked `confidence: stub`, so the skill can begin
after the audit instead of stalling on missing files. Every downstream output
carries that stamp until the interview replaces it.

### Move 4: three fixes, closest to revenue

The first artifact a new user sees. Not a 60-item audit, which is how every SEO tool loses the room.

Selection: take the top findings by `revenue_score`, then filter to those shippable inside two weeks of total effort, then take three that are not all the same kind of work. Plot them on effort against impact, where impact is `TIER_WEIGHT * opportunity * severity` and never raw traffic.

```
IMPACT
  high │  ●  Fix now                    ○  Plan it
       │  /pricing is noindexed            rebuild /vs/ hub
       │  tier 0, 0.5h, score 41.2         tier 1, 14h, score 6.1
       │
   low │  ○  Fill in                    ○  Skip for now
       └──────────────────────────────────────────────
           low effort                    high effort

1. /pricing carries <meta name="robots" content="noindex">
   Tier 0. 0.5 hours. Score 41.2. Your only page where money changes
   hands is excluded from search.
   Evidence: crawl.json, robots_meta, 2026-08-12, confidence 1.0
   Next: fix the tag, then `rainmaker audit --refresh`

2. ...
3. ...

Not shown: 47 further findings. `rainmaker report --window 28d` for all of them.
```

Every fix names the file and field it came from, the tier, the hours, and the exact next command. The three go into the ledger as `opened` immediately, so that in 28 days `what-actually-worked` can say whether they moved anything.

Then, and only then, the cadence question.

## 5. Cadence

Recommended, not assumed, and derived from the site rather than from a default that suits a vendor.

| Site shape | Weekly | Monthly | Quarterly |
|---|---|---|---|
| Under 50 URLs, or under 100 clicks a month | nothing | full audit and report | strategy review |
| 50 to 500 URLs | pulse: `fetch` plus `audit --refresh` | full audit, report, off-site scan, AI probes | `know-my-buyer` if drift fires |
| Over 500 URLs, or publishing 4+ pages a month | full `routine` | report, off-site scan, AI probes, `--compact` | strategy review |

Three rules behind the table, each with a reason:

1. **Never re-check anything faster than its verification window.** Positions move on a 28-day window. A weekly ranking report on a 40-page site reports noise as news, and noise erodes trust in the numbers that matter.
2. **AI citation probes are monthly, never weekly.** They cost money per run and the answers are non-deterministic, so a weekly line is mostly sampling variance.
3. **Small sites get less frequency, not less care.** Under 100 clicks a month there is no statistical signal to read weekly. Monthly, with a bigger window, is honest.

`put-it-on-autopilot` writes the workflows for the chosen cadence and prints the exact `gh secret set` commands for the keys it needs. Nothing is scheduled that the user did not choose.

## 6. What has to be built for autonomy

Named so nobody assumes it already exists.

| Piece | Why | Block |
|---|---|---|
| `rainmaker agent` loop | drives skills for users not inside an AI coding tool; provider-agnostic, BYO key | 22 |
| Background audit during init | so the interview is grounded without making the user wait | 22 |
| Effort against impact renderer | the first-run artifact, and the header of every report | 22 |
| Cadence recommender | reads site shape, proposes, never assumes | 23 |
| Cost guard and projections | an agent that can silently spend is not shippable | 23 |
| Portable project packaging | `rainmaker init` and `rainmaker install` across compatible assistants | 24 |

## 7. What stays human

The agent proposes; a person approves. These are never automated, in any cadence, with any key set:

- Publishing anything to a community, forum or social platform. Drafting is automated, posting is not.
- Sending outreach of any kind.
- Changing live site content or DNS. Rainmaker writes diffs and files issues.
- Deleting or redirecting a URL. `revive-old-pages` proposes; a person accepts.
- Spending beyond the configured budget.
- Overriding the authority budget or a preflight gate.

The reason is uniform: every item on that list is externally visible and hard to reverse, and the value of this system is that its record is trustworthy. An agent that can quietly publish is one bad inference away from destroying the only asset it was built to protect.
