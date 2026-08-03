# Rainmaker

Free, open-source SEO and AEO agent for Codex, Claude Code, and compatible AI coding assistants.

Rainmaker crawls your website, connects problems to how the business makes money, and gives you the three fixes worth considering next. It then records what shipped and checks whether the work helped. No hosted account, paid crawler, or separate model API key is required for the normal workflow.

> Most SEO tools find problems. Rainmaker decides what is worth fixing and remembers whether it worked.

## Quick start

Install the plugin for your assistant (see [Install options](#install-options)), open it in your website project, and say:

```text
run rainmaker
```

That is the whole setup. The `rainmaker` skill asks for your site URL, runs `init` itself, crawls, and opens the conversation from what it found. You do not run CLI commands by hand.

If your assistant has no plugin support, set the project up first and then say the same thing:

```bash
npx @vcxcvii/rainmaker init --site https://example.com
```

Run it in the directory for the site, not in your home directory — `init` writes configuration, `context/`, `data/` and skill copies into the working directory, and refuses a home directory without `--force`.

Rainmaker will:

1. Crawl the site with its built-in crawler.
2. Show the diagnosis before asking generic business questions.
3. Offer to connect Google Search Console, GA4, and Clarity.
4. Interview you one question at a time using evidence from the crawl.
5. Recommend three fixes ranked by distance to revenue.
6. Record what you ship and check the relevant metric later.

## What problem does it solve?

A normal site audit might put a missing alt attribute on a careers page beside a noindexed pricing page. Both appear urgent. The report does not tell you which problem is more likely to cost a customer.

Rainmaker gives every URL a revenue tier:

| Tier | Plain-English meaning | Examples |
|---|---|---|
| 0 | Money changes hands here | pricing, demo, signup, checkout, contact |
| 1 | Read right before buying | comparisons, alternatives, case studies, integrations |
| 2 | Brings the right person in | use cases, solution pages, pain-point content |
| 3 | General awareness | educational and definitional content |
| 4 | No direct commercial role | about, careers, press, legal |

The tier feeds a deterministic score computed in code. The model cannot invent or adjust it. Two runs over unchanged input produce the same result.

## What you get

- **Zero-credential first audit.** Built-in crawling, technical checks, tiering, scoring, and reports work without a paid provider.
- **Three fixes, not sixty.** Every recommendation includes evidence, effort, impact, confidence, and the consequence of doing nothing.
- **Grounded buyer context.** The interview runs after the crawl and cites the site evidence in every question.
- **SEO, AEO, and GEO in one workflow.** Technical health, live SERPs, site architecture, content, AI citations, and off-site work share one strategy.
- **A publish budget.** Rainmaker limits new content to what the site has demonstrated it can get indexed and ranked.
- **A permanent ledger.** It remembers what Rainmaker believed, what changed, what shipped, and what moved.
- **Human control.** Paid providers and externally visible actions require explicit approval.

## Install options

### Portable project install

This is the broadest option. It installs one front-door `rainmaker` skill plus 26 decision skills into `.agents/skills/` and `.claude/skills/`. It also writes `RAINMAKER.md` and adds a managed pointer to both `AGENTS.md` and `CLAUDE.md` without replacing existing instructions — Claude Code loads `CLAUDE.md` and nothing else, so a pointer in `AGENTS.md` alone never reaches it.

```bash
npx @vcxcvii/rainmaker init --site https://example.com
```

Refresh the skills after an upgrade without touching business configuration:

```bash
npx @vcxcvii/rainmaker install
```

Some assistants discover newly installed skills only when a new task or session starts.

### Native Codex plugin

```bash
codex plugin marketplace add vcxcvii/rainmaker --ref main
codex plugin add rainmaker@vcxcvii
```

Start a new task in the website project and say `run rainmaker`.

### Claude Code plugin

```text
/plugin marketplace add vcxcvii/rainmaker
/plugin install rainmaker@vcxcvii
```

The Claude plugin also includes a session hook that notices unfinished Rainmaker work and surfaces the next step.

## Why it uses your existing assistant instead of another model key

The normal workflow is host-native. Codex or Claude Code conducts the conversation using the model session you already opened. Rainmaker’s CLI handles deterministic work such as crawling, measurement, scoring, and memory.

The CLI cannot borrow a ChatGPT, Claude, or Codex subscription. Those apps do not expose their session credentials or model runtime to child command-line processes, and an app subscription is not API credit.

`rainmaker agent` is therefore a separate standalone terminal fallback. Use it only when you deliberately want to bring an API key or compatible local endpoint:

```bash
ANTHROPIC_API_KEY=... rainmaker agent

# or an OpenAI-compatible local model
OPENAI_API_KEY=ollama \
OPENAI_BASE_URL=http://localhost:11434/v1 \
RAINMAKER_MODEL=llama3.1 \
rainmaker agent
```

Inside Codex or Claude Code, do not run `rainmaker agent`. Say `run rainmaker` instead.

## Credentials and provider consent

No credential is required for the first useful result.

| Credential | What it unlocks | Required? |
|---|---|---|
| None | Built-in crawl, technical checks, tiers, scoring, blueprint, reports | No |
| Google service account | Search Console opportunity data and GA4 conversion evidence | Optional |
| Clarity token | Behavioural evidence such as dead clicks and rage clicks | Optional |
| Firecrawl or context.dev | Alternative crawling for sites that need it | Optional and approval-gated |
| OpenAI or Anthropic API key | Standalone terminal agent and direct AI citation probes | Optional |

An environment key makes a provider available. It does not approve use. It does not license silence either: when a paid key is present, Rainmaker asks which crawler you want before the first crawl, once, and records the answer.

```bash
rainmaker keys --balances               # what is set, and credits remaining
rainmaker audit                         # built-in crawler, spends nothing
rainmaker audit --provider firecrawl    # explicit Firecrawl use, this run only
rainmaker serp --allow-paid "query"     # explicit paid SERP capture
```

The answer is stored as `crawl.provider` in `rainmaker.config.yml` and honoured by every later audit, so you are asked once rather than once per crawl. `--provider` overrides it for a single run. A crawl projected to exceed the remaining balance is refused rather than trimmed.

Run `rainmaker keys` to see which credentials are set, what each unlocks, and whether it remains dormant; add `--balances` to check live provider credits. Rainmaker never prints secret contents.

### Connecting Search Console and GA4

Both use one Google service account: a robot account you create once inside your own Google Cloud project. It reads only. The scopes are `webmasters.readonly` and `analytics.readonly`, so it cannot change settings, publish, or delete anything.

`rainmaker doctor` prints the address you need and the properties it can already see:

```text
GSC        ok       2 site(s), gsc_site_url not set: sc-domain:example.com
GA4        ok       ga4_property_id not set: 531203437 (example.com)

Service account: rainmaker@your-project.iam.gserviceaccount.com
Grant it Full access in Search Console and Viewer access in GA4 to close a MISSING row above.
```

Paste that address into Search Console under Settings, Users and permissions, as Full; and into GA4 under Admin, Property access management, as Viewer. Then copy the site URL and property ID that `doctor` listed into `gsc_site_url` and `ga4_property_id` in your config.

A site appears to the service account only when you grant it, one property at a time. Nothing is connected automatically, and the account cannot add itself anywhere. The address is an identifier and is safe to share; the private key in the JSON file beside it is not.

## Example questions

- “Which three fixes are closest to revenue?”
- “Which pages get impressions but fail to earn clicks?”
- “Can we realistically rank for this query? Read the live results first.”
- “Our organic traffic fell. Was it something we shipped, a wider search change, or neither?”
- “How many pages can this site publish before we exceed what it gets indexed?”
- “What did we ship last quarter that produced no measurable improvement?”

Rainmaker supports sales-led, self-serve, product-led, marketplace, local-services, ecommerce, ads, newsletter, and consulting revenue models.

## Main commands

| Command | Purpose |
|---|---|
| `rainmaker init --site <url>` | Create config, context, and portable skills |
| `rainmaker audit` | Crawl, tier, score, and write the diagnosis |
| `rainmaker keys` | Explain credential state; `--balances` for live provider credits |
| `rainmaker doctor` | Probe configured connections independently |
| `rainmaker fetch` | Pull GSC, GA4, and Clarity snapshots |
| `rainmaker serp` | Capture live search results with explicit paid consent |
| `rainmaker blueprint` | Build or inspect the one-intent-per-URL site plan |
| `rainmaker report` | Render pulse, 28-day, monthly, or longer reports |
| `rainmaker routine` | Run the repeatable measurement and planning pass |
| `rainmaker ledger` | Query finding and outcome history |
| `rainmaker context` | Check, initialize, validate, or sync business context |
| `rainmaker agent` | Standalone API-key terminal fallback only |

## How the system fits together

Rainmaker has one entry skill and 26 decision skills across six phases:

```text
Ground -> See -> Decide -> Build -> Spread -> Prove
                     ^                         |
                     |____ evidence loop ______|
```

All decision skills read the same `context/business.md` and `data/strategy.json`. Each strategy field has one owner. The deterministic core writes snapshots and scores. The append-only ledger carries evidence across sessions.

This prevents 26 skills from becoming 26 unrelated opinions.

## What Rainmaker will not do quietly

- Publish content, post to communities, send outreach, redirect pages, or delete URLs.
- Spend paid-provider quota because a key exists.
- Let a model compute or alter revenue scores.
- Use Domain Rating or Authority Score as ranking truth.
- Ship doorway-page permutations or simulate independent voices.
- Claim an algorithm update caused a change when the evidence only shows timing.
- Hide missing Search Console, GA4, or other evidence from a report.
- Let the assistant's own observations be reported as findings the tool made. What the checks found and what the assistant noticed are separate sections, separately attributed.

## Rainmaker versus an experienced agency

Rainmaker is strong at repeatable crawling, prioritization, transparent evidence, and remembering outcomes. An experienced human agency remains stronger at stakeholder alignment, customer nuance, creative positioning, political constraints, and decisions where the evidence is incomplete.

The useful combination is a senior operator using Rainmaker as the shared measurement and memory layer, not pretending software removes judgment.

Want help applying it to a real site? [Book 30 minutes with Varun](https://cal.com/varun-choraria/30min).

## Development

```bash
npm ci
npm run typecheck
npm run build
npm test
```

The repository includes fabricated `data.example/` fixtures, so contributors can inspect the complete data contracts without sending requests to a real website or provider.

The full specification lives in [`SPEC.md`](SPEC.md). Supporting documents cover the [context layer](spec/context-layer.md), [site blueprint](spec/site-blueprint.md), [off-site work](spec/offsite.md), [skills](spec/skills.md), [agent workflow](spec/agent.md), and [false-positive policy](spec/false-positives.md).

## License

[MIT](LICENSE). Use it, fork it, remove what you do not need, and disagree with it in public.
