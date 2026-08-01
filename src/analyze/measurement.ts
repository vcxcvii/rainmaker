import type { RainmakerConfig, RevenueModel } from '../config/schema.js';
import type { Ga4Snapshot } from '../fetch/types.js';

/**
 * Whether the site measures a conversion at all, and what to do when it does not.
 *
 * GA4 reports sessions whether or not anything is defined as a key event, so a
 * connected property looks healthy while measuring nothing. Tiering already
 * handles the empty case correctly by declining to use it (`ga4Rule` returns
 * null), which is right and completely silent: the audit falls back to URL
 * patterns, every score loses its measured input, and nothing anywhere says
 * why.
 *
 * That is the difference between "GA4 connected" and "GA4 useful", and it is
 * the single highest-leverage thing a new site can fix. It cannot be fixed from
 * here: creating a key event needs write scope, and Rainmaker holds
 * `analytics.readonly` deliberately. So this proposes and instructs, and the
 * user clicks.
 */

export type MeasurementState = 'unmeasured' | 'measuring' | 'no-analytics';

export interface KeyEventProposal {
  /** GA4 event name, snake_case, as the UI expects it. */
  event: string;
  /** What the visitor did, in the user's language rather than GA4's. */
  action: string;
  /** Why it is worth measuring for this revenue model. */
  because: string;
}

export function measurementState(ga4: Ga4Snapshot | null | undefined): MeasurementState {
  if (!ga4) return 'no-analytics';
  return ga4.key_events_configured.length === 0 ? 'unmeasured' : 'measuring';
}

const BY_MODEL: Record<RevenueModel, KeyEventProposal[]> = {
  'sales-led': [
    { event: 'demo_request', action: 'submits the demo form', because: 'it is the moment a lead becomes a pipeline opportunity' },
    { event: 'contact_submit', action: 'submits any contact form', because: 'it catches intent that never reaches the demo form' },
  ],
  'self-serve': [
    { event: 'sign_up', action: 'creates an account', because: 'it is the first irreversible commitment' },
    { event: 'begin_checkout', action: 'starts paying', because: 'it separates interest from intent to buy' },
  ],
  plg: [
    { event: 'sign_up', action: 'creates an account', because: 'the product is the funnel, so activation starts here' },
    { event: 'first_value_action', action: 'does the thing the product is for, once', because: 'signups without it never convert' },
  ],
  ecommerce: [
    { event: 'purchase', action: 'completes an order', because: 'it is the revenue event' },
    { event: 'begin_checkout', action: 'starts checkout', because: 'it locates where orders are being lost' },
  ],
  marketplace: [
    { event: 'listing_contact', action: 'contacts a seller or lister', because: 'it is where the two sides actually meet' },
    { event: 'sign_up', action: 'joins either side', because: 'supply and demand both need measuring' },
  ],
  'local-services': [
    { event: 'booking_submit', action: 'books an appointment', because: 'it is the revenue event' },
    { event: 'call_click', action: 'taps the phone number', because: 'most local intent converts by phone and is otherwise invisible' },
  ],
  consulting: [
    { event: 'booking_submit', action: 'books a call', because: 'it is the only step that reliably precedes a paid engagement' },
    { event: 'contact_submit', action: 'submits an enquiry', because: 'it catches intent that will not book cold' },
  ],
  newsletter: [
    { event: 'subscribe', action: 'subscribes', because: 'the list is the asset' },
    { event: 'referral_share', action: 'shares or refers', because: 'it is what makes the list grow without spend' },
  ],
  ads: [
    { event: 'outbound_click', action: 'clicks a monetised link', because: 'it is the event advertisers pay for' },
    { event: 'scroll_90', action: 'reads to the end', because: 'attention is the inventory being sold' },
  ],
  unknown: [
    { event: 'contact_submit', action: 'submits any form', because: 'until the revenue model is confirmed, reaching out is the safest proxy for intent' },
  ],
};

/**
 * Events to propose, given how the business makes money and where its Tier 0
 * pages are. Deliberately at most three: a list of ten is a project, and a
 * project does not get done before the next audit.
 */
export function proposeKeyEvents(
  config: Pick<RainmakerConfig, 'revenue_model' | 'primary_conversion'>,
  tierZeroPaths: string[] = [],
): KeyEventProposal[] {
  const proposals = [...(BY_MODEL[config.revenue_model] ?? BY_MODEL.unknown)];

  // A declared conversion path that no proposal covers is worth its own event:
  // the user has already said this is where money changes hands.
  const declared = config.primary_conversion.length > 0 ? config.primary_conversion : tierZeroPaths;
  for (const path of declared) {
    const slug = path.replace(/^\/+|\/+$/g, '').replace(/[^a-z0-9]+/gi, '_').toLowerCase();
    if (!slug) continue;
    const event = `${slug}_submit`;
    if (proposals.some((proposal) => proposal.event === event)) continue;
    proposals.push({
      event,
      action: `converts on ${path}`,
      because: 'it is declared as a place money changes hands, so it should be measured as one',
    });
    break;
  }

  return proposals.slice(0, 3);
}

/**
 * The audit's measurement notice, with the events to create.
 *
 * The proposals are computed here rather than left to the assistant for the
 * same reason every other number is: a deterministic list is reproducible
 * across runs and reviewable in a diff, and an invented one is neither.
 */
export function formatMeasurementWarning(
  state: MeasurementState,
  proposals: KeyEventProposal[] = [],
): string | undefined {
  if (state !== 'unmeasured') return undefined;

  const lines = [
    'GA4 is connected but has no key events configured, so nothing on this site',
    'currently measures a conversion. Sessions are reported; none of them can be',
    'told apart from a bounce. Every score below falls back to URL patterns.',
    'Fixing this is worth more than any single finding here.',
  ];

  if (proposals.length > 0) {
    lines.push('', 'Worth marking as key events, for this revenue model:');
    for (const proposal of proposals) {
      lines.push(`  ${proposal.event}  when someone ${proposal.action}`);
      lines.push(`    ${proposal.because}`);
    }
    lines.push(
      '',
      'GA4 Admin, Events, mark as key event. Rainmaker reads Analytics and cannot',
      'create these for you.',
    );
  }

  return lines.join('\n');
}
