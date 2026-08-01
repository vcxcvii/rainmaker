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

/** Current default. Older ids still work; they are just a generation behind. */
export const DEFAULT_ANTHROPIC_MODEL = 'claude-opus-5';

/** Trailing slashes are easy to leave on an env var and produce a 404 path. */
function normaliseBaseUrl(url: string | undefined, fallback: string): string {
  return (url || fallback).replace(/\/+$/, '');
}

export function createAnthropicProvider(options: {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  fetcher?: typeof fetch;
}): ModelProvider {
  const fetcher = options.fetcher ?? fetch;
  const model = options.model ?? DEFAULT_ANTHROPIC_MODEL;
  const baseUrl = normaliseBaseUrl(options.baseUrl, 'https://api.anthropic.com');

  return {
    name: 'anthropic',
    async complete(system, messages) {
      const response = await fetcher(`${baseUrl}/v1/messages`, {
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

export const DEFAULT_OPENAI_MODEL = 'gpt-4.1';

/**
 * Also the door to every other model. The OpenAI chat-completions shape is the
 * de facto interchange format, so pointing `baseUrl` at OpenRouter, Groq,
 * Gemini's compatibility endpoint, Ollama, LM Studio or vLLM makes those work
 * without a provider implementation each.
 */
export function createOpenAIProvider(options: {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  fetcher?: typeof fetch;
}): ModelProvider {
  const fetcher = options.fetcher ?? fetch;
  const model = options.model ?? DEFAULT_OPENAI_MODEL;
  const baseUrl = normaliseBaseUrl(options.baseUrl, 'https://api.openai.com');

  return {
    name: 'openai',
    async complete(system, messages) {
      const response = await fetcher(`${baseUrl}/v1/chat/completions`, {
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
 *
 * `RAINMAKER_MODEL` and the two base-URL variables are what make "bring your
 * own model" true rather than "bring your own key to one of two vendors".
 * Anything speaking the OpenAI chat-completions shape is reachable with
 * `OPENAI_API_KEY` plus `OPENAI_BASE_URL`, including local models.
 */
export function selectProvider(
  env: NodeJS.ProcessEnv,
  options: { fetcher?: typeof fetch } = {},
): ModelProvider | null {
  const model = env.RAINMAKER_MODEL || undefined;

  if (env.ANTHROPIC_API_KEY) {
    return createAnthropicProvider({
      apiKey: env.ANTHROPIC_API_KEY,
      model,
      baseUrl: env.ANTHROPIC_BASE_URL,
      fetcher: options.fetcher,
    });
  }
  if (env.OPENAI_API_KEY) {
    return createOpenAIProvider({
      apiKey: env.OPENAI_API_KEY,
      model,
      baseUrl: env.OPENAI_BASE_URL,
      fetcher: options.fetcher,
    });
  }
  return null;
}
