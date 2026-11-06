"""Rebuild the store: python3 build.py  ->  writes index.html (standalone, GitHub Pages ready).
Edit src/store.src.html (page), src/mod/*.js|css (data layer, sign-in gate, admin panel, assistant), src/img.json (images), src/catalog_public.json (starter products)."""
import pathlib
R = pathlib.Path(__file__).parent
rd = lambda p: (R / p).read_text() if (R / p).exists() else ''
CSS_MODS = ['gate', 'admin', 'admin_cat', 'admin_sys', 'bot', 'studio']
JS_MODS = ['costing', 'colour', 'sb', 'studio_lib', 'gate', 'admin', 'admin_cat', 'admin_sys', 'admin_ops', 'bot', 'studio']
data = rd('src/mod/data.js').replace('/*%SEED_ADMIN%*/', rd('src/mod/seed_admin.json'))
art = (rd('src/store.src.html').replace('/*%IMG%*/', rd('src/img.json')).replace('/*%CATALOG%*/', rd('src/catalog_public.json'))
       .replace('/*%DATA_JS%*/', data).replace('/*%MOD_CSS%*/', '\n'.join(rd(f'src/mod/{m}.css') for m in CSS_MODS))
       .replace('/*%MOD_JS%*/', '\n'.join(rd(f'src/mod/{m}.js') for m in JS_MODS)))
cur = rd('index.html')
head = cur[:cur.index('<style>html,body')] + '<style>html,body{margin:0;background:#070807}</style>\n</head>\n<body>\n'
art = art.replace('<title>XARO Industries Store</title>\n', '').replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '')
(R / 'index.html').write_text(head + art + '\n</body>\n</html>\n')
print('index.html written', round(len(head + art) / 1e6, 2), 'MB')
