import type { CrawlProviderName } from '../config/schema.js';
import { createBuiltinProvider } from './builtin.js';
import { createContextDevProvider } from './contextdev.js';
import { createFirecrawlProvider } from './firecrawl.js';
import type { CrawlProvider } from './types.js';

export interface CrawlProviderSelection {
  requested: CrawlProviderName;
  provider?: CrawlProvider;
  missingCredential?: 'FIRECRAWL_API_KEY' | 'CONTEXT_DEV_API_KEY';
}

export function selectCrawlProvider(
  argv: string[],
  env: NodeJS.ProcessEnv,
): CrawlProviderSelection {
  const index = argv.indexOf('--provider');
  const inline = argv.find((arg) => arg.startsWith('--provider='));
  const requested = index >= 0 ? argv[index + 1] : inline?.slice('--provider='.length) ?? 'builtin';
  if (requested !== 'builtin' && requested !== 'firecrawl' && requested !== 'contextdev') {
    throw new Error('--provider must be builtin, firecrawl, or contextdev');
  }

  if (requested === 'builtin') {
    return { requested, provider: createBuiltinProvider() };
  }
  if (requested === 'firecrawl') {
    return env.FIRECRAWL_API_KEY
      ? { requested, provider: createFirecrawlProvider({ apiKey: env.FIRECRAWL_API_KEY }) }
      : { requested, missingCredential: 'FIRECRAWL_API_KEY' };
  }
  return env.CONTEXT_DEV_API_KEY
    ? { requested, provider: createContextDevProvider({ apiKey: env.CONTEXT_DEV_API_KEY }) }
    : { requested, missingCredential: 'CONTEXT_DEV_API_KEY' };
}
