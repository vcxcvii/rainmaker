#!/usr/bin/env node
/**
 * rainmaker CLI.
 *
 * Deterministic layer. Everything here runs without Claude, which is what makes
 * it cron-safe and reproducible. Skills read what this writes; they never
 * re-crawl or re-measure.
 */

import 'dotenv/config';
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ConfigError } from './config/load.js';

const VERSION = (JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  version: string;
}).version;

/**
 * Every command's summary, argument shape and accepted flags in one place.
 *
 * `flags` is what makes `--help` and unknown-flag rejection possible, and it is
 * declared here rather than inside each command so the two cannot disagree. A
 * flag missing from this list is refused, so adding one to a command means
 * adding it here in the same change.
 */
const COMMANDS = {
  init: {
    summary: 'Create rainmaker.config.yml. No credentials needed.',
    args: '[options]',
    flags: [
      'site',
      'revenue-model',
      'primary-conversion',
      'secondary-conversion',
      'acv',
      'sales-cycle-days',
      'icp-hint',
      'competitors',
    ],
  },
  install: {
    summary: 'Install or refresh portable project skills and assistant instructions.',
    args: '',
    flags: [],
  },
  doctor: {
    summary: 'Verify every credential independently. Report live vs degraded capabilities.',
    args: '[--json]',
    flags: ['json'],
  },
  audit: {
    summary: 'Crawl, measure, tier, score. Writes a diagnosis. Runs with whatever is available.',
    args: '[--refresh] [--max-urls <n>] [--json]',
    flags: ['refresh', 'max-urls', 'json'],
  },
  serp: {
    summary: 'Capture a live SERP for one or more queries and compute a rank verdict.',
    args: '<query>... [--allow-paid]',
    flags: ['allow-paid'],
  },
  blueprint: {
    summary: 'Site structure. --build from strategy and crawl data, --tree to print it.',
    args: '--build | --tree',
    flags: ['build', 'tree'],
  },
  fetch: {
    summary: 'Pull GA4, GSC and Clarity into data/snapshots/ without re-crawling.',
    args: '[--source ga4|gsc|clarity|all]',
    flags: ['source'],
  },
  routine: {
    summary: 'Run the scheduled pass: refresh, detect shipped work, file issues in revenue order.',
    args: '[--refresh] [--source <name>] [--provider <name>] [--allow-over-budget] [--json]',
    flags: ['refresh', 'source', 'provider', 'allow-over-budget', 'json'],
  },
  report: {
    summary: 'Render a report. --window pulse|28d|month|quarter|half-year',
    args: '[--window pulse|28d|month|quarter|half-year]',
    flags: ['window'],
  },
  context: {
    summary: 'Business context and strategy. --check | --init | --validate | --sync',
    args: '--check | --init | --validate | --sync',
    flags: ['check', 'init', 'validate', 'sync'],
  },
  agent: {
    summary:
      'Standalone terminal fallback. Requires a model API key; do not use inside an AI assistant.',
    args: '[--skip-interview]',
    flags: ['skip-interview'],
  },
  keys: {
    summary: 'Which credentials are set and what each one unlocks. --balances for live provider credits.',
    args: '[--balances] [--json]',
    flags: ['balances', 'json'],
  },
  ledger: {
    summary:
      'Query finding history. --id | --since | --status | --pending | --did-nothing | --rebuild | --compact',
    args: '[--id <id>] [--since <date>] [--status <status>] [--pending] [--did-nothing] [--rebuild] [--compact] [--json]',
    flags: ['id', 'since', 'status', 'pending', 'did-nothing', 'rebuild', 'compact', 'json'],
  },
} as const satisfies Record<string, { summary: string; args: string; flags: readonly string[] }>;

type Command = keyof typeof COMMANDS;

function usage(): void {
  const width = Math.max(...Object.keys(COMMANDS).map((c) => c.length));
  const lines = Object.entries(COMMANDS)
    .map(([name, spec]) => `  ${name.padEnd(width)}  ${spec.summary}`)
    .join('\n');

  console.log(
    [
      `rainmaker ${VERSION}`,
      'Ranks SEO and content work by distance to revenue, not technical severity.',
      '',
      'Usage: rainmaker <command> [options]',
      '',
      lines,
      '',
      'Start with `rainmaker init --site https://example.com`, then open your assistant in that directory.',
      'Run `rainmaker <command> --help` for one command.',
    ].join('\n'),
  );
}

function commandUsage(command: Command): void {
  const spec = COMMANDS[command];
  const lines = [
    `rainmaker ${command}`,
    spec.summary,
    '',
    `Usage: rainmaker ${command}${spec.args ? ` ${spec.args}` : ''}`,
  ];
  if (spec.flags.length) {
    lines.push('', 'Flags:', ...spec.flags.map((flag) => `  --${flag}`));
  } else {
    lines.push('', 'Takes no flags.');
  }
  console.log(lines.join('\n'));
}

