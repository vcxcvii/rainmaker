import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TIERS, TIER_ORDER } from '../analyze/tiering.js';

/**
 * Installing into a project, rather than into one assistant.
 *
 * There is no plugin format that loads in Claude Code, Codex and opencode
 * alike, so this does not try to invent one. It writes the two things every
 * harness already reads:
 *
 *   .claude/skills/  Claude Code loads these natively; opencode searches
 *                    `.claude/skills/<name>/SKILL.md` alongside its own paths
 *   AGENTS.md        the cross-tool convention, read by Codex, opencode,
 *                    Cursor, Gemini CLI, Copilot, Zed, Aider and others
 *
 * Claude Code users who install the plugin get more than this: a SessionStart
 * hook that reads project state and opens on the right next step. AGENTS.md is
 * the portable floor, not a replacement for it.
 */

/** Package root, from `dist/install/harness.js`. */
function packageRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
}

export interface AgentsDocInput {
  site: string;
  hasPrimaryConversion: boolean;
}

/**
 * Deliberately explains the vocabulary it uses. A new user's first contact
 * with this system is output like `Tiers: 0:1 1:0 2:13`, which means nothing
 * without a definition, and an agent reading only this file is the one that
 * has to explain it back to them.
 */
export function renderAgentsDoc(input: AgentsDocInput): string {
  const firstStep = input.hasPrimaryConversion
    ? 'rainmaker audit'
    : 'fill in `primary_conversion` in rainmaker.config.yml, then `rainmaker audit`';

  return `# AGENTS.md

This project is analysed with [Rainmaker](https://github.com/vcxcvii/rainmaker),
which turns ${input.site} into a pipeline diagnosis and then works the fixes
closest to revenue.

## How to work in this project

Skills live in \`.claude/skills/\`. Each is a Markdown file describing one
decision. Read the relevant \`SKILL.md\` in full before acting on its subject,
and follow it rather than improvising an approach.

Shared reference files the skills depend on are in \`skills/_shared/\`.

Deterministic work is the CLI's job, not yours. Crawling, tiering, scoring,
budget and the ledger all run through \`rainmaker\`. Do not reimplement them,
and do not estimate a number the CLI can produce.

Run \`rainmaker context --check\` before judgment work. It reports what exists,
what is stale, and exits non-zero when something required is missing.

## Next step

\`${firstStep}\`

Then run the \`know-my-buyer\` skill, which writes \`context/business.md\`.
Every judgment skill refuses until that file exists.

## Vocabulary

Explain these to the user in plain language the first time each comes up, then
use the real term. Do not assume they are known.

**Tier** — how close a page is to money, from 0 to 4.

${TIER_ORDER.map(
  (tier) =>
    `- **Tier ${tier}** (${TIERS[tier].name}): ${TIERS[tier].plain} — ${TIERS[tier].examples}.`,
).join('\n')}

Tier drives every score in this system, which is why
\`primary_conversion\` in the config matters more than any other setting: it is
what seeds Tier 0, and everything else is measured by distance from it.

**SERP verdict** — the judgment made about a keyword after reading the live
search results page, before anything gets written. \`QUALIFY\` means go,
\`CONDITIONAL\` means only in a specific format, \`KILL\` means do not write it.
Nothing gets briefed without one.

**Authority budget** — how many new pages this site can realistically get
indexed and ranked per month, measured from the last 90 days rather than
assumed. Publishing past it produces crawl waste, not rankings.

**Topical completeness** — how much of a subject area the site actually
covers. No new cluster opens while an existing one is under 40 percent
covered.

## How to give a recommendation

Every finding and every recommendation states three things, in this order:

1. **What it is**, in plain language first, then the correct term
2. **Why it happens**, the mechanism, not the assertion
3. **What changes if they act**, and what happens if they do not

A recommendation without its "why" is not actionable, and the user cannot
judge whether to trust it.
`;
}

/** Copies the packaged skills into a project, where any harness can find them. */
export function installSkills(projectDir: string): { installed: number; target: string } {
  const source = join(packageRoot(), 'skills');
  if (!existsSync(source)) {
    throw new Error(`packaged skills not found at ${source}`);
  }

  // `_shared` is skipped here on purpose. Skills reference it as
  // `skills/_shared/<file>` relative to the project root, so the copy below is
  // the one that gets read; a second copy under .claude/skills/ is never
  // resolved by anything and only gives the reference files somewhere to drift.
  const target = join(projectDir, '.claude', 'skills');
  cpSync(source, target, {
    recursive: true,
    dereference: true,
    filter: (from) => basename(from) !== '_shared',
  });

  cpSync(join(source, '_shared'), join(projectDir, 'skills', '_shared'), {
    recursive: true,
    dereference: true,
  });

  return { installed: readdirSync(target).length, target };
}

/** Writes AGENTS.md unless one already exists, which is the user's own. */
export function writeAgentsDoc(projectDir: string, input: AgentsDocInput): 'written' | 'kept' {
  const path = join(projectDir, 'AGENTS.md');
  if (existsSync(path)) return 'kept';
  writeFileSync(path, renderAgentsDoc(input), 'utf8');
  return 'written';
}
