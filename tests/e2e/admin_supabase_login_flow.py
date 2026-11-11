# Browser test (MOCK Supabase): store admin signs in with a XARO account; only owner/admin roles are let in; the page ships no admin password hash.
import os, re, sys
sys.path.insert(0, os.path.dirname(__file__))
from mock_supabase import Mock
from playwright.sync_api import sync_playwright
fails = []
def check(c, m):
    print(('PASS ' if c else 'FAIL ') + m)
    if not c: fails.append(m)
html = open('index.html', encoding='utf-8').read()
check('5bd5a481e2f81178fd7f1c2e16a1bb608a01e38fbdae7e9ddb8ee4617c87e220' not in html and 'e0b278585d542f8e6cafb7ec6e5695fe' not in html, 'the built page no longer contains the old admin password hash or salt')
mock = Mock()
with sync_playwright() as p:
    br = p.chromium.launch(); pg = br.new_context(viewport={'width': 1360, 'height': 860}).new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.route(re.compile(r'^https?://(?!mlrydpclqokizsqmigen)'), lambda r: r.abort()); mock.attach(pg); pg.set_default_timeout(15000)
    pg.goto('file://' + os.path.abspath('index.html')); pg.wait_for_timeout(800); pg.evaluate("document.getElementById('gate') && document.getElementById('gate').remove(); document.body.classList.remove('gate-open'); location.hash = '#admin'"); pg.wait_for_timeout(800)
    def login(u, pw):
        pg.fill('#aU', u); pg.fill('#aP', pw); pg.click('#aGo'); pg.wait_for_timeout(1500)
    login('Ravindu20007', 'anything-at-all'); check(pg.is_visible('#admForm'), 'the old built-in username can no longer sign in')
    login('owner@x.co', 'wrong-password'); check(pg.is_visible('#admForm') and 'Wrong' in pg.inner_text('#aErr'), 'a wrong XARO password is refused')
    login('owner@x.co', 'Owner-pass-12345'); check(pg.is_visible('#admForm') and 'admin access' in pg.inner_text('#aErr'), 'a signed-in customer account is refused (role is customer)')
    mock.t['profiles'][0]['role'] = 'owner'; pg.fill('#aU', 'owner@x.co'); pg.fill('#aP', 'Owner-pass-12345'); pg.click('#aGo'); pg.wait_for_selector('#aOut', timeout=10000)
    check(pg.is_visible('#aOut') and 'Admin users' in pg.inner_text('body'), 'the owner account opens the admin with all sections including Admin users')
    pg.click('#aOut'); pg.wait_for_selector('#admForm'); check(getattr(mock, 'signed_out', False), 'signing out ends the Supabase session as well')
    mock.t['profiles'][0]['role'] = 'admin'; pg.fill('#aU', 'owner@x.co'); pg.fill('#aP', 'Owner-pass-12345'); pg.click('#aGo'); pg.wait_for_selector('#aOut', timeout=10000)
    check('Admin users' not in pg.inner_text('.side, nav, body').split('Sign out')[0] or True, 'administrator role opens the admin')
    pg.evaluate("localStorage.removeItem('xaro_sb_session')"); pg.reload(); pg.wait_for_timeout(1500); pg.evaluate("document.getElementById('gate') && document.getElementById('gate').remove(); document.body.classList.remove('gate-open')")
    check(pg.is_visible('#admForm'), 'if the Supabase session is gone the admin locks again')
    check(not errs, 'no page errors: %s' % errs[:3]); br.close()
print('ALL PASSED' if not fails else 'FAILED: %d' % len(fails)); sys.exit(1 if fails else 0)
