/**
 * Model providers for `rainmaker agent`. Raw fetch, no SDK, matching the rest
 * of this codebase's style (see src/providers/firecrawl.ts): a fetcher is
 * always injectable so this is testable without a live key or network call.
 *
 * Bring your own key. Nothing here is a hosted service; each provider talks
 * directly to the API it belongs to.
 */

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ModelProvider {
  readonly name: 'anthropic' | 'openai';
  complete(system: string, messages: ChatMessage[]): Promise<string>;
}

async function readJson(response: Response, label: string): Promise<Record<string, unknown>> {
  const payload = (await response.json()) as Record<string, unknown> | null;
  if (!response.ok) {
    const error = payload && typeof payload === 'object' ? (payload as { error?: unknown }).error : undefined;
    const detail =
      error && typeof error === 'object' && 'message' in error
        ? String((error as { message: unknown }).message)
        : `HTTP ${response.status}`;
    throw new Error(`${label}: ${detail}`);
  }
  if (!payload) throw new Error(`${label}: empty response`);
  return payload;
}

export function createAnthropicProvider(options: {
  apiKey: string;
  model?: string;
  fetcher?: typeof fetch;
}): ModelProvider {
  const fetcher = options.fetcher ?? fetch;
  const model = options.model ?? 'claude-sonnet-4-5';

  return {
    name: 'anthropic',
    async complete(system, messages) {
      const response = await fetcher('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': options.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          system,
          messages: messages.map((message) => ({ role: message.role, content: message.content })),
        }),
      });
      const payload = await readJson(response, 'Anthropic');
      const content = payload.content;
      if (!Array.isArray(content)) throw new Error('Anthropic: no content in response');
      const text = content.find((block): block is { type: string; text: string } =>
        Boolean(block && typeof block === 'object' && (block as { type?: unknown }).type === 'text'),
      );
      if (!text) throw new Error('Anthropic: no text block in response');
      return text.text;
    },
  };
}

export function createOpenAIProvider(options: {
  apiKey: string;
  model?: string;
  fetcher?: typeof fetch;
}): ModelProvider {
  const fetcher = options.fetcher ?? fetch;
  const model = options.model ?? 'gpt-4.1';

  return {
    name: 'openai',
    async complete(system, messages) {
      const response = await fetcher('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${options.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: system }, ...messages],
        }),
      });
      const payload = await readJson(response, 'OpenAI');
      const choices = payload.choices;
      if (!Array.isArray(choices) || choices.length === 0) throw new Error('OpenAI: no choices in response');
      const message = (choices[0] as { message?: { content?: unknown } }).message;
      if (!message || typeof message.content !== 'string') throw new Error('OpenAI: no message content in response');
      return message.content;
    },
  };
}

/**
 * Anthropic first, then OpenAI, matching the order both are listed everywhere
 * else in the spec. Returns null rather than throwing: the caller decides how
 * to explain the absence, since `rainmaker agent` and a citation probe need
 * different refusal text for the same missing key.
 */
export function selectProvider(
  env: NodeJS.ProcessEnv,
  options: { fetcher?: typeof fetch } = {},
): ModelProvider | null {
  if (env.ANTHROPIC_API_KEY) {
    return createAnthropicProvider({ apiKey: env.ANTHROPIC_API_KEY, fetcher: options.fetcher });
  }
  if (env.OPENAI_API_KEY) {
    return createOpenAIProvider({ apiKey: env.OPENAI_API_KEY, fetcher: options.fetcher });
  }
  return null;
}
