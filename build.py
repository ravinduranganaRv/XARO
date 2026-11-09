"""Rebuild the store: python3 build.py  ->  writes index.html (standalone, GitHub Pages ready).
Edit src/store.src.html (page), src/mod/*.js|css (data layer, sign-in gate, admin panel, assistant), src/img.json (images), src/catalog_public.json (starter products)."""
import pathlib, re, hashlib, base64
R = pathlib.Path(__file__).parent
rd = lambda p: (R / p).read_text(encoding='utf-8') if (R / p).exists() else ''
CSS_MODS = ['gate', 'admin', 'admin_cat', 'admin_sys', 'bot', 'studio_acct', 'studio', 'workspace']
JS_MODS = ['costing', 'colour', 'vectorize', 'sb', 'studio_lib', 'studio_export', 'templates_extra', 'gate', 'admin', 'admin_cat', 'admin_sys', 'admin_ops', 'bot', 'studio_acct', 'workspace_core', 'workspace', 'workspace_yarn', 'workspace_vec', 'workspace_biz', 'studio_edit', 'studio3d', 'studio']
data = rd('src/mod/data.js').replace('/*%SEED_ADMIN%*/', rd('src/mod/seed_admin.json'))
art = (rd('src/store.src.html').replace('/*%IMG%*/', rd('src/img.json')).replace('/*%CATALOG%*/', rd('src/catalog_public.json'))
       .replace('/*%DATA_JS%*/', data).replace('/*%MOD_CSS%*/', '\n'.join(rd(f'src/mod/{m}.css') for m in CSS_MODS))
       .replace('/*%MOD_JS%*/', '\n'.join(rd(f'src/mod/{m}.js') for m in JS_MODS)))
cur = rd('index.html')
head = cur[:cur.index('<style>html,body')] + '<style>html,body{margin:0;background:#070807}</style>\n</head>\n<body>\n'
art = art.replace('<title>XARO Industries Store</title>\n', '').replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '')
full = head + art + '\n</body>\n</html>\n'
# ---- Content-Security-Policy: every inline script is pinned by its SHA-256, so injected markup or scripts cannot run, and the page can only talk to the hosts it really uses.
# (GitHub Pages cannot send HTTP headers, so this is a <meta> policy; frame-ancestors and similar header-only rules are not available.)
full = re.sub(r'<meta http-equiv="Content-Security-Policy"[^>]*>\n?', '', full)
full = re.sub(r'<meta name="referrer"[^>]*>\n?', '', full)
scripts = re.findall(r'<script(?![^>]*\bsrc=)(?![^>]*application/ld\+json)[^>]*>(.*?)</script>', full, re.S)
hashes = ' '.join("'sha256-%s'" % base64.b64encode(hashlib.sha256(x.encode('utf-8')).digest()).decode() for x in scripts)
SUPA = 'https://mlrydpclqokizsqmigen.supabase.co'
csp = '; '.join(["default-src 'self'", "script-src 'self' " + hashes, "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", "font-src 'self' data: https://fonts.gstatic.com",
                 "img-src 'self' data: blob: https:", "media-src 'self' data: blob:", "connect-src 'self' data: blob: " + SUPA + " https://script.google.com https://script.googleusercontent.com",
                 "worker-src 'self' blob:", "object-src 'none'", "base-uri 'self'", "form-action 'self' " + SUPA + " https://wa.me"])
tag = '<meta charset="utf-8">'; assert tag in full
full = full.replace(tag, tag + '\n<meta http-equiv="Content-Security-Policy" content="%s">\n<meta name="referrer" content="strict-origin-when-cross-origin">' % csp, 1)
(R / 'index.html').write_text(full, encoding='utf-8')
print('index.html written', round(len(full) / 1e6, 2), 'MB;', len(scripts), 'inline scripts pinned by hash')
