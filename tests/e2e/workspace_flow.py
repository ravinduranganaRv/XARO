# Browser test of the rug-maker workspace against a MOCK Supabase backend (tests/e2e/mock_supabase.py). Run: python3 tests/e2e/workspace_flow.py [stage]
import io, json, os, re, subprocess, sys, csv
sys.path.insert(0, os.path.dirname(__file__))
from mock_supabase import Mock
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw
OUT = '/tmp/xw'; os.makedirs(OUT, exist_ok=True)
fails = []
def check(c, msg):
    print(('PASS ' if c else 'FAIL ') + msg)
    if not c: fails.append(msg)
mock = Mock()
def png_bytes(draw_fn, size=(400, 300), bg=(255, 255, 255)):
    im = Image.new('RGB', size, bg); d = ImageDraw.Draw(im); draw_fn(d, im); b = io.BytesIO(); im.save(b, 'PNG'); return b.getvalue()
def logo(d, im): d.rectangle([40, 40, 200, 160], fill=(200, 30, 40)); d.ellipse([180, 100, 360, 260], fill=(20, 80, 200)); d.rectangle([220, 30, 380, 80], fill=(240, 200, 20))
def many(d, im):
    for i in range(64): d.rectangle([(i % 8) * 50, (i // 8) * 37, (i % 8) * 50 + 49, (i // 8) * 37 + 36], fill=((i * 37) % 256, (i * 91) % 256, (i * 53) % 256))

with sync_playwright() as p:
    br = p.chromium.launch(); ctx = br.new_context(viewport={'width': 1360, 'height': 860}, accept_downloads=True); pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
    pg.route(re.compile(r'^https?://(?!mlrydpclqokizsqmigen)'), lambda r: r.abort())
    pg.set_default_timeout(10000); _click = pg.click; pg.click = lambda sel, **k: _click(sel, no_wait_after=True, **k); mock.attach(pg); pg.add_init_script(mock.session_script()); pg.add_init_script("window.requestAnimationFrame=cb=>setTimeout(()=>cb(performance.now()),3000)")
    pg.goto('file://' + os.path.abspath('index.html')); pg.wait_for_timeout(600)
    pg.evaluate("document.getElementById('gate') && document.getElementById('gate').remove(); document.body.classList.remove('gate-open'); XSTUDIO.open()"); pg.wait_for_selector('#studio.on')
    pg.wait_for_function("!document.getElementById('stWork').hidden", timeout=8000)
    check(pg.inner_text('#stAcct') == 'Rita', 'signed-in rug maker with a business sees the account chip and Workspace button')
    pg.click('#stWork'); pg.wait_for_selector('#xwork.on')
    names = pg.eval_on_selector_all('#xwork .xw-nav button', 'els => els.map(e => e.textContent)')
    check(names == ['Dashboard', 'My Designs', 'Image to Vector', 'Colour Separation', 'Yarn Manager', 'Rug Calculator', '3D Preview', 'Production Sheets', 'Customer Projects', 'Quotations', 'Orders', 'Inventory', 'Reports', 'Account Settings'], 'all 14 workspace sections are listed in order')
    pg.wait_for_selector('#xwork .xw-cards'); check('getting set up' in pg.inner_text('#xwBody').lower(), 'dashboard shows the setup checklist for a new business')
    def go(label): pg.click('#xwork .xw-nav button:text-is("%s")' % label); pg.wait_for_selector('#xwBody > *', timeout=8000); pg.wait_for_timeout(250)
    def dl(click_sel, name_sel=None):
        with pg.expect_download(timeout=30000) as d: pg.click(click_sel)
        f = d.value; path = os.path.join(OUT, f.suggested_filename); f.save_as(path); return path
    def fill_yarn(code, name, hexv, price='', stock='0', reorder=''):
        pg.click('#yAdd'); pg.fill('#yC', code); pg.fill('#yN', name); pg.fill('#yH', hexv); pg.fill('#yP', price); pg.fill('#yS', stock); pg.fill('#yR', reorder); pg.click('.xw-acts .pri'); pg.wait_for_selector('.xw-mod', state='detached'); pg.wait_for_timeout(400)

    # ---------------- Yarn Manager
    go('Yarn Manager'); check('empty' in pg.inner_text('#xwBody').lower() or 'Your yarn library is empty' in pg.inner_text('#xwBody'), 'yarn manager starts empty')
    fill_yarn('R1', 'Red', '#ff0000', '10', '5', '2'); fill_yarn('B1', 'Blue', '#0000ff', '20', '0.5', '1')
    ys = {y['code']: y for y in mock.t['biz_yarns']}
    check(set(ys) == {'R1', 'B1'} and ys['R1']['hex'] == '#FF0000' and ys['R1']['stock_kg'] == 5 and ys['R1']['price_per_kg'] == 10, 'yarns added with normalised colour, price and opening stock')
    check(len([m for m in mock.t['yarn_movements'] if m['kind'] == 'purchase']) == 2, 'opening stock is recorded as purchase movements')
    check('1 yarn at or below the reorder level' in pg.inner_text('#xwBody'), 'low-stock banner shows for the yarn under its reorder level')
    pg.click('#yAdd'); pg.fill('#yC', 'R1'); pg.fill('#yH', '#123456'); pg.click('.xw-acts .pri'); pg.wait_for_selector('.xw-tt.on.bad'); check('already exists' in pg.inner_text('.xw-tt'), 'duplicate yarn code is refused with a clear message'); pg.click('.xw-mod .x')
    pg.click('#yAdd'); pg.fill('#yC', 'Z9'); pg.fill('#yH', 'nothex'); pg.click('.xw-acts .pri'); check('#RRGGBB' in pg.inner_text('#yE'), 'bad hex colour is rejected before sending'); pg.click('.xw-mod .x')
    csvp = os.path.join(OUT, 'imp.csv'); open(csvp, 'w').write('Code,Name,Hex,Brand,Price,Stock,Reorder\nR1,Red updated,#ee0000,Acme,11,99,3\nG1,Green,00ff00,Acme,8,4,1\nY1,Yellow,#ffff00,,,,\nBAD,Bad,zzz,,,,\n')
    pg.set_input_files('#yImp', csvp); pg.wait_for_selector('.xw-mod'); t = pg.inner_text('.xw-mod')
    check('2 new' in t and '1 existing' in t and '1 row with problems' in t, 'CSV import preview counts new, existing and problem rows: ' + t[:90].replace('\n', ' '))
    pg.click('.xw-acts .pri'); pg.wait_for_selector('.xw-mod', state='detached'); pg.wait_for_timeout(300)
    ys = {y['code']: y for y in mock.t['biz_yarns']}
    check(set(ys) == {'R1', 'B1', 'G1', 'Y1'} and ys['R1']['name'] == 'Red updated' and ys['R1']['stock_kg'] == 5, 'import adds new yarns, updates details of existing ones and never overwrites stock')
    check(ys['G1']['stock_kg'] == 4, 'imported opening stock goes through a purchase movement')
    pth = dl('#yExp'); rows = list(csv.reader(open(pth, encoding='utf-8-sig'))); check(rows[0][:3] == ['code', 'name', 'hex'] and len(rows) == 5, 'yarn CSV export has header and all yarns')
    pg.click('[data-sel]:nth-of-type(1)') if False else None
    pg.check('tr:has-text("R1") [data-sel]'); pg.check('tr:has-text("B1") [data-sel]'); pg.click('#yPal'); pg.fill('#pN', 'Core'); pg.click('.xw-acts .pri'); pg.wait_for_timeout(300)
    check(len(mock.t['biz_palettes']) == 1 and sorted(mock.t['biz_palettes'][0]['colours']) == ['B1', 'R1'], 'selected yarns saved as a palette')
    # studio uses the business yarns
    check(pg.evaluate("XSTUDIO_LIB.yarnList().map(y=>y.id).sort().join(',')") == 'BY-B1,BY-G1,BY-R1,BY-Y1', 'design editor offers the rug maker\'s own yarn library')
    pg.screenshot(path=OUT + '/yarns.png')

    # ---------------- Inventory
    go('Inventory'); pg.click('#iMove'); pg.select_option('#mY', label='R1 - Red updated'); pg.select_option('#mK', 'actual_use'); pg.fill('#mG', '1.5'); pg.click('.xw-acts .pri'); pg.wait_for_selector('.xw-mod', state='detached'); pg.wait_for_timeout(300)
    r1 = [y for y in mock.t['biz_yarns'] if y['code'] == 'R1'][0]; check(r1['stock_kg'] == 3.5, 'actual use reduces stock (5 - 1.5 = 3.5)')
    pg.click('#iMove'); pg.select_option('#mY', label='R1 - Red updated'); pg.select_option('#mK', 'estimated_use'); pg.fill('#mG', '2'); pg.click('.xw-acts .pri'); pg.wait_for_selector('.xw-mod', state='detached'); pg.wait_for_timeout(300)
    check(r1['stock_kg'] == 3.5, 'estimated use does not change stock')
    rowtxt = pg.inner_text('tr:has-text("R1")'); check('3.5' in rowtxt and '2' in rowtxt and '1.5' in rowtxt, 'inventory shows stock, estimated and actual use side by side: ' + rowtxt.replace('\n', ' ').replace('\t', ' '))
    pg.click('#iMove'); pg.select_option('#mY', label='R1 - Red updated'); pg.fill('#mG', '0'); pg.click('.xw-acts .pri'); check('weight' in pg.inner_text('#mE'), 'zero weight is rejected'); pg.click('.xw-mod .x')
    pg.select_option('#iFk', 'actual_use'); pg.wait_for_timeout(300); check(pg.locator('.xw-sec:has-text("Movement history") tbody tr').count() == 1, 'movement history filters by type')
    if len(sys.argv) > 1 and sys.argv[1] == '1': print('stage 1 done', 'FAILED %d' % len(fails) if fails else 'ALL PASSED', errs[:5]); br.close(); sys.exit(1 if fails else 0)
    def toast_text(): pg.wait_for_selector('.xw-tt.on'); return pg.inner_text('.xw-tt')
    def pdf_ok(path, *needles):
        r = subprocess.run(['qpdf', '--check', path], capture_output=True); txt = subprocess.run(['python3', '-I', '-c', "import sys;from pypdf import PdfReader;print('\\n'.join(p.extract_text() for p in PdfReader(sys.argv[1]).pages))", path], capture_output=True, text=True).stdout
        return r.returncode == 0 and all(n in txt for n in needles), txt

    # ---------------- Customer Projects
    go('Customer Projects'); pg.click('[data-tab=customers]'); pg.wait_for_timeout(300); pg.click('#pNew'); pg.fill('#cuN', 'Ann Perera'); pg.fill('#cuE', 'bad-email'); pg.click('.xw-acts .pri'); check('email' in pg.inner_text('#cuErr').lower(), 'customer form validates the email')
    pg.fill('#cuE', 'ann@example.com'); pg.click('.xw-acts .pri'); pg.wait_for_selector('.xw-mod', state='detached'); pg.wait_for_timeout(300); check(len(mock.t['biz_customers']) == 1, 'customer created')
    pg.click('[data-tab=projects]'); pg.wait_for_timeout(300); pg.click('#pNew'); pg.fill('#prT', 'Ann living room rug'); pg.select_option('#prC', label='Ann Perera'); pg.fill('#prU', '2026-12-20'); pg.click('.xw-acts .pri'); pg.wait_for_selector('.xw-mod', state='detached'); pg.wait_for_timeout(300)
    pj = mock.t['biz_projects'][0]; check(pj['title'] == 'Ann living room rug' and pj['status'] == 'enquiry' and pj['customer_id'] == mock.t['biz_customers'][0]['id'] and pj['due_date'] == '2026-12-20', 'project created for the customer with a due date')
    pg.select_option('[data-ps]', 'quoted'); pg.wait_for_timeout(300); check(pj['status'] == 'quoted', 'project status changes inline')
    pg.fill('#pq', 'zzz'); pg.wait_for_timeout(600); check('Ann living' not in pg.inner_text('#xwBody'), 'project search filters the list'); pg.fill('#pq', '')

    # ---------------- Rug Calculator
    go('Rug Calculator'); pg.click('#cAdd'); pg.click('#cAdd'); pg.select_option('[data-ci="0"] [data-cy]', label='R1 - Red updated'); pg.fill('[data-ci="0"] [data-cp]', '75'); pg.select_option('[data-ci="1"] [data-cy]', label='B1 - Blue'); pg.fill('[data-ci="1"] [data-cp]', '25')
    out = pg.inner_text('#cOut'); check('still to enter' in out and 'No total is shown' in out and pg.locator('#cOut .xw-total').count() == 0, 'with no rates entered the calculator lists what is missing and shows no total')
    check(pg.locator('#cOut .xw-badge:text-is("missing")').count() >= 3, 'cost lines without a rate are marked missing, not zero')
    for k, v in {'currency': 'lkr', 'pileKgPerM2__standard': '2', 'wastePct': '10', 'labour__hoursPerM2': '4', 'labour__hourlyRate': '5', 'backingPerM2': '3', 'finishingFlat': '4', 'packagingFlat': '1', 'marginPct': '25', 'taxPct': '5'}.items(): pg.fill('#r_' + k, v)
    pg.fill('#r_wastePct', '120'); pg.click('#rSave'); check('cannot be above 100' in pg.inner_text('#rErr'), 'a waste rate above 100% is rejected'); pg.fill('#r_wastePct', '10'); pg.click('#rSave'); pg.wait_for_timeout(400)
    rt = mock.t['biz_rates'][0]['rates']; check(rt.get('currency') == 'LKR' and rt['pileKgPerM2'] == {'standard': 2} and rt['labour'] == {'hoursPerM2': 4, 'hourlyRate': 5} and 'overheadPct' not in rt and 'bindingPerM' not in rt, 'only the rates the maker entered are stored: ' + json.dumps(rt))
    out = pg.inner_text('#cOut'); check('80.01' in out and 'still to enter' not in out, 'total is 80.01 once every needed rate is set (hand-checked: 57.15 cost / 0.75 + 5% tax): ' + out[-160:].replace('\n', ' '))
    check('SHORT BY 0.05 KG' in out.upper(), 'stock check flags the yarn that is short')
    pg.select_option('#cPrj', label='Ann living room rug'); pg.click('#cPlan'); pg.wait_for_timeout(400); est = sorted((round(m['kg'], 3)) for m in mock.t['yarn_movements'] if m['kind'] == 'estimated_use' and m.get('project_id') == pj['id'])
    check(est == [0.55, 1.65], 'estimated yarn use saved against the project as planned (not stock): %s' % est); check([y for y in mock.t['biz_yarns'] if y['code'] == 'R1'][0]['stock_kg'] == 3.5, 'saving an estimate leaves stock untouched')
    pg.click('#cQuote'); pg.wait_for_timeout(400); qd = mock.t['biz_quotations'][0]; check(re.match(r'Q-\d{4}-0001$', qd['ref']) and qd['currency'] == 'LKR' and qd['lines']['items'][0]['unit'] == 76.2 and qd['lines']['total'] == 80.01 and qd['status'] == 'draft', 'quotation draft created from the estimate')

    # ---------------- Quotations
    go('Quotations'); check('LKR' in pg.inner_text('#xwBody') or '80.01' in pg.inner_text('#xwBody'), 'quotation listed with its total'); pg.click('[data-qe]'); pg.wait_for_selector('.xw-mod')
    pg.select_option('#qC', label='Ann Perera'); pg.select_option('#qP', label='Ann living room rug'); pg.select_option('#qS', 'sent'); pg.click('#qAddL'); pg.fill('[data-li="1"] [data-ld]', 'Delivery'); pg.fill('[data-li="1"] [data-lu]', '10'); pg.fill('#qD', '10')
    check('81.46' in pg.inner_text('#qTot'), 'live total: (76.20 + 10.00) less 10%, plus 5% tax = 81.46: ' + pg.inner_text('#qTot'))
    pg.fill('[data-li="1"] [data-lu]', '-5'); pg.click('.xw-acts .pri'); check('unit price' in pg.inner_text('#qErr'), 'negative unit price is rejected'); pg.fill('[data-li="1"] [data-lu]', '10'); pg.click('.xw-acts .pri'); pg.wait_for_selector('.xw-mod', state='detached'); pg.wait_for_timeout(400)
    qd = mock.t['biz_quotations'][0]; check(qd['status'] == 'sent' and qd['subtotal'] == 86.2 and len(qd['lines']['items']) == 2 and qd['lines']['discountPct'] == 10 and qd['lines']['total'] == 81.46 and qd['customer_id'] and qd['project_id'], 'edited quotation stored with discount, tax and totals: ' + json.dumps({k: qd[k] for k in ('subtotal', 'status')}) + str(qd['lines'].get('total')))
    check([x for x in mock.t['biz_projects']][0]['status'] == 'quoted', 'sending a quotation marks the project as quoted')
    path = dl('[data-qp]'); okp, txt = pdf_ok(path, qd['ref'], 'Ann Perera', 'Delivery', 'TOTAL: 81.46 LKR'); check(okp, 'quotation PDF is valid and carries the reference, customer, lines and total')
    pg.click('[data-qo]'); pg.fill('#oDue', '2026-12-10'); pg.click('.xw-acts .pri'); pg.wait_for_timeout(500); od = mock.t['biz_orders'][0]
    check(re.match(r'O-\d{4}-0001$', od['ref']) and od['total'] == 81.46 and od['paid'] == 0 and od['quotation_id'] == qd['id'] and od['due_date'] == '2026-12-10' and qd['status'] == 'accepted', 'order created from the quotation; quotation becomes accepted')
    check(mock.t['biz_projects'][0]['status'] == 'confirmed', 'project becomes confirmed')

    # ---------------- Orders
    go('Orders'); pg.click('[data-op]'); pg.fill('#pA', '0'); pg.click('.xw-acts .pri'); check('above 0' in pg.inner_text('#pE'), 'zero payment rejected'); pg.fill('#pA', '30'); pg.click('.xw-acts .pri'); pg.wait_for_timeout(500)
    check(od['paid'] == 30 and '51.46' in pg.inner_text('#xwBody'), 'payment recorded and balance shown (81.46 - 30 = 51.46)')
    pg.select_option('[data-os]', 'in_production'); pg.wait_for_timeout(500); check(od['status'] == 'in_production' and mock.t['biz_projects'][0]['status'] == 'in_production', 'order status flows to the project (in production)')
    pg.select_option('[data-os]', 'delivered'); pg.wait_for_timeout(500); check(mock.t['biz_projects'][0]['status'] == 'delivered', 'delivered order marks the project delivered')
    pg.click('#oNew'); pg.fill('#oCur', 'x'); pg.fill('#oT', '10'); pg.click('.xw-acts .pri'); check('3 letters' in pg.inner_text('#oErr'), 'manual order validates currency'); pg.fill('#oCur', 'usd'); pg.fill('#oT', '100'); pg.click('.xw-acts .pri'); pg.wait_for_selector('.xw-mod', state='detached'); pg.wait_for_timeout(400)
    check(len(mock.t['biz_orders']) == 2 and mock.t['biz_orders'][1]['ref'].endswith('-0002'), 'manual order gets the next reference')
    open(OUT + '/stage2', 'w').write('ok')
    if len(sys.argv) > 1 and sys.argv[1] == '2': print('stage 2 done', 'FAILED %d' % len(fails) if fails else 'ALL PASSED', errs[:5]); br.close(); sys.exit(1 if fails else 0)
