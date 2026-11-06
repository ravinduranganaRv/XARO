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

## Phase 6b: Supabase schema v2 (multi-tenant) - in progress
- Supabase access verified (project XARO-STUDIO, Singapore). Migrations 0001-0003 applied to the remote project.
- 0004_tenancy (rug maker businesses, RLS, yarn movements, audit) and 0005_storage (private buckets) are written and pass locally (rls_test 51 checks, tenancy_test 63 checks) but are NOT yet applied remotely: the connector is waiting for the owner to approve a migration containing destructive statements (drop policy / drop constraint on objects created minutes earlier).
- Next: apply 0004/0005, run tenancy_test remotely, review advisors, then front-end integration.
- Status: IMPLEMENTED BUT NOT FULLY TESTED (remote verification pending; browser-to-Supabase E2E cannot be run from the build sandbox).
