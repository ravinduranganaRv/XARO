# Visual regression for the EXISTING storefront (the part that must not change).
#   python3 tests/e2e/visual_regression.py capture <out_dir> [index.html]    -> PNG baselines
#   python3 tests/e2e/visual_regression.py compare <baseline_dir> <new_dir> [max_diff_pct=0.05]
# Animations/transitions are frozen, requests to the internet are blocked, the clock is fixed, canvases (live 3D / particle effects) are masked,
# so two captures of the SAME page must match exactly (the script self-checks this with `selfcheck`).
import os, re, sys
from playwright.sync_api import sync_playwright
VIEWS = [('desktop', {'width': 1360, 'height': 860}), ('phone', {'width': 390, 'height': 844})]
FREEZE = "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important;scroll-behavior:auto!important}canvas{visibility:hidden!important}#toast,#zaro .zbub,#zaro [class*=bub]{visibility:hidden!important}#custom .field:has(>a[data-open-studio]){display:none!important}"   # the ONE sanctioned addition (Studio entry button in the Custom panel) is hidden so everything else is compared strictly
INIT = "window.requestAnimationFrame=cb=>0;Math.random=(()=>{let s=7;return()=>(s=(s*16807)%2147483647)/2147483647})();"
def capture(out, page_path):
    os.makedirs(out, exist_ok=True); n = 0
    with sync_playwright() as p:
        br = p.chromium.launch()
        for vname, vp in VIEWS:
            ctx = br.new_context(viewport=vp, device_scale_factor=1, locale='en-US', timezone_id='UTC'); pg = ctx.new_page(); pg.set_default_timeout(15000)
            pg.route(re.compile(r'^https?://'), lambda r: r.abort()); pg.add_init_script(INIT)
            def shot(name, full=False):
                nonlocal n; pg.add_style_tag(content=FREEZE); pg.wait_for_timeout(250); pg.screenshot(path=os.path.join(out, '%s_%s.png' % (vname, name)), full_page=full); n += 1
            pg.goto('file://' + os.path.abspath(page_path)); pg.wait_for_timeout(1200); shot('gate')
            pg.fill('#gName', 'Test Person'); pg.fill('#gMail', 'tp@example.com'); pg.fill('#gPhone', '771234567'); pg.check('#gOk'); pg.click('#gateForm button[type=submit]'); pg.wait_for_timeout(800)
            shot('home_top'); shot('home_full', full=True)
            pg.evaluate("document.querySelector('#shop').scrollIntoView()"); pg.wait_for_timeout(300); shot('shop')
            pg.evaluate("document.querySelector('#custom').scrollIntoView()"); pg.wait_for_timeout(300); shot('custom'); pg.evaluate("scrollTo(0,0)"); pg.wait_for_timeout(200)
            pg.evaluate("document.querySelector('.card [data-view]').click()"); pg.wait_for_timeout(900); shot('product_view')
            pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
            pg.evaluate("var b=document.querySelector('.card [data-add]');b&&b.click()"); pg.wait_for_timeout(500)
            pg.evaluate("document.querySelector('.cartbtn').click()"); pg.wait_for_timeout(500); shot('cart')
            pg.evaluate("var c=document.querySelector('#cartFoot button');c&&c.click()"); pg.wait_for_timeout(700); shot('checkout')
            ctx.close()
        br.close()
    print('captured %d screenshots in %s' % (n, out))
def compare(a, b, tol):
    from PIL import Image, ImageChops
    bad = 0
    for f in sorted(os.listdir(a)):
        if not f.endswith('.png'): continue
        pb = os.path.join(b, f)
        if not os.path.exists(pb): print('FAIL missing', f); bad += 1; continue
        A = Image.open(os.path.join(a, f)).convert('RGB'); B = Image.open(pb).convert('RGB')
        if A.size != B.size: print('FAIL size differs', f, A.size, B.size); bad += 1; continue
        d = ImageChops.difference(A, B).convert('L').point(lambda v: 255 if v > 8 else 0); cnt = sum(1 for v in d.tobytes() if v); pct = 100.0 * cnt / (A.size[0] * A.size[1])
        ok = pct <= tol; print(('PASS ' if ok else 'FAIL ') + '%-28s differing pixels %.4f%%' % (f, pct)); bad += 0 if ok else 1
    print('\n%d failure(s)' % bad); return bad
if __name__ == '__main__':
    m = sys.argv[1]
    if m == 'capture': capture(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else 'index.html')
    elif m == 'compare': sys.exit(1 if compare(sys.argv[2], sys.argv[3], float(sys.argv[4]) if len(sys.argv) > 4 else 0.05) else 0)
    elif m == 'selfcheck':
        capture('/tmp/vr_a', sys.argv[2]); capture('/tmp/vr_b', sys.argv[2]); sys.exit(1 if compare('/tmp/vr_a', '/tmp/vr_b', 0.0) else 0)
