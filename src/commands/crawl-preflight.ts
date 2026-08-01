import { formatProjection, projectCrawlCost } from '../agent/costguard.js';
import type { CrawlProviderName } from '../config/schema.js';
import { selectCrawlProvider } from '../providers/select.js';
import type { CrawlProvider } from '../providers/types.js';

export async function crawlPreflight(input: {
  args: string[];
  env: NodeJS.ProcessEnv;
  maxUrls: number;
  configured?: CrawlProviderName;
}): Promise<CrawlProvider | undefined> {
  const selection = selectCrawlProvider(input.args, input.env, input.configured);
  if (!selection.provider) {
    console.error(
      `${selection.missingCredential} is required for the ${selection.requested} provider` +
        (selection.source === 'config'
          ? `, which is set as \`crawl.provider\` in rainmaker.config.yml.`
          : '.'),
    );
    return undefined;
  }

  if (selection.requested !== 'builtin') {
    // Naming the source matters when it is the config: that is a decision the
    // user made in an earlier conversation, and spending credits on it now
    // should not look like the tool picked a paid provider on its own.
    console.log(
      selection.source === 'config'
        ? `Using ${selection.requested}, set as \`crawl.provider\` in rainmaker.config.yml.`
        : `Using explicitly selected ${selection.requested} provider.`,
    );
  }

  // The built-in crawler draws on no external budget, so quoting it a spend in
  // credits is simply false — and it undercuts the number when a paid provider
  // really is about to cost something.
  if (selection.provider.name === 'builtin') {
    console.log(`Built-in crawler: up to ${input.maxUrls} URLs, no provider credits.`);
    return selection.provider;
  }

  const remainingCredits = await selection.provider.remainingCredits();
  const projection = projectCrawlCost(
    input.maxUrls,
    remainingCredits,
    input.args.includes('--allow-over-budget'),
  );
  console.log(formatProjection(projection));
  if (!projection.allowed) {
    console.error(projection.reason);
    return undefined;
  }

  return selection.provider;
}
