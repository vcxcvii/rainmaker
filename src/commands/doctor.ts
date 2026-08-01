import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createDefaultCapabilityClients,
  verifyCapabilities,
  type CapabilityResult,
} from '../auth/verify.js';
import { CONFIG_FILENAME, loadConfig } from '../config/load.js';

/**
 * The plugin and the CLI version independently, and a stale plugin is silent
 * rather than broken: it simply ships an older set of skills. A marketplace
 * install pinned at 0.2.1 had no `rainmaker` orchestrator skill at all, so the
 * whole interactive workflow was missing with nothing anywhere saying why.
 */
export function formatVersionSkew(
  cliVersion: string,
  pluginVersion: string | undefined,
): string | undefined {
  if (!pluginVersion || pluginVersion === cliVersion) return undefined;
  return [
    `Plugin ${pluginVersion} against CLI ${cliVersion}.`,
    'The plugin carries the skills, so an older one is missing whatever shipped since.',
    'Update it with `/plugin` and reinstall rainmaker from the vcxcvii marketplace.',
  ].join(' ');
}

/** Reads the installed plugin's manifest version, when running under a plugin. */
export function pluginVersion(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const root = env.CLAUDE_PLUGIN_ROOT;
  if (!root) return undefined;
  try {
    const manifest = readFileSync(join(root, '.claude-plugin', 'plugin.json'), 'utf8');
    const parsed = JSON.parse(manifest) as { version?: unknown };
    return typeof parsed.version === 'string' ? parsed.version : undefined;
  } catch {
    return undefined;
  }
}

function cliVersion(): string {
  const packageJson = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'package.json');
  const parsed = JSON.parse(readFileSync(packageJson, 'utf8')) as { version: string };
  return parsed.version;
}

export function formatDoctor(results: CapabilityResult[]): string {
  const width = Math.max(...results.map((result) => result.capability.length));
  const lines = results.map((result) => {
    const capability = result.capability.toUpperCase().padEnd(width);
    const status = result.status === 'ok'
      ? 'ok'.padEnd(8)
      : result.status === 'missing'
        ? 'MISSING'.padEnd(8)
        : 'ERROR'.padEnd(8);
    return `${capability}  ${status} ${result.detail}`;
  });
  const degraded = results.filter((result) => result.status !== 'ok').length;
  lines.push('', `${degraded} of ${results.length} capabilities degraded.`);
  lines.push('Audit will still run. Findings will carry reduced confidence.');
  return lines.join('\n');
}

export async function runDoctor(argv: string[]): Promise<number> {
  const json = argv.includes('--json');
  const configPath = resolve(process.cwd(), CONFIG_FILENAME);
  const config = existsSync(configPath) ? loadConfig() : undefined;
  const clients = createDefaultCapabilityClients({ config });
  const results = await verifyCapabilities(clients);

  const skew = formatVersionSkew(cliVersion(), pluginVersion());
  console.log(json ? JSON.stringify(results, null, 2) : formatDoctor(results));
  if (skew && !json) console.log(`\n${skew}`);
  return 0;
}
