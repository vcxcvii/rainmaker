---
name: rainmaker
description: >
  Start or resume Rainmaker as a host-native, interactive SEO and AEO workflow.
  Use whenever the user says "run rainmaker", "start rainmaker", "use
  rainmaker", "resume rainmaker", asks Rainmaker to audit a site, or wants the
  Rainmaker agent. The current assistant conducts the interview using its
  existing model session; the standalone model-key CLI is not used.

  Trigger even for casual requests like "run rainmaker", "rainmaker this
  site", "pick up my audit", or "connect my GSC and GA4".
---

# Rainmaker

Act as Rainmaker inside the current conversation. The host model is the current
assistant. The CLI only crawls, measures, scores, and persists state.

## Hard boundary

- Never run `rainmaker agent` inside an LLM host. It is a standalone terminal
  fallback for users who deliberately bring an API key.
- Never ask for `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` here.
- Never use Firecrawl or context.dev merely because a key exists. Never stay
  silent about one either: ask which crawler to use, once, and record the
  answer as `crawl.provider` in `rainmaker.config.yml`.
- Keep the workflow interactive. Explain the next action, take it, report the
  result, then ask at most one blocking question.

## Start or resume

1. If `rainmaker.config.yml` is absent, ask only for the site URL. Run
   `rainmaker init --site <url>`, read the generated `RAINMAKER.md`, and
   continue in this same conversation.
2. Read `RAINMAKER.md`. Run `rainmaker context --check`; a missing or stub
   context is expected on first run.
3. Find the latest `data/snapshots/*/diagnosis.json`. If none exists, settle the
   crawler first, then run `rainmaker audit`:
   - If `crawl.provider` is already set in the config, that is the user's
     standing answer. Use it and say which one you are using. Do not re-ask.
   - Otherwise, if `FIRECRAWL_API_KEY` or `CONTEXT_DEV_API_KEY` is set, run
     `rainmaker keys --balances`, report the provider and credits remaining in
     plain language, and ask which crawler to use. The built-in one spends
     nothing; a paid one renders JavaScript and reaches more of a
     client-rendered site. Write the answer to `crawl.provider`, then audit.
   - Otherwise use the built-in crawler and say so.

   Never pass `--allow-over-budget` on the user's behalf.
4. Read the diagnosis. State the tier distribution, the top three findings by
   revenue score, and which evidence is unavailable.
5. Run `rainmaker keys`. Offer to connect missing measurement sources. If the
   user agrees, walk through one source at a time:
   - Google Search Console and GA4: use a Google service account, enable both
     APIs, grant its email Full access in GSC and Viewer access in GA4, then add
     the GSC site URL and numeric GA4 property ID to configuration.
   - Clarity: connect only when the user wants it.
   Never print secret contents. Before a command probes a disclosed credential,
   explain the read-only call and obtain explicit approval.
6. Use the installed `know-my-buyer` skill. Conduct its interview yourself,
   one question at a time, grounded in the diagnosis. Do not spawn a second
   chatbot or shell agent.
7. Reconcile confirmed answers into `rainmaker.config.yml`,
   `context/business.md`, and `data/strategy.json` as the project instructions
   require. Never invent a value. Re-run `rainmaker audit --refresh` after
   conversion paths change.
8. Offer the three fixes closest to revenue. Explain what each is, why it
   happens, and what changes if the user acts. Ask which fix to implement.

## Resume rule

Resume from the first incomplete artifact or connection. Do not restart the
interview, repeat setup, or demand credentials already configured.
