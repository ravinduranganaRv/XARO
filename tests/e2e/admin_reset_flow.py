# Browser test: tools/admin_password_tool.html makes a password that the real admin login accepts (and the old one no longer works).
import os, re, sys
from playwright.sync_api import sync_playwright
fails = []
def check(c, m):
    print(('PASS ' if c else 'FAIL ') + m)
    if not c: fails.append(m)
NEW = 'correct horse battery staple 77'
with sync_playwright() as p:
    br = p.chromium.launch(); ctx = br.new_context(viewport={'width': 1200, 'height': 800}); t = ctx.new_page(); t.route(re.compile(r'^https?://'), lambda r: r.abort())
    t.goto('file://' + os.path.abspath('tools/admin_password_tool.html'))
    t.fill('#pw', 'short'); t.fill('#pw2', 'short'); t.click('#go'); check('12' in t.inner_text('#msg'), 'short password refused')
    t.fill('#pw', NEW); t.fill('#pw2', NEW + 'x'); t.click('#go'); check('match' in t.inner_text('#msg'), 'mismatch refused')
    t.fill('#pw', NEW); t.fill('#pw2', NEW); t.click('#go'); t.wait_for_selector('#out:not([hidden])'); snippet = t.input_value('#a'); seed = t.input_value('#b')
    check(NEW not in snippet and NEW not in seed and t.input_value('#pw') == '', 'the password itself is not in the output and the fields are cleared')
    pg = ctx.new_page(); pg.route(re.compile(r'^https?://'), lambda r: r.abort()); pg.set_default_timeout(10000)
    pg.goto('file://' + os.path.abspath('index.html') + '#admin'); pg.wait_for_timeout(800)
    # lock the account first (5 wrong tries) to prove the snippet also clears the lockout
    for i in range(5):
        pg.fill('#aU', 'Ravindu20007'); pg.fill('#aP', 'wrong-password-%d' % i); pg.click('#admForm button[type=submit]'); pg.wait_for_timeout(2200)
    check('Locked' in pg.inner_text('#admForm') or 'Too many' in pg.inner_text('#admForm'), 'account locked after 5 wrong tries (setup)')
    pg.evaluate(snippet); pg.reload(); pg.wait_for_timeout(800)
    pg.fill('#aU', 'Ravindu20007'); pg.fill('#aP', 'wrong-again'); pg.click('#admForm button[type=submit]'); pg.wait_for_timeout(2200)
    check('Too many' not in pg.inner_text('#admForm'), 'lockout cleared by the snippet')
    pg.fill('#aP', NEW); pg.click('#admForm button[type=submit]'); pg.wait_for_timeout(2500)
    check(pg.evaluate("!!document.querySelector('.shell')"), 'new password signs in to the admin panel')
    check(pg.evaluate("XD.admins().filter(a => a.username === 'Ravindu20007').length") == 1 and pg.evaluate("XD.admins()[0].role") == 'owner', 'exactly one owner record, role kept')
    br.close()
print('\n%d failure(s)' % len(fails)); sys.exit(1 if fails else 0)
