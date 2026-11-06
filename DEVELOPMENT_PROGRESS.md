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
