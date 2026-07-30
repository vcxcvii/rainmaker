import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig } from '../config/load.js';
import {
  BUSINESS_PATH,
  CONTEXT_DIR,
  GLOSSARY_PATH,
  VOICE_PATH,
  hashBody,
  readBusiness,
  writeBusiness,
} from '../context/business.js';
import { stubBusiness, stubGlossary, stubVoice } from '../context/scaffold.js';
import {
  DATA_DIR,
  STRATEGY_PATH,
  emptyStrategy,
  readStrategy,
  validateShape,
  writeStrategy,
} from '../context/strategy.js';
import { ContextError } from '../context/types.js';

function snapshotDir(): string | null {
  const dir = join(DATA_DIR, 'snapshots');
  if (!existsSync(dir)) return null;
  const entries = readdirSync(dir).sort();
  return entries.length > 0 ? entries[entries.length - 1] : null;
}

function runInit(): number {
  const config = loadConfig();
  const now = new Date().toISOString();

  if (existsSync(BUSINESS_PATH)) {
    console.error(
      `${BUSINESS_PATH} already exists. Refusing to overwrite a context you may have edited.\n` +
        'Delete it deliberately, or run the `know-my-buyer` skill to replace it properly.',
    );
    return 1;
  }

  mkdirSync(CONTEXT_DIR, { recursive: true });
  const doc = stubBusiness(config, now);
  writeBusiness(doc);
  if (!existsSync(VOICE_PATH)) writeFileSync(VOICE_PATH, stubVoice(), 'utf8');
  if (!existsSync(GLOSSARY_PATH)) writeFileSync(GLOSSARY_PATH, stubGlossary(config), 'utf8');

  if (!existsSync(STRATEGY_PATH)) {
    const violations = writeStrategy(
      emptyStrategy(now, hashBody(doc.body)),
      { by: 'cli', contextHash: hashBody(doc.body), generatedAt: now },
    );
    if (violations.length > 0) {
      console.error('Stub strategy failed its own validation. This is a bug:');
      for (const violation of violations) console.error(`  ${violation.field}: ${violation.reason}`);
      return 2;
    }
  }

  console.log(
    [
      `Wrote ${BUSINESS_PATH}, ${VOICE_PATH}, ${GLOSSARY_PATH} and ${STRATEGY_PATH}.`,
      '',
      'This is a stub. Nothing in it came from a buyer, so every report built on',
      'it will say confidence: stub until you run the know-my-buyer skill.',
      '',
      'Next: `rainmaker audit`, then the know-my-buyer skill.',
    ].join('\n'),
  );
  return 0;
}

