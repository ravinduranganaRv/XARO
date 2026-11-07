# Browser test: 100 templates, all unique and all render to non-blank, mutually different images. Run: python3 tests/e2e/templates.py
import os, sys, json
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + os.path.abspath('index.html')); pg.wait_for_timeout(600)
    r = pg.evaluate("""() => { const L = XSTUDIO_LIB, T = L.TEMPLATES, out = { n: T.length, ids: new Set(T.map(t => t.id)).size, names: new Set(T.map(t => t.name.toLowerCase())).size, blank: [], dup: [], err: [], originals: T.slice(0, 36).every((t, i) => t.id === 'T-' + String(i + 1).padStart(3, '0')), editable: [] }, seen = new Map();
      T.forEach(t => { try { const doc = L.fromTemplate(t), c = document.createElement('canvas'); c.width = 48; c.height = 48; L.render(doc, c, {}, {}); const d = c.getContext('2d').getImageData(0, 0, 48, 48).data, cols = new Set(); let h = 0;
        for (let i = 0; i < d.length; i += 4) { cols.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]); h = (h * 31 + d[i] + 7 * d[i + 1] + 13 * d[i + 2]) | 0; }
        if (cols.size < 3) out.blank.push(t.id); if (seen.has(h)) out.dup.push(t.id + '=' + seen.get(h)); seen.set(h, t.id); if (!(doc.layers && doc.layers.length >= 2 && doc.layers.every(l => l.id && l.type && Object.values(l).every(v => typeof v !== "number" || isFinite(v))))) out.editable.push(t.id); } catch (e) { out.err.push(t.id + ':' + e.message); } });
      return out; }""")
    print(json.dumps(r)); ok = r['n'] == 100 and r['ids'] == 100 and r['names'] == 100 and r['originals'] and not (r['blank'] or r['dup'] or r['err'] or r['editable']) and not errs
    print('PASS 100 unique, editable, rendering templates' if ok else 'FAIL'); b.close(); sys.exit(0 if ok else 1)
