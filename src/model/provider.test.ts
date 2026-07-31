import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAnthropicProvider, createOpenAIProvider, selectProvider } from './provider.js';

function fakeFetcher(handler: (url: string, init: RequestInit) => Response): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    return handler(url, init ?? {});
  }) as typeof fetch;
}

test('the Anthropic provider sends system separately and parses a text block', async () => {
  const captured: { body: Record<string, unknown> | null; headers: Record<string, string> | null } = {
    body: null,
    headers: null,
  };

  const provider = createAnthropicProvider({
    apiKey: 'sk-ant-test',
    fetcher: fakeFetcher((url, init) => {
      captured.body = JSON.parse(String(init.body));
      captured.headers = init.headers as Record<string, string>;
      assert.equal(url, 'https://api.anthropic.com/v1/messages');
      return new Response(JSON.stringify({ content: [{ type: 'text', text: 'What is your ICP?' }] }), { status: 200 });
    }),
  });

  const reply = await provider.complete('You are an interviewer.', [{ role: 'user', content: 'go' }]);

  assert.equal(reply, 'What is your ICP?');
  assert.equal(captured.headers?.['x-api-key'], 'sk-ant-test');
  assert.equal(captured.body?.system, 'You are an interviewer.');
  assert.deepEqual(captured.body?.messages, [{ role: 'user', content: 'go' }]);
});

test('the Anthropic provider surfaces the API error message on failure', async () => {
  const provider = createAnthropicProvider({
    apiKey: 'bad-key',
    fetcher: fakeFetcher(() => new Response(JSON.stringify({ error: { message: 'invalid x-api-key' } }), { status: 401 })),
  });

  await assert.rejects(() => provider.complete('sys', []), /invalid x-api-key/);
});

test('the OpenAI provider puts system inline in the messages array', async () => {
  const captured: { body: Record<string, unknown> | null } = { body: null };

  const provider = createOpenAIProvider({
    apiKey: 'sk-oai-test',
    fetcher: fakeFetcher((url, init) => {
      captured.body = JSON.parse(String(init.body));
      assert.equal(url, 'https://api.openai.com/v1/chat/completions');
      return new Response(JSON.stringify({ choices: [{ message: { content: 'Who is your ICP?' } }] }), { status: 200 });
    }),
  });

  const reply = await provider.complete('You are an interviewer.', [{ role: 'user', content: 'go' }]);

  assert.equal(reply, 'Who is your ICP?');
  assert.deepEqual((captured.body?.messages as unknown[])[0], { role: 'system', content: 'You are an interviewer.' });
});

test('the OpenAI provider surfaces the API error message on failure', async () => {
  const provider = createOpenAIProvider({
    apiKey: 'bad-key',
    fetcher: fakeFetcher(() => new Response(JSON.stringify({ error: { message: 'invalid api key' } }), { status: 401 })),
  });

  await assert.rejects(() => provider.complete('sys', []), /invalid api key/);
});

test('selectProvider prefers Anthropic over OpenAI when both are set', () => {
  const provider = selectProvider({ ANTHROPIC_API_KEY: 'a', OPENAI_API_KEY: 'b' } as NodeJS.ProcessEnv);
  assert.equal(provider?.name, 'anthropic');
});

test('selectProvider falls back to OpenAI when only it is set', () => {
  const provider = selectProvider({ OPENAI_API_KEY: 'b' } as NodeJS.ProcessEnv);
  assert.equal(provider?.name, 'openai');
});

test('selectProvider returns null with neither key set', () => {
  assert.equal(selectProvider({} as NodeJS.ProcessEnv), null);
});
