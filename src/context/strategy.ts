import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { writeStableJson } from '../util/json.js';
import { validateWrite, type Violation } from './ownership.js';
import { ContextError, type SkillName, type Strategy } from './types.js';

export const DATA_DIR = 'data';
export const STRATEGY_PATH = join(DATA_DIR, 'strategy.json');
export const HISTORY_DIR = join(DATA_DIR, 'strategy-history');

export function emptyStrategy(generatedAt: string, contextHash: string): Strategy {
  return {
    version: 1,
    generated_at: generatedAt,
    context_hash: contextHash,
    written_by: ['cli'],
    icp: {
      segment: '',
      employee_range: null,
      industries: [],
      geographies: [],
      disqualifiers: [],
    },
    personas: [],
    pain_points: [],
    proof: [],
    competitors: [],
    clusters: [],
    keyword_plan: [],
    messaging: { one_liner: '', category: '', differentiators: [], objection_handling: [] },
    decisions: [],
  };
}

export function readStrategy(path = STRATEGY_PATH): Strategy {
  if (!existsSync(path)) {
    throw new ContextError(
      'No strategy yet. Run the `know-my-buyer` skill, or `rainmaker context --init` for a stub.',
    );
  }
  return JSON.parse(readFileSync(path, 'utf8')) as Strategy;
}

/** Structural problems that make the file unusable regardless of who wrote it. */
export function validateShape(strategy: Strategy): Violation[] {
  const problems: Violation[] = [];
  const ids = new Set<string>();

  for (const [field, rows] of [
    ['personas', strategy.personas],
    ['pain_points', strategy.pain_points],
    ['proof', strategy.proof],
    ['clusters', strategy.clusters],
  ] as const) {
    for (const row of rows) {
      const key = `${field}.${row.id}`;
      if (ids.has(key)) problems.push({ field: key, reason: 'duplicate id' });
      ids.add(key);
    }
  }

  const painIds = new Set(strategy.pain_points.map((pain) => pain.id));
  const personaIds = new Set(strategy.personas.map((persona) => persona.id));
  const proofIds = new Set(strategy.proof.map((proof) => proof.id));
  const clusterIds = new Set(strategy.clusters.map((cluster) => cluster.id));

  for (const pain of strategy.pain_points) {
    for (const id of pain.persona_ids) {
      if (!personaIds.has(id)) {
        problems.push({ field: `pain_points.${pain.id}.persona_ids`, reason: `unknown persona ${id}` });
      }
    }
    if (pain.status === 'retired' && !pain.retired_reason) {
      problems.push({ field: `pain_points.${pain.id}`, reason: 'retired needs retired_reason' });
    }
    if (pain.status === 'validated' && pain.buyer_language.length === 0) {
      problems.push({
        field: `pain_points.${pain.id}.buyer_language`,
        reason: 'a validated pain point with no buyer language was never heard from a buyer',
      });
    }
  }

  for (const cluster of strategy.clusters) {
    if (cluster.pain_point_ids.length === 0) {
      problems.push({
        field: `clusters.${cluster.id}`,
        reason: 'a cluster with no pain point exists only because a keyword had volume',
      });
    }
    for (const id of cluster.pain_point_ids) {
      if (!painIds.has(id)) {
        problems.push({ field: `clusters.${cluster.id}.pain_point_ids`, reason: `unknown pain point ${id}` });
      }
    }
  }

  for (const slot of strategy.keyword_plan) {
    if (!clusterIds.has(slot.cluster_id)) {
      problems.push({ field: `keyword_plan.${slot.query}`, reason: `unknown cluster ${slot.cluster_id}` });
    }
  }

  for (const handled of strategy.messaging.objection_handling) {
    if (handled.proof_id && !proofIds.has(handled.proof_id)) {
      problems.push({ field: 'messaging.objection_handling', reason: `unknown proof ${handled.proof_id}` });
    }
  }

  return problems;
}

export interface WriteOptions {
  by: SkillName;
  contextHash: string;
  generatedAt: string;
}

/**
 * Writes a new strategy version after checking ownership and shape. Archives
 * the previous version first, so a bad write is always recoverable and the
 * belief history stays readable.
 */
export function writeStrategy(next: Strategy, options: WriteOptions, path = STRATEGY_PATH): Violation[] {
  const previous = existsSync(path) ? readStrategy(path) : null;
  const candidate: Strategy = {
    ...next,
    generated_at: options.generatedAt,
    context_hash: options.contextHash,
    written_by: previous?.written_by.includes(options.by)
      ? previous.written_by
      : [...(previous?.written_by ?? []), options.by],
  };

  const violations = previous ? validateWrite(previous, candidate, options.by) : [];
  violations.push(...validateShape(candidate));
  if (violations.length > 0) return violations;

  if (previous) {
    mkdirSync(HISTORY_DIR, { recursive: true });
    copyFileSync(
      path,
      join(HISTORY_DIR, `${String(previous.version).padStart(4, '0')}-${previous.generated_at.replace(/[:.]/g, '-')}.json`),
    );
  }
  mkdirSync(DATA_DIR, { recursive: true });
  writeStableJson(path, candidate);
  return [];
}