function runCheck(): number {
  const rows: Array<[string, string, string]> = [];
  let missingRequired = false;

  if (existsSync(BUSINESS_PATH)) {
    const doc = readBusiness();
    rows.push([
      BUSINESS_PATH,
      'present',
      `strategy_version ${doc.frontmatter.strategy_version}, ${doc.frontmatter.confidence}, ${doc.frontmatter.generated_at.slice(0, 10)}`,
    ]);
  } else {
    rows.push([BUSINESS_PATH, 'MISSING', 'every judgment skill will refuse. `rainmaker context --init`']);
    missingRequired = true;
  }

  rows.push(
    existsSync(VOICE_PATH)
      ? [VOICE_PATH, 'present', 'read by writing skills and the slop gate']
      : [VOICE_PATH, 'MISSING', 'writing skills will refuse'],
  );
  rows.push(
    existsSync(GLOSSARY_PATH)
      ? [GLOSSARY_PATH, 'present', 'brand tokens suppress false cannibalisation findings']
      : [GLOSSARY_PATH, 'MISSING', 'brand queries may be reported as cannibalisation'],
  );

  if (existsSync(STRATEGY_PATH)) {
    const strategy = readStrategy();
    const hash = existsSync(BUSINESS_PATH) ? hashBody(readBusiness().body) : '';
    const matches = strategy.context_hash === hash;
    rows.push([
      STRATEGY_PATH,
      matches ? 'present' : 'STALE',
      matches
        ? `version ${strategy.version}, hash matches, ${strategy.pain_points.length} pain points, ${strategy.clusters.length} clusters`
        : 'business.md was edited after the strategy was written',
    ]);
    if (!matches) missingRequired = true;
  } else {
    rows.push([STRATEGY_PATH, 'MISSING', 'strategy skills will refuse. `rainmaker context --init`']);
    missingRequired = true;
  }

  const latest = snapshotDir();
  rows.push(
    latest
      ? [join(DATA_DIR, 'snapshots'), latest, 'latest snapshot']
      : [join(DATA_DIR, 'snapshots'), 'MISSING', 'no measurements yet. `rainmaker audit`'],
  );

  const width = Math.max(...rows.map(([path]) => path.length));
  for (const [path, status, note] of rows) {
    console.log(`${path.padEnd(width)}  ${status.padEnd(8)}  ${note}`);
  }

  if (existsSync(STRATEGY_PATH) && existsSync(BUSINESS_PATH)) {
    const strategy = readStrategy();
    if (strategy.context_hash !== hashBody(readBusiness().body)) {
      console.log(
        '\nBusiness context was edited after the strategy was written. Re-run `know-my-buyer`, ' +
          'or run `rainmaker context --sync` to accept the prose as authoritative.',
      );
    }
  }

  return missingRequired ? 1 : 0;
}

function runValidate(): number {
  const strategy = readStrategy();
  const problems = validateShape(strategy);

  if (existsSync(BUSINESS_PATH)) {
    const hash = hashBody(readBusiness().body);
    if (strategy.context_hash !== hash) {
      problems.push({
        field: 'context_hash',
        reason: 'does not match context/business.md. Run `rainmaker context --sync` or re-interview.',
      });
    }
  }

  if (problems.length === 0) {
    console.log(`${STRATEGY_PATH} is valid: version ${strategy.version}, hash matches.`);
    return 0;
  }

  console.error(`${problems.length} problem(s) in ${STRATEGY_PATH}:\n`);
  for (const problem of problems) console.error(`  ${problem.field}: ${problem.reason}`);
  return 1;
}

function runSync(): number {
  const doc = readBusiness();
  const strategy = readStrategy();
  const hash = hashBody(doc.body);

  if (strategy.context_hash === hash) {
    console.log('Already in sync. Nothing to do.');
    return 0;
  }

  const now = new Date().toISOString();
  const next = {
    ...strategy,
    version: strategy.version + 1,
    decisions: [
      ...strategy.decisions,
      {
        ts: now,
        field: 'context_hash',
        from: strategy.context_hash,
        to: hash,
        reason: 'prose edited by hand and accepted as authoritative via context --sync',
        source: 'cli' as const,
      },
    ],
  };

  const violations = writeStrategy(next, { by: 'cli', contextHash: hash, generatedAt: now });
  if (violations.length > 0) {
    console.error('Sync refused:\n');
    for (const violation of violations) console.error(`  ${violation.field}: ${violation.reason}`);
    return 1;
  }

  writeBusiness({
    frontmatter: { ...doc.frontmatter, strategy_version: next.version, generated_at: now },
    body: doc.body,
  });

  console.log(
    `Accepted context/business.md as authoritative. Strategy now version ${next.version}.\n` +
      'The prose and the records are only as aligned as you left them: --sync accepts the hash, it does not re-read your edits.',
  );
  return 0;
}

export function runContext(args: string[]): number {
  try {
    if (args.includes('--init')) return runInit();
    if (args.includes('--validate')) return runValidate();
    if (args.includes('--sync')) return runSync();
    return runCheck();
  } catch (error) {
    if (error instanceof ContextError) {
      console.error(error.message);
      return 1;
    }
    throw error;
  }
}
