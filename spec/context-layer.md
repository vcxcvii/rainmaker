# paydirt: Context Layer Specification

**Status:** normative. Part of the v2 handoff spec. Where this conflicts with `paydirt-handoff-spec.md` (v1), this wins.

---

## 1. The problem this solves

21 skills each need to know the same things: who the buyer is, what they call their pain, what the site sells, what counts as proof, which competitors matter, how the owner writes. Without one shared layer, each skill re-derives that from whatever it happens to read, and the system produces 21 slightly different opinions about the same business. Judgment drifts, tone drifts, and the reports contradict each other.

The context layer is one canonical answer to those questions, loaded identically by every skill.

## 2. Two artifacts, one truth

| Artifact | Format | Canonical for | Written by | Read by |
|---|---|---|---|---|
| `context/business.md` | prose Markdown, human-editable | judgment, nuance, buyer language, voice | `grill-me`, then hand-edited by the owner | every judgment skill |
| `data/strategy.json` | typed JSON | machine fields: ids, clusters, keyword slots, statuses | `grill-me`, `buyer-sharpener`, `revenue-map`, `topic-map`, `keyword-plan` | skills and `src/` |

They are not duplicates. `business.md` holds sentences a human argues with. `strategy.json` holds the same commitments as addressable records that code can join against `diagnosis.json` and `ledger.jsonl`.

**Binding rule.** Every pain point, persona, competitor and proof point exists in both, sharing one `id`. Prose without a record is invisible to scoring. A record without prose is unusable by a writing skill. A skill that adds one must add the other in the same run.

## 3. `context/` layout

```
context/
├── business.md      canonical prose context. Committed. Never contains metrics.
├── voice.md         how this owner writes. Committed.
├── glossary.md      site-specific terms, product names, competitor names. Committed.
└── history/
    └── <ISO8601>-<reason-slug>.md   prior business.md versions, committed
```

`context/` is committed. It contains positioning, not traffic. `data/` stays gitignored because it contains real numbers.

### 3.1 `business.md` template

Frontmatter is mandatory and machine-parsed.

```markdown
---
generated_at: 2026-08-12T09:00:00Z
strategy_version: 3
source: grill-me
confidence: interviewed          # interviewed | inferred | stub
---

# Business Context

## One-liner
<one sentence. What the company sells, to whom, for what outcome.>

## Category and revenue model
<the category the buyer already shops in, and how money is made. Matches config.revenue_model.>

## Who buys
### Segment
<firmographics: size, stage, industry, geography, and explicit disqualifiers.>

### Personas
| id | Title | Role in deal | Cares about | Will kill the deal over |
|---|---|---|---|---|
| p1 | ... | champion / economic / technical / user / blocker | ... | ... |

## Pain points, in the buyer's own words
<one subsection per pain point. Quote the buyer. Paraphrase is a downgrade and must be marked.>

### pp1: <short name>
- **They say:** "<verbatim quote or closest recorded phrasing>"
- **Source:** <sales call, review site, support ticket, GSC query, interview date>
- **Costs them:** <consequence in their terms>
- **Status:** hypothesis | validated | retired

## Proof
| id | Kind | Claim | Source | Strength |
|---|---|---|---|---|
| pr1 | case_study / metric / quote / benchmark | ... | url | strong / medium / weak |

## Competitors
| Domain | How they position | Where they win | Where we win |
|---|---|---|---|

## Objections and answers
| Objection | Answer | Proof id |
|---|---|---|

## What we will not say
<claims that are unsupported, legally risky, or off-positioning. Writing skills treat this as a hard block.>

## Open questions
<what grill-me could not settle. Each line is a candidate question for the next interview.>
```

### 3.2 `voice.md`

Not optional and not decorative. `draft-punch-up` and the slop gate both read it.

