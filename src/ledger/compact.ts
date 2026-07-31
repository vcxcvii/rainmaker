export interface SnapshotRef {
  name: string;
  fetched_at: string;
}

function isoWeekKey(date: Date): string {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNumber = (target.getUTCDay() + 6) % 7; // Monday = 0
  target.setUTCDate(target.getUTCDate() - dayNumber + 3); // nearest Thursday
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/**
 * Snapshot retention from the core spec: full fidelity for 90 days, then
 * downsampled to one snapshot per ISO week, keeping the Monday one.
 *
 * `ledger.jsonl` is never touched by this. Only the raw snapshot directories
 * compact; the ledger's own history is permanent regardless of age.
 */
export function planCompaction(snapshots: SnapshotRef[], now: string): { keep: string[]; remove: string[] } {
  const cutoff = Date.parse(now) - 90 * 86_400_000;
  const recent = snapshots.filter((snapshot) => Date.parse(snapshot.fetched_at) >= cutoff);
  const old = snapshots.filter((snapshot) => Date.parse(snapshot.fetched_at) < cutoff);

  const byWeek = new Map<string, SnapshotRef[]>();
  for (const snapshot of old) {
    const key = isoWeekKey(new Date(snapshot.fetched_at));
    byWeek.set(key, [...(byWeek.get(key) ?? []), snapshot]);
  }

  const keptFromOld: SnapshotRef[] = [];
  for (const group of byWeek.values()) {
    // Prefer the Monday snapshot; otherwise the earliest in the week.
    const monday = group.find((snapshot) => new Date(snapshot.fetched_at).getUTCDay() === 1);
    keptFromOld.push(
      monday ?? [...group].sort((left, right) => Date.parse(left.fetched_at) - Date.parse(right.fetched_at))[0],
    );
  }

  const keepNames = new Set([...recent, ...keptFromOld].map((snapshot) => snapshot.name));
  return {
    keep: snapshots.filter((snapshot) => keepNames.has(snapshot.name)).map((snapshot) => snapshot.name),
    remove: snapshots.filter((snapshot) => !keepNames.has(snapshot.name)).map((snapshot) => snapshot.name),
  };
}
