import { classifyIntent } from '../analyze/intent.js';
import type { BeatabilityEvidence, PageFormat, SerpCapture, SerpResult, Verdict, VerdictResult } from './types.js';

/**
 * Classifies a result's format from its title and URL. A keyword heuristic in
 * the style of tiering.ts, not NLP: consistent, cheap, and easy to audit.
 */
export function classifyFormat(title: string, url: string): PageFormat {
  const text = `${title} ${url}`.toLowerCase();
  if (/\bbest\b|\btop\s?\d+\b/.test(text)) return 'listicle';
  if (/alternative/.test(text)) return 'alternatives';
  if (/\bvs\.?\b|\bversus\b|comparison/.test(text)) return 'comparison';
  if (/\/docs?\b|documentation/.test(text)) return 'documentation';
  if (/how\s?to|\bguide\b|tutorial/.test(text)) return 'guide';
  if (/pricing|demo|signup|sign up|get started|book a demo/.test(text)) return 'landing';
  if (url.replace(/^https?:\/\/[^/]+/, '').split('/').filter(Boolean).length <= 1) return 'category';
  return 'other';
}

function modalFormat(results: SerpResult[]): PageFormat | null {
  const counts = new Map<PageFormat, number>();
  for (const result of results) {
    const format = classifyFormat(result.title, result.url);
    if (format === 'other') continue;
    counts.set(format, (counts.get(format) ?? 0) + 1);
  }
  if (counts.size === 0) return null;
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0][0];
}

/**
 * Whether the top 10 largely agree on intent. A mixed SERP means Google is not
 * confident what searchers want, which makes deliberate targeting unreliable
 * and rankings unstable regardless of how good the content is.
 */
function intentConsistency(results: SerpResult[]): { consistent: boolean; majority: number } {
  const classified = results.map((result) => classifyIntent(result.title)).filter(Boolean);
  if (classified.length === 0) return { consistent: true, majority: 0 };

  const counts = new Map<string, number>();
  for (const intent of classified) counts.set(intent!, (counts.get(intent!) ?? 0) + 1);
  const top = Math.max(...counts.values());
  const share = top / classified.length;
  return { consistent: share >= 0.6, majority: share };
}

export interface VerdictInput {
  capture: SerpCapture;
  /** Present when the SERP's category terms should be checked. Empty means "assume present". */
  categoryTerms: string[];
  /** Formats this site can plausibly produce. Empty means "assume any". */
  canProduce: PageFormat[];
  /** Domain -> pages already built in this cluster. Used for the lower-page-count beatability signal. */
  competitorClusterPages?: Record<string, number>;
  ourClusterPages?: number;
  /** 90th percentile position this site has achieved at a similar impression volume. Null when unknown. */
  ownDemonstratedCeiling?: number | null;
  now?: string;
}

function categoryPresent(results: SerpResult[], categoryTerms: string[]): boolean {
  if (categoryTerms.length === 0) return true;
  const lowered = categoryTerms.map((term) => term.toLowerCase());
  return results.some((result) => {
    const haystack = `${result.title} ${result.domain}`.toLowerCase();
    return lowered.some((term) => haystack.includes(term));
  });
}

function staleTopResults(results: SerpResult[], now: string): boolean {
  const top5 = results.slice(0, 5).filter((result) => result.last_modified);
  if (top5.length === 0) return false;
  const twoYearsMs = 2 * 365 * 86_400_000;
  return top5.every((result) => Date.parse(now) - Date.parse(result.last_modified!) > twoYearsMs);
}

/**
 * The SERP verdict. Ends in QUALIFY, CONDITIONAL or KILL, per spec/skills.md
 * phase 3. Beatability requires named evidence: optimism is not evidence, and
 * a CONDITIONAL without a stated, resolvable condition is a soft pass that
 * should have been a KILL.
 */
