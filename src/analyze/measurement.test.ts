import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Ga4Snapshot } from '../fetch/types.js';
import {
  formatMeasurementWarning,
  measurementState,
  proposeKeyEvents,
} from './measurement.js';

const ga4 = (keyEvents: string[]): Ga4Snapshot =>
  ({
    key_events_configured: keyEvents,
    pages: [],
  }) as unknown as Ga4Snapshot;

test('a connected property with no key events is unmeasured, not healthy', () => {
  assert.equal(measurementState(ga4([])), 'unmeasured');
  assert.equal(measurementState(ga4(['demo_request'])), 'measuring');
  assert.equal(measurementState(null), 'no-analytics');
});

test('only the unmeasured state warns, because the other two are not defects', () => {
  assert.match(formatMeasurementWarning('unmeasured') ?? '', /measures a conversion/);
  assert.equal(formatMeasurementWarning('measuring'), undefined);
  // No analytics at all is already reported as a degraded capability; saying it
  // twice in different words reads as two problems.
  assert.equal(formatMeasurementWarning('no-analytics'), undefined);
});

test('the warning carries the events to create, and says who has to create them', () => {
  const notice = formatMeasurementWarning(
    'unmeasured',
    proposeKeyEvents({ revenue_model: 'consulting', primary_conversion: [] }),
  ) ?? '';

  assert.match(notice, /booking_submit/);
  assert.match(notice, /GA4 Admin, Events/);
  // The read-only guarantee is part of the instruction, not a footnote.
  assert.match(notice, /cannot\s+create these for you/);
});

test('proposals match how the business actually makes money', () => {
  const consulting = proposeKeyEvents({ revenue_model: 'consulting', primary_conversion: [] });
  assert.ok(consulting.some((proposal) => proposal.event === 'booking_submit'));

  const shop = proposeKeyEvents({ revenue_model: 'ecommerce', primary_conversion: [] });
  assert.ok(shop.some((proposal) => proposal.event === 'purchase'));
  assert.ok(!shop.some((proposal) => proposal.event === 'booking_submit'));
});

test('an unknown revenue model still proposes something rather than nothing', () => {
  const proposals = proposeKeyEvents({ revenue_model: 'unknown', primary_conversion: [] });
  assert.ok(proposals.length > 0);
  assert.match(proposals[0].because, /until the revenue model is confirmed/);
});

test('a declared conversion path earns its own event', () => {
  const proposals = proposeKeyEvents({
    revenue_model: 'consulting',
    primary_conversion: ['/hire-me'],
  });
  const own = proposals.find((proposal) => proposal.event === 'hire_me_submit');
  assert.ok(own, `expected an event for /hire-me, got ${proposals.map((p) => p.event).join(', ')}`);
  assert.match(own.action, /\/hire-me/);
});

test('tier 0 pages stand in when nothing is declared yet', () => {
  const proposals = proposeKeyEvents(
    { revenue_model: 'unknown', primary_conversion: [] },
    ['/contact'],
  );
  assert.ok(proposals.some((proposal) => proposal.event === 'contact_submit'));
});

test('never more than three, because a longer list does not get done', () => {
  const proposals = proposeKeyEvents({
    revenue_model: 'ecommerce',
    primary_conversion: ['/checkout', '/cart', '/upsell', '/gift'],
  });
  assert.ok(proposals.length <= 3, `got ${proposals.length}`);
});

test('every proposal says what the visitor did and why it is worth measuring', () => {
  for (const model of ['sales-led', 'plg', 'ads', 'newsletter'] as const) {
    for (const proposal of proposeKeyEvents({ revenue_model: model, primary_conversion: [] })) {
      assert.match(proposal.event, /^[a-z0-9_]+$/, `${proposal.event} is not a GA4 event name`);
      assert.ok(proposal.action.length > 0, `${proposal.event} does not say what happened`);
      assert.ok(proposal.because.length > 0, `${proposal.event} does not say why`);
    }
  }
});
