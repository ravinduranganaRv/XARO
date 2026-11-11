"""Writes assets/xaro-quotation-template.jpg: the XARO Industries quotation template (A4 landscape), loaded on demand by quote_doc.js.
usage: python3 tools/make_quote_preset.py <template.png>"""
import sys, io
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGB').resize((1754, 1240), Image.LANCZOS)
b = io.BytesIO(); im.save(b, 'JPEG', quality=86, optimize=True, progressive=True)
open('assets/xaro-quotation-template.jpg', 'wb').write(b.getvalue())
print(len(b.getvalue()), 'bytes')
