# DEVELOPMENT_PROGRESS

Branch: `dev/studio-pro` (never merged to `main` without the owner's explicit approval).
Scope (V5.0): (A) security of the existing site, (B) upgrade of the existing 3D Studio. The rest of the site stays as it was.
Status labels: COMPLETE AND TESTED | IMPLEMENTED BUT NOT FULLY TESTED | REQUIRES EXTERNAL CONNECTION | NOT IMPLEMENTED | BLOCKED

## Phase 0 - access, branch, homepage restore (2026-11-06)
- Branch created from `main` (57c0a40 + CI fix).
- Homepage restored to its pre-change wording and navigation (nav, hero headline/text/buttons/chip, custom section intro, footer link) by diffing against c368187. Four engine lines kept because the Studio needs them (WebGL buffer option, canvas read mode, `window.XARO` exports).
- One small entry control added inside the existing Custom builder panel: "Open the full 3D Studio".
- GitHub: push access confirmed (admin on the repo). `gh auth status` reports the injected token as invalid, but git push and the API work through the session proxy.
- Supabase: BLOCKED / REQUIRES EXTERNAL CONNECTION. The session network policy denies supabase.com and api.supabase.com, and the Supabase connector is not installed. Needed: install the Supabase connector in claude.ai (see chat).

## Phase 6a - colour reduction and yarn mapping engine (2026-11-06)
- `src/mod/colour.js` (pure functions): CIELAB + CIEDE2000, palette extraction (near colours grouped, transparency ignored, coverage %), reduction to N colours by weighted agglomerative merging, locked colours, manual merge/replace, pixel remap, nearest-yarn mapping with out-of-stock skipping and a closeness label.
- `tests/colour.test.js`: 8 tests pass, including four published CIEDE2000 reference values.
- Status: engine COMPLETE AND TESTED (unit level). The Studio screens for it (palette view, count selector, before/after, merge/lock UI) are NOT IMPLEMENTED yet.

## Phase 6b: Supabase schema v2 (multi-tenant) - applied to the real project
Project XARO-STUDIO (Singapore). All six migrations are applied remotely and mirrored in supabase/migrations.
- 0001 store schema, 0002 RLS + private helper schema, 0003 seed roles/permissions: applied.
- 0004 tenancy (businesses, members, designs/folders/versions, yarn library + movements, quotations, orders, production sheets, rates, audit): applied.
  Its four DROP statements only replaced my own earlier policies/constraints on the empty project (approved by the owner).
- 0005 private storage: 3 private buckets (design-originals 8 MB, design-exports 20 MB, business-assets 2 MB), path-based policies.
- 0006 advisor fixes: 38 foreign-key indexes, auth.uid() cached per statement, overlapping policies merged, storage policies merged to 4.
- Verification on the REAL project: tenancy isolation test TENANCY_TESTS_PASSED 63 (run twice: before and after 0006; rolled back, no leftover rows).
  Local Postgres: rls_test 51 checks + tenancy 63 checks pass with all six migrations (also run in CI).
- Advisors: security = 3 WARN, intentional (create_business, become_rugmaker, add_business_member are callable by signed-in users and check identity inside).
  Performance = only INFO "unused index" (expected on an empty database).
- Not yet done: set business_settings 'owner_email' (needs the owner's email), edge functions adapted to the schema, front-end Supabase client.
- Status: schema and database security COMPLETE AND TESTED (database level). Browser-to-Supabase auth/upload flows: not yet built, and cannot be exercised live from the build sandbox.

## Owner account
- Owner claim is currently DISABLED: no business_settings row 'owner_email' exists and no account holds the owner role (owner confirmed this is still pending).
- The mechanism is verified (real project, rolled-back test): once an 'owner_email' setting exists, only an account with that VERIFIED email, while no owner exists, becomes owner; metadata cannot grant roles; a second claim is refused.
- To enable: the owner gives the address; a single insert into business_settings ('owner_email'). Keep "Confirm email" enabled in Supabase Auth (Authentication > Providers > Email).

## Update 2026-11-10: owner configured, default rates
- Owner email supplied by the owner and stored in business_settings 'owner_email' (is_public=false) on the real Supabase project. No account exists yet; the owner must sign up with that address and VERIFY the email, then the first verified claim becomes owner (mechanism tested earlier on the real project). Confirm-email must stay enabled.
- Storefront costing: yarn kg/m² now starts at typical tufting averages (low 1.8, standard 2.5, high 3.5, carved 3.0). All rates remain editable in Admin > Costing; blank hides the yarn figure. Rug-maker workspace rates remain each maker's own (nothing assumed).
