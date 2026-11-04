"""Rebuild the store from src/ : python3 build.py  ->  writes index.html (standalone, GitHub Pages ready).
Edit src/store.src.html (markup, CSS, JS); src/img.json holds base64 images; src/catalog_public.json holds products and prices."""
import re, pathlib
R = pathlib.Path(__file__).parent
src = (R / "src/store.src.html").read_text()
art = src.replace("/*%IMG%*/", (R / "src/img.json").read_text()).replace("/*%CATALOG%*/", (R / "src/catalog_public.json").read_text())
cur = (R / "index.html").read_text()
head = cur[:cur.index("<style>html,body")]            # keep the standalone <head> (title, meta, favicon)
head += "<style>html,body{margin:0;background:#070807}</style>\n</head>\n<body>\n"
art = art.replace('<title>XARO Industries Store</title>\n', '').replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '')
(R / "index.html").write_text(head + art + "\n</body>\n</html>\n")
print("index.html written", round(len(head + art) / 1e6, 2), "MB")
