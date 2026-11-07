// Pure Stripe webhook event handling (no Deno APIs). The caller passes a small `db` adapter, so the logic is unit-testable.
// Rules: amounts come from OUR stored order rows (never from event metadata); every write is idempotent (payments has unique(provider, provider_ref));
// the caller returns 2xx only after this function resolves, and 5xx when it throws, so Stripe retries.
import { expectedDueNowCents, toCents } from './pricing.mjs';

export const PAID_STAGE_CATALOG = 3;  // "Payment confirmed" in production_stages (index 3)
export const PAID_STAGE_DEPOSIT = 1;  // "Design review": a deposit order starts with the artwork review

const lower = (s) => String(s || '').toLowerCase();
const upper = (s) => String(s || '').toUpperCase();
const isUuid = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

/** Keep only the facts we need from an event; never store payment-method details or full customer objects. */
export function slimEvent(event) {
  const o = (event && event.data && event.data.object) || {};
  return { event_id: event.id, type: event.type, livemode: !!event.livemode, object_id: o.id, payment_intent: o.payment_intent || null, amount_total: o.amount_total ?? o.amount ?? null, amount_refunded: o.amount_refunded ?? null, currency: o.currency || null, payment_status: o.payment_status || null, client_reference_id: o.client_reference_id || null };
}

export async function processStripeEvent(event, db) {
  if (!event || typeof event.id !== 'string' || typeof event.type !== 'string') return { status: 400, result: 'malformed_event' };
  const o = (event.data && event.data.object) || {};
  switch (event.type) {
    case 'checkout.session.completed': return onCompleted(event, o, db);
    case 'checkout.session.expired': return onExpired(event, o, db);
    case 'charge.refunded': return onRefunded(event, o, db);
    default: return { status: 200, result: 'ignored' };
  }
}

async function onCompleted(event, session, db) {
  const orderId = session.client_reference_id;
  if (!isUuid(orderId)) return { status: 200, result: 'no_order_reference' };            // not one of ours; retrying will not help
  const order = await db.getOrder(orderId);
  if (!order) return { status: 200, result: 'order_not_found' };
  if (session.payment_status !== 'paid') return { status: 200, result: 'not_paid_yet' };  // async method still pending: a later event completes it
  const items = await db.getOrderItems(orderId);
  const expected = expectedDueNowCents(order, items);
  const matches = Number.isInteger(session.amount_total) && session.amount_total === expected && upper(session.currency) === upper(order.currency);
  const ref = (typeof session.payment_intent === 'string' && session.payment_intent) || session.id;
  const hasDeposit = items.some((i) => i.meta && i.meta.deposit === true);
  const payment = { order_id: orderId, provider: 'stripe', provider_ref: ref, amount: (Number.isInteger(session.amount_total) ? session.amount_total : 0) / 100, currency: upper(session.currency || order.currency), status: matches ? 'succeeded' : 'amount_mismatch', raw: { ...slimEvent(event), expected_cents: expected } };
  const ins = await db.insertPayment(payment);
  if (ins === 'duplicate') return { status: 200, result: 'duplicate' };
  if (!matches) {
    await db.updateOrder(orderId, { payment_status: 'failed', notes: appendNote(order.notes, `Payment flagged: Stripe charged ${session.amount_total} ${upper(session.currency)} (minor units), expected ${expected} ${order.currency}. Check before producing.`) });
    return { status: 200, result: 'amount_mismatch' };
  }
  const stage = Math.max(Number(order.stage) || 0, hasDeposit ? PAID_STAGE_DEPOSIT : PAID_STAGE_CATALOG);
  await db.updateOrder(orderId, { payment_status: hasDeposit ? 'deposit_paid' : 'paid', stage });
  if (order.customer_id) await db.notify({ user_id: order.customer_id, title: 'Payment received', body: `Thank you! We received your ${hasDeposit ? 'deposit' : 'payment'} for order ${order.ref}.` });
  return { status: 200, result: 'paid' };
}

async function onExpired(event, session, db) {
  const orderId = session.client_reference_id; if (!isUuid(orderId)) return { status: 200, result: 'no_order_reference' };
  const order = await db.getOrder(orderId); if (!order) return { status: 200, result: 'order_not_found' };
  if (order.payment_status !== 'unpaid') return { status: 200, result: 'already_settled' };   // never cancel an order that was paid
  await db.updateOrder(orderId, { cancelled: true, notes: appendNote(order.notes, 'Checkout expired without payment.') });
  return { status: 200, result: 'cancelled' };
}

async function onRefunded(event, charge, db) {
  const pi = charge.payment_intent; if (typeof pi !== 'string' || !pi) return { status: 200, result: 'no_payment_intent' };
  const paid = await db.findPaymentByRef(pi); if (!paid) return { status: 200, result: 'payment_not_found' };
  const full = charge.refunded === true || (Number.isInteger(charge.amount) && charge.amount_refunded >= charge.amount);
  const ins = await db.insertPayment({ order_id: paid.order_id, provider: 'stripe', provider_ref: `${charge.id}:refund:${Number(charge.amount_refunded) || 0}`, amount: (Number(charge.amount_refunded) || 0) / 100, currency: upper(charge.currency || paid.currency), status: full ? 'refunded' : 'partially_refunded', raw: slimEvent(event) });
  if (ins === 'duplicate') return { status: 200, result: 'duplicate' };
  if (full) { const order = await db.getOrder(paid.order_id); await db.updateOrder(paid.order_id, { payment_status: 'refunded', notes: appendNote(order && order.notes, 'Fully refunded in Stripe.') }); }
  return { status: 200, result: full ? 'refunded' : 'partially_refunded' };
}

function appendNote(prev, add) { const s = [prev, add].filter(Boolean).join(' | '); return s.length > 1500 ? s.slice(-1500) : s; }
export { toCents, lower };
