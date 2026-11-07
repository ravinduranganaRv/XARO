# XARO edge functions

Three Supabase Edge Functions (Deno / TypeScript). **They are unit tested with mocks only. They have NOT been run against Stripe, Anthropic or a deployed Supabase project.** Pure logic lives in `_shared/*.mjs` (no Deno APIs) and is covered by `tests/edge.test.mjs` (36 tests, `node --test tests/edge.test.mjs`).

| Function | Purpose | Auth |
|---|---|---|
| `create-checkout` | Browser sends SKU, qty, country, contact. Server recomputes every price, shipping fee and 50% deposit from the database, creates `orders` + `order_items`, then a Stripe Checkout Session, and returns its URL. | Optional user JWT (required only when a saved design is attached) |
| `stripe-webhook` | Verifies the Stripe signature, then marks orders paid / deposit paid / cancelled / refunded idempotently. | Stripe signature only (deploy with JWT verification **off**) |
| `zaro-chat` | Sales assistant. Uses only public data (anon key). 503 when no AI key is set, so the page falls back to its offline FAQ. | Anonymous, soft rate limit |

## Rules implemented (and where they come from in the storefront)
- Client prices, totals, shipping and currency are ignored. Only `sku`, `qty` (1..50), `designId`, country and contact details are read.
- Currency and shipping per country follow `src/mod/data.js` (LK/US/AE open; GB/AU closed). The owner can open a country or set a flat fee with the `checkout_countries` business setting; it cannot change a country's currency.
- Custom (`kind = custom`) products take a 50% deposit (storefront rule). `orders.total` holds the full value, `order_items.meta` records the deposit, and the webhook recomputes "due now" from those rows.
- The webhook compares Stripe's `amount_total` and currency with our own rows. A mismatch is flagged (`payments.status = amount_mismatch`, order `failed`), never marked paid.
- Return URLs only use origins from `ALLOWED_ORIGINS`.

## Secrets (set in the Supabase dashboard, never in chat)
Project Settings > Edge Functions > Secrets:
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (optional, default `claude-haiku-5-5`), `ALLOWED_ORIGINS` (comma separated, default `https://ravinduranganarv.github.io`), `SITE_URL` (optional).
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are injected by the platform.

## Before going live (not done yet)
1. The `products` / `product_prices` tables must contain the real catalogue (SKUs, per-country prices). Right now the storefront still uses its built-in demo data, so `create-checkout` would find nothing.
2. Create the Stripe webhook endpoint (`checkout.session.completed`, `checkout.session.expired`, `charge.refunded`) pointing at the deployed `stripe-webhook` URL, and put its signing secret in `STRIPE_WEBHOOK_SECRET`.
3. Deploy: `create-checkout` and `zaro-chat` with JWT verification on or off as you prefer (they handle anon), `stripe-webhook` with JWT verification off.
4. Test with Stripe **test mode** keys first, using Stripe's test cards.
5. The in-memory rate limit is a speed bump only (per isolate). Use the platform's limits for real throttling.
