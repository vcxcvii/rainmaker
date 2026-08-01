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

export function renderRainmakerDoc(input: AgentsDocInput): string {
  const discovery = input.hasPrimaryConversion
    ? 'Verify the configured conversion paths against the crawl and the user.'
    : 'Propose likely conversion paths from the crawl and ask the user to confirm them.';

  return `# Rainmaker

Rainmaker analyses ${input.site}. The conversation is the interface. The CLI
is deterministic plumbing for crawl, measurement, scoring, and memory.

## Start or resume

1. Run \`rainmaker context --check\`.
2. If no diagnosis exists, run \`rainmaker audit\`. It uses the built-in
   crawler by default and spends no provider credits.
3. Read the diagnosis before asking business questions.
4. ${discovery}
   After confirmation, edit \`primary_conversion\` and \`secondary_conversion\`
   in \`rainmaker.config.yml\`, then run \`rainmaker audit --refresh\`.
5. Run the \`know-my-buyer\` skill one question at a time.
6. Reconcile \`rainmaker.config.yml\` with confirmed answers: update
   \`revenue_model\`, \`primary_conversion\`, \`secondary_conversion\`, \`acv\`,
   \`sales_cycle_days\`, \`icp_hint\`, and \`competitors\`. Never invent a
   value. Do not run blueprint or map-my-site while \`revenue_model\` is
   \`unknown\`. Run \`rainmaker audit --refresh\` after saving.
7. Offer the three closest fixes, explain why each matters, then ask which to
   implement.

## Provider consent

Never use Firecrawl or context.dev because a key happens to exist in the
environment. Ask, once, rather than staying silent about it.

Before the first crawl, if either key is set: run \`rainmaker keys --balances\`,
tell the user what they actually have — provider and credits remaining — and
ask which crawler to use. The built-in one spends nothing and is the right
default for most sites; a paid provider renders JavaScript and reaches more of
a client-rendered site.

Write the answer to \`crawl.provider\` in \`rainmaker.config.yml\`. That is the
consent record, and every later audit honours it without asking again. Change
it only when the user asks. \`--provider\` still overrides it for one run.

Never let a crawl exceed the remaining balance. The preflight projects the cost
and refuses; do not pass \`--allow-over-budget\` on the user's behalf.

## Host model

Use the model already hosting this conversation. Do not ask for model API keys
unless the user explicitly chooses the standalone \`rainmaker agent\` command.
Never run \`rainmaker agent\` inside a host assistant. The host model conducts
the interview directly using the user's current assistant session.
Project skills are the portable plugin surface across assistants.

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

## Shared references

Shared rules live in \`skills/_shared/\`. Deterministic numbers come from the
CLI. Never estimate a number the CLI can produce.
`;
}

/** Copies skills into portable and Claude-compatible project locations. */
export function installSkills(projectDir: string): {
  installed: number;
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

  // Count what was copied, not what the target now holds. `.claude/skills` is
  // a shared directory: reading its length reported "Installed 91 skills" to a
  // user who has 64 of their own and got 27 from Rainmaker.
  const installed = readdirSync(source).filter((entry) => entry !== '_shared').length;
  return { installed, targets };
}

export function writeRainmakerDoc(projectDir: string, input: AgentsDocInput): 'written' {
  writeFileSync(join(projectDir, 'RAINMAKER.md'), renderRainmakerDoc(input), 'utf8');
  return 'written';
}

const POINTER_START = '<!-- RAINMAKER:START -->';
const POINTER_END = '<!-- RAINMAKER:END -->';

function managedPointer(): string {
  return `${POINTER_START}\n## Rainmaker\n\nWhen the user says "run rainmaker", or wants SEO, AEO, content or site-strategy work in this project, invoke the \`rainmaker\` skill. If the host does not surface skills by name, read \`.agents/skills/rainmaker/SKILL.md\` and follow it.\n\nThe skill runs the whole workflow — setup, audit, buyer interview, fixes — and resumes wherever it left off. Do not drive the \`rainmaker\` CLI by hand in its place.\n\nRead \`RAINMAKER.md\` before that work. Never run the standalone \`rainmaker agent\` command inside an assistant.\n${POINTER_END}`;
}

export type PointerResult = 'written' | 'updated' | 'kept';

/** Preserves user instructions and adds one idempotent Rainmaker pointer. */
function writePointerDoc(path: string): PointerResult {
  if (!existsSync(path)) {
    writeFileSync(path, `${managedPointer()}\n`, 'utf8');
    return 'written';
  }

  const current = readFileSync(path, 'utf8');
  if (current.includes(POINTER_START)) {
    const next = current.replace(
      new RegExp(`${POINTER_START}[\\s\\S]*?${POINTER_END}`),
      managedPointer(),
    );
    if (next === current) return 'kept';
    writeFileSync(path, next, 'utf8');
    return 'updated';
  }
  writeFileSync(path, `${current.trimEnd()}\n\n${managedPointer()}\n`, 'utf8');
  return 'updated';
}

export function writeAgentsDoc(projectDir: string): PointerResult {
  return writePointerDoc(join(projectDir, 'AGENTS.md'));
}

/**
 * Claude Code auto-loads CLAUDE.md and nothing else. Writing the pointer only
 * to AGENTS.md left RAINMAKER.md unreferenced in the one host Rainmaker ships
 * a plugin for: the next session started with no idea any of this existed.
 */
export function writeClaudeDoc(projectDir: string): PointerResult {
  return writePointerDoc(join(projectDir, 'CLAUDE.md'));
}
