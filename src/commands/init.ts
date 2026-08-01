import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { CONFIG_FILENAME } from '../config/load.js';
import { REVENUE_MODELS, type RevenueModel } from '../config/schema.js';
import { installSkills, writeAgentsDoc } from '../install/harness.js';

/** Parses `--key value` and `--key=value` into a flat map. */
function parseFlags(argv: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const eq = arg.indexOf('=');
    if (eq !== -1) {
      flags[arg.slice(2, eq)] = arg.slice(eq + 1);
    } else if (argv[i + 1] && !argv[i + 1].startsWith('--')) {
      flags[arg.slice(2)] = argv[++i];
    } else {
      flags[arg.slice(2)] = 'true';
    }
  }
  return flags;
}

export interface InitField {
  /** CLI flag, minus the leading dashes. */
  flag: string;
  /** Prompt shown on a TTY. */
  question: string;
  /** Comma-separated on the flag, a YAML list in the config. */
  list?: boolean;
  /** Only `site` blocks writing a config; everything else has a usable default. */
  required?: boolean;
  /** Applied when neither a flag nor an interactive answer supplies a value. */
  default?: string;
  /** Placeholder in the usage message. */
  example: string;
  /** Context printed above the prompt on a TTY. */
  note?: string;
}

/**
 * The one description of what init needs, so the interactive prompts, the
 * non-interactive usage message, and `--describe` can never disagree about
 * which fields exist or which are optional.
 */
export const INIT_FIELDS: InitField[] = [
  {
    flag: 'site',
    question: 'Site URL',
    required: true,
    example: 'https://example.com',
  },
  {
    flag: 'revenue-model',
    question: 'Revenue model',
    default: 'sales-led',
    example: REVENUE_MODELS.join('|'),
    note: `Revenue model: ${REVENUE_MODELS.join(' | ')}`,
  },
  {
    flag: 'primary-conversion',
    question: 'Primary conversion paths',
    list: true,
    example: '/demo, /pricing',
    note:
      'Primary conversion paths seed Tier 0, where money changes hands.\n' +
      'These matter more than anything else you enter here.',
  },
  {
    flag: 'secondary-conversion',
    question: 'Secondary paths (docs, blog)',
    list: true,
    example: '/docs, /blog',
  },
  {
    flag: 'acv',
    question: 'Average contract value, 0 if unknown',
    default: '0',
    example: '18000',
  },
  {
    flag: 'sales-cycle-days',
    question: 'Sales cycle in days',
    default: '30',
    example: '45',
  },
  {
    flag: 'icp-hint',
    question: 'Who buys this?',
    example: 'who buys this',
  },
  {
    flag: 'competitors',
    question: 'Competitor domains to benchmark against',
    list: true,
    example: 'a.com, b.com',
  },
];

const FIELDS_BY_FLAG: Record<string, InitField> = Object.fromEntries(
  INIT_FIELDS.map((field) => [field.flag, field]),
);

/**
 * Usage for the non-interactive path. Separates required from optional because
 * listing all eight flags as one block reads as if all eight are mandatory,
 * which is the single most common reason a first run gets abandoned.
 */
export function formatInitUsage(): string {
  const required = INIT_FIELDS.filter((f) => f.required);
  const optional = INIT_FIELDS.filter((f) => !f.required);
  const quote = (f: InitField): string => (f.example.includes(' ') ? `"${f.example}"` : f.example);
  const suffix = (f: InitField): string => (f.default ? `  # default: ${f.default}` : '');

  return [
    'Not a terminal, so init reads flags instead of prompting.',
    '',
    'Required:',
    '',
    ...required.map((f) => `  --${f.flag} ${quote(f)}`),
    '',
    'Optional, omit any of these:',
    '',
    ...optional.map((f) => `  --${f.flag} ${quote(f)}${suffix(f)}`),
    '',
    'Smallest run that writes a usable config:',
    '',
    '  rainmaker init --site https://example.com --primary-conversion "/demo, /pricing"',
    '',
    '`rainmaker init --describe` prints these fields as JSON.',
  ].join('\n');
}

