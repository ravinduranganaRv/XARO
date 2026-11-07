// create-checkout: the browser sends only SKUs, quantities, country and contact details. Every price, shipping fee, deposit and currency is recomputed here
// from the database. UNIT TESTED WITH MOCKS ONLY: not yet run against Stripe or a deployed project (see ../README.md).
// Secrets (Supabase dashboard > Edge Functions > Secrets): STRIPE_SECRET_KEY, ALLOWED_ORIGINS, SITE_URL. SUPABASE_* are injected by the platform.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { parseAllowedOrigins, isOriginAllowed, preflightResponse } from '../_shared/cors.mjs';
import { json, readTextCapped, clientIp } from '../_shared/http.mjs';
import { createLimiter } from '../_shared/ratelimit.mjs';
import { LIMITS, ValidationError, parseJsonObject, validateCheckoutBody, isUuid } from '../_shared/validate.mjs';
import { resolveCountries, enabledCountryCodes, buildOrder, buildOrderRows, generateOrderRef } from '../_shared/pricing.mjs';
import { isStripeSecretKey, returnUrls, buildCheckoutSessionParams, sessionParamsTotalCents, createCheckoutSession, StripeError } from '../_shared/stripe.mjs';

const allowed = parseAllowedOrigins(Deno.env.get('ALLOWED_ORIGINS'));
const hit = createLimiter({ windowMs: 60_000, max: 8 });
const url = Deno.env.get('SUPABASE_URL')!, serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const db = createClient(url, serviceKey, { auth: { persistSession: false } });

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return preflightResponse(origin, allowed);
  const reply = (b: unknown, s: number) => json(b, s, origin, allowed);
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
  if (origin && !isOriginAllowed(origin, allowed)) return reply({ error: 'Origin not allowed' }, 403);
  if (!hit(clientIp(req))) return reply({ error: 'Too many attempts. Please wait a minute.' }, 429);
  const secretKey = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
  if (!isStripeSecretKey(secretKey)) return reply({ error: 'Online payment is not switched on yet. Please use the quote form.' }, 503);
  try {
    const body = parseJsonObject(await readTextCapped(req, LIMITS.CHECKOUT_BODY_BYTES));
    const { data: setting } = await db.from('business_settings').select('value').eq('key', 'checkout_countries').maybeSingle();
    const countries = resolveCountries(setting?.value);
    const input = validateCheckoutBody(body, enabledCountryCodes(countries));

    // optional signed-in user: required only when a design is attached, and the design must be visible to THAT user (row-level security decides)
    let customerId: string | null = null;
    const auth = req.headers.get('authorization') ?? '';
    const userDb = auth.toLowerCase().startsWith('bearer ') ? createClient(url, anonKey, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } }) : null;
    if (userDb) { const { data } = await userDb.auth.getUser(); customerId = data.user?.id ?? null; }
    const designIds = [...new Set(input.items.map((i: { designId?: string | null }) => i.designId).filter(Boolean))] as string[];
    if (designIds.length) {
      if (!userDb || !customerId) throw new ValidationError('Please sign in to order a saved design.', 401, 'sign_in_required');
      const { data: mine } = await userDb.from('custom_designs').select('id').in('id', designIds);
      if (!mine || mine.length !== designIds.length || !designIds.every(isUuid)) throw new ValidationError('That design was not found in your account.', 400, 'design_not_found');
    }

    const { data: products, error: pe } = await db.from('products').select('id,sku,name,kind,status,specs,product_prices(country,currency,amount)').in('sku', input.items.map((i: { sku: string }) => i.sku));
    if (pe) throw new Error('catalogue lookup failed');
    const order = buildOrder({ items: input.items, country: input.country, products, countries });

    // create the order (retry on a rare ref collision), then the lines; roll the order back if the lines fail
    let orderId = '', ref = '';
    for (let i = 0; i < 4 && !orderId; i++) {
      ref = generateOrderRef();
      const { orderRow, itemRows } = buildOrderRows({ ref, customerId, input, order });
      const ins = await db.from('orders').insert(orderRow).select('id').single();
      if (ins.error) { if (ins.error.code === '23505') continue; throw new Error('order insert failed'); }
      orderId = ins.data.id;
      const li = await db.from('order_items').insert(itemRows.map((r: Record<string, unknown>) => ({ ...r, order_id: orderId })));
      if (li.error) { await db.from('orders').delete().eq('id', orderId); throw new Error('order lines insert failed'); }
    }
    if (!orderId) throw new Error('could not allocate an order reference');

    const urls = returnUrls({ origin, allowed, siteUrl: Deno.env.get('SITE_URL'), ref });
    const params = buildCheckoutSessionParams({ orderId, ref, email: input.email, order, successUrl: urls.success, cancelUrl: urls.cancel, nowSec: Math.floor(Date.now() / 1000) });
    if (sessionParamsTotalCents(params) !== order.dueNowCents) { await db.from('orders').update({ cancelled: true, notes: 'Internal total mismatch' }).eq('id', orderId); throw new Error('internal total mismatch'); }
    try {
      const session = await createCheckoutSession({ fetchFn: fetch, secretKey, params, idempotencyKey: orderId });
      return reply({ url: session.url, ref, orderId }, 200);
    } catch (e) {
      await db.from('orders').update({ cancelled: true, notes: 'Checkout session could not be created.' }).eq('id', orderId);
      throw e;
    }
  } catch (e) {
    if (e instanceof ValidationError) return reply({ error: e.message, code: e.code }, e.status);
    if (e instanceof StripeError) { console.error('stripe', e.status, JSON.stringify(e.detail ?? {})); return reply({ error: 'The payment page could not be opened. Please try again.' }, e.status === 504 ? 504 : 502); }
    if ((e as { status?: number })?.status === 413) return reply({ error: 'Request too large.' }, 413);
    console.error('create-checkout', (e as Error)?.message);
    return reply({ error: 'Something went wrong. Please try again.' }, 500);
  }
});
