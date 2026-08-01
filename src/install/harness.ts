import { cpSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TIERS, TIER_ORDER } from '../analyze/tiering.js';

/** Package root, from `dist/install/harness.js`. */
function packageRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
}

export interface AgentsDocInput {
  site: string;
  hasPrimaryConversion: boolean;
}

export function renderAgentsDoc(input: AgentsDocInput): string {
  const discovery = input.hasPrimaryConversion
    ? 'Tier 0 is seeded. Verify it against the crawl and the user before treating it as settled.'
    : 'Tier 0 is not seeded yet. Run the audit, then propose likely conversion paths from the site and confirm them in conversation.';

  return `# AGENTS.md

This project is analysed with [Rainmaker](https://github.com/vcxcvii/rainmaker),
which turns ${input.site} into a pipeline diagnosis and then works the fixes
closest to revenue.

## How to work in this project

Read \`RAINMAKER.md\` first. It defines the portable, conversation-first entry
path. Skills live in \`.agents/skills/\` and \`.claude/skills/\`. Read the
relevant \`SKILL.md\` in full before acting on its subject.

Shared reference files live in \`skills/_shared/\`.

Deterministic work is the CLI's job. Crawling, tiering, scoring, budget, and
the ledger run through \`rainmaker\`. Never estimate a number the CLI can
produce.

Run \`rainmaker context --check\` before judgment work.

## Next step

\`rainmaker audit\`

${discovery}

Then run the \`know-my-buyer\` skill, which writes \`context/business.md\`.

## Vocabulary

Explain each term in plain language the first time it appears.

**Tier** - how close a page is to money, from 0 to 4.

${TIER_ORDER.map(
  (tier) =>
    `- **Tier ${tier}** (${TIERS[tier].name}): ${TIERS[tier].plain} - ${TIERS[tier].examples}.`,
).join('\n')}

Tier drives every score. \`primary_conversion\` seeds Tier 0.

**SERP verdict** - judgment made after reading live search results. \`QUALIFY\`
means go, \`CONDITIONAL\` means only under a named condition, and \`KILL\`
means do not write it.

**Authority budget** - how many new pages this site can realistically get
indexed and ranked per month.

**Topical completeness** - how much of a subject area the site covers.

## Recommendations

Every recommendation states:

1. What it is
2. Why it happens
3. What changes if they act, and what happens if they do not
`;
}

export function renderRainmakerDoc(input: AgentsDocInput): string {
  return `# Rainmaker

Rainmaker analyses ${input.site}. The conversation is the interface. The CLI
is deterministic plumbing for crawl, measurement, scoring, and memory.

## Start or resume

1. Run \`rainmaker context --check\`.
2. If no diagnosis exists, run \`rainmaker audit\`. It uses the built-in
   crawler by default and spends no provider credits.
3. Read the diagnosis before asking business questions.
4. If conversion paths are missing, propose likely paths from the crawl and
   ask the user to confirm or correct them. Do not send them to edit YAML alone.
5. Run the \`know-my-buyer\` skill one question at a time.
6. Offer the three closest fixes, explain why each matters, then ask which to
   implement.

## Provider consent

Never use Firecrawl or context.dev because a key happens to exist in the
environment. Paid or quota-backed providers require explicit approval in the
current conversation. After approval, use \`rainmaker audit --provider
firecrawl\` or \`rainmaker audit --provider contextdev\`. Without approval,
use the built-in crawler.

## Host model

Use the model already hosting this conversation. Do not ask for model API keys
unless the user explicitly chooses the standalone \`rainmaker agent\` command.
Project skills are the portable plugin surface across assistants.

## Shared references

Shared rules live in \`skills/_shared/\`. Deterministic numbers come from the
CLI. Never estimate a number the CLI can produce.
`;
}

/** Copies skills into portable and Claude-compatible project locations. */
export function installSkills(projectDir: string): {
  installed: number;
  target: string;
  targets: string[];
} {
  const source = join(packageRoot(), 'skills');
  if (!existsSync(source)) throw new Error(`packaged skills not found at ${source}`);

  const targets = [join(projectDir, '.agents', 'skills'), join(projectDir, '.claude', 'skills')];
  for (const target of targets) {
    cpSync(source, target, {
      recursive: true,
      dereference: true,
      filter: (from) => basename(from) !== '_shared',
    });
  }

  cpSync(join(source, '_shared'), join(projectDir, 'skills', '_shared'), {
    recursive: true,
    dereference: true,
  });

  return { installed: readdirSync(targets[0]).length, target: targets[0], targets };
}

export function writeRainmakerDoc(projectDir: string, input: AgentsDocInput): 'written' {
  writeFileSync(join(projectDir, 'RAINMAKER.md'), renderRainmakerDoc(input), 'utf8');
  return 'written';
}

const POINTER_START = '<!-- RAINMAKER:START -->';
const POINTER_END = '<!-- RAINMAKER:END -->';

function managedPointer(): string {
  return `${POINTER_START}\n## Rainmaker\n\nRead \`RAINMAKER.md\` before SEO, AEO, content, or site-strategy work.\n${POINTER_END}`;
}

/** Preserves user instructions and adds one idempotent Rainmaker pointer. */
export function writeAgentsDoc(
  projectDir: string,
  input: AgentsDocInput,
): 'written' | 'updated' | 'kept' {
  const path = join(projectDir, 'AGENTS.md');
  if (!existsSync(path)) {
    writeFileSync(path, `${renderAgentsDoc(input)}\n${managedPointer()}\n`, 'utf8');
    return 'written';
  }

  const current = readFileSync(path, 'utf8');
  if (current.includes(POINTER_START)) return 'kept';
  writeFileSync(path, `${current.trimEnd()}\n\n${managedPointer()}\n`, 'utf8');
  return 'updated';
}
