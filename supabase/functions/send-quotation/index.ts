// send-quotation: emails a quotation PDF (made in the browser) to the customer of that quotation. UNIT TESTED WITH MOCKS ONLY (see ../README.md).
// Only a signed-in member of the quotation's business can use it: the quotation and customer are read with the CALLER's token, so row-level security decides.
// The recipient is always the customer's email stored on the quotation; the browser cannot choose another address.
// Secrets: RESEND_API_KEY, QUOTE_FROM_EMAIL (a sender on a domain verified in Resend), ALLOWED_ORIGINS. SUPABASE_* are injected by the platform.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { parseAllowedOrigins, isOriginAllowed, preflightResponse } from '../_shared/cors.mjs';
import { json, readTextCapped, clientIp } from '../_shared/http.mjs';
import { createLimiter } from '../_shared/ratelimit.mjs';
import { MAX_PDF_BYTES, MailError, validateBody, buildEmail, sendViaResend } from '../_shared/quote_mail.mjs';

const allowed = parseAllowedOrigins(Deno.env.get('ALLOWED_ORIGINS'));
const hit = createLimiter({ windowMs: 60_000, max: 10 });
const url = Deno.env.get('SUPABASE_URL')!, anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return preflightResponse(origin, allowed);
  const reply = (b: unknown, s: number) => json(b, s, origin, allowed);
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
  if (origin && !isOriginAllowed(origin, allowed)) return reply({ error: 'Origin not allowed' }, 403);
  if (!hit(clientIp(req))) return reply({ error: 'Too many emails. Please wait a minute.' }, 429);
  const auth = req.headers.get('authorization') ?? '';
  if (!auth.toLowerCase().startsWith('bearer ')) return reply({ error: 'Please sign in.' }, 401);
  try {
    const apiKey = Deno.env.get('RESEND_API_KEY') ?? '', from = Deno.env.get('QUOTE_FROM_EMAIL') ?? '';
    if (!apiKey || !from) throw new MailError('Email sending is not set up yet.', 503, 'not_configured');
    const b = validateBody(JSON.parse(await readTextCapped(req, Math.ceil(MAX_PDF_BYTES * 4 / 3) + 4096)));
    const db = createClient(url, anonKey, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
    const { data: u } = await db.auth.getUser(); if (!u?.user) return reply({ error: 'Please sign in.' }, 401);
    const { data: q } = await db.from('biz_quotations').select('id,ref,currency,valid_until,business_id,customer_id,subtotal,lines').eq('id', b.quotationId).maybeSingle();
    if (!q) return reply({ error: 'Quotation not found.' }, 404);
    const [{ data: biz }, { data: cust }] = await Promise.all([db.from('businesses').select('name,email,phone').eq('id', q.business_id).maybeSingle(), q.customer_id ? db.from('biz_customers').select('name,email').eq('id', q.customer_id).maybeSingle() : Promise.resolve({ data: null })]);
    const total = Array.isArray(q.lines) ? null : q.lines?.total; const totalText = typeof total === 'number' ? new Intl.NumberFormat('en-US', { style: 'currency', currency: q.currency || 'USD', currencyDisplay: 'code' }).format(total) : '';
    const payload = buildEmail({ business: biz, customer: cust, quote: q, totalText, message: b.message, pdfBase64: b.pdfBase64, fromEmail: from });
    const sent = await sendViaResend(apiKey, payload);
    await db.from('biz_quotations').update({ emailed_at: new Date().toISOString(), emailed_to: cust!.email }).eq('id', q.id);
    return reply({ ok: true, to: cust!.email, id: sent.id }, 200);
  } catch (e) {
    if (e instanceof MailError) return reply({ error: e.message, code: e.code }, e.status);
    if (e instanceof SyntaxError) return reply({ error: 'Send a JSON object.' }, 400);
    if ((e as { status?: number }).status === 413) return reply({ error: 'The quotation PDF is too large to email.' }, 413);
    console.error('send-quotation failed', e instanceof Error ? e.message : 'unknown');
    return reply({ error: 'Could not send the email. Please try again.' }, 500);
  }
});