```markdown
# Voice

## Rules
- No em-dashes anywhere. The owner's published posts contain none, so an em-dash reads as machine-written.
- <sentence length ceiling, person, tense, contraction policy>

## Banned phrasings
<list. Seeds the slop check in section 11.3 of the core spec, in addition to the fixed list there.>

## Samples
<3 to 5 paragraphs of the owner's real published writing, verbatim, with source URLs. Skills pattern-match against these rather than against a description of the voice.>
```

### 3.3 `glossary.md`

Product names, feature names, internal shorthand, competitor names and their correct casing. Prevents a writing skill inventing a product name and a crawl check flagging a brand term as a typo.

## 4. `data/strategy.json` schema

```ts
export interface Strategy {
  version: number;                 // increments on every write, never reused
  generated_at: string;            // ISO 8601 UTC
  context_hash: string;            // sha256 of context/business.md at write time
  written_by: SkillName[];         // every skill that has contributed, in order
  icp: {
    segment: string;
    employee_range: [number, number] | null;
    industries: string[];
    geographies: string[];
    disqualifiers: string[];
  };
  personas: Persona[];
  pain_points: PainPoint[];
  proof: ProofPoint[];
  competitors: Competitor[];
  clusters: Cluster[];
  keyword_plan: KeywordSlot[];
  messaging: {
    one_liner: string;
    category: string;
    differentiators: string[];
    objection_handling: { objection: string; response: string; proof_id: string | null }[];
  };
  decisions: StrategyDecision[];   // append-only within the file
}

export interface Persona {
  id: string;                      // p1, p2, ...
  title: string;
  role_in_deal: 'champion' | 'economic' | 'technical' | 'user' | 'blocker';
  cares_about: string[];
  objections: string[];
}

export interface PainPoint {
  id: string;                      // pp1, pp2, ...
  statement: string;               // one sentence, the analyst's framing
  buyer_language: string[];        // verbatim phrasings. Empty array is a defect after grill-me.
  evidence: { type: 'interview' | 'gsc_query' | 'review' | 'support' | 'sales_call'; ref: string }[];
  persona_ids: string[];
  tier_hint: 0 | 1 | 2 | 3 | 4;
  status: 'hypothesis' | 'validated' | 'retired';
  retired_reason: string | null;
}

export interface ProofPoint {
  id: string;                      // pr1, ...
  kind: 'case_study' | 'metric' | 'quote' | 'benchmark';
  claim: string;
  source_url: string | null;
  strength: 'strong' | 'medium' | 'weak';
}

export interface Competitor {
  domain: string;
  positioning: string;
  where_they_win: string[];
  where_we_win: string[];
  evidence_urls: string[];
}

export interface Cluster {
  id: string;                      // c1, ...
  pain_point_ids: string[];
  intent: 'transactional' | 'commercial' | 'solution' | 'informational';
  target_tier: 0 | 1 | 2 | 3 | 4;
  head_query: string;
  support_queries: string[];
  existing_urls: string[];         // from crawl.json, normalised paths
  gap: 'none' | 'thin' | 'missing';
}

export interface KeywordSlot {
  cluster_id: string;
  query: string;
  impressions: number;             // 0 when no GSC data
  position: number | null;
  slot: 'new' | 'refresh' | 'consolidate' | 'kill';
  target_url: string | null;
  priority_score: number;          // computed by src/, never by a skill
}

export interface StrategyDecision {
  ts: string;
  field: string;                   // dotted path, e.g. "pain_points.pp3.status"
  from: string | null;
  to: string;
  reason: string;                  // <= 200 chars
  source: SkillName;
}
```

`SkillName` is a closed union in `src/analyze/skills.ts` listing the 21 names.

### 4.1 Write ownership

A skill may only write the fields it owns. Enforced by `paydirt context --validate`, which fails the run if a field changed and the writing skill is not its owner.

