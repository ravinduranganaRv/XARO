# Loads the built page with its Content-Security-Policy and exercises the main flows; any CSP violation or console error fails the test.
import os, re, sys
from playwright.sync_api import sync_playwright
fails = []
def check(c, m):
    print(('PASS ' if c else 'FAIL ') + m)
    if not c: fails.append(m)
with sync_playwright() as p:
    br = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']); pg = br.new_context(viewport={'width': 1360, 'height': 860}).new_page(); errs = []; viol = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text and 'net::ERR' not in m.text else None)
    pg.route(re.compile(r'^https?://'), lambda r: r.abort()); pg.set_default_timeout(15000)
    pg.add_init_script("window.__v=[];document.addEventListener('securitypolicyviolation',e=>window.__v.push(e.violatedDirective+' '+e.blockedURI+' '+(e.sample||'')));window.requestAnimationFrame=cb=>setTimeout(()=>cb(performance.now()),120);")
    pg.goto('file://' + os.path.abspath('index.html')); pg.wait_for_timeout(1200)
    csp = pg.evaluate("document.querySelector('meta[http-equiv=Content-Security-Policy]').content"); check("script-src 'self' 'sha256-" in csp and 'unsafe-inline' not in csp.split('script-src')[1].split(';')[0] and "object-src 'none'" in csp, 'CSP present; scripts pinned by hash, no unsafe-inline for scripts')
    check(pg.evaluate("!!document.getElementById('gate')"), 'page scripts run under the policy (sign-in gate built)')
    # store flows: sign in, browse, cart, studio, admin screen, assistant
    pg.fill('#gName', 'Test Person'); pg.fill('#gMail', 'tp@example.com'); pg.fill('#gPhone', '771234567'); pg.check('#gOk'); pg.click('#gateForm button[type=submit]'); pg.wait_for_timeout(600)
    check(not pg.evaluate("document.getElementById('gate').classList.contains('on')"), 'sign-in works')
    pg.evaluate("XSTUDIO.open()"); pg.wait_for_selector('#studio.on'); pg.wait_for_timeout(1500)
    pg.evaluate("document.querySelector('[data-lt=d3]').click()"); pg.wait_for_timeout(300); pg.evaluate("document.querySelector('[data-v=v3d]').click()"); pg.wait_for_timeout(1500)
    pg.evaluate("XSTUDIO.open && document.getElementById('stClose').click()"); pg.wait_for_timeout(300)
    pg.evaluate("location.hash = '#admin'"); pg.wait_for_timeout(800); check(pg.evaluate("!!document.getElementById('aU') || !!document.querySelector('#admin input')"), 'admin sign-in screen renders')
    pg.evaluate("location.hash = ''"); pg.wait_for_timeout(500)
    pg.evaluate("document.querySelector('#zaro .zr').click()"); pg.wait_for_timeout(600)
    if pg.is_visible('#zaro .zft input'):
        pg.fill('#zaro .zft input', 'how much is shipping?'); pg.press('#zaro .zft input', 'Enter'); pg.wait_for_timeout(2500)
    check(pg.evaluate("document.querySelectorAll('#zaro .zm').length") >= 2, 'assistant answers a question under the policy')
    v = pg.evaluate("window.__v"); check(not v, 'no CSP violations %s' % v[:3])
    check(not errs, 'no console or page errors %s' % errs[:3]); br.close()
print('\n%d failure(s)' % len(fails)); sys.exit(1 if fails else 0)
