# Stored-XSS check for the rug-maker workspace and Studio account screens. MOCK backend: every text field is hostile; no payload may become a real element.
import os, re, sys, json
sys.path.insert(0, os.path.dirname(__file__))
from mock_supabase import Mock
from playwright.sync_api import sync_playwright
fails = []
def check(c, m):
    print(('PASS ' if c else 'FAIL ') + m)
    if not c: fails.append(m)
PAY = "\"'><img data-xss=1 src=x><b data-xss=1>x</b>"
mock = Mock(); b = mock.bid; mock.business.update(name=PAY, owner_name=PAY, phone=PAY, email=PAY, address={'line1': PAY, 'city': PAY})
mock.t['profiles'][0].update(full_name=PAY)
y = lambda i, c: {'id': 'y%d' % i, 'business_id': b, 'code': c, 'name': PAY, 'hex': '#FF0000', 'stock_kg': 1.5, 'reorder_kg': 2, 'price_per_kg': 10, 'active': True, 'availability': 'in-stock', 'supplier': PAY, 'notes': PAY, 'material': PAY, 'created_at': '2026-11-01T00:00:00Z', 'updated_at': '2026-11-01T00:00:00Z'}
mock.t['biz_yarns'] += [y(1, 'R1'), y(2, 'B1')]
mock.t['biz_projects'].append({'id': 'p1', 'business_id': b, 'client_name': PAY, 'client_email': PAY, 'client_phone': PAY, 'title': PAY, 'notes': PAY, 'status': 'enquiry', 'created_at': '2026-11-01T00:00:00Z', 'updated_at': '2026-11-01T00:00:00Z'})
mock.t['biz_quotations'].append({'id': 'q1', 'business_id': b, 'ref': 'Q-1', 'project_id': 'p1', 'status': 'draft', 'lines': {'items': [{'desc': PAY, 'qty': 1, 'unit': 10}], 'discountPct': 0, 'taxPct': 0, 'total': 10}, 'notes': PAY, 'currency': 'LKR', 'created_at': '2026-11-01T00:00:00Z', 'updated_at': '2026-11-01T00:00:00Z'})
mock.t['biz_orders'].append({'id': 'o1', 'business_id': b, 'ref': 'O-1', 'project_id': 'p1', 'status': 'open', 'total': 10, 'paid': 0, 'notes': PAY, 'currency': 'LKR', 'created_at': '2026-11-01T00:00:00Z', 'updated_at': '2026-11-01T00:00:00Z'})
mock.t['custom_designs'].append({'id': 'd1', 'owner_id': mock.user, 'business_id': b, 'name': PAY, 'status': 'draft', 'doc': {'v': 1, 'layers': [], 'widthCm': 40, 'heightCm': 30, 'shape': 'rect', 'bg': 'XY-001', 'notes': PAY}, 'created_at': '2026-11-01T00:00:00Z', 'updated_at': '2026-11-01T00:00:00Z'})
mock.t['yarn_movements'].append({'id': 'm1', 'business_id': b, 'yarn_id': 'y1', 'kind': 'purchase', 'kg': 1.5, 'note': PAY, 'at': '2026-11-01T00:00:00Z', 'created_at': '2026-11-01T00:00:00Z'})
with sync_playwright() as p:
    br = p.chromium.launch(); pg = br.new_context(viewport={'width': 1360, 'height': 860}).new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.route(re.compile(r'^https?://(?!mlrydpclqokizsqmigen)'), lambda r: r.abort()); pg.set_default_timeout(10000); _click = pg.click; pg.click = lambda sel, **k: _click(sel, no_wait_after=True, **k)
    mock.attach(pg); pg.add_init_script(mock.session_script()); pg.add_init_script("window.requestAnimationFrame=cb=>setTimeout(()=>cb(performance.now()),200);")
    pg.goto('file://' + os.path.abspath('index.html')); pg.wait_for_timeout(800)
    pg.evaluate("document.getElementById('gate') && document.getElementById('gate').remove(); document.body.classList.remove('gate-open'); XSTUDIO.open()"); pg.wait_for_selector('#studio.on'); pg.wait_for_function("!document.getElementById('stWork').hidden", timeout=8000)
    def xss(where):
        n = pg.evaluate("document.querySelectorAll('[data-xss]').length")
        if n: print('   where:', pg.evaluate("[...new Set([...document.querySelectorAll('[data-xss]')].map(e => { let p = e.parentElement, path = []; for (let i = 0; i < 4 && p; i++, p = p.parentElement) path.push(p.tagName.toLowerCase() + (p.id ? '#' + p.id : '') + (p.className && typeof p.className === 'string' ? '.' + p.className.split(' ')[0] : '')); return path.join(' < '); }))].slice(0, 8)"))
        check(n == 0, 'no injected elements in %s (%d)' % (where, n))
    xss('studio account chip'); pg.click('#stWork'); pg.wait_for_selector('#xwork.on')
    for label in ['Dashboard', 'My Designs', 'Image to Vector', 'Colour Separation', 'Yarn Manager', 'Rug Calculator', '3D Preview', 'Production Sheets', 'Customer Projects', 'Quotations', 'Orders', 'Inventory', 'Reports', 'Account Settings']:
        pg.evaluate("(l) => { document.querySelectorAll('.xw-mod').forEach(m => m.remove()); [...document.querySelectorAll('#xwork .xw-nav button')].find(b => b.textContent === l).click(); }", label); pg.wait_for_timeout(500); xss('workspace: ' + label)
        for lab in ['Edit', 'View', 'Open', 'Details', 'Movements', 'History']:
            bt = pg.query_selector('#xwBody button:has-text("%s")' % lab)
            if bt:
                try: bt.click(timeout=1500, no_wait_after=True); pg.wait_for_timeout(500); xss('workspace %s dialog (%s)' % (label, lab)); pg.keyboard.press('Escape'); pg.evaluate("document.querySelectorAll('.xw-mod').forEach(m => m.remove())")
                except Exception: pass
                break
    check(not errs, 'no page errors %s' % errs[:3]); br.close()
print('\n%d failure(s)' % len(fails)); sys.exit(1 if fails else 0)
