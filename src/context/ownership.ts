import type { SkillName, Strategy } from './types.js';

/**
 * Field ownership. Without it, say-it-their-way and pick-my-battles overwrite
 * each other's conclusions and the strategy becomes whichever skill ran last.
 *
 * Keys are dotted paths matched by longest prefix, so a specific rule such as
 * `pain_points.status` beats the general `pain_points` rule.
 */
export const OWNERSHIP: Record<string, readonly SkillName[]> = {
  icp: ['know-my-buyer', 'say-it-their-way'],
  personas: ['know-my-buyer', 'say-it-their-way'],
  pain_points: ['know-my-buyer'],
  'pain_points.buyer_language': ['know-my-buyer', 'say-it-their-way'],
  'pain_points.status': ['say-it-their-way', 'what-actually-worked'],
  proof: ['know-my-buyer', 'beat-my-competitors'],
  competitors: ['beat-my-competitors'],
  clusters: ['pick-my-battles'],
  'clusters.target_tier': ['pick-my-battles', 'follow-the-money'],
  keyword_plan: ['what-to-target-next'],
  'keyword_plan.slot': ['what-to-target-next', 'revive-old-pages'],
  messaging: ['say-it-their-way'],
  decisions: [...([] as SkillName[])], // append-only, checked separately
};

type KeyedField = 'personas' | 'pain_points' | 'proof' | 'competitors' | 'clusters';

/** Collections keyed by a stable id, so a change can be attributed to one record. */
const KEYED: Array<{ field: KeyedField; key: string }> = [
  { field: 'personas', key: 'id' },
  { field: 'pain_points', key: 'id' },
  { field: 'proof', key: 'id' },
  { field: 'competitors', key: 'domain' },
  { field: 'clusters', key: 'id' },
];

export interface Violation {
  field: string;
  reason: string;
}

function ownerOf(path: string): readonly SkillName[] | null {
  const parts = path.split('.');
  for (let depth = parts.length; depth > 0; depth -= 1) {
    const candidate = parts.slice(0, depth).join('.');
    if (candidate in OWNERSHIP) return OWNERSHIP[candidate];
    // pain_points.pp3.status -> pain_points.status
    if (depth >= 3) {
      const collapsed = `${parts[0]}.${parts.slice(2, depth).join('.')}`;
      if (collapsed in OWNERSHIP) return OWNERSHIP[collapsed];
    }
  }
  return null;
}

function changedPaths(before: unknown, after: unknown, prefix: string, out: string[]): void {
  if (JSON.stringify(before) === JSON.stringify(after)) return;
  if (
    before === null ||
    after === null ||
    typeof before !== 'object' ||
    typeof after !== 'object' ||
    Array.isArray(before) !== Array.isArray(after)
  ) {
    out.push(prefix);
    return;
  }
  if (Array.isArray(before) && Array.isArray(after)) {
    out.push(prefix);
    return;
  }
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    changedPaths(
      (before as Record<string, unknown>)[key],
      (after as Record<string, unknown>)[key],
      prefix ? `${prefix}.${key}` : key,
      out,
    );
  }
}

function keyedDiff(before: Strategy, after: Strategy): string[] {
  const paths: string[] = [];
  for (const { field, key } of KEYED) {
    const rowsOf = (strategy: Strategy) =>
      strategy[field] as unknown as Array<Record<string, unknown>>;
    const from = new Map(rowsOf(before).map((row) => [String(row[key]), row]));
    const to = new Map(rowsOf(after).map((row) => [String(row[key]), row]));

    for (const [id, row] of to) {
      const previous = from.get(id);
      if (!previous) {
        paths.push(`${field}.${id}`);
        continue;
      }
      const nested: string[] = [];
      changedPaths(previous, row, `${field}.${id}`, nested);
      paths.push(...nested);
    }
    for (const id of from.keys()) {
      if (!to.has(id)) paths.push(`${field}.${id}`);
    }
  }
  return paths;
}

const UNKEYED: Array<keyof Strategy> = ['icp', 'messaging', 'keyword_plan'];

/**
 * Checks one write against the ownership table and the additive rule.
 *
 * Returns violations rather than throwing: a caller reporting three problems
 * at once is more useful than one that stops at the first, and this runs in
 * `context --validate` where the whole picture is the point.
 */
export function validateWrite(before: Strategy, after: Strategy, writer: SkillName): Violation[] {
  const violations: Violation[] = [];

  if (after.version <= before.version) {
    violations.push({
      field: 'version',
      reason: `version must increase: ${before.version} -> ${after.version}`,
    });
  }

  // Records are retired, never deleted. A deleted pain point takes its history
  // with it, and the next retrospective cannot tell that we ever believed it.
  for (const { field, key } of KEYED) {
    const to = new Set(
      (after[field] as unknown as Array<Record<string, unknown>>).map((row) => String(row[key])),
    );
    for (const row of before[field] as unknown as Array<Record<string, unknown>>) {
      const id = String(row[key]);
      if (!to.has(id)) {
        violations.push({
          field: `${field}.${id}`,
          reason: 'records are retired with a status and a reason, never deleted',
        });
      }
    }
  }

  const paths = keyedDiff(before, after);
  for (const field of UNKEYED) {
    changedPaths(before[field], after[field], String(field), paths);
  }

  const unexplained = new Set<string>();
  for (const path of paths) {
    const owners = ownerOf(path);
    if (!owners) {
      violations.push({ field: path, reason: 'no skill owns this field' });
      continue;
    }
    if (!owners.includes(writer)) {
      violations.push({
        field: path,
        reason: `${writer} may not write this. Owners: ${owners.join(', ')}`,
      });
      continue;
    }
    unexplained.add(path);
  }

  // Every change needs a reason on the record, so a later reader can ask why
  // rather than reverse-engineering a diff.
  const explained = new Set(
    after.decisions.slice(before.decisions.length).map((decision) => decision.field),
  );
  for (const path of unexplained) {
    const covered = [...explained].some((field) => path === field || path.startsWith(`${field}.`));
    if (!covered) {
      violations.push({ field: path, reason: 'changed without a decisions entry explaining why' });
    }
  }

  if (after.decisions.length < before.decisions.length) {
    violations.push({ field: 'decisions', reason: 'decisions are append-only' });
  }

  return violations;
}
