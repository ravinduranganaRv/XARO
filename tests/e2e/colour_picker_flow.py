# Browser test: the Studio colour panel groups a 1000-shade yarn library into colour families.
# Run: python3 tests/e2e/colour_picker_flow.py   (after python3 build.py). No backend needed (yarns are injected).
import os, re, sys, csv
from playwright.sync_api import sync_playwright
fails = []
def check(c, msg):
    print(('PASS ' if c else 'FAIL ') + msg)
    if not c: fails.append(msg)
rows = list(csv.DictReader(open('tools/default_yarns_1000.csv', encoding='utf-8')))
yarns = [{'id': r['code'], 'name': r['name'], 'hex': r['hex'], 'material': r['material'], 'availability': 'unknown', 'active': True} for r in rows]
with sync_playwright() as p:
    br = p.chromium.launch(); pg = br.new_context(viewport={'width': 1360, 'height': 860}).new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
    pg.route(re.compile(r'^https?://'), lambda r: r.abort()); pg.set_default_timeout(10000); _c = pg.click; pg.click = lambda s, **k: _c(s, no_wait_after=True, **k)
    pg.add_init_script("window.requestAnimationFrame=cb=>setTimeout(()=>cb(performance.now()),120);")
    pg.goto('file://' + os.path.abspath('index.html')); pg.wait_for_timeout(600)
    pg.evaluate("document.getElementById('gate') && document.getElementById('gate').remove(); document.body.classList.remove('gate-open'); XSTUDIO.open()"); pg.wait_for_selector('#studio.on')
    pg.evaluate("(ys) => XSTUDIO_LIB.useYarns(() => ys)", yarns); pg.click('[data-v="v2d"]')
    pg.evaluate("XSTUDIO.loadDoc(XSTUDIO_LIB.newDoc({ widthCm: 60, heightCm: 40, layers: [XSTUDIO_LIB.layer('rect', {})] }))"); pg.wait_for_timeout(300)
    pg.click('[data-lt="col"]'); pg.wait_for_timeout(300)
    chips = pg.evaluate("[...document.querySelectorAll('#studio .fam [data-fam]')].map(b => b.textContent.trim())")
    check(len(chips) == 14 and chips[0].startswith('All') and '1000' in chips[0], 'family chips: All (1000) + 13 families: %s' % chips[:3])
    check(pg.evaluate("document.querySelectorAll('#studio .cg').length") == 13, 'one section per family')
    n_all = pg.evaluate("document.querySelectorAll('#studio .sw button').length")
    check(n_all <= 13 * 31 and n_all >= 100, 'overview shows only the first shades per family (%d swatches, not 1000)' % n_all)
    check(pg.evaluate("[...document.querySelectorAll('#studio .cg .sb[data-fam]')].some(b => /^Show all \\d+/.test(b.textContent))"), 'each long family offers "Show all"')
    # a family chip shows the whole family, sorted dark to light
    pg.click('#studio .fam [data-fam="blues"]'); pg.wait_for_timeout(200)
    cnt = pg.evaluate("document.querySelectorAll('#studio .sw button').length"); want = int(re.search(r'(\d+)\s*$', [c for c in chips if c.startswith('Blues')][0]).group(1))
    check(cnt == want and pg.evaluate("document.querySelectorAll('#studio .cg').length") == 1, 'Blues chip shows all %d blue shades in one section' % want)
    check(pg.evaluate("document.querySelector('#studio .fam [data-fam=blues]').getAttribute('aria-pressed')") == 'true', 'active family chip is marked pressed')
    # choosing a swatch applies the yarn colour to the selected object
    pg.click('[data-lt="lay"]'); pg.wait_for_timeout(200); pg.evaluate("document.querySelector('[data-sel]').click()"); pg.wait_for_timeout(200); pg.click('[data-lt="col"]'); pg.wait_for_timeout(200); pg.click('#studio .fam [data-fam="blues"]'); pg.wait_for_timeout(200)
    first = pg.evaluate("document.querySelector('#studio .sw button').dataset.y"); pg.click('#studio .sw button'); pg.wait_for_timeout(300)
    check(pg.evaluate("XSTUDIO.getDoc().doc.layers[0].fill") == first, 'clicking a swatch sets the object colour to %s' % first)
    # search narrows within families; All restores
    pg.fill('#stCq', 'Teal'); pg.wait_for_timeout(200)
    names = pg.evaluate("[...document.querySelectorAll('#studio .sw button')].map(b => b.getAttribute('aria-label'))")
    check(len(names) > 0 and all('teal' in n.lower() for n in names), 'search "Teal" keeps families and only matching shades (%d)' % len(names))
    pg.fill('#stCq', ''); pg.click('#studio .fam [data-fam=""]'); pg.wait_for_timeout(200)
    check(pg.evaluate("document.querySelectorAll('#studio .cg').length") == 13, 'All restores every family')
    # border colour picker uses families too; replace-with list is grouped
    pg.click('[data-lt="size"]'); pg.wait_for_timeout(200); pg.evaluate("var r=document.getElementById('stBd'); r.value=2; r.dispatchEvent(new Event('input',{bubbles:true})); r.dispatchEvent(new Event('change',{bubbles:true}))"); pg.wait_for_timeout(300)
    check(pg.evaluate("document.querySelectorAll('#studio .fam').length") >= 1 and pg.evaluate("document.querySelectorAll('#studio [data-by]').length") > 0, 'border colour picker is grouped into families')
    pg.click('[data-lt="col"]'); pg.wait_for_timeout(200)
    check(pg.evaluate("document.querySelectorAll('#stRt optgroup').length") == 13, 'Replace-with list is grouped (13 optgroups)')
    # the 3D preview and the design still render with a 1000-yarn library
    pg.click('[data-v="v3d"]'); pg.wait_for_timeout(800)
    check(not errs, 'no console or page errors %s' % errs[:3]); pg.screenshot(path='/tmp/colour_picker.png'); br.close()
print('\n%d failure(s)' % len(fails)); sys.exit(1 if fails else 0)
