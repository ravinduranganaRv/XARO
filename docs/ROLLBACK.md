# Rollback procedure

Nothing from the Studio upgrade is on `main` or live yet. Everything is on branch `dev/studio-pro`. Until you approve a merge, the live site cannot be affected by this work.

## Before the merge (now)
Nothing to undo. Delete or ignore the branch.

## After a merge to `main` (if ever approved)
The live site is static files on GitHub Pages, so a rollback is "put the old files back".

1. Find the merge commit: `git log --merges -3 origin/main`.
2. Revert it: `git revert -m 1 <merge-commit>` then `git push origin main`. GitHub Pages republishes in about a minute. (Or `git checkout <last good commit> -- index.html` and commit.)
3. Check `https://ravinduranganarv.github.io/XARO` after the rebuild; hard-refresh the browser.
- Last commit on `main` before any of this work: `de0b8c9`. The original storefront (before any Studio changes): `5acf7a5`.
- Note: today's live `main` page has different homepage wording from the original (changed in `57c0a40`). The `dev/studio-pro` branch restores the original wording, so reverting to `de0b8c9` brings the changed wording back; revert to `5acf7a5`'s `index.html` if you want the original.

## Database (Supabase project `mlrydpclqokizsqmigen`)
- The storefront does not use Supabase, so a front-end rollback needs no database change.
- Migrations `0001`-`0006` are additive and already applied. They only affect the Studio tables, buckets and policies. Leave them in place when rolling back the page.
- To undo the owner setting: `delete from public.business_settings where key = 'owner_email';` (only before the owner has signed up; after that the owner role row exists in `business_members`).
- To fully remove the Studio database (destroys saved designs): create a new Supabase project instead of dropping objects by hand, or restore from a Supabase backup. Ask before doing this.

## Edge functions
Not deployed. When they are: Supabase dashboard > Edge Functions > select function > delete, or redeploy the previous version.

## Secrets
If any secret is ever exposed, rotate it in the Supabase / Stripe dashboard immediately; do not rely on deleting a commit.
