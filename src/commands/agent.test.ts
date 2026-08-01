import assert from 'node:assert/strict';
import { test } from 'node:test';
import { standaloneModelKeyMessage } from './agent.js';

test('standalone agent key error redirects host assistants instead of blocking them', () => {
  const message = standaloneModelKeyMessage();

  assert.match(message, /standalone terminal mode/i);
  assert.match(message, /cannot use.*subscription/i);
  assert.match(message, /current assistant.*run.*Rainmaker/i);
  assert.match(message, /no model API key/i);
});
