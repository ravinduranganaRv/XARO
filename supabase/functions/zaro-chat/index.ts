// zaro-chat: robot sales assistant. Uses ONLY public data (active products, public settings). If no AI key is set it answers 503 and the page falls back to its offline FAQ.
// UNIT TESTED WITH MOCKS ONLY (see ../README.md). Secrets: ANTHROPIC_API_KEY, ANTHROPIC_MODEL (optional), ALLOWED_ORIGINS.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { parseAllowedOrigins, isOriginAllowed, preflightResponse } from '../_shared/cors.mjs';
import { json, readTextCapped, clientIp } from '../_shared/http.mjs';
import { createLimiter } from '../_shared/ratelimit.mjs';
import { LIMITS, ValidationError, parseJsonObject, validateChatBody } from '../_shared/validate.mjs';
import { resolveCountries, enabledCountryCodes } from '../_shared/pricing.mjs';
import { buildSystemPrompt, toApiMessages, askClaude, ChatError, DEFAULT_MODEL } from '../_shared/chat.mjs';

const allowed = parseAllowedOrigins(Deno.env.get('ALLOWED_ORIGINS'));
const hit = createLimiter({ windowMs: 60_000, max: 12 });
// anon key: the assistant can see exactly what a visitor can see (row-level security), never more
const pub = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false } });

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return preflightResponse(origin, allowed);
  const reply = (b: unknown, s: number) => json(b, s, origin, allowed);
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
  if (origin && !isOriginAllowed(origin, allowed)) return reply({ error: 'Origin not allowed' }, 403);
  if (!hit(clientIp(req))) return reply({ error: 'Too many messages. Please wait a moment.' }, 429);
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
  if (!apiKey) return reply({ error: 'assistant offline' }, 503);
  try {
    const body = parseJsonObject(await readTextCapped(req, LIMITS.CHAT_BODY_BYTES));
    const { data: setting } = await pub.from('business_settings').select('value').eq('key', 'checkout_countries').maybeSingle();
    const input = validateChatBody(body, enabledCountryCodes(resolveCountries(setting?.value)));
    const [prods, sets] = await Promise.all([
      pub.from('products').select('sku,name,kind,specs,product_prices(country,currency,amount)').eq('status', 'active').limit(40),
      pub.from('business_settings').select('key,value').in('key', ['production_stages', 'faq']),
    ]);
    const bag = Object.fromEntries((sets.data ?? []).map((r: { key: string; value: unknown }) => [r.key, r.value]));
    const system = buildSystemPrompt({ products: prods.data ?? [], country: input.country, faq: Array.isArray(bag.faq) ? bag.faq : [], stages: Array.isArray(bag.production_stages) ? bag.production_stages : [] });
    const answer = await askClaude({ fetchFn: fetch, apiKey, model: Deno.env.get('ANTHROPIC_MODEL') || DEFAULT_MODEL, system, messages: toApiMessages(input.history, input.message) });
    return reply({ answer }, 200);
  } catch (e) {
    if (e instanceof ValidationError) return reply({ error: e.message, code: e.code }, e.status);
    if (e instanceof ChatError) return reply({ error: 'assistant unavailable' }, e.status);
    if ((e as { status?: number })?.status === 413) return reply({ error: 'Request too large.' }, 413);
    console.error('zaro-chat', (e as Error)?.message);
    return reply({ error: 'assistant unavailable' }, 500);
  }
});
