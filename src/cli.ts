#!/usr/bin/env node
/**
 * rainmaker CLI.
 *
 * Deterministic layer. Everything here runs without Claude, which is what makes
 * it cron-safe and reproducible. Skills read what this writes; they never
 * re-crawl or re-measure.
 */

import 'dotenv/config';
import { ConfigError } from './config/load.js';

const VERSION = '0.1.0';

const COMMANDS = {
  init: 'Create rainmaker.config.yml. No credentials needed.',
  doctor: 'Verify every credential independently. Report live vs degraded capabilities.',
  audit: 'Crawl, measure, tier, score. Writes a diagnosis. Runs with whatever is available.',
  serp: 'Capture a live SERP for one or more queries and compute a rank verdict.',
  blueprint: 'Site structure. --build from strategy and crawl data, --tree to print it.',
  fetch: 'Pull GA4, GSC and Clarity into data/snapshots/ without re-crawling.',
  routine: 'Run the scheduled pass: refresh, detect shipped work, file issues in revenue order.',
  report: 'Render a report. --window pulse|28d|month|quarter|half-year',
  context:
    'Business context and strategy. --check | --init | --validate | --sync',
  ledger:
    'Query finding history. --id | --since | --status | --pending | --did-nothing | --rebuild | --compact',
} as const;

type Command = keyof typeof COMMANDS;

function usage(): void {
  const width = Math.max(...Object.keys(COMMANDS).map((c) => c.length));
  const lines = Object.entries(COMMANDS)
    .map(([name, desc]) => `  ${name.padEnd(width)}  ${desc}`)
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
      'Start with `rainmaker init`, then `rainmaker doctor`.',
    ].join('\n'),
  );
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

  switch (command as Command) {
    case 'init': {
      const { runInit } = await import('./commands/init.js');
      return runInit(rest);
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
          `See SPEC.md section 6 for the build order. Shipped: init, doctor, fetch, audit, serp, blueprint, report, routine, context, ledger.`,
      );
      return 1;
    }
  }
}

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
