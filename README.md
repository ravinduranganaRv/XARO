# XARO Industries - store, admin panel and assistant

Hand-tufted keyboard rugs and 3D wall art (Sri Lanka, shipped worldwide). Real-time 3D scene in raw WebGL, no libraries.

**Demo mode:** no payments are taken. Data is stored in each visitor's own browser until a backend is connected. **Read `docs/BACKEND.md` before going live.**

## What is in it
- Customer sign-in gate (name, email, phone, country, currency), then the shop.
- Per-country price lists (LKR, USD, AED, GBP, AUD) set by you; the customer picks country and display currency.
- Admin panel at `#admin` (footer: "Staff login"): Dashboard and analytics, Customers, Orders, Products (add / edit / remove), Prices (matrix + bulk %), Admin users with permissions, Assistant (knowledge base, unanswered questions, chats), Settings (countries, exchange rates, Google Sheet sync, backup / reset).
- "Zaro", an animated robot assistant (bottom right) that reacts to what visitors do and answers from your knowledge base. It is rule-based, not a generative AI.

## Files
- `index.html` - built standalone page (GitHub Pages serves this). Rebuild with `python3 build.py`.
- `src/store.src.html` - page markup, styles, 3D engine and shop logic
- `src/mod/` - `data.js` (data layer), `gate`, `admin*`, `bot` modules, `seed_admin.json` (owner login hash)
- `tools/make_seed.py` - set the owner password; `apps_script/Code.gs` - Google Sheet receiver; `docs/BACKEND.md`

## Owner login
Username `Ravindu20007`. Change the password straight away: `python3 tools/make_seed.py "a long new passphrase"`, then `python3 build.py`, commit and push. The login is checked in the browser, so it is a convenience lock, not real security (see `docs/BACKEND.md`).

## Studio, costing and database (latest)
- Custom Studio: open from the nav, hero button or `#studio`. Code in `src/mod/studio*.js`.
- Costing engine: `src/mod/costing.js` (pure functions, `node --test tests/costing.test.js`). Rates are editable in Admin > Costing and are placeholders.
- Database: `supabase/migrations` + `supabase/tests/run.sh` (needs a throwaway Postgres 15+). Edge function skeletons in `supabase/functions`. Copy `.env.example`; never commit keys.
- Rebuild the page after editing `src/`: `python3 build.py`. CI fails if `index.html` is stale.
