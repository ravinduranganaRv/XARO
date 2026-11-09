# Browser test of the advanced 3D preview + custom outlines (software WebGL). Run: python3 tests/e2e/studio3d_flow.py   (after python3 build.py)
import os, re, sys, io, json, base64
from playwright.sync_api import sync_playwright
from PIL import Image
OUT = '/tmp/x3d'; os.makedirs(OUT, exist_ok=True); fails = []
def check(c, msg):
    print(('PASS ' if c else 'FAIL ') + msg)
    if not c: fails.append(msg)
with sync_playwright() as p:
    br = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']); ctx = br.new_context(viewport={'width': 1360, 'height': 860}); pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type in ('error', 'warning') and 'Failed to load resource' not in m.text and 'willReadFrequently' not in m.text and 'GPU stall' not in m.text and 'swiftshader' not in m.text.lower() else None)
    pg.route(re.compile(r'^https?://'), lambda r: r.abort()); pg.set_default_timeout(15000); _click = pg.click; pg.click = lambda sel, **k: _click(sel, no_wait_after=True, **k)
    pg.add_init_script("window.requestAnimationFrame=cb=>setTimeout(()=>cb(performance.now()),150);")
    pg.goto('file://' + os.path.abspath('index.html')); pg.wait_for_timeout(800)
    pg.evaluate("document.getElementById('gate') && document.getElementById('gate').remove(); document.body.classList.remove('gate-open'); XSTUDIO.open()"); pg.wait_for_selector('#studio.on')
    doc = lambda: pg.evaluate("XSTUDIO.getDoc().doc")
    def load(d3=None, **kw):
        pg.evaluate("""([d3, kw]) => { const L = XSTUDIO_LIB, lum = h => { const n = parseInt(h.slice(1), 16); return 0.3 * (n >> 16) + 0.59 * (n >> 8 & 255) + 0.11 * (n & 255); }, ys = L.yarnList().slice(), bright = (kw.bg === 'MID' ? ys.sort((a, b) => Math.abs(lum(a.hex) - 60) - Math.abs(lum(b.hex) - 60)) : ys.sort((a, b) => lum(b.hex) - lum(a.hex)))[0].id; delete kw.bg; const d = L.newDoc(Object.assign({ widthCm: 80, heightCm: 60, shape: 'rect', radius: 0, bg: bright, layers: [], borderType: 'none', pile: 'standard' }, kw)); if (d3) d.d3 = d3; XSTUDIO.loadDoc(d, { view: 'v3d' }); }""", [d3, kw]); pg.wait_for_timeout(900)
    def top_view():
        pg.evaluate("document.querySelector('[data-cam=front]').click()"); pg.wait_for_timeout(700)
    def shot(name=None):
        d = pg.evaluate("document.getElementById('st3').toDataURL('image/png')"); im = Image.open(io.BytesIO(base64.b64decode(d.split(',')[1]))).convert('RGB')
        if name: im.save(OUT + '/' + name + '.png')
        return im
    def bright_px(im, thr=150):
        px = im.load(); w, h = im.size; return sum(1 for y in range(0, h, 2) for x in range(0, w, 2) if max(px[x, y]) > thr)
    def gl_ok(): return pg.evaluate("!!(XSTUDIO.getDoc && document.getElementById('st3').width > 10)")

    # ---------- baseline renders (rect) and shader compile
    load(); top_view(); base = shot('rect_top'); b_rect = bright_px(base); check(b_rect > 2000, 'rectangular rug renders in the 3D view (%d bright samples)' % b_rect)
    check(pg.evaluate("!!document.querySelector('#studio [data-lt=d3]')"), 'the Studio has a 3D tab')

    # ---------- custom outline: heart
    pg.evaluate("document.querySelector('[data-lt=size]').click()"); pg.select_option('#stShape', 'custom'); pg.wait_for_timeout(300)
    check(doc()['shape'] == 'custom' and len(doc()['outline']) >= 3, 'choosing Custom outline gives a default freeform outline (%d points)' % len(doc().get('outline', [])))
    pg.click('[data-ol="heart"]'); pg.wait_for_timeout(1500); top_view(); pg.wait_for_timeout(600)
    d = doc(); check(d['shape'] == 'custom' and len(d['outline']) >= 6, 'heart preset sets the outline')
    area = pg.evaluate("XEDIT.polyArea(XSTUDIO.getDoc().doc.outline)")
    heart = shot('heart_top'); b_heart = bright_px(heart); ratio = b_heart / b_rect
    check(abs(ratio - area) < 0.16, '3D silhouette follows the outline: bright area %.2f of the rectangle vs outline area %.2f' % (ratio, area))
    c2 = pg.evaluate("""() => { const c = document.getElementById('stC'), x = c.getContext('2d'); const a = (u, v) => x.getImageData(Math.floor(u * c.width), Math.floor(v * c.height), 1, 1).data[3]; return [a(0.02, 0.02), a(0.5, 0.5), a(0.98, 0.02)]; }""")
    check(c2[0] == 0 and c2[2] == 0 and c2[1] > 200, '2D artwork is cut to the outline (corners transparent, middle solid) %s' % c2)
    svg = pg.evaluate("XEXP.svg(XSTUDIO.getDoc().doc, XSTUDIO_LIB.yarnList())"); check('<polygon' in svg and 'clipPath' in svg, 'SVG export uses the custom outline')
    est = pg.evaluate("(() => { const e = document.querySelector('#stEst'); return e ? e.textContent : ''; })()")
    pg.evaluate("document.querySelector('[data-lt=lay]').click()"); pg.evaluate("document.querySelector('[data-lt=add]').click()"); pg.wait_for_timeout(100)
    # refresh estimate area from the right-hand panel
    area_txt = pg.evaluate("(() => { const r = [...document.querySelectorAll('#stEst .k')].find(k => /Area/.test(k.textContent)); return r ? r.textContent : ''; })()"); a_cm2 = int(re.search(r'(\d+)\s*cm', area_txt).group(1)) if area_txt else -1
    check(0 < a_cm2 < 80 * 60 * 0.9, 'price estimate uses the outline area (%s cm2, box is %d)' % (a_cm2, 80 * 60))
    pg.screenshot(path=OUT + '/heart_ui.png')

    # ---------- pen outline
    pg.evaluate("document.querySelector('[data-lt=size]').click()"); pg.click('#olPen'); pg.wait_for_timeout(150)
    g = pg.evaluate("(() => { const r = document.getElementById('stO').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()")
    for u, v in [(0.1, 0.9), (0.5, 0.1), (0.9, 0.9), (0.5, 0.6)]: pg.mouse.click(g[0] + u * g[2], g[1] + v * g[3])
    pg.keyboard.press('Enter'); pg.wait_for_timeout(500)
    o = doc()['outline']; check(len(o) == 4 and doc()['shape'] == 'custom', 'pen-drawn outline becomes the rug shape (%d points)' % len(o))
    pg.click('#olSmooth'); pg.wait_for_timeout(200); check(len(doc()['outline']) == 8, 'Smooth corners rounds the outline')
    n_before = len(doc()['outline']); pg.click('#olSimp'); pg.wait_for_timeout(200); check(len(doc()['outline']) <= n_before, 'Fewer points never adds points')
    n_mid = len(doc()['outline']); pg.click('#olSmooth'); pg.wait_for_timeout(200); n_now = len(doc()['outline'])
    pg.keyboard.press('Control+z'); pg.wait_for_timeout(200); check(n_now == 2 * n_mid and len(doc()['outline']) == n_mid, 'undo works on the outline (%d -> %d -> %d)' % (n_mid, n_now, len(doc()['outline'])))

    # ---------- 3D settings
    load(bg='MID'); top_view(); pg.evaluate("document.querySelector('[data-lt=d3]').click()"); pg.wait_for_selector('#d3style')
    g0 = pg.evaluate("XSTUDIO.__g && XSTUDIO.__g()")
    pg.select_option('#d3quality', 'high'); pg.wait_for_timeout(500)
    sh = lambda: pg.evaluate("(() => { const v = document.getElementById('st3'); return null; })()")
    lum = lambda im: (lambda c: sum(c.tobytes()) / len(c.tobytes()))(im.convert('L').crop((int(im.width * .35), int(im.height * .42), int(im.width * .65), int(im.height * .52))))
    def lum3():
        v = []
        for _ in range(3): v.append(lum(shot())); pg.wait_for_timeout(450)
        return sorted(v)[1]
    cut = shot('cut'); pg.select_option('#d3light', 'day'); pg.wait_for_timeout(1500); l_day_ref = lum3(); pg.select_option('#d3light', 'dramatic'); pg.wait_for_timeout(1500); dram = shot('dramatic'); l_dram = lum3()
    check(l_dram < l_day_ref * 0.85, 'dramatic lighting is darker than daylight (%.1f vs %.1f)' % (l_dram, l_day_ref))
    pg.select_option('#d3light', 'day'); pg.wait_for_timeout(1500); day = shot('day'); l_day = lum3(); check(abs(l_day - l_day_ref) < 0.3 * l_day_ref, 'lighting presets are steady, not flickering (%.1f vs %.1f)' % (l_day, l_day_ref))
    pg.select_option('#d3light', 'studio'); pg.wait_for_timeout(1000)
    pg.select_option('#d3style', 'loop'); pg.wait_for_timeout(1600); loop = shot('loop')
    diff = sum(abs(a - b) for a, b in zip(cut.resize((64, 48)).tobytes(), loop.resize((64, 48)).tobytes())); check(diff > 1500 and doc()['d3']['style'] == 'loop', 'loop pile renders differently from cut pile (diff %d) and is saved in the design' % diff)
    pg.select_option('#d3mat', 'polyester'); pg.wait_for_timeout(600); check(doc()['d3']['mat'] == 'polyester', 'yarn look is saved')
    pg.evaluate("(() => { const s = document.getElementById('d3pileMm'); s.value = 25; s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })); })()"); pg.wait_for_timeout(700)
    check(doc()['d3']['pileMm'] == 25 and 'mm' in pg.inner_text('#d3pileMmV'), 'pile height slider stores millimetres'); pg.click('#d3pileAuto'); pg.wait_for_timeout(300); check(doc()['d3']['pileMm'] is None, 'reset returns to the pile type height')
    pg.evaluate("document.querySelector('[data-cam=side]').click()"); pg.select_option('#d3light', 'studio')
    pg.evaluate("(() => { const s = document.getElementById('d3thickMm'); s.value = 25; s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })); })()"); pg.wait_for_timeout(1000); thick = shot('thick25')
    pg.evaluate("(() => { const s = document.getElementById('d3thickMm'); s.value = 0; s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })); })()"); pg.wait_for_timeout(1000); thin = shot('thick0')
    check(sum(abs(a - b) for a, b in zip(thick.resize((64, 48)).tobytes(), thin.resize((64, 48)).tobytes())) > 800, 'rug thickness changes the edge in the 3D view')

    # ---------- room scene
    pg.select_option('#d3scene', 'room'); pg.wait_for_timeout(300); pg.evaluate("document.querySelector('[data-cam=angle]').click()"); pg.wait_for_timeout(1400); room = shot('room_wood')
    check(pg.evaluate("!!document.querySelector('#d3floor') && !!document.querySelector('#d3furn')"), 'room options appear (floor, furniture)')
    px = room.load(); w, h = room.size; nonblack = sum(1 for y in range(0, h, 4) for x in range(0, w, 4) if max(px[x, y]) > 40) / ((w // 4) * (h // 4))
    check(nonblack > 0.55, 'the room fills most of the view (%.0f%% lit pixels)' % (nonblack * 100))
    pg.select_option('#d3floor', 'tile'); pg.wait_for_timeout(1000); tile = shot('room_tile')
    check(sum(abs(a - b) for a, b in zip(room.resize((64, 48)).tobytes(), tile.resize((64, 48)).tobytes())) > 2000, 'changing the floor changes the room')
    pg.evaluate("document.querySelector('#d3furn').click()"); pg.wait_for_timeout(1000); nofurn = shot('room_nofurn'); check(sum(abs(a - b) for a, b in zip(tile.resize((64, 48)).tobytes(), nofurn.resize((64, 48)).tobytes())) > 1500, 'furniture can be hidden')
    pg.evaluate("document.querySelector('[data-cam=front]').click()"); pg.wait_for_timeout(900); shot('room_top')

    # ---------- edge finish + custom outline in the room
    pg.evaluate("document.querySelector('[data-lt=size]').click()"); pg.select_option('#stShape', 'custom'); pg.click('[data-ol="blob"]'); pg.wait_for_timeout(300)
    pg.select_option('#mBord', 'bound'); pg.wait_for_timeout(1200); pg.evaluate("document.querySelector('[data-cam=angle]').click()"); pg.wait_for_timeout(1000); shot('blob_room_bound')

    # ---------- quality / mobile
    pg.evaluate("document.querySelector('[data-lt=d3]').click()"); pg.select_option('#d3quality', 'low'); pg.wait_for_timeout(500)
    q = pg.evaluate("XSTUDIO.getDoc().doc.d3.quality"); check(q == 'low', 'quality setting saved')
    pg.set_viewport_size({'width': 390, 'height': 800}); pg.wait_for_timeout(500)
    ov = pg.evaluate("(() => { const p = document.querySelector('#stL'); return [p.scrollWidth, p.clientWidth, document.documentElement.scrollWidth, innerWidth]; })()")
    check(ov[0] <= ov[1] + 1 and ov[2] <= ov[3], '3D tab fits a 390px phone without sideways scrolling %s' % ov)
    pg.screenshot(path=OUT + '/phone3d.png')
    check(gl_ok(), 'viewer canvas alive'); check(not errs, 'no page or WebGL errors %s' % errs[:4]); br.close()
print('\n%d failure(s)' % len(fails)); sys.exit(1 if fails else 0)
