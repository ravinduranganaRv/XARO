// Stripe helpers over plain REST + Web Crypto (no Stripe SDK, no Deno-only APIs).
import { isOriginAllowed, normaliseOrigin } from './cors.mjs';
import { toCents } from './pricing.mjs';

export const STRIPE_API_VERSION = '2024-06-20';
export const SIGNATURE_TOLERANCE_SEC = 300;
export const DEFAULT_SITE_URL = 'https://ravinduranganarv.github.io/XARO';
export const CHECKOUT_EXPIRES_SEC = 3600; // Stripe allows 30 min .. 24 h; 1 h means abandoned orders are flagged quickly

export class StripeError extends Error {
  constructor(message, status = 502, detail = {}) { super(message); this.name = 'StripeError'; this.status = status; this.detail = detail; }
}

/** A real secret / restricted key looks like sk_test_..., sk_live_..., rk_test_..., rk_live_... (a pk_ publishable key must never be used here). */
export const isStripeSecretKey = (k) => typeof k === 'string' && /^(sk|rk)_(test|live)_[A-Za-z0-9]{8,}$/.test(k.trim());

// ---------- webhook signature ----------
const enc = new TextEncoder();
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

/** Constant-time string compare (the length of a hex digest is not secret; the content is). */
export function timingSafeEqualStr(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function hmacSha256Hex(secret, message) {
  const key = await globalThis.crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toHex(await globalThis.crypto.subtle.sign('HMAC', key, enc.encode(message)));
}

/** Parse "t=1700000000,v1=abc...,v1=def...,v0=..." strictly. Returns null for anything malformed. */
export function parseSignatureHeader(header) {
  if (typeof header !== 'string' || header.length === 0 || header.length > 1024) return null;
  let t = null; const v1 = [];
  for (const part of header.split(',')) {
    const i = part.indexOf('=');
    if (i < 1) return null;
    const k = part.slice(0, i).trim(), v = part.slice(i + 1).trim();
    if (k === 't') { if (t !== null || !/^\d{1,12}$/.test(v)) return null; t = Number(v); }
    else if (k === 'v1') { if (!/^[0-9a-f]{64}$/i.test(v)) return null; v1.push(v.toLowerCase()); }
    // other schemes (v0 = Stripe test-mode legacy) are ignored on purpose
  }
  if (t === null || v1.length === 0) return null;
  return { t, v1 };
}

/**
 * Verify a Stripe-Signature header over the RAW request body: HMAC-SHA256(secret, `${t}.${rawBody}`), constant-time compare against every v1,
 * and reject timestamps more than `toleranceSec` (5 min) away from now in either direction.
 * Returns {ok:true, timestamp} or {ok:false, reason}.
 */
export async function verifyStripeSignature({ payload, header, secret, now = Date.now(), toleranceSec = SIGNATURE_TOLERANCE_SEC }) {
  if (!secret || typeof secret !== 'string') return { ok: false, reason: 'missing_secret' };
  if (!header) return { ok: false, reason: 'missing_header' };
  const parsed = parseSignatureHeader(header);
  if (!parsed) return { ok: false, reason: 'malformed_header' };
  const expected = await hmacSha256Hex(secret, `${parsed.t}.${payload}`);
  let match = false;
  for (const sig of parsed.v1) if (timingSafeEqualStr(expected, sig)) match = true; // no early exit
  if (!match) return { ok: false, reason: 'no_matching_signature' };
  if (Math.abs(Math.floor(now / 1000) - parsed.t) > toleranceSec) return { ok: false, reason: 'timestamp_out_of_tolerance' };
  return { ok: true, timestamp: parsed.t };
}

// ---------- Checkout Session ----------
/** Stripe's form encoding: nested keys as a[b][c]=v and arrays as a[0][b]=v. null / undefined are skipped. */
export function encodeForm(obj) {
  const pairs = [];
  const walk = (prefix, v) => {
    if (v === undefined || v === null) return;
    if (Array.isArray(v)) v.forEach((x, i) => walk(`${prefix}[${i}]`, x));
    else if (typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(prefix ? `${prefix}[${k}]` : k, x);
    else pairs.push(`${encodeURIComponent(prefix)}=${encodeURIComponent(String(v))}`);
  };
  walk('', obj);
  return pairs.join('&');
}

/** Redirect base: the caller's origin when allow-listed (else the first allowed origin). For the GitHub Pages site the app lives under /XARO, so SITE_URL supplies the path. */
export function resolveReturnBase({ origin, allowed, siteUrl }) {
  const o = isOriginAllowed(origin, allowed) ? normaliseOrigin(origin) : allowed[0];
  for (const candidate of [siteUrl, DEFAULT_SITE_URL]) {
    try {
      const u = new URL(String(candidate || ''));
      if ((u.protocol === 'https:' || u.protocol === 'http:') && u.origin === o) return u.origin + u.pathname.replace(/\/+$/, '');
    } catch { /* try next */ }
  }
  return o;
}

export function returnUrls({ origin, allowed, siteUrl, ref }) {
  const base = resolveReturnBase({ origin, allowed, siteUrl });
  return { success: `${base}/#track?o=${encodeURIComponent(ref)}`, cancel: `${base}/#shop` };
}

/** Build the Checkout Session parameters purely from DB-derived lines. Amounts are minor units (cents). */
export function buildCheckoutSessionParams({ orderId, ref, email, order, successUrl, cancelUrl, nowSec }) {
  const cur = order.currency.toLowerCase();
  const line_items = order.lines.map((l) => ({
    quantity: l.qty,
    price_data: { currency: cur, unit_amount: l.depositUnitCents ?? l.unitCents, product_data: { name: (l.depositUnitCents != null ? `${l.name} (50% deposit)` : l.name).slice(0, 120) } },
  }));
  if (order.shippingCents > 0) line_items.push({ quantity: 1, price_data: { currency: cur, unit_amount: order.shippingCents, product_data: { name: 'Shipping' } } });
  return {
    mode: 'payment', client_reference_id: orderId, customer_email: email,
    success_url: successUrl, cancel_url: cancelUrl, expires_at: nowSec + CHECKOUT_EXPIRES_SEC,
    metadata: { order_id: orderId, order_ref: ref },
    payment_intent_data: { description: `XARO order ${ref}`, metadata: { order_id: orderId, order_ref: ref } },
    line_items,
  };
}
/** Sum of the Stripe line items in cents (used by tests and as a runtime assertion against the order's expected due-now amount). */
export const sessionParamsTotalCents = (params) => params.line_items.reduce((a, li) => a + li.price_data.unit_amount * li.quantity, 0);

/** POST /v1/checkout/sessions with plain fetch. Throws StripeError; never returns Stripe's error text to the browser. */
export async function createCheckoutSession({ fetchFn, secretKey, params, idempotencyKey, timeoutMs = 15000 }) {
  let res;
  try {
    res = await fetchFn('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/x-www-form-urlencoded',
        'Stripe-Version': STRIPE_API_VERSION, ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
      body: encodeForm(params),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    throw new StripeError('stripe unreachable', 504, { cause: e && e.name });
  }
  let body = null;
  try { body = await res.json(); } catch { /* non-JSON error body */ }
  if (!res.ok) throw new StripeError('stripe rejected the request', 502, { status: res.status, type: body?.error?.type, code: body?.error?.code, param: body?.error?.param });
  let host = '';
  try { host = new URL(body?.url).hostname; } catch { /* leave empty */ }
  if (!body || typeof body.id !== 'string' || !(host === 'stripe.com' || host.endsWith('.stripe.com'))) throw new StripeError('stripe returned no checkout url', 502, {});
  return { id: body.id, url: body.url };
}

/** Convert Stripe's minor-unit integer to the order's expected cents (identity for two-decimal currencies; kept as a named step for clarity). */
export const stripeMinorToCents = (n) => Number.isInteger(n) ? n : toCents(NaN);