export function computeVerdict(input: VerdictInput): VerdictResult {
  const { capture, now = new Date().toISOString() } = input;
  const top10 = capture.results.slice(0, 10);
  const top5 = capture.results.slice(0, 5);

  const { consistent: intentConsistent } = intentConsistency(top10);
  const category = categoryPresent(top10, input.categoryTerms);
  const rewardedFormat = modalFormat(top5);

  const evidence: BeatabilityEvidence[] = [];

  if (input.competitorClusterPages && input.ourClusterPages !== undefined) {
    for (const result of top10) {
      const theirs = input.competitorClusterPages[result.domain];
      if (theirs !== undefined && theirs < input.ourClusterPages) {
        evidence.push({
          reason: 'lower_page_count_competitor',
          detail: `${result.domain} has ${theirs} pages in this cluster against our ${input.ourClusterPages}`,
        });
      }
    }
  }

  for (const result of top5) {
    const resultIntent = classifyIntent(result.title);
    const capturedIntent = classifyIntent(capture.query);
    if (resultIntent && capturedIntent && resultIntent !== capturedIntent) {
      evidence.push({
        reason: 'intent_mismatched_result',
        detail: `"${result.title}" (position ${result.position}) does not serve the query's own intent`,
      });
    }
  }

  if (input.ownDemonstratedCeiling !== undefined && input.ownDemonstratedCeiling !== null && input.ownDemonstratedCeiling <= 10) {
    evidence.push({
      reason: 'own_demonstrated_ceiling',
      detail: `this site has reached position ${input.ownDemonstratedCeiling} at a similar impression volume`,
    });
  }

  if (staleTopResults(capture.results, now)) {
    evidence.push({ reason: 'stale_top_results', detail: 'every result in the top 5 with a known date is over 24 months old' });
  }

  // Being able to produce the rewarded format is necessary but is not itself
  // beatability evidence, so it never adds to `evidence` above.
  const formatGap =
    rewardedFormat !== null && input.canProduce.length > 0 && !input.canProduce.includes(rewardedFormat);

  const beatable = evidence.length > 0;

  return decide({ query: capture.query, intentConsistent, category, rewardedFormat, beatable, evidence, formatGap, canProduce: input.canProduce });
}

function decide(args: {
  query: string;
  intentConsistent: boolean;
  category: boolean;
  rewardedFormat: PageFormat | null;
  beatable: boolean;
  evidence: BeatabilityEvidence[];
  formatGap: boolean;
  canProduce: PageFormat[];
}): VerdictResult {
  const base = {
    query: args.query,
    intent_consistent: args.intentConsistent,
    category_present: args.category,
    rewarded_format: args.rewardedFormat,
    beatable: args.beatable,
    evidence: args.evidence,
  };

  if (!args.category) {
    return { ...base, verdict: 'KILL', kill_reason: 'the top results serve a different product category entirely' };
  }
  if (!args.intentConsistent) {
    return { ...base, verdict: 'KILL', kill_reason: 'the SERP is mixed intent, so no single page can target it deliberately' };
  }
  if (!args.beatable) {
    return { ...base, verdict: 'KILL', kill_reason: 'no beatability evidence: every position is held with no visible gap' };
  }
  if (args.formatGap) {
    const verdict: Verdict = 'CONDITIONAL';
    return {
      ...base,
      verdict,
      condition: `Google rewards ${args.rewardedFormat} here, which this site is not positioned to produce`,
      condition_resolved_by: 'confirm the site can build this format, or target a different query in this cluster',
    };
  }
  return { ...base, verdict: 'QUALIFY' };
}

/** Applies computeVerdict across a candidate pool, summarising kill reasons. */
export function verdictBatch(inputs: VerdictInput[]): { results: VerdictResult[]; killReasons: Map<string, number> } {
  const results = inputs.map(computeVerdict);
  const killReasons = new Map<string, number>();
  for (const result of results) {
    if (result.verdict === 'KILL' && result.kill_reason) {
      killReasons.set(result.kill_reason, (killReasons.get(result.kill_reason) ?? 0) + 1);
    }
  }
  return { results, killReasons };
}
