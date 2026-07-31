import { execFileSync } from 'node:child_process';
import type { LedgerEvent, StatusEvent } from './types.js';

export interface Commit {
  sha: string;
  message: string;
}

const TRAILER = /rainmaker-fix:\s*(\S+)/g;

/** Extracts every finding id named in a commit's `rainmaker-fix:` trailer. */
export function findingIdsInCommit(message: string): string[] {
  return [...message.matchAll(TRAILER)].map((match) => match[1]);
}

export interface ShippedInput {
  commits: Commit[];
  /** Current status per finding id, so `shipped` is only appended on a legal transition. */
  status: ReadonlyMap<string, StatusEvent>;
  now: string;
}

/**
 * Turns commit trailers into `shipped` events.
 *
 * Per spec section 1.3: a `shipped` event is appended only from a commit
 * trailer or a re-measure, never inferred any other way. A finding still in
 * `opened` that starts passing goes straight to `closed` elsewhere in the
 * pipeline; nobody claimed to fix it, so there is nothing to verify. This
 * function only fires from `acknowledged` or `in_progress`, where a claim
 * was actually made.
 */
export function shippedFromCommits(input: ShippedInput): LedgerEvent[] {
  const events: LedgerEvent[] = [];
  const seen = new Set<string>();

  for (const commit of input.commits) {
    for (const id of findingIdsInCommit(commit.message)) {
      if (seen.has(id)) continue; // first commit naming an id wins within one scan
      const status = input.status.get(id);
      if (status !== 'acknowledged' && status !== 'in_progress') continue;
      events.push({ ts: input.now, id, event: 'shipped', cause: commit.sha });
      seen.add(id);
    }
  }
  return events;
}

/** Reads commits since a given ref (or all history), oldest first. Side-effecting; not unit tested. */
export function readCommitsSince(ref: string | null): Commit[] {
  const range = ref ? `${ref}..HEAD` : 'HEAD';
  const out = execFileSync('git', ['log', range, '--reverse', '--format=%H%x00%B%x01'], { encoding: 'utf-8' });
  return out
    .split('\x01')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [sha, message] = entry.split('\x00');
      return { sha, message: message ?? '' };
    });
}
