import type { RainmakerConfig } from '../config/schema.js';
import { effortFor } from './effort.js';
import { combineConfidence, revenueScore } from './scoring.js';
import { findingId, type Finding, type Tier } from './checks.js';

/**
 * Findings about the shape of the site rather than about any one page.
 *
 * "No Tier 0 pages" and "No Tier 1 pages" were the two most valuable things the
 * audit produced and the only two it could not remember producing. They existed
 * as `console.log` inside the printer: absent from `Diagnosis`, unscored, never
 * written to the ledger, invisible to `report`, to `routine`, and to every skill
 * that reads the diagnosis JSON. The best output of the system disappeared the
 * moment nobody was watching stdout, and could never be closed because nothing
 * had opened it.
 *
 * They are ordinary findings now, so they rank against page-level work, survive
 * in the ledger, and close on their own evidence: a Tier 1 page existing is
 * exactly what makes "no Tier 1 pages" no longer true.
 *
 * The site root carries them. A finding needs a URL, and these are true of the
 * whole site, so the root is the honest place to hang them rather than an
 * arbitrary page that happens to be missing something.
 */

const SITE_URL = '/';

export interface SiteLevelInput {
  config: RainmakerConfig;
  tierDistribution: Record<'0' | '1' | '2' | '3' | '4', number>;
  /** False when the crawl hit its budget: absence is not evidence in a sample. */
  coverageComplete: boolean;
}

export function siteLevelFindings(input: SiteLevelInput): Finding[] {
  // A partial crawl cannot support a site-wide claim. "Not found in this
  // sample" and "absent from the site" are different statements, and only the
  // second one is a finding.
  if (!input.coverageComplete) return [];

  const findings: Finding[] = [];
  const pages = Object.values(input.tierDistribution).reduce((sum, count) => sum + count, 0);
  if (pages === 0) return [];

  if ((input.tierDistribution['0'] ?? 0) === 0) {
    findings.push(
      build({
        check: 'tier_zero_absent',
        tier: 0,
        severity: 'blocking',
        message:
          'No Tier 0 pages. Nothing on this site is where money changes hands, so every other score is relative to nothing.',
        evidence: { tier_0_pages: 0, pages_analysed: pages },
        config: input.config,
      }),
    );
  } else if ((input.tierDistribution['1'] ?? 0) === 0) {
    // Only when Tier 0 exists. Reporting both at once tells a site with no
    // commercial pages at all that it has two problems, when it has one.
    findings.push(
      build({
        check: 'tier_one_absent',
        tier: 1,
        severity: 'major',
        message:
          'No Tier 1 pages. Buyers arrive at awareness content and reach the point of paying with nothing in between to convince them.',
        evidence: { tier_1_pages: 0, tier_0_pages: input.tierDistribution['0'], pages_analysed: pages },
        config: input.config,
      }),
    );
  }

  return findings;
}

function build(draft: {
  check: 'tier_zero_absent' | 'tier_one_absent';
  tier: Tier;
  severity: 'blocking' | 'major';
  message: string;
  evidence: Record<string, unknown>;
  config: RainmakerConfig;
}): Finding {
  const effort = effortFor(draft.check);
  // Counted directly from the crawl this run performed, so the measurement is
  // as certain as anything the system produces.
  const measurement = 1.0;
  const tierConfidence = 1.0;
  const opportunity = 1;

  return {
    id: findingId(draft.tier, draft.check, SITE_URL),
    check: draft.check,
    url: SITE_URL,
    tier: draft.tier,
    tier_source: 'site_structure',
    tier_confidence: tierConfidence,
    severity: draft.severity,
    effort_hours: effort,
    opportunity,
    revenue_score: revenueScore({
      tier: draft.tier,
      severity: draft.severity,
      effort_hours: effort,
      opportunity,
      acv: draft.config.acv,
    }),
    confidence: combineConfidence(tierConfidence, measurement),
    evidence: draft.evidence,
    message: draft.message,
    verdict: 'finding',
  };
}
