import type { RainmakerConfig } from '../config/schema.js';
import type { BusinessDoc } from './business.js';

/**
 * A stub context, built from config alone.
 *
 * Its purpose is to unblock, not to pretend. Everything here is marked
 * `confidence: stub`, every downstream report says so, and every section names
 * what a real interview would replace. A user in a hurry is never blocked, and
 * is never told a guess is a finding.
 */
export function stubBusiness(config: RainmakerConfig, generatedAt: string): BusinessDoc {
  const site = config.site.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const competitors = config.competitors ?? [];

  const body = `# Business Context

> Stub, written by \`rainmaker context --init\` from rainmaker.config.yml.
> Nothing here came from a buyer. Run the \`know-my-buyer\` skill to replace it.
> Until then every report is stamped \`confidence: stub\`.

## One-liner

${site} sells to ${config.icp_hint || 'an unstated buyer'}. Replace this with what they buy and the outcome they get.

## Category and revenue model

Revenue model: ${config.revenue_model}. Average contract value: ${config.acv || 'unstated'}. Sales cycle: ${config.sales_cycle_days} days.

## Who buys

### Segment

${config.icp_hint || 'Unstated. This is the first thing know-my-buyer will ask about.'}

### Personas

| id | Title | Role in deal | Cares about | Will kill the deal over |
|---|---|---|---|---|
| p1 | unknown | champion | unknown | unknown |

## Pain points, in the buyer's own words

### pp1: unstated

- **They say:** not yet recorded. A pain point with no verbatim buyer language is a hypothesis.
- **Source:** none
- **Costs them:** unknown
- **Status:** hypothesis

## Proof

| id | Kind | Claim | Source | Strength |
|---|---|---|---|---|

No proof recorded. Writing skills will refuse claims that have no proof id.

## Competitors

| Domain | How they position | Where they win | Where we win |
|---|---|---|---|
${competitors.length ? competitors.map((domain) => `| ${domain} | unknown | unknown | unknown |`).join('\n') : '| none declared | | | |'}

## Objections and answers

| Objection | Answer | Proof id |
|---|---|---|

## What we will not say

Nothing declared yet. This section is a hard block on writing skills, so it is
worth filling in before any page is drafted.

## Open questions

- Who signs, and who blocks?
- Which page does sales send before a deal closes?
- What did the last lost deal say in their own words?

## Declared conversions

Primary: ${config.primary_conversion.join(', ') || 'none'}
Secondary: ${config.secondary_conversion?.join(', ') || 'none'}
`;

  return {
    frontmatter: { generated_at: generatedAt, strategy_version: 1, source: 'cli', confidence: 'stub' },
    body,
  };
}

export function stubVoice(): string {
  return `# Voice

## Rules

- No em-dashes anywhere.
- Replace these rules with how this site actually writes.

## Banned phrasings

- leverage
- utilize
- seamless
- robust
- game-changer
- unlock
- elevate
- supercharge

## Samples

No samples recorded. Paste three to five paragraphs of real published writing
here, with source URLs. Writing skills pattern-match against samples, not
against a description of a voice, so this file does nothing until it has some.
`;
}

export function stubGlossary(config: RainmakerConfig): string {
  const brand = config.site.replace(/^https?:\/\//, '').replace(/\..*$/, '');
  return `# Glossary

Product, feature and competitor names with their correct casing. Used to
suppress brand queries in cannibalisation checks and to stop writing skills
inventing a product name.

## Brand tokens

- ${brand}

## Product and feature names

- none recorded

## Competitor names

${(config.competitors ?? []).map((domain) => `- ${domain}`).join('\n') || '- none declared'}
`;
}
