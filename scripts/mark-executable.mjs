/**
 * `tsc` emits dist/cli.js at 0644, and package.json points `bin` at it.
 *
 * A bin target without the executable bit is skipped by PATH lookup entirely:
 * shells and `[ -x ]` checks pass over it as though it were not there. On a
 * machine that also had the plugin wrapper on PATH, that turned every
 * `rainmaker` call into a fallback chain ending in `npx`, which resolved the
 * name back to the wrapper — an unbounded respawn that reached 280 processes.
 *
 * npm sets this bit when installing a published tarball, so the failure only
 * appears for `npm link` and for any rebuild that lands after a link. Setting
 * it at build time covers both.
 */
import { chmodSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const cli = resolve('dist', 'cli.js');
if (!existsSync(cli)) {
  console.error(`mark-executable: ${cli} does not exist; did the build run?`);
  process.exit(1);
}

chmodSync(cli, 0o755);

const mode = statSync(cli).mode & 0o777;
if ((mode & 0o111) === 0) {
  console.error(`mark-executable: ${cli} is still not executable (mode ${mode.toString(8)}).`);
  process.exit(1);
}
