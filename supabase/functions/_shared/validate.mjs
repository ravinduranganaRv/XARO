// Pure input validation (no Deno APIs). Everything the browser sends is hostile until it passes through here.

export class ValidationError extends Error {
  constructor(message, status = 400, code = 'invalid_request') { super(message); this.name = 'ValidationError'; this.status = status; this.code = code; }
}

export const LIMITS = {
  CHECKOUT_BODY_BYTES: 16 * 1024,
  CHAT_BODY_BYTES: 24 * 1024,
  WEBHOOK_BODY_BYTES: 1024 * 1024,
  MAX_LINES: 20,
  QTY_MIN: 1,
  QTY_MAX: 50, // same cap as the storefront cart is expected to use; keeps one order from reserving unlimited production time
  NAME_MAX: 120,
  CHAT_MESSAGE_MAX: 800,
  CHAT_HISTORY_MAX_TURNS: 10,
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SKU_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/;
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g;

export const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v);
export const isSku = (v) => typeof v === 'string' && SKU_RE.test(v);

/** Same shape as the storefront's emailOK (src/mod/sb.js okEmail) plus a total-length cap. */
export function isEmail(v) {
  const s = String(v ?? '').trim();
  return s.length <= 254 && /^[^\s@<>(),;:"]{1,64}@[^\s@<>(),;:"]{1,190}\.[^\s@<>(),;:"]{2,}$/.test(s) && !s.includes('..');
}

/** Single-line text: strips control characters, collapses whitespace, trims, caps length. Never throws. */
export function cleanLine(v, max) {
  return String(v ?? '').replace(CONTROL_RE, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Parse JSON text into a plain object or throw a 400. */
export function parseJsonObject(text) {
  let v;
  try { v = JSON.parse(text); } catch { throw new ValidationError('Request body is not valid JSON.', 400, 'bad_json'); }
  if (!isPlainObject(v)) throw new ValidationError('Request body must be a JSON object.', 400, 'bad_json');
  return v;
}

/**
 * Validate the create-checkout payload. `allowedCountries` is the set of country codes currently open for orders.
 * Only sku / qty / designId are read from each item: any client-supplied price, total, shipping or currency is dropped here.
 */
export function validateCheckoutBody(body, allowedCountries) {
  const country = String(body.country ?? '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(country) || !allowedCountries.includes(country)) throw new ValidationError('We do not ship to this country yet.', 400, 'country_not_supported');

  const email = String(body.email ?? '').trim().toLowerCase();
  if (!isEmail(email)) throw new ValidationError('Enter a valid email address.', 400, 'bad_email');

  const name = cleanLine(body.name, LIMITS.NAME_MAX);
  if (name.length < 2) throw new ValidationError('Enter your full name.', 400, 'bad_name');

  let phone = null;
  if (body.phone != null && String(body.phone).trim() !== '') {
    const p = cleanLine(body.phone, 30);
    if (!/^\+?[0-9 ()\-.]{7,30}$/.test(p) || p.replace(/\D/g, '').length < 7) throw new ValidationError('Enter a valid phone number.', 400, 'bad_phone');
    phone = p;
  }

  let address = null;
  if (body.address != null) {
    if (!isPlainObject(body.address)) throw new ValidationError('Address is not valid.', 400, 'bad_address');
    const line = cleanLine(body.address.line, 200), city = cleanLine(body.address.city, 100), zip = cleanLine(body.address.zip, 20);
    const state = cleanLine(body.address.state, 100);
    if (line.length < 5 || city.length < 2) throw new ValidationError('Enter a street address and city.', 400, 'bad_address');
    // storefront rule (src/store.src.html checkout form): a US order needs a 5-digit ZIP
    if (country === 'US' && !/^\d{5}(-\d{4})?$/.test(zip)) throw new ValidationError('Enter a 5-digit US ZIP code.', 400, 'bad_address');
    address = { line, city, zip, ...(state ? { state } : {}), country };
  }

  if (!Array.isArray(body.items) || body.items.length < 1) throw new ValidationError('Your cart is empty.', 400, 'empty_cart');
  if (body.items.length > LIMITS.MAX_LINES) throw new ValidationError(`At most ${LIMITS.MAX_LINES} lines per order.`, 400, 'too_many_lines');
  const merged = new Map();
  for (const it of body.items) {
    if (!isPlainObject(it)) throw new ValidationError('Cart item is not valid.', 400, 'bad_item');
    if (!isSku(it.sku)) throw new ValidationError('Unknown product.', 400, 'bad_sku');
    if (typeof it.qty !== 'number' || !Number.isInteger(it.qty) || it.qty < LIMITS.QTY_MIN || it.qty > LIMITS.QTY_MAX) throw new ValidationError(`Quantity must be a whole number from ${LIMITS.QTY_MIN} to ${LIMITS.QTY_MAX}.`, 400, 'bad_qty');
    let designId = null;
    if (it.designId != null && it.designId !== '') {
      if (!isUuid(it.designId)) throw new ValidationError('Design reference is not valid.', 400, 'bad_design');
      designId = it.designId.toLowerCase();
    }
    const key = `${it.sku}|${designId ?? ''}`;
    const ex = merged.get(key);
    if (ex) ex.qty += it.qty; else merged.set(key, { sku: it.sku, qty: it.qty, designId });
  }
  const items = [...merged.values()];
  if (items.some((i) => i.qty > LIMITS.QTY_MAX)) throw new ValidationError(`Quantity must be a whole number from ${LIMITS.QTY_MIN} to ${LIMITS.QTY_MAX}.`, 400, 'bad_qty');
  return { items, country, email, name, phone, address };
}

/** Validate the zaro-chat payload. History is trimmed (not rejected) so a long conversation keeps working. */
export function validateChatBody(body, allowedCountries = []) {
  if (typeof body.message !== 'string') throw new ValidationError('Message is required.', 400, 'bad_message');
  const message = body.message.replace(CONTROL_RE, ' ').trim();
  if (!message) throw new ValidationError('Message is required.', 400, 'bad_message');
  if (message.length > LIMITS.CHAT_MESSAGE_MAX) throw new ValidationError(`Message is too long (max ${LIMITS.CHAT_MESSAGE_MAX} characters).`, 400, 'message_too_long');

  const history = [];
  if (Array.isArray(body.history)) {
    for (const h of body.history.slice(-LIMITS.CHAT_HISTORY_MAX_TURNS)) {
      if (!isPlainObject(h)) continue;
      const role = h.role === 'assistant' || h.role === 'bot' ? 'assistant' : h.role === 'user' ? 'user' : null;
      const content = typeof (h.content ?? h.text) === 'string' ? String(h.content ?? h.text).replace(CONTROL_RE, ' ').trim().slice(0, LIMITS.CHAT_MESSAGE_MAX) : '';
      if (role && content) history.push({ role, content });
    }
  }
  let country = null;
  if (body.country != null) {
    const c = String(body.country).trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(c) && (allowedCountries.length === 0 || allowedCountries.includes(c))) country = c;
  }
  return { message, history, country };
}
