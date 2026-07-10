import type { Finding } from "./finding-extractor.js";

export interface Suggestion {
  title: string;
  body: string;
}

const SUGGESTIONS: Record<string, (f: Finding) => Suggestion> = {
  DeadClickCount: (f) => ({
    title: `[Lazarus Pit] Dead clicks detected`,
    body: [
      `**Metric:** DeadClickCount — ${f.value}% of sessions (threshold ${f.threshold}%)`,
      ``,
      `**Hypothesis:** ${f.hypothesis}`,
      ``,
      `**Suggested fix:** Audit elements styled like links/buttons (underline, pointer cursor, brand color) that aren't wired to an action. Common culprits: static badges, disabled-looking CTAs, icons without href. Check against the site's existing button/link component — dead clicks usually mean a non-interactive element borrowed interactive styling.`,
    ].join("\n"),
  }),
  RageClickCount: (f) => ({
    title: `[Lazarus Pit] Rage clicks detected`,
    body: [
      `**Metric:** RageClickCount — ${f.value}% of sessions (threshold ${f.threshold}%)`,
      ``,
      `**Hypothesis:** ${f.hypothesis}`,
      ``,
      `**Suggested fix:** Add visible loading/pressed state to the affected interactive element, or fix the underlying slow handler. If it's a link, verify it isn't silently failing (404, JS error blocking navigation).`,
    ].join("\n"),
  }),
  QuickbackClick: (f) => ({
    title: `[Lazarus Pit] High quickback rate`,
    body: [
      `**Metric:** QuickbackClick — ${f.value}% of sessions (threshold ${f.threshold}%)`,
      ``,
      `**Hypothesis:** ${f.hypothesis}`,
      ``,
      `**Suggested fix:** Compare link/CTA copy against destination page's H1 and first paragraph — mismatch here is the most common cause. Also check destination load time; slow pages get quickbacked too.`,
    ].join("\n"),
  }),
  ScriptErrorCount: (f) => ({
    title: `[Lazarus Pit] Script errors detected`,
    body: [
      `**Metric:** ScriptErrorCount — ${f.value}% of sessions (threshold ${f.threshold}%)`,
      ``,
      `**Hypothesis:** ${f.hypothesis}`,
      ``,
      `**Suggested fix:** Pull stack traces from Clarity session recordings directly (dashboard, not API) for this metric — the export API doesn't include trace detail. Cross-check against recent deploys.`,
    ].join("\n"),
  }),
  ErrorClickCount: (f) => ({
    title: `[Lazarus Pit] Clicks triggering errors`,
    body: [
      `**Metric:** ErrorClickCount — ${f.value}% of sessions (threshold ${f.threshold}%)`,
      ``,
      `**Hypothesis:** ${f.hypothesis}`,
      ``,
      `**Suggested fix:** Watch a session replay for this metric in the Clarity dashboard to identify the exact element, then check its handler for null refs or race conditions.`,
    ].join("\n"),
  }),
  ScrollDepth: (f) => ({
    title: `[Lazarus Pit] Low average scroll depth`,
    body: [
      `**Metric:** ScrollDepth — average ${f.value}% (threshold ${f.threshold}%)`,
      ``,
      `**Hypothesis:** ${f.hypothesis}`,
      ``,
      `**Suggested fix:** Move highest-value content (key CTA, core message) above the fold, or shorten the page. If key content is intentionally deep, consider a sticky in-page nav or progress indicator to encourage continued scroll.`,
    ].join("\n"),
  }),
};

export function mapFindingToSuggestion(finding: Finding): Suggestion {
  const mapper = SUGGESTIONS[finding.metric];
  if (!mapper) {
    return {
      title: `[Lazarus Pit] ${finding.metric} anomaly`,
      body: `**Metric:** ${finding.metric} — ${finding.value} (threshold ${finding.threshold})\n\n**Hypothesis:** ${finding.hypothesis}`,
    };
  }
  return mapper(finding);
}
