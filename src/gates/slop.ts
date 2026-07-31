/**
 * The slop check, in code. Enforces the fixed floor from
 * skills/_shared/voice-rules.md so preflight can gate on it deterministically
 * rather than relying on a skill remembering to apply it.
 */

const OPENING_CLICHES = [
  /^in today['’]?s/i,
  /^in the world of/i,
  /^let['’]?s dive in/i,
  /^in an era where/i,
];

const SLOP_WORDS = [
  'leverage', 'utilize', 'seamless', 'robust', 'game-changer', 'unlock',
  'elevate', 'supercharge', 'delve', 'landscape', 'realm', 'tapestry',
];

export interface SlopViolation {
  rule: 'opening_cliche' | 'em_dash' | 'slop_vocabulary' | 'long_sentence' | 'filler_triads';
  detail: string;
}

function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).filter((sentence) => sentence.trim().length > 0);
}

export function checkSlop(text: string): { passed: boolean; violations: SlopViolation[] } {
  const violations: SlopViolation[] = [];
  const trimmed = text.trim();

  if (OPENING_CLICHES.some((pattern) => pattern.test(trimmed))) {
    violations.push({ rule: 'opening_cliche', detail: 'opens with a cliched phrase' });
  }

  if (text.includes('—')) {
    violations.push({ rule: 'em_dash', detail: 'contains an em-dash' });
  }

  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const slopHits = SLOP_WORDS.reduce(
    (total, word) => total + words.filter((candidate) => candidate.replace(/[^a-z-]/g, '') === word).length,
    0,
  );
  if (wordCount > 0 && slopHits / wordCount > 1 / 500) {
    violations.push({ rule: 'slop_vocabulary', detail: `${slopHits} slop word(s) in ${wordCount} words, above 1 per 500` });
  }

  for (const sentence of sentences(text)) {
    const sentenceWords = sentence.split(/\s+/).filter(Boolean).length;
    if (sentenceWords > 40) {
      violations.push({ rule: 'long_sentence', detail: `a ${sentenceWords}-word sentence exceeds 40 words` });
      break;
    }
  }

  return { passed: violations.length === 0, violations };
}
