// SKELETON, not run against Stripe yet. Receives Stripe events, verifies the signature, and updates the order idempotently.
// Deploy: supabase functions deploy stripe-webhook --no-verify-jwt   (Stripe cannot send a Supabase JWT; the signature is the auth)
// Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import Stripe from "https://esm.sh/stripe@16.12.0?target=denonext";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 400 });
  const raw = await req.text(); // the exact bytes Stripe signed
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig, Deno.env.get("STRIPE_WEBHOOK_SECRET")!);
  } catch (_e) {
    return new Response("Invalid signature", { status: 400 });
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded" || event.type === "payment_intent.payment_failed") {
    const obj = event.data.object as Stripe.Checkout.Session & Stripe.PaymentIntent;
    const orderRef = (obj.metadata?.order_ref ?? "") as string;
    const ok = event.type !== "payment_intent.payment_failed";
    const { data: order } = await db.from("orders").select("id,total,currency").eq("ref", orderRef).maybeSingle();
    if (!order) return new Response("Unknown order", { status: 200 }); // ack so Stripe stops retrying; investigate via logs
    const paid = (obj.amount_total ?? obj.amount ?? 0) / 100;
    // unique (provider, provider_ref) makes a replayed event a no-op
    const ins = await db.from("payments").insert({ order_id: order.id, provider: "stripe", provider_ref: event.id, amount: paid, currency: String(obj.currency ?? order.currency).toUpperCase(), status: ok ? "succeeded" : "failed", raw: event });
    if (ins.error && ins.error.code !== "23505") return new Response("DB error", { status: 500 }); // let Stripe retry
    if (ok && !ins.error) {
      const full = paid + 0.005 >= Number(order.total);
      await db.from("orders").update({ payment_status: full ? "paid" : "deposit_paid", stage: 3 }).eq("id", order.id).eq("payment_status", "unpaid");
    }
  }
  return new Response("ok", { status: 200 });
});
