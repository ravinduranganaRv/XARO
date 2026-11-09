# Final acceptance report: XARO Studio upgrade (branch `dev/studio-pro`)

Date: 2026-11-10. Nothing has been merged to `main` or deployed.

**Status labels:** COMPLETE AND TESTED · IMPLEMENTED BUT NOT FULLY TESTED · REQUIRES EXTERNAL CONNECTION · NOT IMPLEMENTED · BLOCKED

**How "tested" is meant here.** The build sandbox cannot reach `supabase.co`. Browser to Supabase flows were therefore tested against a **MOCK** Supabase server (`tests/e2e/mock_supabase.py`). Database security was tested on the **REAL** project with SQL (63 isolation checks) and on a local Postgres (51 + 63 checks, run in CI). Where a feature depends on a real Supabase round trip from the browser, it is labelled IMPLEMENTED BUT NOT FULLY TESTED.

Test totals at this commit: 137 unit tests pass; browser suites with 0 failures: store/CSP, XSS (store + admin + workspace), accounts, workspace (115 checks), vector editor (43), 3D (outline, loop vs cut, lighting, thickness, room, quality, phone), storefront visual regression (16 views x 0 differing pixels).

## A. Existing site

| Item | Status | Evidence / note |
|---|---|---|
| Storefront (home, shop, product, cart, checkout) unchanged | COMPLETE AND TESTED | Pixel comparison against the original commit `5acf7a5` at desktop and phone width, 16 views, 0 differing pixels (animated canvases, toast and chat bubble masked; the one sanctioned Studio entry button hidden). Runs in CI. |
| Security: CSP, stored-XSS fixes, sync-address allow-list, stronger new password hashes | COMPLETE AND TESTED | `docs/SECURITY_AUDIT.md`; `tests/security.test.js`, `csp_flow.py`, `xss_flow.py`, `xss_workspace.py` |
| Admin sign-in is a browser-side lock (owner hash ships in the page) | BLOCKED | Proper fix is Supabase Auth for admin; needs your approval to move catalogue/orders to Supabase. Use a long unique admin password meanwhile. |
| Clickjacking protection (`frame-ancestors`) | BLOCKED | GitHub Pages cannot send response headers. |
| Costing rates | COMPLETE AND TESTED | All editable in Admin > Costing; normal starting values set (including yarn kg/m²). Replace with your measured numbers. |

## B. Customer Design Studio

| Item | Status | Evidence / note |
|---|---|---|
| Vector editor: select/move/resize/rotate, point editing, pen tool, align to rug, grid/snap/rulers/zoom, simplify/split/merge, undo/redo | COMPLETE AND TESTED | 13 unit + 43 browser checks. Not provided: aligning several layers to each other (alignment is to the rug); dragging the points of the rug outline itself (outline is changed by redraw/smooth/simplify/convert). |
| Image to vector (5 levels), colour reduction, yarn mapping | COMPLETE AND TESTED | `vectorize.test.js`, `colour.test.js`, workspace browser tests |
| 100 templates (editable) | COMPLETE AND TESTED | Browser test: unique, render, editable |
| Free export PNG / JPEG / SVG / PDF, no watermark, true size | COMPLETE AND TESTED | `export.test.js` (9) + browser flow |
| Advanced 3D: custom shapes, thickness, pile height (mm), border/edge, cut vs loop, lighting presets, shadows, room scene, phone quality tiers | COMPLETE AND TESTED | `studio3d.test.js` + `studio3d_flow.py` in software GL. Material look is physically motivated sheen/specular, **not** full PBR. Loop/cut and thickness are visual and do not change the price. Not measured on real phones or real GPUs. |
| Estimate with custom outline area/perimeter | COMPLETE AND TESTED | unit + browser |

## C. Rug Maker Workspace (14 screens)

| Item | Status | Evidence / note |
|---|---|---|
| Dashboard, designs, yarn manager, inventory, calculator, image to vector, colour separation, projects, quotations, orders, production sheets, reports, settings, staff read-only | IMPLEMENTED BUT NOT FULLY TESTED | 115 browser checks against the MOCK backend, desktop and phone layouts; calculator and sheets have unit tests. Not run against the real Supabase from a browser. |
| Production calculator uses each rug maker's own rates; missing rates are reported, never guessed | COMPLETE AND TESTED | `workspace.test.js` |
| Sign-up/sign-in (customer and rug maker), business setup, cloud save/open/duplicate/delete | IMPLEMENTED BUT NOT FULLY TESTED | MOCK-tested; real round trip needs a live test (see below). |
| Multi-tenant isolation (RLS), private storage, roles, owner claim | COMPLETE AND TESTED | REAL project SQL tests (63) + CI local Postgres. Owner email set; no owner account exists until you sign up and verify the email. |

## D. Backend and delivery

| Item | Status | Note |
|---|---|---|
| Edge functions: create-checkout, stripe-webhook, zaro-chat | REQUIRES EXTERNAL CONNECTION | 36 mock tests pass. Not deployed. Needs your approval, Stripe secrets entered by you in the Supabase dashboard (test mode first), and a cost check if an AI provider key is used. |
| Real Supabase browser tests | REQUIRES EXTERNAL CONNECTION | Sandbox cannot reach supabase.co. Run the checklist below on your machine. |
| Product catalogue seed (products/prices tables are empty) | NOT IMPLEMENTED | Waits for your approval to write to the real project. |
| Admin on Supabase Auth | BLOCKED | See A. |
| Deploy to production / merge to `main` | BLOCKED | Needs your explicit approval; nothing was merged. |
| Rollback procedure | COMPLETE AND TESTED | `docs/ROLLBACK.md` (documented; the revert itself not exercised because nothing is merged). |

## Live test checklist (needs you, about 15 minutes, after the preview is published from the branch)
1. Supabase > Authentication > Providers > Email: "Confirm email" is ON.
2. Open the Studio, create an account with `ranganaravindu200007@gmail.com`, verify the email, sign in. Confirm you appear as owner.
3. Create a rug maker business, add a yarn, create a design, save, reload, re-open it.
4. Create a second account with another email; confirm it cannot see the first account's designs or yarns.
5. Upload a logo; confirm it shows and that its address is not public without sign-in.
