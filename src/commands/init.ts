import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { CONFIG_FILENAME } from '../config/load.js';
import { REVENUE_MODELS, type RevenueModel } from '../config/schema.js';

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

/**
 * Config creation. Deliberately asks nothing about credentials: a first audit
 * must be possible with none, so the console work in `doctor` is never a
 * prerequisite for seeing value.
 *
 * Interactive on a TTY, flag-driven otherwise, so CI and scripted setup work.
 * Node's readline drops buffered lines on piped stdin, so prompting is only
 * attempted when we genuinely have a terminal.
 */
export async function runInit(argv: string[]): Promise<number> {
  const dir = process.cwd();
  const path = resolve(dir, CONFIG_FILENAME);
  const flags = parseFlags(argv);
  const force = 'force' in flags;
  const interactive = stdin.isTTY === true;

  if (existsSync(path) && !force) {
    console.error(`${CONFIG_FILENAME} already exists. Use --force to overwrite.`);
    return 1;
  }

  const rl = interactive ? createInterface({ input: stdin, output: stdout }) : null;

  const ask = async (flag: string, question: string, fallback = ''): Promise<string> => {
    if (flags[flag] !== undefined) return flags[flag];
    if (!rl) return fallback;
    const suffix = fallback ? ` (${fallback})` : '';
    const answer = (await rl.question(`${question}${suffix}: `)).trim();
    return answer || fallback;
  };

  const askList = async (flag: string, question: string): Promise<string[]> => {
    const answer = await ask(flag, `${question} [comma separated]`);
    return answer
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  };

  try {
    if (!interactive && !flags.site) {
      console.error(
        [
          'Not a terminal, so init needs flags:',
          '',
          '  rainmaker init \\',
          '    --site https://example.com \\',
          '    --revenue-model sales-led \\',
          '    --primary-conversion "/demo, /pricing" \\',
          '    --secondary-conversion "/docs, /blog" \\',
          '    --acv 18000 \\',
          '    --sales-cycle-days 45 \\',
          '    --icp-hint "who buys this" \\',
          '    --competitors "a.com, b.com"',
        ].join('\n'),
      );
      return 1;
    }

    const site = await ask('site', 'Site URL');
    if (!site) {
      console.error('\nSite URL is required.');
      return 1;
    }

    if (rl) console.log(`\nRevenue model: ${REVENUE_MODELS.join(' | ')}`);
    const revenueModel = (await ask(
      'revenue-model',
      'Revenue model',
      'sales-led',
    )) as RevenueModel;

    if (rl) {
      console.log(
        '\nPrimary conversion paths seed Tier 0, where money changes hands.\n' +
          'These matter more than anything else you enter here.',
      );
    }
    const primary = await askList('primary-conversion', 'Primary conversion paths');
    if (!primary.length) {
      console.error('\nAt least one primary conversion path is required.');
      return 1;
    }

    const secondary = await askList('secondary-conversion', 'Secondary paths (docs, blog)');
    const acvRaw = await ask('acv', 'Average contract value, 0 if unknown', '0');
    const cycleRaw = await ask('sales-cycle-days', 'Sales cycle in days', '30');
    const icpHint = await ask('icp-hint', 'Who buys this?');
    const competitors = await askList('competitors', 'Competitor domains to benchmark against');

    const yaml = renderConfig({
      site: site.replace(/\/+$/, ''),
      revenueModel,
      primary,
      secondary,
      acv: Number(acvRaw) || 0,
      salesCycleDays: Number(cycleRaw) || 30,
      icpHint,
      competitors,
    });

    writeFileSync(path, yaml, 'utf8');

    console.log(
      [
        '',
        `Wrote ${CONFIG_FILENAME}`,
        '',
        'Next: `rainmaker doctor` to see which capabilities are live.',
        'An audit will run with zero credentials, just with lower confidence.',
      ].join('\n'),
    );
    return 0;
  } finally {
    rl?.close();
  }
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

  return `# rainmaker configuration
# Supplies the business context that universal tiering logic needs.
# Docs: https://github.com/vcxcvii/rainmaker

site: ${v.site}
revenue_model: ${v.revenueModel}

# Tier 0. Where money changes hands.
primary_conversion:${list(v.primary)}

# Tier 1 and 2 seeds.
secondary_conversion:${list(v.secondary)}

# 0 disables value-weighted scoring.
acv: ${v.acv}
sales_cycle_days: ${v.salesCycleDays}

# grill-me starts from this hypothesis and argues with it.
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
