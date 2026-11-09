#!/usr/bin/env python3
"""Generates tools/default_yarns_1000.csv: a starter yarn library of exactly 1000 distinct shades for the Yarn Manager's Import CSV.
Columns: code,name,hex,manufacturer,material,price_per_kg,stock_kg,reorder_kg,supplier.
Prices are a flat PLACEHOLDER (edit the price_per_kg column in a spreadsheet and import again: existing codes are updated, stock is never overwritten)."""
import colorsys, csv, os
PRICE = 2500   # placeholder per kg in the business currency; replace with your real supplier price
FAMILIES = [(0,'Red'),(12,'Vermilion'),(24,'Orange'),(36,'Amber'),(48,'Gold'),(60,'Yellow'),(78,'Lime'),(100,'Green'),(130,'Emerald'),(160,'Mint'),(172,'Teal'),(186,'Cyan'),(200,'Sky'),(214,'Azure'),(226,'Blue'),(240,'Royal Blue'),(254,'Indigo'),(268,'Violet'),(282,'Purple'),(298,'Orchid'),(314,'Magenta'),(330,'Fuchsia'),(344,'Rose'),(352,'Crimson')]
LEVELS = [(18,'Deep'),(32,'Dark'),(46,'Mid'),(60,'Bright'),(76,'Light')]
SATS = [(30,'Dusty'),(48,'Muted'),(66,'Soft'),(84,'Rich'),(100,'Vivid')]
rows, seen = [], set()
def hexof(h, s, l):
    r, g, b = colorsys.hls_to_rgb(h / 360, l / 100, s / 100); return '#%02X%02X%02X' % (round(r * 255), round(g * 255), round(b * 255))
def add(name, hx):
    if hx in seen: return False
    seen.add(hx); rows.append((name, hx)); return True
# 1) chromatic grid: 24 hue families x 5 lightness x 5 saturation = 600
for h, fam in FAMILIES:
    for l, ln in LEVELS:
        for s, sn in SATS: add('%s %s %s' % (ln, sn, fam), hexof(h, s, l))
# 2) neutrals: 40 greys from black to white, cool/warm/true
for i in range(40): v = round(255 * i / 39); add('Grey %02d' % (i + 1), '#%02X%02X%02X' % (v, v, v))
for i in range(30): v = 20 + round(220 * i / 29); add('Warm Grey %02d' % (i + 1), '#%02X%02X%02X' % (min(255, v + 8), v, max(0, v - 12)))
for i in range(30): v = 20 + round(220 * i / 29); add('Cool Grey %02d' % (i + 1), '#%02X%02X%02X' % (max(0, v - 10), v, min(255, v + 10)))
# 3) earth tones, skin tones and pastels to reach exactly 1000
for i in range(100): add('Earth %03d' % (i + 1), hexof(18 + (i * 7) % 40, 25 + (i * 11) % 40, 14 + (i * 13) % 60))
for i in range(100): add('Skin %03d' % (i + 1), hexof(14 + (i * 3) % 18, 30 + (i * 7) % 45, 28 + (i * 9) % 55))
k = 0
while len(rows) < 1000:
    k += 1; add('Pastel %03d' % k, hexof((k * 37) % 360, 40 + (k * 17) % 40, 80 + (k * 5) % 14))
rows = rows[:1000]
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'default_yarns_1000.csv')
with open(out, 'w', newline='', encoding='utf-8') as f:
    w = csv.writer(f); w.writerow(['code', 'name', 'hex', 'manufacturer', 'material', 'price_per_kg', 'stock_kg', 'reorder_kg', 'supplier'])
    for i, (name, hx) in enumerate(rows, 1): w.writerow(['XR-%04d' % i, name, hx, 'XARO Standard Range', 'Acrylic', PRICE, 0, '', ''])
print('wrote', out, len(rows), 'yarns,', len(set(h for _, h in rows)), 'distinct colours')
