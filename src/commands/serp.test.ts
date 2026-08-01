import assert from 'node:assert/strict';
import { test } from 'node:test';
import { paidSearchApproved } from './serp.js';

test('SERP capture requires an explicit paid-provider acknowledgement', () => {
  assert.equal(paidSearchApproved(['b2b seo']), false);
  assert.equal(paidSearchApproved(['--allow-paid', 'b2b seo']), true);
});
