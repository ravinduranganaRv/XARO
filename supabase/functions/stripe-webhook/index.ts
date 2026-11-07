// stripe-webhook: verifies Stripe's signature over the raw body, then applies the event idempotently. UNIT TESTED WITH MOCKS ONLY (see ../README.md).
// Secrets: STRIPE_WEBHOOK_SECRET. Deploy with JWT verification OFF for this function (Stripe has no Supabase token); the signature is the authentication.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { readTextCapped } from '../_shared/http.mjs';
import { LIMITS } from '../_shared/validate.mjs';
import { verifyStripeSignature } from '../_shared/stripe.mjs';
import { processStripeEvent } from '../_shared/webhook.mjs';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const reply = (b: unknown, s: number) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const adapter = {
  async getOrder(id: string) { const { data, error } = await db.from('orders').select('id,ref,customer_id,currency,stage,payment_status,notes,subtotal,shipping,total').eq('id', id).maybeSingle(); if (error) throw new Error('db'); return data; },
  async getOrderItems(orderId: string) { const { data, error } = await db.from('order_items').select('qty,unit_price,meta').eq('order_id', orderId); if (error) throw new Error('db'); return data ?? []; },
  async findPaymentByRef(ref: string) { const { data, error } = await db.from('payments').select('order_id,currency').eq('provider', 'stripe').eq('provider_ref', ref).maybeSingle(); if (error) throw new Error('db'); return data; },
  async insertPayment(row: Record<string, unknown>) { const { error } = await db.from('payments').insert(row); if (!error) return 'ok'; if (error.code === '23505') return 'duplicate'; throw new Error('db'); },
  async updateOrder(id: string, patch: Record<string, unknown>) { const { error } = await db.from('orders').update(patch).eq('id', id); if (error) throw new Error('db'); },
  async notify(row: Record<string, unknown>) { await db.from('notifications').insert(row); }, // a failed notification must not make Stripe retry a paid order
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply({ error: 'method' }, 405);
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
  if (!secret) return reply({ error: 'webhook not configured' }, 503);
  let raw = '';
  try { raw = await readTextCapped(req, LIMITS.WEBHOOK_BODY_BYTES); } catch { return reply({ error: 'payload too large' }, 413); }
  const v = await verifyStripeSignature({ payload: raw, header: req.headers.get('stripe-signature') ?? '', secret });
  if (!v.ok) { console.warn('stripe-webhook bad signature:', v.reason); return reply({ error: 'bad signature' }, 400); }
  let event; try { event = JSON.parse(raw); } catch { return reply({ error: 'bad json' }, 400); }
  try { const r = await processStripeEvent(event, adapter); return reply({ received: true, result: r.result }, r.status); }
  catch (e) { console.error('stripe-webhook', (e as Error)?.message); return reply({ error: 'temporary failure' }, 500); } // 5xx => Stripe retries
});
