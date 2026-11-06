# Master-prompt audit and roadmap (updated after phases 2-4)

Status key: DONE = built and tested in this repo | PARTIAL | NOT STARTED | NEEDS ACCOUNT (external service required).

| Area (from the master prompt) | Status | Note |
|---|---|---|
| Premium dark brand, neon accent, responsive | PARTIAL | Kept the logo's #39FF14 on near-black with glass panels. Space Grotesk/Inter/Manrope and the #C6FF3D palette were NOT applied (brand colour kept on purpose) |
| Cinematic hero with real-time 3D rug | DONE | Custom WebGL, no libraries. Hero headline and nav follow the master prompt |
| Product catalogue, cart, checkout form | DONE (demo) | No real payment; orders stay in the browser |
| Customer sign-in | PARTIAL | Name/email/phone gate; no email verification, no real accounts |
| Admin: dashboard, products, prices, customers, orders, admin users + permissions | DONE (demo) | Runs in the browser; permissions are NOT enforced on a server until Supabase is connected |
| Zaro assistant | PARTIAL | Rule-based in the browser. `supabase/functions/zaro-chat` is an untested skeleton for a secure AI backend |
| Per-country LKR/USD/AED/GBP/AUD prices | DONE | See docs/PRICING.md |
| 3D Custom Rug Studio | DONE (v1, tested in headless Chromium) | Layers, shapes, text, image upload (SVG sanitised), 36 templates (not 100), yarn-colour separation, rect/square/circle/oval, pile/backing/border/frame, undo/redo, live 3D, save designs, PNG download, quotation, add to cart. NOT built: freeform outline, loop-vs-cut pile simulation, pan, background removal, AI image-to-rug |
| Yarn library, costing engine, quotations | DONE (rates are placeholders) | Admin tabs Costing, Yarn library, Quotations. 11 unit tests. Replace default rates with measured costs |
| Customer portal, live 13-stage tracking, production Kanban, inventory, invoices | NOT STARTED | Schema exists (production_jobs/updates, yarn_inventory); no UI yet. Basic 5-stage tracker remains |
| Supabase database, auth, Row Level Security | SCHEMA DONE and tested on a local Postgres 16 | 51 RLS/trigger assertions pass (`supabase/tests/run.sh`) using a small stand-in for Supabase's auth schema. NOT yet applied to a real Supabase project; the site does not read from it yet |
| Stripe / UAE payment provider, webhooks | SKELETON | `create-checkout` and `stripe-webhook` edge functions written, never run against Stripe. Needs accounts and keys |
| AI image-to-rug | NEEDS ACCOUNT | Needs an AI provider key on a backend |
| React + TypeScript + Vite + R3F migration | NOT STARTED | Staged on the existing vanilla architecture instead |
| SEO (sitemap, robots, structured data, canonical, Open Graph) | DONE | Hash routes are not separately indexable; a multi-page build would improve this |
| CI (syntax, unit tests, build freshness, RLS tests, secret scan) | WRITTEN | `.github/workflows/ci.yml`; first run happens on GitHub after push |

Next: (a) create a Supabase project, apply `supabase/migrations`, and move the shop, studio saves and admin onto it; (b) payments; (c) production board, customer portal and invoices; (d) real AI for Zaro. Each phase is tested before the next.
