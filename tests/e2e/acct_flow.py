# UI flow test with a MOCK Supabase (the build sandbox cannot reach supabase.co). Run: python3 tests/e2e/acct_flow.py
import json, re, sys, os
from playwright.sync_api import sync_playwright
H = 'https://mlrydpclqokizsqmigen.supabase.co'
CORS = {'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'content-type': 'application/json'}
log = []; state = {'biz': None, 'designs': []}
JWT = 'x.' + __import__('base64').urlsafe_b64encode(json.dumps({'sub': 'u-1', 'exp': 4102444800}).encode()).decode().rstrip('=') + '.y'
def handle(route, req):
    u, m = req.url, req.method
    if m == 'OPTIONS': return route.fulfill(status=204, headers=CORS)
    body = (req.post_data_buffer or b'').decode('utf-8', 'ignore')
    log.append((m, u.replace(H, ''), body[:2000000]))
    def ok(b, s=200): route.fulfill(status=s, headers=CORS, body=json.dumps(b))
    if '/auth/v1/signup' in u: return ok({'id': 'u-1', 'email': 'rm@x.co'})
    if 'grant_type=password' in u: return ok({'access_token': JWT, 'refresh_token': 'RT', 'expires_in': 3600, 'user': {'id': 'u-1', 'email': 'rm@x.co'}})
    if '/rest/v1/profiles' in u: return ok([{'id': 'u-1', 'email': 'rm@x.co', 'full_name': 'Rita Maker', 'role': 'customer', 'account_type': 'rugmaker'}])
    if '/rest/v1/business_members' in u: return ok([{'role': 'owner', 'businesses': state['biz']}] if state['biz'] else [])
    if '/rpc/create_business' in u:
        b = json.loads(body); state['biz'] = {'id': 'b-1', 'name': b['p_name'], 'currency': b['p_currency']}; return ok('b-1')
    if '/storage/v1/object/design-originals' in u: return ok({'Key': 'k'})
    if m == 'POST' and '/rest/v1/custom_designs' in u:
        r = json.loads(body); state['designs'].append({'id': 'd-%d' % len(state['designs']), 'name': r['name'], 'status': 'draft', 'updated_at': '2026-11-06T10:00:00Z', 'business_id': r.get('business_id'), '_thumb': r['doc'].get('_thumb')}); return ok([{'id': state['designs'][-1]['id']}])
    if m == 'GET' and '/rest/v1/custom_designs' in u: return ok(state['designs'])
    return ok([])
fails = []
def check(c, msg):
    print(('PASS ' if c else 'FAIL ') + msg); 
    if not c: fails.append(msg)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1280, 'height': 800}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route(re.compile(r'https://mlrydpclqokizsqmigen\.supabase\.co/.*'), handle)
    pg.goto('file://' + os.path.abspath('index.html')); pg.wait_for_timeout(800)
    pg.evaluate("document.getElementById('gate') && document.getElementById('gate').remove(); document.body.classList.remove('gate-open'); XSTUDIO.open()"); pg.wait_for_selector('#studio.on'); pg.wait_for_timeout(500)
    check(pg.inner_text('#stAcct') == 'Sign in', 'account button shows Sign in when signed out')
    pg.click('#stAcct'); pg.click('[data-m=up]'); pg.click('[data-t=rugmaker]')
    pg.fill('#acN', 'Rita Maker'); pg.fill('#acE', 'rm@x.co'); pg.fill('#acP', 'abcdefg1')
    pg.click('#mAct .pri'); pg.wait_for_selector('text=Check your email')
    su = [l for l in log if '/auth/v1/signup' in l[1]][0]; d = json.loads(su[2])
    check(d['data']['account_type'] == 'rugmaker' and 'role' not in d['data'], 'sign-up sends rugmaker account type and no role')
    pg.click('.mod .x'); pg.click('#stAcct'); pg.fill('#acE', 'rm@x.co'); pg.fill('#acP', 'abcdefg1'); pg.click('#mAct .pri')
    pg.wait_for_selector('text=Set up your rug-making business'); check(True, 'rug maker without a business is asked to set one up')
    pg.fill('#bzN', 'Rita Tufting'); pg.fill('#bzU', 'lkr'); pg.click('#mAct .pri'); pg.wait_for_selector('#stAcct:text-is("Rita")', timeout=10000)
    cb = json.loads([l for l in log if 'rpc/create_business' in l[1]][0][2]); check(cb['p_name'] == 'Rita Tufting' and cb['p_currency'] == 'lkr', 'business created through the RPC')
    check(pg.inner_text('#stAcct') == 'Rita', 'account chip shows first name')
    # add an image layer via the library, then save to the cloud
    import io; from PIL import Image
    im = Image.new('RGB', (400, 300), (200, 30, 40)); [im.putpixel((x, y), (20, 80, 200)) for x in range(100, 300) for y in range(80, 220)]
    buf = io.BytesIO(); im.save(buf, 'PNG')
    pg.set_input_files('#stFile', {'name': 'logo.png', 'mimeType': 'image/png', 'buffer': buf.getvalue()}); pg.wait_for_selector('#studio .ly', timeout=15000)
    pg.click('#stSave'); pg.fill('#sdN', 'Cloud rug'); pg.click('#mAct .pri')
    for _ in range(80):
        if any(l[0] == 'POST' and '/rest/v1/custom_designs' in l[1] for l in log): break
        pg.wait_for_timeout(100)
    up = [l for l in log if '/storage/v1/object/design-originals/b/b-1/' in l[1]]; check(len(up) == 1, 'artwork uploaded to the business folder in private storage')
    ins = [l for l in log if l[0] == 'POST' and '/rest/v1/custom_designs' in l[1]][0]; r = json.loads(ins[2])
    check(r['business_id'] == 'b-1' and r['owner_id'] == 'u-1', 'design row carries owner and business ids')
    check('data:image' not in json.dumps(r['doc']).replace(r['doc'].get('_thumb') or '@@', ''), 'no artwork pixels inside the design document')
    check(len(r['doc'].get('_images', {})) == 1, 'design document lists the uploaded image path')
    pg.click('#stMine'); pg.wait_for_selector('text=In your account'); pg.wait_for_selector('text=Cloud rug')
    check(True, 'My designs lists the cloud design')
    pg.click('.mod .x'); pg.click('#stAcct'); pg.click('text=Sign out')
    try: pg.wait_for_selector('#stAcct:text-is("Sign in")', timeout=8000)
    except Exception: pass
    check(pg.inner_text('#stAcct') == 'Sign in', 'sign out resets the account button')
    check(not errs, 'no page errors: ' + '; '.join(errs)[:200])
    pg.screenshot(path='/tmp/acct.png'); b.close()
print('FAILED: %d' % len(fails) if fails else 'ALL PASSED'); sys.exit(1 if fails else 0)
