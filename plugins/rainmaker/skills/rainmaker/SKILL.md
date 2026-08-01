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
assistant. Never run `rainmaker agent`; it is standalone API-key mode. Never
ask for a model API key.

If `rainmaker.config.yml` is absent, ask only for the site URL. Run `npx
@vcxcvii/rainmaker init --site <url>`, read the generated `RAINMAKER.md`, and
continue immediately in this conversation.

Otherwise read `RAINMAKER.md`, run `rainmaker context --check`, and resume from
the first incomplete artifact. Run the built-in audit before interviewing the
user. Never activate Firecrawl or context.dev because a key exists; obtain
explicit approval for paid or quota-backed providers.

Read the diagnosis. Report its tier distribution, top three revenue-scored
findings, and missing evidence. Run `rainmaker keys`, offer GSC/GA4/Clarity
connections, and walk through one source at a time. Obtain explicit approval
before probing a disclosed credential. Never print secret contents.

Conduct the installed `know-my-buyer` workflow yourself, one grounded question
at a time. Do not spawn a shell chatbot. Persist confirmed answers according to
`RAINMAKER.md`, refresh the audit when conversions change, then offer the three
fixes closest to revenue.
