import type { CrawlProviderName } from '../config/schema.js';
import { createBuiltinProvider } from './builtin.js';
import { createContextDevProvider } from './contextdev.js';
import { createFirecrawlProvider } from './firecrawl.js';
import type { CrawlProvider } from './types.js';

export interface CrawlProviderSelection {
  requested: CrawlProviderName;
  /** Where the choice came from, so the caller can say so before spending anything. */
  source: 'flag' | 'config' | 'default';
  provider?: CrawlProvider;
  missingCredential?: 'FIRECRAWL_API_KEY' | 'CONTEXT_DEV_API_KEY';
}

/**
 * Precedence: flag, then configured provider, then built-in.
 *
 * `crawl.provider` was written into every generated config and read by nothing:
 * this function took argv alone, so a user who answered "use Firecrawl" and had
 * it saved still got a built-in crawl on every run, silently.
 *
 * A configured provider counts as consent. It is only ever written after the
 * user is asked, which is the point of persisting it: asked once, not once per
 * crawl.
 */
export function selectCrawlProvider(
  argv: string[],
  env: NodeJS.ProcessEnv,
  configured?: CrawlProviderName,
): CrawlProviderSelection {
  const index = argv.indexOf('--provider');
  const inline = argv.find((arg) => arg.startsWith('--provider='));
  const flagged = index >= 0 ? argv[index + 1] : inline?.slice('--provider='.length);

  const requested = flagged ?? configured ?? 'builtin';
  const source: CrawlProviderSelection['source'] = flagged
    ? 'flag'
    : configured
      ? 'config'
      : 'default';

  if (requested !== 'builtin' && requested !== 'firecrawl' && requested !== 'contextdev') {
    throw new Error('--provider must be builtin, firecrawl, or contextdev');
  }

  if (requested === 'builtin') {
    return { requested, source, provider: createBuiltinProvider() };
  }
  if (requested === 'firecrawl') {
    return env.FIRECRAWL_API_KEY
      ? { requested, source, provider: createFirecrawlProvider({ apiKey: env.FIRECRAWL_API_KEY }) }
      : { requested, source, missingCredential: 'FIRECRAWL_API_KEY' };
  }
  return env.CONTEXT_DEV_API_KEY
    ? { requested, source, provider: createContextDevProvider({ apiKey: env.CONTEXT_DEV_API_KEY }) }
    : { requested, source, missingCredential: 'CONTEXT_DEV_API_KEY' };
}
