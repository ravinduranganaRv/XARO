# Making the admin panel real (read this)

GitHub Pages is a static host: there is no server. In this version everything (customers, orders, price edits, added products, admin users) is saved **in the browser that made it**. So on the live site:

* customers sign up and order, but their data stays in *their* browser;
* the admin panel shows only data from the browser you open it in;
* the admin login is a convenience lock in the page's own code, not real security.

## Step 1: collect customers and orders in a Google Sheet (free, works today)
1. Create a Google Sheet, Extensions > Apps Script, paste `apps_script/Code.gs`.
2. Deploy > New deployment > Web app, access "Anyone". Copy the `.../exec` URL.
3. Admin > Settings > "Save data to a Google Sheet": paste it and press "Send a test row".
Sign-ups, orders and callback requests from every visitor now land in the sheet.

## Step 2: full online admin (recommended before taking real orders)
Move `XD` (in `src/mod/data.js`) to a hosted database with real accounts, e.g. Supabase or Firebase: products and prices in a table anyone can read but only admins can write; customers and orders readable only by admins; admin sign-in via the provider's auth. The rest of the site only talks to `XD`, so the swap is contained.

## Owner password
The owner login ships as a salted hash in `src/mod/seed_admin.json`. Change it for everyone with
`python3 tools/make_seed.py "a long new passphrase"`, then `python3 build.py` and push. Changing it inside the admin panel only changes it in that browser.
