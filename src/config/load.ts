import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { DEFAULT_CRAWL, validateConfig, type PaydirtConfig } from './schema.js';

export const CONFIG_FILENAME = 'paydirt.config.yml';

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/**
 * Loads and validates paydirt.config.yml from cwd.
 *
 * Throws with every problem listed rather than the first, so a user fixes one
 * round of errors instead of discovering them one run at a time.
 */
export function loadConfig(dir = process.cwd()): PaydirtConfig {
  const path = resolve(dir, CONFIG_FILENAME);

  if (!existsSync(path)) {
    throw new ConfigError(
      `No ${CONFIG_FILENAME} found in ${dir}.\nRun \`paydirt init\` to create one.`,
    );
  }

  let raw: unknown;
  try {
    raw = parse(readFileSync(path, 'utf8'));
  } catch (err) {
    throw new ConfigError(`${CONFIG_FILENAME} is not valid YAML: ${(err as Error).message}`);
  }

  const problems = validateConfig(raw);
  if (problems.length) {
    const lines = problems.map((p) => `  ${p.field}: ${p.message}`).join('\n');
    throw new ConfigError(`${CONFIG_FILENAME} has ${problems.length} problem(s):\n${lines}`);
  }

  const config = raw as PaydirtConfig;

  return {
    ...config,
    site: config.site.replace(/\/+$/, ''),
    secondary_conversion: config.secondary_conversion ?? [],
    crawl: { ...DEFAULT_CRAWL, ...config.crawl },
  };
}
