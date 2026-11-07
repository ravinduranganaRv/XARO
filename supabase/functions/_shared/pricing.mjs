// Pure price / order logic (no Deno APIs). The server NEVER uses a price, total, shipping fee or currency sent by the browser:
// it takes (sku, qty, designId, country) and recomputes everything from product_prices, exactly the way the storefront does.
//
// Where each rule comes from in the storefront (this repo):
//   * Countries, currencies, shipping fee (0), enabled flag ...... src/mod/data.js  COUNTRIES_DEFAULT  (LK/US/AE enabled, GB/AU "Opening soon")
//   * Price per country, in that country's own currency .......... src/mod/data.js  SEED_PRICES + priceFor();  DB: product_prices (one row per product+country)
//   * Deposit: custom pieces pay 50% today ....................... src/store.src.html  unitPrice = priceOf(p)*(i.dep ? 0.5 : 1);  p.deposit is true for kind "custom" in src/catalog_public.json
//   * Shipping added once to the total ........................... src/store.src.html  renderCart: "Due today" = sub + shipFee();  checkout: total = sub + sf
//   * Balance on art approval .................................... src/store.src.html  renderCart: bal = sum(price*0.5*qty) for deposit lines
//   * Order ref "XARO-" + 5 digits ............................... src/mod/data.js  newOrderId()
import { ValidationError } from './validate.mjs';

export const DEPOSIT_PERCENT = 50;

// Mirrors COUNTRIES_DEFAULT in src/mod/data.js. `ship` is a flat fee in the country's own currency (0 = "Shipping is included").
export const COUNTRY_DEFAULTS = {
  LK: { name: 'Sri Lanka', cur: 'LKR', ship: 0, enabled: true },
  US: { name: 'United States', cur: 'USD', ship: 0, enabled: true },
  AE: { name: 'United Arab Emirates', cur: 'AED', ship: 0, enabled: true },
  GB: { name: 'United Kingdom', cur: 'GBP', ship: 0, enabled: false }, // off until VAT is sorted (docs/PRICING.md)
  AU: { name: 'Australia', cur: 'AUD', ship: 0, enabled: false }, // off until GST is sorted (docs/PRICING.md)
};
// All of these are two-decimal currencies at Stripe, so "cents" below = Stripe's minor unit. A zero-decimal currency (JPY...) must not be added without extra handling.
export const SUPPORTED_CURRENCIES = ['LKR', 'USD', 'AED', 'GBP', 'AUD', 'EUR'];

/**
 * Merge the optional owner setting business_settings['checkout_countries'] over the defaults.
 * Shape: {"GB": {"enabled": true, "ship": 12.5}}. Only `enabled` (boolean) and `ship` (finite number 0..1e6) are read;
 * unknown countries and any currency override are ignored, so a bad setting can never change what currency a country is charged in.
 */
export function resolveCountries(setting) {
  const out = {};
  for (const [code, d] of Object.entries(COUNTRY_DEFAULTS)) out[code] = { ...d };
  if (setting && typeof setting === 'object' && !Array.isArray(setting)) {
    for (const [code, o] of Object.entries(setting)) {
      const c = out[String(code).toUpperCase()];
      if (!c || !o || typeof o !== 'object') continue;
      if (typeof o.enabled === 'boolean') c.enabled = o.enabled;
      if (typeof o.ship === 'number' && Number.isFinite(o.ship) && o.ship >= 0 && o.ship <= 1e6) c.ship = o.ship;
    }
  }
  return out;
}
export const enabledCountryCodes = (countries) => Object.entries(countries).filter(([, c]) => c.enabled).map(([k]) => k);

/** numeric(12,2) <-> integer minor units. All arithmetic is done in integers so totals never drift by a cent. */
export const toCents = (n) => Math.round(Number(n) * 100);
export const fromCents = (c) => Number((c / 100).toFixed(2));

/** A product takes a deposit when specs.deposit is true, or when specs.deposit is not set and the product kind is 'custom' (the storefront's rule). */
export function isDepositProduct(p) {
  const d = p && p.specs && typeof p.specs === 'object' ? p.specs.deposit : undefined;
  if (typeof d === 'boolean') return d;
  return p?.kind === 'custom';
}

/**
 * items: output of validateCheckoutBody (sku, qty, designId only). products: rows from the DB incl. product_prices.
 * Returns the authoritative lines and totals in integer cents, or throws ValidationError.
 */
