import { formatProjection, projectCrawlCost } from '../agent/costguard.js';
import { selectCrawlProvider } from '../providers/select.js';
import type { CrawlProvider } from '../providers/types.js';

export async function crawlPreflight(input: {
  args: string[];
  env: NodeJS.ProcessEnv;
  maxUrls: number;
}): Promise<CrawlProvider | undefined> {
  const selection = selectCrawlProvider(input.args, input.env);
  if (!selection.provider) {
    console.error(`${selection.missingCredential} is required for --provider ${selection.requested}.`);
    return undefined;
  }

  if (selection.requested !== 'builtin') {
    console.log(`Using explicitly selected ${selection.requested} provider.`);
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
