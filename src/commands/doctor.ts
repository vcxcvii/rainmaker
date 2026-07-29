import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  createDefaultCapabilityClients,
  verifyCapabilities,
  type CapabilityResult,
} from '../auth/verify.js';
import { CONFIG_FILENAME, loadConfig } from '../config/load.js';

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

  console.log(json ? JSON.stringify(results, null, 2) : formatDoctor(results));
  return 0;
}