| Field | Owner | Others may |
|---|---|---|
| `icp`, `personas` | `grill-me` | `buyer-sharpener` may amend with a `decisions` entry |
| `pain_points[].buyer_language` | `grill-me`, `buyer-sharpener` | read only |
| `pain_points[].status` | `buyer-sharpener`, `where-we-stand` | read only |
| `proof` | `grill-me` | `competitor-teardown` may append `benchmark` kinds |
| `competitors` | `competitor-teardown` | read only |
| `clusters` | `topic-map` | `revenue-map` sets `target_tier` |
| `keyword_plan` | `keyword-plan` | `content-refresh` may set `slot` |
| `messaging` | `buyer-sharpener` | read only |
| `decisions` | all writers, append only | never edit |

### 4.2 Additive mutation

No skill deletes a record. Retirement is `status: 'retired'` plus `retired_reason` plus a `decisions` entry. `version` increments. The prior `strategy.json` is copied to `data/strategy-history/<version>-<ts>.json` before the write.

## 5. Loading protocol

Every judgment skill opens with the identical block below, copied verbatim into its `SKILL.md`. This is the shared entry point that makes 21 skills one system.

```markdown
## Context load

Run `npx paydirt context --check` first. It prints what exists, what is stale, and exits 1 if anything this skill requires is missing.

Then read, in this order:
1. `context/business.md` in full. If absent, stop: "No business context. Run `npx paydirt audit`, then the `grill-me` skill."
2. `context/voice.md` if this skill writes prose. If absent, stop and say so.
3. `data/strategy.json` if this skill reads or writes strategy.
4. Only the `data/` files listed in this skill's Requires table. Never crawl or call an API the core already covers.

If `strategy.json.context_hash` does not match the current sha256 of `context/business.md`, say exactly:
"Business context was edited after the strategy was written. Re-run `grill-me`, or run `npx paydirt context --sync` to accept the prose as authoritative."
Then stop.
```

## 6. `paydirt context` command

New CLI subcommand. Added to section 8 of the core spec.

```
paydirt context --check       print presence and freshness of context files and data
paydirt context --validate    schema-check strategy.json; verify write-ownership; exit 1 on violation
paydirt context --sync        recompute context_hash from business.md, bump version, record a decisions entry
paydirt context --init        write a stub business.md from paydirt.config.yml with confidence: stub
```

`--check` output:

```
context/business.md    present    strategy_version 3, interviewed, 2026-08-12
context/voice.md       present    5 samples
context/glossary.md    MISSING    writing skills will not know product names
data/strategy.json     present    version 3, hash matches
data/state.json        present    412 findings, ledger 1830 lines
snapshots/latest       2026-08-12T09:00:00Z  crawl gsc ga4, clarity missing
```

`--init` exists so a first-time user is never blocked: a stub context is legal, marked `confidence: stub`, and every report built on a stub says so in section 5 of the report spine.

## 7. Shared references

```
skills/_shared/
├── context-load.md      the block in section 5, included by every SKILL.md
├── revenue-tiers.md     tier definitions and weights, human-readable
├── metric-definitions.md  owned by metrics-decoder, cited by all
├── voice-rules.md       the fixed slop list from core spec 11.3
└── evidence-rules.md    how to cite a number: source file, field, window, confidence
```

Skills reference these by relative path. No skill restates their content. If a skill needs a rule that belongs in a shared file, it adds it there.

### 7.1 `evidence-rules.md`, in short

Every number a skill states must carry: the file it came from, the field, the window, and the confidence from section 4.6 of the core spec. Format:

```
1,240 impressions (gsc.json, 28d to 2026-08-09, confidence 0.7)
```

A skill that states a number without provenance is producing a defect, not a report.

## 8. Cold start

The system must be useful before any interview happens.

| State | What works | What refuses |
|---|---|---|
| No config | nothing | `init` prompts |
| Config, no credentials | `audit`, `site-health-check`, `ai-search-check`, `competitor-teardown` | anything reading `gsc.json` or `ga4.json` |
| Audit run, no context | all diagnostic skills | every skill reading `strategy.json` |
| Context stub via `--init` | all skills, outputs stamped `confidence: stub` | nothing |
| Interviewed context | everything at full confidence | nothing |

Refusal text always names the exact command that unblocks it. A skill that stops without naming the next command is a defect.
