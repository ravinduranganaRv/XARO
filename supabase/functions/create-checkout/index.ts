// SKELETON, not run against Stripe yet. The browser sends only SKUs, quantities and a country. Prices, shipping and totals are
// computed HERE from the database, so a customer can never choose their own price.
// Secrets: STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, SITE_URL, ALLOWED_ORIGINS
import Stripe from "https://esm.sh/stripe@16.12.0?target=denonext";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders, json } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const COUNTRIES = new Set(["LK", "AE", "GB", "AU", "US"]);

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(origin) });
  if (req.method !== "POST") return json({ error: "method" }, 405, origin);
  let body: { items?: { sku: string; qty: number }[]; country?: string; name?: string; email?: string; phone?: string; address?: Record<string, string> };
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400, origin); }
  const items = (body.items ?? []).slice(0, 20);
  if (!items.length || !COUNTRIES.has(String(body.country))) return json({ error: "invalid request" }, 400, origin);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(body.email ?? ""))) return json({ error: "email" }, 400, origin);

  // optional signed-in user
  let customerId: string | null = null;
  const auth = req.headers.get("authorization");
  if (auth) {
    const u = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    customerId = (await u.auth.getUser()).data.user?.id ?? null;
  }

  const lines: { sku: string; name: string; qty: number; unit: number; currency: string; product_id: string }[] = [];
  let currency = "";
  for (const it of items) {
    const qty = Math.floor(Number(it.qty));
    if (!(qty >= 1 && qty <= 50)) return json({ error: "qty" }, 400, origin);
    const { data: p } = await db.from("products").select("id,sku,name,status,product_prices(country,currency,amount)").eq("sku", it.sku).eq("status", "active").maybeSingle();
    const price = p?.product_prices?.find((x: { country: string }) => x.country === body.country);
    if (!p || !price) return json({ error: `not available: ${it.sku}` }, 400, origin);
    currency = currency || price.currency;
    lines.push({ sku: p.sku, name: p.name, qty, unit: Number(price.amount), currency: price.currency, product_id: p.id });
  }
  const subtotal = lines.reduce((a, l) => a + l.unit * l.qty, 0);
  const shipping = 0; // TODO: read shipping bands from business_settings
  const ref = "XO-" + crypto.randomUUID().slice(0, 8).toUpperCase();
  const { data: order, error } = await db.from("orders").insert({ ref, customer_id: customerId, name: String(body.name ?? "").slice(0, 120), email: body.email, phone: String(body.phone ?? "").slice(0, 30), country: body.country, currency, subtotal, shipping, total: subtotal + shipping, address: body.address ?? null }).select("id").single();
  if (error || !order) return json({ error: "could not create order" }, 500, origin);
  await db.from("order_items").insert(lines.map((l) => ({ order_id: order.id, product_id: l.product_id, sku: l.sku, name: l.name, qty: l.qty, unit_price: l.unit })));

  const session = await stripe.checkout.sessions.create({
    mode: "payment", customer_email: body.email, metadata: { order_ref: ref },
    line_items: lines.map((l) => ({ quantity: l.qty, price_data: { currency: l.currency.toLowerCase(), unit_amount: Math.round(l.unit * 100), product_data: { name: l.name } } })),
    success_url: `${Deno.env.get("SITE_URL")}/#track?o=${ref}`, cancel_url: `${Deno.env.get("SITE_URL")}/#cart`,
  });
  return json({ url: session.url, ref }, 200, origin);
});
