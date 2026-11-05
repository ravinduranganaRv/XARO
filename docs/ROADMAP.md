# Master-prompt audit and roadmap (phase 1)

Status key: DONE = built and tested in this repo | PARTIAL | NOT STARTED | NEEDS ACCOUNT (external service required).

| Area (from the master prompt) | Status | Note |
|---|---|---|
| Premium dark brand, neon accent, responsive | PARTIAL | Current palette is #39FF14 on black; glass panels, Space Grotesk/Inter not applied yet |
| Cinematic hero with real-time 3D rug | DONE | Custom WebGL, no libraries |
| Product catalogue, cart, checkout form | DONE (demo) | No real payment; orders stay in the browser |
| Customer sign-in | PARTIAL | Name/email/phone gate; no email verification, no real accounts |
| Admin: dashboard, products, prices, customers, orders, admin users + permissions | DONE (demo) | Runs in the browser; permissions are NOT enforced on a server |
| Zaro assistant | PARTIAL | Rule-based; no AI provider, no backend |
| Per-country LKR/USD/AED/GBP/AUD prices | DONE | See docs/PRICING.md |
| 3D Custom Rug Studio (layers, shapes, templates, undo/redo) | PARTIAL | Simple upload-to-3D builder exists; no studio, no 100 templates |
| Yarn library, costing engine, quotations | NOT STARTED | |
| Customer portal, live 13-stage tracking, production Kanban, inventory, invoices | NOT STARTED | Basic 5-stage tracker exists |
| Supabase database, auth, Row Level Security, storage | NEEDS ACCOUNT | Needs a Supabase project and keys (never in the repo) |
| Stripe / UAE payment provider, webhooks | NEEDS ACCOUNT | Needs provider accounts and server code |
| AI image-to-rug | NEEDS ACCOUNT | Needs an AI provider key on a backend |
| React + TypeScript + Vite + R3F migration, CI | NOT STARTED | Large change; staged migration recommended |
| SEO (sitemap, robots, structured data) | NOT STARTED | |

Recommended order: (2) foundation and Supabase schema with auth and RLS, (3) move shop/admin to the database, (4) custom studio, (5) payments, (6) production/inventory, (7) real AI for Zaro. Each phase is tested before the next starts.
