// SKELETON, not run yet. Moves Zaro's answers to a server so the AI key never reaches the browser.
// The browser sends the last few messages; this function adds the business context, calls the model, and returns text only.
// Secrets: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ALLOWED_ORIGINS
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders, json } from "../_shared/cors.ts";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const MODEL = Deno.env.get("ZARO_MODEL") ?? "claude-haiku-5-5";
const hits = new Map<string, number[]>(); // per-instance soft limit; use a DB table or Upstash for a hard limit

const SYSTEM = `You are Zaro, the friendly assistant for XARO Industries, a small Sri Lankan maker of hand-tufted keyboard rugs and 3D wall art.
Answer only from the business facts provided below. If you do not know, say so and offer to pass the question to the team. Never invent prices, delivery dates, stock or materials.
Prices come from the facts; never quote a price that is not listed. Do not give legal, medical or financial advice. Keep replies short and warm.`;

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(origin) });
  if (req.method !== "POST") return json({ error: "method" }, 405, origin);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const now = Date.now(), w = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  if (w.length >= 12) return json({ error: "slow down" }, 429, origin);
  hits.set(ip, [...w, now]);

  let body: { messages?: { role: string; content: string }[]; country?: string };
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400, origin); }
  const messages = (body.messages ?? []).slice(-8).map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content).slice(0, 1000) }));
  if (!messages.length || messages[messages.length - 1].role !== "user") return json({ error: "no question" }, 400, origin);

  const { data: prods } = await db.from("products").select("sku,name,status,description,product_prices(country,currency,amount)").in("status", ["active", "coming_soon"]).limit(60);
  const { data: facts } = await db.from("business_settings").select("key,value").eq("is_public", true);
  const country = String(body.country ?? "LK");
  const context = JSON.stringify({ country, products: (prods ?? []).map((p) => ({ ...p, product_prices: p.status === "active" ? p.product_prices?.filter((x: { country: string }) => x.country === country) : [] })), facts });

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 400, system: `${SYSTEM}\n\nBUSINESS FACTS (JSON):\n${context}`, messages }),
  });
  if (!r.ok) return json({ error: "assistant unavailable" }, 502, origin);
  const out = await r.json();
  const text = (out.content ?? []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("\n");
  return json({ reply: text }, 200, origin);
});