/**
 * How to spell the next command back to the user. Under npx the package runs
 * from a cache directory and the `rainmaker` bin is never on PATH, so telling
 * them to run `rainmaker doctor` produces `command not found`.
 */
export function invocation(
  argv1: string | undefined = process.argv[1],
  env: NodeJS.ProcessEnv = process.env,
): string {
  // The plugin wrapper knows the answer for certain and says so; the argv
  // sniff is the fallback for a bare npx run with no wrapper in front of it.
  if (env.RAINMAKER_INVOCATION) return env.RAINMAKER_INVOCATION;
  return argv1?.includes('/_npx/') ? 'npx @vcxcvii/rainmaker' : 'rainmaker';
}

/**
 * Conversion paths are site paths, not descriptions. A wizard prompt invites
 * prose answers ("not decided, help figure out"), and silently accepting them
 * seeds Tier 0 with strings that match no URL, so the first audit is wrong in
 * a way nothing downstream can attribute back to here.
 */
export function suspectPaths(paths: string[]): string[] {
  return paths.filter((p) => !/^(\/|https?:\/\/)/.test(p));
}

/** Field spec for callers that collect answers themselves, such as an agent. */
export function describeInitFields(): string {
  return JSON.stringify(
    {
      command: 'init',
      writes: CONFIG_FILENAME,
      fields: INIT_FIELDS.map((f) => ({
        flag: f.flag,
        question: f.question,
        type: f.list ? 'list' : 'string',
        required: f.required === true,
        default: f.default ?? null,
        example: f.example,
        note: f.note ?? null,
      })),
    },
    null,
    2,
  );
}

/**
 * Config creation. Deliberately asks nothing about credentials: a first audit
 * must be possible with none, so the console work in `doctor` is never a
 * prerequisite for seeing value.
 *
 * Interactive on a TTY, flag-driven otherwise, so CI, scripted setup, and
 * agents all work. Node's readline drops buffered lines on piped stdin, so
 * prompting is only attempted when we genuinely have a terminal.
 *
 * Given a site, this always writes a file. A scaffold with a TODO is more
 * recoverable than an aborted run leaving an empty directory, and an unfilled
 * primary_conversion is caught by validateConfig with a named field rather
 * than by a usage dump.
 */
