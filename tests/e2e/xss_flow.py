# Stored-XSS check: every free-text field of every stored record is replaced with markup/attribute-breaking payloads, then the store and all admin screens are rendered.
# The test fails if any payload becomes a real element ([data-xss]). (The page's CSP would also block script execution; this checks the escaping itself.)
import os, re, sys, json
from playwright.sync_api import sync_playwright
fails = []
def check(c, m):
    print(('PASS ' if c else 'FAIL ') + m)
    if not c: fails.append(m)
PAY = "\"'><img data-xss=1 src=x><b data-xss=1>x</b>"
with sync_playwright() as p:
    br = p.chromium.launch(); pg = br.new_context(viewport={'width': 1360, 'height': 860}).new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.route(re.compile(r'^https?://'), lambda r: r.abort()); pg.set_default_timeout(15000)
    pg.add_init_script("window.requestAnimationFrame=cb=>setTimeout(()=>cb(performance.now()),200);")
    pg.goto('file://' + os.path.abspath('index.html')); pg.wait_for_timeout(1000)
    pg.evaluate("document.getElementById('gate') && document.getElementById('gate').remove(); document.body.classList.remove('gate-open')")
    # seed hostile data
    seeded = pg.evaluate("""async (PAY) => {
      const KEEP = new Set(['id','sku','type','status','stage','kind','cur','country','role','source','cat','t','at','last','perm','perms','username','salt','hash','iter','active','qty','sid','c','visits','consent','cancelled','price','prices','total','designs','keys']);
      const taint = (o, depth) => { if (Array.isArray(o)) return o.map(x => taint(x, depth + 1)); if (o && typeof o === 'object') { const r = {}; for (const k in o) r[k] = KEEP.has(k) ? o[k] : taint(o[k], depth + 1); return r; } return typeof o === 'string' && o.length ? PAY : o; };
      const n = {};
      const put = (name, list) => { n[name] = list.length; };
      const cs = XD.customers(); if (!cs.length) { XD.upsertCustomer({ name: 'A', email: 'a@x.co', phone: '+94 771234567', country: 'LK', cur: 'LKR' }); XD.upsertCustomer({ name: 'B', email: 'b@x.co', phone: '+94 771234568', country: 'US', cur: 'USD' }); }
      const p0 = XD.products()[0];
      XD.addOrder({ cid: XD.customers()[0].id, name: 'N', email: 'a@x.co', phone: '1', country: 'LK', cur: 'LKR', total: 100, address: 'addr', items: [{ sku: p0.sku, name: 'item', qty: 1, price: 100, opts: 'o' }], note: 'n', pay: 'cod' });
      XD.addQuote({ name: 'q', email: 'q@x.co', phone: '1', notes: 'n', items: [], rug: { w: 1 } });
      XD.logChat('user', 'hello'); XD.logChat('bot', 'hi'); XD.addUnanswered('what?');
      const d = XD.designs(); d.push({ id: 'd1', name: 'design', at: new Date().toISOString(), doc: {} }); XD.saveDesigns(d);
      ['customers','orders','quotes','chat','unans','designs','kb','yarns'].forEach(k => { const v = XD.g(k, null); if (v) { XD.s(k, taint(v, 0)); put(k, v); } });
      const ps = XD.products().map(x => Object.assign({}, x, { name: PAY, desc: PAY, size: PAY, lead: PAY, weight: PAY, img: PAY })); XD.saveProducts(ps);
      XD.setSettings({ storeName: PAY, announce: PAY, whatsapp: PAY, email: PAY, syncUrl: '' });
      // a known admin so the admin screens can be opened
      const salt = XADM.rand(16), hash = await XADM.hashPw('Test-pass-12345', salt, 1000); XD.saveAdmins([{ username: 'tester', name: PAY, role: 'owner', perms: XD.ALL_PERMS.map(x => x[0]), active: true, salt, hash, iter: 1000 }]);
      return n; }""", PAY)
    print('seeded', seeded)
    pg.reload(); pg.wait_for_timeout(1500); pg.evaluate("document.getElementById('gate') && document.getElementById('gate').remove(); document.body.classList.remove('gate-open')")
    def xss(where):
        n = pg.evaluate("document.querySelectorAll('[data-xss]').length")
        if n: print('   where:', pg.evaluate("[...new Set([...document.querySelectorAll('[data-xss]')].map(e => { let p = e.parentElement, path = []; for (let i = 0; i < 4 && p; i++, p = p.parentElement) path.push(p.tagName.toLowerCase() + (p.id ? '#' + p.id : '') + (p.className && typeof p.className === 'string' ? '.' + p.className.split(' ')[0] : '')); return path.join(' < '); }))].slice(0, 12)"))
        check(n == 0, 'no injected elements in %s (%d)' % (where, n))
    xss('the storefront')
    for sec in ['shop', 'custom', 'track', 'cart', 'about']:
        pg.evaluate("(s) => { const e = document.getElementById(s); e && e.scrollIntoView(); }", sec); pg.wait_for_timeout(150)
    xss('the storefront after browsing')
    pg.evaluate("document.querySelector('#zaro .zr') && document.querySelector('#zaro .zr').click()"); pg.wait_for_timeout(500); xss('the assistant panel')
    pg.evaluate("location.hash = '#admin'"); pg.wait_for_timeout(800)
    pg.fill('#aU', 'tester'); pg.fill('#aP', 'Test-pass-12345'); pg.press('#aP', 'Enter'); pg.wait_for_timeout(2500)
    tabs = pg.evaluate("XADM.order.slice()"); print('admin tabs:', tabs)
    for t in tabs:
        pg.evaluate("(t) => { location.hash = '#admin/' + t; }", t); pg.wait_for_timeout(700); xss('admin tab ' + t)
        # open any first row / detail dialogs reachable by a button labelled View/Open/Edit
        for lab in ['View', 'Open', 'Edit', 'Details']:
            b = pg.query_selector('#admin button:has-text("%s"), .adm button:has-text("%s")' % (lab, lab))
            if b:
                try: b.click(timeout=1500, no_wait_after=True); pg.wait_for_timeout(400); xss('admin tab %s dialog (%s)' % (t, lab)); pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
                except Exception: pass
                break
    check(not errs, 'no page errors %s' % errs[:3]); br.close()
print('\n%d failure(s)' % len(fails)); sys.exit(1 if fails else 0)
