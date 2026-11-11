# XARO full-site audit, 11 Nov 2026

Method: Supabase security + performance advisors on the real project, table/RLS listing, edge-function listing, secret scan of the repo and built page, CSP review, headless-browser check of the built page (390px phone width), plus the 155 unit / 10 browser / 65 database test results. The live GitHub Pages URL could not be opened from the build sandbox, so a manual smoke test is still needed (list at the end).

## Security: what is good
- Row-level security is ON for all 38 public tables; tenancy and RLS tests pass (65 checks).
- No secrets in the repo or the page. The only key in the page is the Supabase *publishable* key (public by design).
- Content-Security-Policy with hash-pinned scripts, `object-src 'none'`, restricted `connect-src`/`form-action`; XSS tests pass (storefront and workspace).
- `send-quotation` edge function: JWT required, recipient read server-side, origin allow-list, size cap, rate limit. Dormant (answers "not set up") until the email secrets exist.
- Email confirmation is required before an account is usable.

## Security: things to fix or decide (highest first)
1. **Store admin login is browser-side only.** The admin record (salt + password hash) ships in the public repo/page, so anyone can try passwords offline against it, and admin data (orders, quotes, settings) lives in the browser plus the Google Sheet, not behind server rules. Short-term: use a long random passphrase (14+ characters) and change it with the offline tool in `tools/admin_password_tool.html`. Proper fix: move admin sign-in to Supabase Auth (needs your approval).
2. **Leaked-password protection is OFF** (Supabase advisor WARN). Turn it on in Supabase → Authentication → Password security (may require the Pro plan).
3. **Supabase built-in email is heavily rate-limited** (a few emails per hour). Sign-up codes/links will fail once several people register. Set a custom SMTP (Resend offers SMTP) in Authentication → SMTP.
4. **Free plan limits:** projects pause after about a week of no activity (sign-in would break) and there are no managed backups. Plan: export the database regularly, or move to Pro before real customers.
5. **Public Google Apps Script endpoint** ("Anyone") can be spammed with junk rows. It has size and spreadsheet-injection guards, so impact is low; a static site cannot hide a secret to fix it fully.
6. **GitHub Pages cannot send security headers.** CSP is set by meta tag, but clickjacking protection (`frame-ancestors`) cannot work this way. Optional fix: put the site behind a free Cloudflare proxy or custom domain.
7. Advisor WARN "SECURITY DEFINER functions executable by signed-in users" (`create_business`, `become_rugmaker`, `add_business_member`): intentional (they check the caller inside and are covered by tests). No change.
8. Minor: CSP allows `style-src 'unsafe-inline'` and `img-src https:`; tighten later.

## Settings still to do (Supabase / accounts)
- Resend: add secrets `RESEND_API_KEY`, `QUOTE_FROM_EMAIL`, `ALLOWED_ORIGINS` (Edge Functions → Secrets); verify a sender domain, otherwise mail only reaches your own address.
- Authentication → Email Templates → "Confirm signup": add `{{ .Token }}` so the 6-digit code appears.
- Authentication → URL Configuration: Site URL and redirect URLs = https://ravinduranganarv.github.io/XARO.
- Stripe: not connected (functions not deployed); needs your keys in dashboard secrets, never in chat.
- Mobile OTP: deferred by you.

## Performance
- `index.html` is 2.86 MB (loads in 1.6 s locally; expect a few seconds on mobile data). About 0.5 MB is the embedded quotation template image, which does not compress. Recommendation: load the template (and other big images) on demand from `assets/`.
- Advisor: 44 unused indexes (INFO). Ignore for now; tables are nearly empty.
- `audit_logs` already has 1,031 rows (mostly the 1,000-yarn import). Set a retention rule later.

## Design / accessibility / SEO
- Phone width (390 px): no horizontal overflow; 1 `h1`; all form fields labelled; all buttons/links named; language, viewport, description, canonical, sitemap, robots and OG image all present.
- 1 of 24 images has no `alt` text: add one.
- Not yet audited: colour contrast of the neon-green-on-black areas, keyboard use of the 3D Studio, screen-reader use of the Studio canvas.
- Quotation template says "INVOICE" (artwork). Supply a "QUOTATION" version, or rename the document type.
- Contact numbers and website on the template (+94 786472825 / +94 78 483 0704, +971 508590489, Xaroproducts.com) must match the store's settings; if you own xaroproducts.com, point it at the site.

## Data / content
- Catalogue tables (products, categories, prices) are empty; the storefront still uses built-in data. Seed the real catalogue before relying on the database.
- Real Supabase: 1 owner, 1 business, 1,000 yarns imported. Design save/reload and second-account isolation tests on the real project are still unreported.

## Testing gaps
- Browser-to-Supabase is tested against a mock, apart from your manual checks; real email sending, Stripe and the live URL are untested.
- Manual smoke test on the live site: storefront homepage, Studio (upload image, preview, download), sign-up with code, rug-maker business, calculator, yarn manager, quotation download, admin login, admin quotation download.