export function buildOrder({ items, country, products, countries }) {
  const cfg = countries[country];
  if (!cfg || !cfg.enabled) throw new ValidationError('We do not ship to this country yet.', 400, 'country_not_supported');
  const bySku = new Map((products || []).map((p) => [String(p.sku), p]));
  const lines = [];
  for (const it of items) {
    const p = bySku.get(it.sku);
    if (!p || p.status !== 'active') throw new ValidationError(`"${it.sku}" is not available.`, 400, 'product_unavailable');
    const row = (p.product_prices || []).find((x) => String(x.country).toUpperCase() === country);
    const unitCents = row ? toCents(row.amount) : 0;
    if (!row || !Number.isFinite(unitCents) || unitCents <= 0) throw new ValidationError(`"${it.sku}" is not sold in this country.`, 400, 'product_unavailable');
    const currency = String(row.currency || '').trim().toUpperCase();
    if (!SUPPORTED_CURRENCIES.includes(currency) || currency !== cfg.cur) throw new ValidationError('This price is not available right now.', 500, 'price_config');
    const deposit = isDepositProduct(p);
    const depositUnitCents = deposit ? Math.round((unitCents * DEPOSIT_PERCENT) / 100) : null;
    lines.push({ productId: p.id, sku: p.sku, name: String(p.name), qty: it.qty, unitCents, depositUnitCents, designId: it.designId ?? null, currency });
  }
  const currency = cfg.cur;
  const subtotalCents = lines.reduce((a, l) => a + l.unitCents * l.qty, 0);
  const shippingCents = toCents(cfg.ship);
  return { currency, lines, subtotalCents, shippingCents, totalCents: subtotalCents + shippingCents, ...dueFromLines(lines, shippingCents) };
}

function dueFromLines(lines, shippingCents) {
  const itemsDue = lines.reduce((a, l) => a + (l.depositUnitCents ?? l.unitCents) * l.qty, 0);
  const subtotal = lines.reduce((a, l) => a + l.unitCents * l.qty, 0);
  const dueNowCents = itemsDue + shippingCents;
  return { dueNowCents, balanceCents: subtotal + shippingCents - dueNowCents, hasDeposit: lines.some((l) => l.depositUnitCents != null) };
}

/**
 * DB rows for an order. Convention (documented in supabase/functions/README.md):
 *   orders.subtotal / shipping / total  = FULL value of the order (deposit lines at full price).
 *   order_items.unit_price              = full unit price; meta.deposit + meta.deposit_unit_price say what is charged now.
 *   Stripe charges  "due now" = sum(deposit-adjusted lines) + shipping  (recomputed by the webhook from these rows via expectedDueNowCents).
 */
export function buildOrderRows({ ref, customerId, input, order }) {
  const orderRow = {
    ref, customer_id: customerId ?? null, name: input.name, email: input.email, phone: input.phone, country: input.country, currency: order.currency,
    subtotal: fromCents(order.subtotalCents), shipping: fromCents(order.shippingCents), total: fromCents(order.totalCents),
    payment_status: 'unpaid', address: input.address,
    notes: order.hasDeposit ? `Deposit order: ${DEPOSIT_PERCENT}% due now ${fromCents(order.dueNowCents).toFixed(2)} ${order.currency}, balance ${fromCents(order.balanceCents).toFixed(2)} ${order.currency} on design approval.` : null,
  };
  const itemRows = order.lines.map((l) => ({
    product_id: l.productId, sku: l.sku, name: l.name, qty: l.qty, unit_price: fromCents(l.unitCents), design_id: l.designId,
    meta: l.depositUnitCents != null ? { deposit: true, deposit_pct: DEPOSIT_PERCENT, deposit_unit_price: fromCents(l.depositUnitCents) } : {},
  }));
  return { orderRow, itemRows };
}

/** What Stripe must charge for this order today, in cents, recomputed from the stored rows (never from event metadata). */
export function expectedDueNowCents(orderRow, itemRows) {
  const shipping = toCents(orderRow.shipping || 0);
  let sum = 0;
  for (const it of itemRows) {
    const m = it.meta && typeof it.meta === 'object' ? it.meta : {};
    const useDeposit = m.deposit === true && Number.isFinite(Number(m.deposit_unit_price));
    sum += (useDeposit ? toCents(m.deposit_unit_price) : toCents(it.unit_price)) * Number(it.qty);
  }
  return sum + shipping;
}

/** Order ref like the shop's: "XARO-" + 5 digits (10000..99999). Uniqueness is enforced by orders.ref unique; callers retry on conflict. */
export function generateOrderRef(getRandomValues = (a) => globalThis.crypto.getRandomValues(a)) {
  const range = 90000, limit = Math.floor(0x100000000 / range) * range;
  const buf = new Uint32Array(1);
  do { getRandomValues(buf); } while (buf[0] >= limit); // rejection sampling: no modulo bias
  return 'XARO-' + String(10000 + (buf[0] % range));
}
