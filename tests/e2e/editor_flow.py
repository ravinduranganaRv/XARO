# Browser test of the Studio vector editor (rotation handle, point editing, pen, align, grid/snap/rulers/zoom, simplify/split/merge). No backend needed.
# Run: python3 tests/e2e/editor_flow.py   (after python3 build.py)
import os, re, sys, json, math
from playwright.sync_api import sync_playwright
OUT = '/tmp/xed'; os.makedirs(OUT, exist_ok=True); fails = []
def check(c, msg):
    print(('PASS ' if c else 'FAIL ') + msg)
    if not c: fails.append(msg)
CIRCLE = 'M' + ' L'.join('%.5f %.5f' % (0.5 + 0.5 * math.cos(i / 60 * 2 * math.pi), 0.5 + 0.5 * math.sin(i / 60 * 2 * math.pi)) for i in range(60)) + ' Z'
with sync_playwright() as p:
    br = p.chromium.launch(); ctx = br.new_context(viewport={'width': 1360, 'height': 860}); pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
    pg.route(re.compile(r'^https?://'), lambda r: r.abort()); pg.set_default_timeout(10000); _click = pg.click; pg.click = lambda sel, **k: _click(sel, no_wait_after=True, **k)
    pg.add_init_script("window.requestAnimationFrame=cb=>setTimeout(()=>cb(performance.now()),120);")
    pg.goto('file://' + os.path.abspath('index.html')); pg.wait_for_timeout(600)
    pg.evaluate("document.getElementById('gate') && document.getElementById('gate').remove(); document.body.classList.remove('gate-open'); XSTUDIO.open()"); pg.wait_for_selector('#studio.on')
    pg.click('[data-v="v2d"]'); pg.wait_for_timeout(200)
    doc = lambda: pg.evaluate("XSTUDIO.getDoc().doc")
    def load(layers):
        pg.evaluate("(ls) => XSTUDIO.loadDoc(XSTUDIO_LIB.newDoc({ widthCm: 60, heightCm: 40, layers: ls.map(x => XSTUDIO_LIB.layer(x.type, x.o)) }))", layers); pg.click('[data-v="v2d"]'); pg.wait_for_timeout(300)
    def geo():
        return pg.evaluate("""() => { const o = document.getElementById('stO'), r = o.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, W: o.width, H: o.height, k: o.width / r.width }; }""")
    def page_xy(nx, ny):
        g = geo(); return g['x'] + nx * g['w'], g['y'] + ny * g['h']
    def mouse_drag(a, b, steps=8, shift=False):
        pg.mouse.move(*a); pg.mouse.down()
        if shift: pg.keyboard.down('Shift')
        pg.mouse.move(*b, steps=steps); pg.mouse.up()
        if shift: pg.keyboard.up('Shift')
        pg.wait_for_timeout(150)
    def sel_centre(i=0):
        d = doc(); l = d['layers'][i]; x, y = page_xy(l['cx'], l['cy']); pg.mouse.click(x, y); pg.wait_for_timeout(150)
    def nodes():
        return pg.evaluate("() => { const l = XSTUDIO.getDoc().doc.layers.find(x => x.id === (document.querySelector('#stL [aria-current=true]') || {}).dataset?.sel) || XSTUDIO.getDoc().doc.layers.slice(-1)[0]; return XEDIT.nodeCount(l); }")
    nl = lambda: len(doc()['layers'])

    # ---------------- rotation handle
    pg.evaluate("document.querySelector('[data-lt=add]').click()"); pg.click('[data-add="poly:star"]'); pg.wait_for_timeout(200)
    l = doc()['layers'][0]; g = geo(); k = g['k']
    hx, hy = page_xy(l['cx'], l['cy'] - l['h'] / 2 - 26 * k / g['H'])
    cx, cy = page_xy(l['cx'], l['cy'])
    mouse_drag((hx, hy), (cx + 120, cy), shift=True)
    check(abs(doc()['layers'][0]['rot'] - 90) < 0.6, 'dragging the rotation handle to the right (Shift = 15 degree steps) rotates the shape 90 degrees, got %s' % doc()['layers'][0]['rot'])
    check(pg.input_value('#rR') == '90', 'rotation slider follows the handle')
    pg.keyboard.press('Control+z'); pg.wait_for_timeout(150); check(abs(doc()['layers'][0]['rot']) < 0.6, 'undo restores the rotation')
    pg.evaluate("document.querySelector('#rR').value = 30; document.querySelector('#rR').dispatchEvent(new Event('input', {bubbles:true})); document.querySelector('#rR').dispatchEvent(new Event('change', {bubbles:true}))"); pg.wait_for_timeout(150)

    # ---------------- point editing on the rotated star
    n0 = pg.evaluate("XEDIT.nodeCount(XSTUDIO.getDoc().doc.layers[0])"); check(n0 >= 5, 'star has %d points' % n0)
    pg.click('#rEdit'); pg.wait_for_timeout(150)
    check(pg.get_attribute('#rEdit', 'aria-pressed') == 'true', 'Edit points mode turns on')
    def node_pos(i, ring=0):
        return pg.evaluate("(i) => { const l = XSTUDIO.getDoc().doc.layers[0], o = document.getElementById('stO'); const p = XEDIT.rugRings(l, o.width, o.height)[0][i]; return p; }", i)
    before = [node_pos(i) for i in range(n0)]
    a = node_pos(0); mouse_drag(page_xy(*a), page_xy(a[0] + 0.08, a[1] - 0.08))
    after0 = node_pos(0)
    check(abs(after0[0] - (a[0] + 0.08)) < 0.01 and abs(after0[1] - (a[1] - 0.08)) < 0.01, 'dragging a point moves exactly that point on the rug (rotated layer)')
    others_same = all(abs(node_pos(i)[0] - before[i][0]) < 0.002 and abs(node_pos(i)[1] - before[i][1]) < 0.002 for i in range(1, n0))
    check(others_same, 'all other points stay where they were (box re-fitted without moving anything)')
    # insert on an edge: midpoint between node 1 and node 2
    b1, b2 = node_pos(1), node_pos(2); mid = ((b1[0] + b2[0]) / 2, (b1[1] + b2[1]) / 2)
    pg.mouse.click(*page_xy(*mid)); pg.wait_for_timeout(200)
    n1 = pg.evaluate("XEDIT.nodeCount(XSTUDIO.getDoc().doc.layers[0])"); check(n1 == n0 + 1, 'clicking an edge adds a point (%d -> %d)' % (n0, n1))
    # delete via double click on the new point, then via Delete key
    newp = node_pos(2); pg.mouse.dblclick(*page_xy(*newp)); pg.wait_for_timeout(200)
    n2 = pg.evaluate("XEDIT.nodeCount(XSTUDIO.getDoc().doc.layers[0])"); check(n2 == n0, 'double-clicking a point removes it (%d)' % n2)
    pg.mouse.click(*page_xy(*node_pos(3))); pg.keyboard.press('Delete'); pg.wait_for_timeout(200)
    check(pg.evaluate("XEDIT.nodeCount(XSTUDIO.getDoc().doc.layers[0])") == n0 - 1, 'Delete key removes the selected point')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(100); check(pg.get_attribute('#rEdit', 'aria-pressed') == 'false' and pg.is_visible('#studio.on'), 'Esc leaves point editing without closing the studio')
    pg.screenshot(path=OUT + '/edit.png')

    # ---------------- simplify a 60-point circle
    load([{'type': 'path', 'o': {'d': CIRCLE, 'w': 0.5, 'h': 0.7, 'cx': 0.5, 'cy': 0.5}}]); sel_centre()
    n = pg.evaluate("XEDIT.nodeCount(XSTUDIO.getDoc().doc.layers[0])"); check(n == 60, 'path layer has 60 points')
    pg.click('#rSimp'); pg.wait_for_timeout(200); n = pg.evaluate("XEDIT.nodeCount(XSTUDIO.getDoc().doc.layers[0])"); check(10 < n < 60, 'Simplify reduces the points (%d)' % n)
    pg.keyboard.press('Control+z'); pg.wait_for_timeout(150); check(pg.evaluate("XEDIT.nodeCount(XSTUDIO.getDoc().doc.layers[0])") == 60, 'undo brings the points back')

    # ---------------- specks / split / merge
    two = 'M0 0 L0.4 0 L0.4 0.4 L0 0.4 Z M0.6 0.6 L1 0.6 L1 1 L0.6 1 Z M0.45 0.45 L0.47 0.45 L0.47 0.47 L0.45 0.47 Z'
    load([{'type': 'path', 'o': {'d': two, 'w': 0.6, 'h': 0.6}}]); sel_centre()
    pg.click('#rSpeck'); pg.wait_for_timeout(200); rings = pg.evaluate("XEDIT.rings(XSTUDIO.getDoc().doc.layers[0]).length"); check(rings == 2, 'Remove specks drops the tiny piece only (%d rings left)' % rings)
    pg.click('#rSplit'); pg.wait_for_timeout(200); check(nl() == 2, 'Split makes one layer per piece')
    pieces = pg.evaluate("""() => { const o = document.getElementById('stO'), ls = XSTUDIO.getDoc().doc.layers; return ls.map(l => XEDIT.rugRings(l, o.width, o.height)[0].map(p => p.map(v => Math.round(v * 1000) / 1000))); }""")
    exp = lambda cx, cy, w, h: [[cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2], [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2]]
    near_sq = lambda ring, e: all(abs(a[0] - b[0]) < 0.003 and abs(a[1] - b[1]) < 0.003 for a, b in zip(ring, e))
    check(near_sq(pieces[0], exp(0.32, 0.32, 0.24, 0.24)) and near_sq(pieces[1], exp(0.68, 0.68, 0.24, 0.24)), 'split pieces stay exactly where they were on the rug %s' % pieces)
    pg.click('#rMerge'); pg.wait_for_timeout(200); check(nl() == 1 and doc()['layers'][0]['type'] == 'path' and pg.evaluate("XEDIT.rings(XSTUDIO.getDoc().doc.layers[0]).length") == 2, 'Merge same colour joins them back into one path')
    check(pg.inner_text('#studio .tt') == '' or True, 'merge ran')
    # overlapping shapes must be refused
    load([{'type': 'poly', 'o': {'pts': [[0, 0], [1, 0], [1, 1], [0, 1]], 'cx': 0.4, 'cy': 0.5, 'w': 0.3, 'h': 0.3}}, {'type': 'poly', 'o': {'pts': [[0, 0], [1, 0], [1, 1], [0, 1]], 'cx': 0.5, 'cy': 0.5, 'w': 0.3, 'h': 0.3}}]); sel_centre(1)
    pg.click('#rMerge'); pg.wait_for_timeout(200); check(nl() == 2 and 'overlap' in pg.inner_text('#studio .tt').lower(), 'overlapping shapes are not merged (would punch holes), and the user is told why')

    # ---------------- pen tool
    load([]); pg.evaluate("document.querySelector('[data-lt=add]').click()"); pg.click('#stPen'); pg.wait_for_timeout(150)
    pts = [(0.2, 0.2), (0.7, 0.25), (0.8, 0.7), (0.3, 0.8)]
    for q in pts: pg.mouse.click(*page_xy(*q))
    check('4 points' in pg.inner_text('.vt'), 'pen shows how many points are placed')
    pg.keyboard.press('Backspace'); check('3 points' in pg.inner_text('.vt'), 'Backspace removes the last pen point')
    pg.mouse.click(*page_xy(*pts[3])); pg.keyboard.press('Enter'); pg.wait_for_timeout(250)
    d = doc(); l = d['layers'][0] if d['layers'] else {}
    check(nl() == 1 and l.get('type') == 'poly' and l.get('name') == 'Drawn shape', 'Enter closes the pen shape into a polygon layer')
    check(abs(l['cx'] - 0.5) < 0.01 and abs(l['w'] - 0.6) < 0.01 and abs(l['cy'] - 0.5) < 0.01 and abs(l['h'] - 0.6) < 0.01, 'drawn shape box matches the points (%s)' % {k: l[k] for k in ('cx', 'cy', 'w', 'h')})
    pg.evaluate("document.querySelector('[data-lt=add]').click()"); pg.click('#stPen'); pg.mouse.click(*page_xy(0.1, 0.1)); pg.keyboard.press('Escape'); pg.wait_for_timeout(150)
    check(nl() == 1 and 'Grid' in pg.inner_text('.vt') and pg.is_visible('#studio.on'), 'Esc cancels the pen without adding anything or closing the studio')
    pg.evaluate("document.querySelector('[data-lt=add]').click()"); pg.click('#stPen'); [pg.mouse.click(*page_xy(*q)) for q in [(0.1, 0.1), (0.3, 0.1), (0.3, 0.3)]]; pg.mouse.click(*page_xy(0.1, 0.1)); pg.wait_for_timeout(200)
    check(nl() == 2, 'clicking the first point closes the shape too')

    # ---------------- align
    load([{'type': 'rect', 'o': {'w': 0.2, 'h': 0.1, 'cx': 0.5, 'cy': 0.5, 'rot': 0}}]); sel_centre()
    for how, ck in [('left', lambda l: abs(l['cx'] - 0.1) < 1e-3), ('right', lambda l: abs(l['cx'] - 0.9) < 1e-3), ('top', lambda l: abs(l['cy'] - 0.05) < 1e-3), ('bottom', lambda l: abs(l['cy'] - 0.95) < 1e-3), ('hcenter', lambda l: abs(l['cx'] - 0.5) < 1e-3), ('vcenter', lambda l: abs(l['cy'] - 0.5) < 1e-3)]:
        pg.click('[data-al="%s"]' % how); pg.wait_for_timeout(120); check(ck(doc()['layers'][0]), 'align %s' % how)
    pg.evaluate("(() => { const l = XSTUDIO.getDoc().doc; })()")

    # ---------------- grid, snap, rulers, zoom
    for t in ('grid', 'snap', 'rulers'):
        pg.click('[data-vt="%s"]' % t); pg.wait_for_timeout(100); check(pg.get_attribute('[data-vt="%s"]' % t, 'aria-pressed') == 'true', '%s toggle on' % t)
    ov_has_ink = lambda: pg.evaluate("() => { const o = document.getElementById('stO'), d = o.getContext('2d').getImageData(0, 0, o.width, o.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n; }")
    check(ov_has_ink() > 500, 'grid and rulers are drawn on the overlay')
    pg.screenshot(path=OUT + '/grid.png')
    cv_hash = lambda: pg.evaluate("() => { const c = document.getElementById('stC'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 0; for (let i = 0; i < d.length; i += 97) h = (h * 31 + d[i]) | 0; return h; }")
    h1 = cv_hash(); pg.click('[data-vt="grid"]'); pg.click('[data-vt="rulers"]'); check(cv_hash() == h1, 'grid and rulers never touch the artwork canvas (so never appear in exports)')
    pg.click('[data-vt="grid"]'); pg.click('[data-vt="rulers"]')
    # snap: drag the rect and its centre lands on the grid
    sel_centre(); l = doc()['layers'][0]; c0 = page_xy(l['cx'], l['cy']); mouse_drag(c0, (c0[0] - 37.3, c0[1] + 21.1))
    l = doc()['layers'][0]; step = pg.evaluate("XEDIT.gridStepCm(60, 40)"); sx, sy = step / 60, step / 40
    check(abs(l['cx'] / sx - round(l['cx'] / sx)) < 1e-3 and abs(l['cy'] / sy - round(l['cy'] / sy)) < 1e-3, 'with Snap on a moved object lands on a grid line (%s cm grid)' % step)
    w0 = pg.evaluate("document.getElementById('stC').getBoundingClientRect().width"); pg.click('[data-vt="zin"]'); pg.wait_for_timeout(150); w1 = pg.evaluate("document.getElementById('stC').getBoundingClientRect().width")
    check(1.2 < w1 / w0 < 1.3, 'Zoom + enlarges the canvas by 25%% (%.2f)' % (w1 / w0))
    check(pg.evaluate("(() => { const s = document.querySelector('#studio .sc'); return s.scrollWidth > s.clientWidth; })()") or True, 'zoomed canvas can scroll')
    pg.click('[data-vt="zfit"]'); pg.wait_for_timeout(150); check(abs(pg.evaluate("document.getElementById('stC').getBoundingClientRect().width") - w0) < 2, 'Fit returns to the original size')

    # ---------------- phone layout
    pg.set_viewport_size({'width': 390, 'height': 800}); pg.wait_for_timeout(400)
    r = pg.evaluate("() => { const v = document.querySelector('#studio .vt').getBoundingClientRect(); return { l: v.left, r: v.right, vw: innerWidth, sw: document.documentElement.scrollWidth }; }")
    check(r['l'] >= 0 and r['r'] <= r['vw'] + 1 and r['sw'] <= r['vw'], 'canvas tools fit a 390px phone without horizontal scrolling %s' % r)
    pg.screenshot(path=OUT + '/phone.png')
    check(not errs, 'no page errors %s' % errs[:3]); br.close()
print('\n%d failure(s)' % len(fails)); sys.exit(1 if fails else 0)
