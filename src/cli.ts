#!/usr/bin/env node
/**
 * paydirt CLI.
 *
 * Deterministic layer. Everything here runs without Claude, which is what makes
 * it cron-safe and reproducible. Skills read what this writes; they never
 * re-crawl or re-measure.
 */

import 'dotenv/config';
import { ConfigError } from './config/load.js';

const VERSION = '0.1.0';

const COMMANDS = {
  init: 'Create paydirt.config.yml. No credentials needed.',
  doctor: 'Verify every credential independently. Report live vs degraded capabilities.',
  audit: 'Crawl, measure, tier, score. Writes a diagnosis. Runs with whatever is available.',
  fetch: 'Pull GA4, GSC and Clarity into data/snapshots/ without re-crawling.',
  routine: 'Run the scheduled pass: fetch, diagnose, file issues in revenue order.',
  report: 'Render a report. --window pulse|28d|month|quarter|half-year',
  ledger: 'Query finding history. --id <finding> | --since <date> | --status <state>',
} as const;

type Command = keyof typeof COMMANDS;

function usage(): void {
  const width = Math.max(...Object.keys(COMMANDS).map((c) => c.length));
  const lines = Object.entries(COMMANDS)
    .map(([name, desc]) => `  ${name.padEnd(width)}  ${desc}`)
    .join('\n');

  console.log(
    [
      `paydirt ${VERSION}`,
      'Ranks SEO and content work by distance to revenue, not technical severity.',
      '',
      'Usage: paydirt <command> [options]',
      '',
      lines,
      '',
      'Start with `paydirt init`, then `paydirt doctor`.',
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
    default: {
      console.error(
        `\`paydirt ${command}\` is not implemented yet.\n` +
          `See PLAN.md for the build order. Currently shipped: init.`,
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
