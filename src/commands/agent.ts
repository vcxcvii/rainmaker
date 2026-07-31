import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { join } from 'node:path';
import { loadConfig } from '../config/load.js';
import { selectProvider } from '../model/provider.js';
import { runInterview, extractInterviewResult, applyInterviewResult, type InterviewIO } from '../agent/interview.js';
import { renderFirstRun } from '../agent/firstrun.js';
import { recommendCadence, formatCadence } from '../agent/cadence.js';
import { BUSINESS_PATH, hashBody, readBusiness, writeBusiness } from '../context/business.js';
import { readStrategy, writeStrategy } from '../context/strategy.js';
import { runAudit } from './audit.js';
import type { Diagnosis } from './audit.js';
import type { GscSnapshot } from '../fetch/types.js';

const SNAPSHOTS = join('data', 'snapshots');

function latestSnapshotDir(): string | null {
  if (!existsSync(SNAPSHOTS)) return null;
  const entries = readdirSync(SNAPSHOTS).sort();
  return entries.length ? join(SNAPSHOTS, entries[entries.length - 1]) : null;
}

function readJson<T>(path: string): T | null {
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as T) : null;
}

function skillPrompt(name: string): string {
  const path = new URL(`../../skills/${name}/SKILL.md`, import.meta.url);
  return readFileSync(path, 'utf8');
}

function stdinIO(): InterviewIO {
  const rl = createInterface({ input: stdin, output: stdout });
  return {
    print(text) {
      console.log(`\n${text}\n`);
    },
    async ask(prompt) {
      return rl.question(prompt);
    },
  };
}

/**
 * The interactive agent: for someone not already inside an AI coding tool.
 * A loop over the same CLI and the same skills, driven by whichever model
 * the user brings, per spec/agent.md section 2.3.
 */
export async function runAgent(args: string[]): Promise<number> {
  if (!existsSync('rainmaker.config.yml')) {
    console.error('No rainmaker.config.yml. Run `rainmaker init` first.');
    return 1;
  }
  const config = loadConfig();
  console.log(`Rainmaker agent for ${config.site}\n`);

  // A model key is only required when an interview is actually about to run.
  // audit, the first-run render and the cadence recommendation are all
  // deterministic and credential-free, so a returning user with context
  // already interviewed should never be blocked here.
  const provider = selectProvider(process.env);

  // Ground: an interview about a site nobody has looked at produces generic
  // questions, so the audit runs before anything else, automatically.
  let snapshotDir = latestSnapshotDir();
  if (!snapshotDir || !existsSync(join(snapshotDir, 'diagnosis.json'))) {
    console.log('No diagnosis yet. Running `rainmaker audit` first...\n');
    const code = await runAudit([]);
    if (code !== 0) return code;
    snapshotDir = latestSnapshotDir();
  }
  const diagnosis = snapshotDir ? readJson<Diagnosis>(join(snapshotDir, 'diagnosis.json')) : null;
  if (!diagnosis) {
    console.error('Audit ran but produced no diagnosis. Run `rainmaker audit` directly to see the error.');
    return 1;
  }

  // The interview, only when the context is missing or still a stub.
  const needsInterview = !existsSync(BUSINESS_PATH) || readBusiness().frontmatter.confidence === 'stub';
  if (needsInterview && !args.includes('--skip-interview')) {
    if (!provider) {
      console.error(
        'No ANTHROPIC_API_KEY or OPENAI_API_KEY set, and the business context needs the interview to hold it. ' +
          'Either set a model key, or run `rainmaker agent --skip-interview` to see the three closest fixes ' +
          'and the cadence recommendation without it; `rainmaker context --init` writes a stub in the meantime.',
      );
      return 1;
    }
    console.log(`Using ${provider.name} as the model provider.`);

    const opening = [
      `Tier distribution: ${JSON.stringify(diagnosis.tier_distribution)}.`,
      `Top findings: ${diagnosis.findings.slice(0, 3).map((f) => `${f.id} (score ${f.revenue_score})`).join(', ')}.`,
    ].join(' ');

    const system = `${skillPrompt('know-my-buyer')}\n\nDiagnosis to open with: ${opening}`;
    console.log("\nRunning the know-my-buyer interview. Answer in your own words; type your reply and press enter.\n");

    const transcript = await runInterview(provider, system, stdinIO());
    console.log('\nWriting your business context...');

    const result = await extractInterviewResult(provider, system, transcript);
    const now = new Date().toISOString();
    const previous = existsSync('data/strategy.json') ? readStrategy() : null;

    writeBusiness({
      frontmatter: { generated_at: now, strategy_version: (previous?.version ?? 0) + 1, source: 'know-my-buyer', confidence: 'interviewed' },
      body: result.business_md_body,
    });

    if (previous) {
      const next = applyInterviewResult(previous, result, now);
      const violations = writeStrategy(next, { by: 'know-my-buyer', contextHash: hashBody(result.business_md_body), generatedAt: now });
      if (violations.length > 0) {
        console.error('Could not write strategy.json:');
        for (const violation of violations) console.error(`  ${violation.field}: ${violation.reason}`);
      }
    }
    console.log('context/business.md and data/strategy.json are written.\n');
  }

  // Three fixes, closest to revenue.
  console.log(renderFirstRun(diagnosis.findings));

  // Cadence, recommended from the site's own shape.
  const gsc = snapshotDir ? readJson<GscSnapshot>(join(snapshotDir, 'gsc.json')) : null;
  const clicksPerMonth = gsc ? gsc.rows.reduce((sum, row) => sum + row.clicks, 0) : 0;
  const shape = {
    urlCount: diagnosis.coverage.fetched,
    clicksPerMonth,
    pagesPublishedPerMonth: 0,
  };
  console.log(`\n${formatCadence(shape, recommendCadence(shape))}`);
  console.log(
    '\nConfirm this, or tell me what to change. To automate it, run `put-it-on-autopilot` inside an ' +
      'AI coding assistant with the skills installed, or schedule `rainmaker routine` yourself.',
  );

  return 0;
}
