# Browser test: store admin -> Quotations -> a request with a confirmed price downloads the quotation on the XARO template (PDF, JPG, PNG).
import os, re, sys, subprocess, threading, http.server, functools
from playwright.sync_api import sync_playwright
fails = []
def check(c, m):
    print(('PASS ' if c else 'FAIL ') + m)
    if not c: fails.append(m)
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(http.server.SimpleHTTPRequestHandler, directory=os.getcwd())); srv.RequestHandlerClass.log_message = lambda *a: None; threading.Thread(target=srv.serve_forever, daemon=True).start(); BASE = 'http://127.0.0.1:%d/' % srv.server_address[1]   # the template image is loaded on demand, so serve over http
OUT = '/tmp/aq_out'; os.makedirs(OUT, exist_ok=True)
with sync_playwright() as p:
    br = p.chromium.launch(); pg = br.new_context(viewport={'width': 1360, 'height': 860}, accept_downloads=True).new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.route(re.compile(r'^https?://(?!127\.0\.0\.1)'), lambda r: r.abort()); pg.set_default_timeout(15000)
    pg.goto(BASE + 'index.html'); pg.wait_for_timeout(1000)
    pg.evaluate("document.getElementById('gate') && document.getElementById('gate').remove(); document.body.classList.remove('gate-open')")
    pg.evaluate("""async () => { const salt = XADM.rand(16), hash = await XADM.hashPw('Test-pass-12345', salt, 1000); XD.saveAdmins([{ username: 'tester', name: 'T', role: 'owner', perms: XD.ALL_PERMS.map(x => x[0]), active: true, salt, hash, iter: 1000 }]);
      XD.addQuote({ id: 'Q-90001', name: 'Ann Perera', email: 'ann@example.com', phone: '+94 77 123 4567', country: 'LK', cur: 'LKR', qty: 2, message: '', doc: { widthCm: 90, heightCm: 40, shape: 'rectangle', pile: 'standard' }, yarns: [], estimate: {} }); }""")
    pg.reload(); pg.wait_for_timeout(1200); pg.evaluate("document.getElementById('gate') && document.getElementById('gate').remove(); document.body.classList.remove('gate-open')")
    pg.evaluate("location.hash = '#admin'"); pg.wait_for_timeout(800); pg.fill('#aU', 'tester'); pg.fill('#aP', 'Test-pass-12345'); pg.press('#aP', 'Enter'); pg.wait_for_timeout(2500)
    pg.evaluate("location.hash = '#admin/quotes'"); pg.wait_for_timeout(800); pg.click('tr.click[data-id="Q-90001"]'); pg.wait_for_selector('#qCf')
    pg.click('button:has-text("JPG")'); pg.wait_for_timeout(600); check('confirmed price' in pg.inner_text('body').lower(), 'without a confirmed price the quotation is refused with a clear message')
    pg.fill('#qCf', '9000')
    def dl(label):
        with pg.expect_download(timeout=30000) as d: pg.click('.ft button:text-is("%s")' % label)
        f = d.value; path = os.path.join(OUT, f.suggested_filename); f.save_as(path); return path
    path = dl('Quotation PDF'); check(subprocess.run(['qpdf', '--check', path], capture_output=True).returncode == 0 and path.endswith('.pdf') and 'Q-90001' in path, 'staff quotation PDF is valid')
    from PIL import Image
    j = dl('JPG'); im = Image.open(j); check(im.size == (1754, 1240), 'JPG is the A4-landscape template page: %s' % (im.size,))
    n = dl('PNG'); check(Image.open(n).format == 'PNG', 'PNG downloads')
    pg.screenshot(path=OUT + '/admin.png')
    check(not errs, 'no page errors: %s' % errs[:3]); br.close()
print('ALL PASSED' if not fails else 'FAILED: %d' % len(fails)); sys.exit(1 if fails else 0)
