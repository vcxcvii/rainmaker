import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ContextError, type BusinessFrontmatter, type ConfidenceLevel } from './types.js';

export const CONTEXT_DIR = 'context';
export const BUSINESS_PATH = join(CONTEXT_DIR, 'business.md');
export const VOICE_PATH = join(CONTEXT_DIR, 'voice.md');
export const GLOSSARY_PATH = join(CONTEXT_DIR, 'glossary.md');

export interface BusinessDoc {
  frontmatter: BusinessFrontmatter;
  /** Everything after the frontmatter. This is what gets hashed. */
  body: string;
}

/**
 * Hashes the body only, never the frontmatter.
 *
 * The frontmatter carries `strategy_version`, which a strategy write bumps.
 * Hashing the whole file would mean every write invalidated its own hash on
 * the next read, and the drift check would fire constantly on nothing.
 */
export function hashBody(body: string): string {
  // Trimmed at both ends: rendering adds a blank line after the frontmatter,
  // so an untrimmed hash would differ between the document in memory and the
  // same document read back from disk, and drift would fire on nothing.
  return createHash('sha256').update(body.trim(), 'utf8').digest('hex');
}

export function parseBusiness(raw: string): BusinessDoc {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(raw);
  if (!match) throw new ContextError('context/business.md is missing its frontmatter block');

  const fields: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const pair = /^([a-z_]+):\s*(.*)$/.exec(line.trim());
    if (pair) fields[pair[1]] = pair[2].trim();
  }

  const version = Number(fields.strategy_version);
  if (!fields.generated_at || Number.isNaN(version)) {
    throw new ContextError('business.md frontmatter needs generated_at and strategy_version');
  }

  return {
    frontmatter: {
      generated_at: fields.generated_at,
      strategy_version: version,
      source: (fields.source || 'cli') as BusinessFrontmatter['source'],
      confidence: (fields.confidence || 'stub') as ConfidenceLevel,
    },
    body: match[2],
  };
}

export function readBusiness(path = BUSINESS_PATH): BusinessDoc {
  if (!existsSync(path)) {
    throw new ContextError(
      'No business context. Run `rainmaker audit`, then the `know-my-buyer` skill, ' +
        'or `rainmaker context --init` for a stub.',
    );
  }
  return parseBusiness(readFileSync(path, 'utf8'));
}

export function renderBusiness(doc: BusinessDoc): string {
  const { generated_at, strategy_version, source, confidence } = doc.frontmatter;
  return [
    '---',
    `generated_at: ${generated_at}`,
    `strategy_version: ${strategy_version}`,
    `source: ${source}`,
    `confidence: ${confidence}`,
    '---',
    '',
    doc.body.replace(/^\n+/, ''),
  ].join('\n');
}

export function writeBusiness(doc: BusinessDoc, path = BUSINESS_PATH): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, renderBusiness(doc), 'utf8');
}