export function wantsHelp(args: readonly string[]): boolean {
  return args.includes('--help') || args.includes('-h');
}

/**
 * Returns the flags in `args` that the command does not accept.
 *
 * Silence here is expensive: an ignored `--refersh` used to run a full audit
 * and quietly not refresh, so the caller read a stale diagnosis as a fresh one.
 * A flag is only what precedes an `=`, so `--source=ga4` is checked as `source`.
 */
export function unknownFlags(command: Command, args: readonly string[]): string[] {
  const accepted = new Set<string>(COMMANDS[command].flags);
  const seen: string[] = [];
  for (const arg of args) {
    if (!arg.startsWith('--') || arg === '--') continue;
    const name = arg.slice(2).split('=')[0];
    if (!accepted.has(name) && !seen.includes(name)) seen.push(name);
  }
  return seen;
}

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;

  if (!command || command === '--help' || command === '-h' || command === 'help') {
    usage();
    return 0;
  }

  if (command === '--version' || command === '-v') {
    console.log(VERSION);
    return 0;
  }

  if (!(command in COMMANDS)) {
    console.error(`Unknown command: ${command}\n`);
    usage();
    return 1;
  }

  // Both checks run before dispatch, because every command below this point
  // crawls, fetches or writes. Asking for help must not spend a provider's
  // quota, and a mistyped flag must not be read as consent to run anyway.
  if (wantsHelp(rest)) {
    commandUsage(command as Command);
    return 0;
  }

  const unknown = unknownFlags(command as Command, rest);
  if (unknown.length) {
    console.error(
      `Unknown flag${unknown.length > 1 ? 's' : ''} for \`rainmaker ${command}\`: ${unknown
        .map((flag) => `--${flag}`)
        .join(', ')}\n`,
    );
    commandUsage(command as Command);
    return 1;
  }

  switch (command as Command) {
    case 'init': {
      const { runInit } = await import('./commands/init.js');
      return runInit(rest);
    }
    case 'install': {
      const { runInstall } = await import('./commands/install.js');
      return Promise.resolve(runInstall());
    }
    case 'doctor': {
      const { runDoctor } = await import('./commands/doctor.js');
      return runDoctor(rest);
    }
    case 'fetch': {
      const { runFetch } = await import('./commands/fetch.js');
      return runFetch(rest);
    }
    case 'audit': {
      const { runAudit } = await import('./commands/audit.js');
      return runAudit(rest);
    }
    case 'serp': {
      const { runSerp } = await import('./commands/serp.js');
      return runSerp(rest);
    }
    case 'report': {
      const { runReport } = await import('./commands/report.js');
      return Promise.resolve(runReport(rest));
    }
    case 'agent': {
      const { runAgent } = await import('./commands/agent.js');
      return runAgent(rest);
    }
    case 'keys': {
      const { runKeys } = await import('./commands/keys.js');
      return runKeys(rest);
    }
    case 'routine': {
      const { runRoutine } = await import('./commands/routine.js');
      return runRoutine(rest);
    }
    case 'blueprint': {
      const { runBlueprint } = await import('./commands/blueprint.js');
      return runBlueprint(rest);
    }
    case 'context': {
      const { runContext } = await import('./commands/context.js');
      return runContext(rest);
    }
    case 'ledger': {
      const { runLedger } = await import('./commands/ledger.js');
      return runLedger(rest);
    }
    default: {
      console.error(
        `\`rainmaker ${command}\` is not implemented yet.\n` +
          `See SPEC.md section 6 for the build order. Shipped: init, doctor, fetch, audit, serp, blueprint, report, routine, agent, keys, context, ledger.`,
      );
      return 1;
    }
  }
}

/**
 * True when this module is the program being run, rather than an import.
 *
 * Both sides are resolved through realpath before comparing. Comparing the raw
 * `argv[1]` against `import.meta.url` looks equivalent and is not: an npm
 * global install puts a symlink on PATH, so `argv[1]` is the link
 * (`.npm-global/bin/rainmaker`) while `import.meta.url` is already the resolved
 * file. They never match, and the CLI exits 0 having printed nothing.
 */
export function isEntrypoint(entry: string | undefined, moduleUrl: string): boolean {
  if (!entry) return false;
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(moduleUrl));
  } catch {
    return false;
  }
}

if (isEntrypoint(process.argv[1], import.meta.url)) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((err: unknown) => {
      if (err instanceof ConfigError) {
        console.error(err.message);
        process.exit(1);
      }
      console.error(err instanceof Error ? err.stack ?? err.message : String(err));
      process.exit(1);
    });
}