export async function runInit(argv: string[]): Promise<number> {
  const dir = process.cwd();
  const path = resolve(dir, CONFIG_FILENAME);
  const flags = parseFlags(argv);
  const force = 'force' in flags;
  const interactive = stdin.isTTY === true;

  if ('describe' in flags) {
    console.log(describeInitFields());
    return 0;
  }

  if (existsSync(path) && !force) {
    console.error(`${CONFIG_FILENAME} already exists. Use --force to overwrite.`);
    return 1;
  }

  const rl = interactive ? createInterface({ input: stdin, output: stdout }) : null;

  const ask = async (flag: string): Promise<string> => {
    const spec = FIELDS_BY_FLAG[flag];
    const fallback = spec.default ?? '';
    if (flags[flag] !== undefined) return flags[flag];
    if (!rl) return fallback;
    if (spec.note) console.log(`\n${spec.note}`);
    const label = spec.list ? `${spec.question} [comma separated]` : spec.question;
    const suffix = fallback ? ` (${fallback})` : '';
    const answer = (await rl.question(`${label}${suffix}: `)).trim();
    return answer || fallback;
  };

  const askList = async (flag: string): Promise<string[]> =>
    (await ask(flag))
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

  try {
    if (!flags.site && !interactive) {
      console.error(formatInitUsage());
      return 1;
    }

    const site = await ask('site');
    if (!site) {
      console.error('\nSite URL is required.');
      return 1;
    }

    const revenueModel = (await ask('revenue-model')) as RevenueModel;
    const primary = await askList('primary-conversion');
    const secondary = await askList('secondary-conversion');
    const acvRaw = await ask('acv');
    const cycleRaw = await ask('sales-cycle-days');
    const icpHint = await ask('icp-hint');
    const competitors = await askList('competitors');

    const normalisedSite = site.replace(/\/+$/, '');
    const yaml = renderConfig({
      site: normalisedSite,
      revenueModel,
      primary,
      secondary,
      acv: numeric(acvRaw, 0),
      salesCycleDays: numeric(cycleRaw, 30),
      icpHint,
      competitors,
    });

    writeFileSync(path, yaml, 'utf8');

    // Any assistant, not just Claude Code. Skipped with --no-skills for
    // callers that manage their own skill installation.
    const installReport: string[] = [];
    if (flags['no-skills'] === undefined) {
      try {
        const { installed } = installSkills(dir);
        const doc = writeAgentsDoc(dir, {
          site: normalisedSite,
          hasPrimaryConversion: primary.length > 0,
        });
        installReport.push(
          '',
          `Installed ${installed} skills into .claude/skills/`,
          doc === 'written'
            ? 'Wrote AGENTS.md'
            : 'Kept your existing AGENTS.md. Point it at .claude/skills/ yourself.',
          'Claude Code and opencode load these directly. Codex and other tools',
          'read AGENTS.md.',
        );
      } catch (error) {
        installReport.push('', `Skills were not installed: ${(error as Error).message}`);
      }
    }

    const run = invocation();
    const suspect = suspectPaths([...primary, ...secondary]);
    const warnings = suspect.length
      ? [
          '',
          `These are not site paths, so nothing will match them: ${suspect.join(', ')}`,
          `Conversion paths look like /pricing or /demo. Edit ${CONFIG_FILENAME} before auditing.`,
        ]
      : [];

    const next = primary.length
      ? [
          '',
          `Next: \`${run} doctor\` to see which capabilities are live.`,
          'An audit will run with zero credentials, just with lower confidence.',
        ]
      : [
          '',
          'primary_conversion is empty, so Tier 0 has nothing to seed and audits',
          `will refuse to run. Fill it in ${CONFIG_FILENAME}, then \`${run} doctor\`.`,
        ];

    console.log(
      ['', `Wrote ${CONFIG_FILENAME}`, ...warnings, ...installReport, ...next].join('\n'),
    );
    return 0;
  } finally {
    rl?.close();
  }
}

/** `Number(x) || d` swallows a deliberate 0, which is a meaningful answer here. */
function numeric(raw: string, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function renderConfig(v: {
  site: string;
  revenueModel: RevenueModel;
  primary: string[];
  secondary: string[];
  acv: number;
  salesCycleDays: number;
  icpHint: string;
  competitors: string[];
}): string {
  const list = (items: string[]): string =>
    items.length ? `\n${items.map((i) => `  - ${i}`).join('\n')}` : ' []';

  const primaryTodo = v.primary.length
    ? ''
    : '# TODO: required. Audits refuse to run until at least one path is listed.\n';

  return `# rainmaker configuration
# Supplies the business context that universal tiering logic needs.
# Docs: https://github.com/vcxcvii/rainmaker

site: ${v.site}
revenue_model: ${v.revenueModel}

# Tier 0. Where money changes hands.
${primaryTodo}primary_conversion:${list(v.primary)}

# Tier 1 and 2 seeds.
secondary_conversion:${list(v.secondary)}

# 0 disables value-weighted scoring.
acv: ${v.acv}
sales_cycle_days: ${v.salesCycleDays}

# know-my-buyer starts from this hypothesis and argues with it.
icp_hint: ${JSON.stringify(v.icpHint)}

competitors:${list(v.competitors)}

crawl:
  max_urls: 500
  provider: firecrawl
  exclude:
    - /tag/
    - /author/
    - /page/
    - /feed/
`;
}
