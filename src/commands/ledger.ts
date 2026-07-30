import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { readLedger } from '../ledger/append.js';
import { materialise } from '../ledger/materialise.js';
import { didNothing, pendingVerification, queryEvents } from '../ledger/query.js';
import { writeStableJson } from '../util/json.js';
import type { EventType } from '../ledger/types.js';

const LEDGER = join('data', 'ledger.jsonl');
const STATE = join('data', 'state.json');

function flag(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

export function runLedger(args: string[]): number {
  if (!existsSync(LEDGER)) {
    console.error('No ledger yet. Run `rainmaker audit` first; it opens the first findings.');
    return 1;
  }

  const events = readLedger(LEDGER);
  const now = new Date().toISOString();
  const json = args.includes('--json');

  if (args.includes('--rebuild')) {
    const state = materialise(events, now);
    writeStableJson(STATE, state);
    console.log(
      `Rebuilt ${STATE} from ${state.ledger_lines} ledger lines: ` +
        `${Object.keys(state.findings).length} findings, ${state.site_events.length} site events.`,
    );
    return 0;
  }

  const state = materialise(events, now);

  if (args.includes('--pending')) {
    const pending = pendingVerification(events, state, now);
    if (json) {
      console.log(JSON.stringify(pending, null, 2));
      return 0;
    }
    if (pending.length === 0) {
      console.log('Nothing is waiting on a verification window.');
      return 0;
    }
    console.log('Shipped, verdict withheld until the window closes:\n');
    for (const row of pending) {
      console.log(`  ${row.id}  shipped ${row.shipped_at.slice(0, 10)}  due ${row.due_at.slice(0, 10)}  (${row.window_days}d)`);
    }
    return 0;
  }

  if (args.includes('--did-nothing')) {
    const nothing = didNothing(events, state, now);
    if (json) {
      console.log(JSON.stringify(nothing, null, 2));
      return 0;
    }
    if (nothing.length === 0) {
      console.log('Nothing shipped past its window has failed to move. Either good, or too early.');
      return 0;
    }
    console.log('Shipped, window closed, nothing moved:\n');
    for (const row of nothing) {
      console.log(`  ${row.id}  ${row.effort_h}h spent  shipped ${row.shipped_at.slice(0, 10)}`);
    }
    return 0;
  }

  const filtered = queryEvents(events, {
    id: flag(args, '--id'),
    since: flag(args, '--since'),
    status: flag(args, '--status') as EventType | undefined,
  });

  if (json) {
    console.log(JSON.stringify(filtered, null, 2));
    return 0;
  }

  if (filtered.length === 0) {
    console.log('No events match.');
    return 0;
  }

  for (const event of filtered) {
    const cause = event.cause ? `  cause=${event.cause}` : '';
    console.log(`${event.ts.slice(0, 10)}  ${event.event.padEnd(12)}  ${event.id}${cause}`);
  }
  console.log(`\n${filtered.length} of ${events.length} events.`);
  return 0;
}
