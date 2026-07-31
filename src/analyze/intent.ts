import type { Tier } from './checks.js';

/**
 * Query intent classification. One implementation, shared by tiering (rule 5)
 * and SERP verdicts, per spec/false-positives.md section 5: the same
 * detection logic implemented twice is how thresholds drift apart and two
 * reports contradict each other.
 */
export type QueryIntent = 'transactional' | 'commercial' | 'solution' | 'informational';

export const INTENT_TIER: Record<QueryIntent, Tier> = {
  transactional: 0,
  commercial: 1,
  solution: 2,
  informational: 3,
};

export const INTENT_TERMS: Record<QueryIntent, string[]> = {
  transactional: [
    'buy', 'demo', 'trial', 'free trial', 'signup', 'sign up', 'get started',
    'book a demo', 'pricing page',
  ],
  commercial: [
    'pricing', 'cost', 'price', ' vs ', 'versus', 'alternative', 'alternatives',
    'best', 'top', 'review', 'reviews', 'comparison', 'competitor',
  ],
  solution: ['how to', 'how do i', 'solve', 'fix', 'reduce', 'improve', 'automate', 'streamline', 'prevent'],
  informational: ['what is', 'why is', 'definition', 'meaning', 'examples', 'guide', 'tutorial', 'statistics', 'trends'],
};

/**
 * Classifies one piece of text (a query or a result title) into an intent
 * class. Order matters: transactional and commercial are checked before the
 * broader informational bucket, so "best pricing guide" reads as commercial.
 */
export function classifyIntent(text: string): QueryIntent | null {
  const padded = ` ${text.toLowerCase()} `;
  for (const intent of ['transactional', 'commercial', 'solution', 'informational'] as const) {
    if (INTENT_TERMS[intent].some((term) => padded.includes(term))) return intent;
  }
  return null;
}
