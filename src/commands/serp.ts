import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { captureSerp } from '../serp/search.js';
import { computeVerdict } from '../serp/verdict.js';
import type { SerpCapture, VerdictResult } from '../serp/types.js';
import { loadConfig } from '../config/load.js';
import { writeStableJson } from '../util/json.js';

export async function runSerp(args: string[]): Promise<number> {
  const queries = args.filter((arg) => !arg.startsWith('--'));
  if (queries.length === 0) {
    console.error('Usage: rainmaker serp <query> [<query> ...]');
    return 1;
  }

  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    console.error(
      'No FIRECRAWL_API_KEY set. SERP verdicts stay `unchecked`, which blocks briefing by design. ' +
        'Run `rainmaker doctor` for the full capability list.',
    );
    return 1;
  }

  const config = loadConfig();
  const now = new Date().toISOString();
  const dir = join('data', 'snapshots', now.replace(/[:.]/g, '-'));
  mkdirSync(dir, { recursive: true });

  const captures: SerpCapture[] = [];
  const verdicts: VerdictResult[] = [];

  for (const query of queries) {
    const capture = await captureSerp(query, { apiKey });
    captures.push(capture);
    const verdict = computeVerdict({
      capture,
      categoryTerms: [],
      canProduce: [],
      ownDemonstratedCeiling: null,
    });
    verdicts.push(verdict);

    console.log(`${query}`);
    console.log(`  ${verdict.verdict}${verdict.kill_reason ? `: ${verdict.kill_reason}` : ''}`);
    if (verdict.condition) console.log(`  condition: ${verdict.condition}`);
    console.log(`  intent consistent: ${verdict.intent_consistent}  category present: ${verdict.category_present}`);
    console.log(`  rewarded format: ${verdict.rewarded_format ?? 'unclear'}`);
    for (const evidence of verdict.evidence) console.log(`  evidence: ${evidence.detail}`);
    console.log('');
  }

  writeStableJson(join(dir, 'serp.json'), { generated_at: now, site: config.site, captures, verdicts });
  console.log(`Written to ${join(dir, 'serp.json')}`);
  return 0;
}
