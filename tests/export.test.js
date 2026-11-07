const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), cp = require('child_process'), os = require('os'), path = require('path');
const X = require('../src/mod/studio_export.js');
const yarns = [{ id: 'XY-001', hex: '#0B0B0B' }, { id: 'XY-002', hex: '#2A2D2A' }, { id: 'XY-007', hex: '#39FF14' }, { id: 'XY-010', hex: '#FF3B30' }];
const L = (type, o) => Object.assign({ id: 'a' + Math.random().toString(36).slice(2, 6), type, cx: .5, cy: .5, w: .3, h: .3, rot: 0, fill: 'XY-007', vis: true }, o);
const doc = (layers, o) => Object.assign({ shape: 'rect', widthCm: 60, heightCm: 40, radius: 8, borderCm: 0, bg: 'XY-002', borderYarn: 'XY-001', layers }, o);
const tmp = (name, bytes) => { const p = path.join(os.tmpdir(), 'xexp-' + process.pid + '-' + name); fs.writeFileSync(p, bytes); return p; };
const hasPy = () => { try { cp.execSync('python3 -c "import PIL, pypdf"', { stdio: 'ignore' }); return true; } catch (e) { return false; } };

test('svg: true physical size, every layer type, yarn colours only', () => {
  const s = X.svg(doc([L('rect'), L('ellipse', { fill: 'XY-010' }), L('poly', { pts: [[0, 0], [1, 0], [.5, 1]] }), L('wave', {}), L('text', { text: 'A & B <x>', font: 'Anton' }),
    L('pix', { rows: ['ab', 'ba'], pal: { a: 'XY-001', b: 'XY-010' } }), L('path', { d: 'M0 0 L1 0 L1 1 Z M0.2 0.2 L0.8 0.2 L0.8 0.8 Z' })]), yarns);
  assert.match(s, /^<svg [^>]*viewBox="0 0 60 40" width="60cm" height="40cm"/);
  ['<rect', '<ellipse', '<polygon', '<text', '<path'].forEach(t => assert.ok(s.includes(t), t));
  assert.ok(s.includes('A &amp; B &lt;x&gt;'), 'text is escaped');
  assert.ok(s.includes('fill-rule="evenodd"'));
  assert.ok(!/<script|onload|javascript:|<foreignObject/i.test(s));
  assert.ok(/#39FF14/.test(s) && /#FF3B30/.test(s));
});
test('svg: transparent background, hidden layers skipped, hostile input neutralised', () => {
  const t = X.svg(doc([L('rect', { vis: false }), L('path', { d: 'M0 0"><script>alert(1)</script>' }), L('image', { img: 'i', id: 'q' })], { bg: 'XY-002' }), yarns, { transparent: true, images: { i: { data: 'data:image/svg+xml;base64,AAAA', w: 1, h: 1 } } });
  assert.ok(!t.includes('<script') && !t.includes('data:image/svg'), 'no script / svg data images');
  assert.ok(!/fill="#2A2D2A"/.test(t), 'no background rect');
  assert.ok(!t.includes('<rect x="-'), 'hidden layer omitted');
});
test('svg: embeds raster artwork only from safe data URLs; circle shape clips', () => {
  const png = 'data:image/png;base64,iVBORw0KGgo=';
  const s = X.svg(doc([L('image', { img: 'i', id: 'z1', w: 1, h: 1 })], { shape: 'circle', borderCm: 2 }), yarns, { images: { i: { data: png, w: 100, h: 50 } } });
  assert.ok(s.includes('<image href="' + png + '"'));
  assert.ok(s.includes('<ellipse cx="30" cy="20" rx="30" ry="20"'));
  assert.ok(s.includes('stroke-width="4"'));
});
test('svg: bad size rejected', () => assert.throws(() => X.svg(doc([], { widthCm: 0 }), yarns), /size/));
test('dpiPlan: exact when it fits, capped and reported when it does not', () => {
  const a = X.dpiPlan(30, 20, 300); assert.deepStrictEqual([a.w, a.h, a.capped], [3543, 2362, false]);
  const b = X.dpiPlan(300, 200, 600); assert.ok(b.capped && b.w <= 12000 && b.w * b.h <= 80e6 && b.dpi < 600 && b.dpi > 50);
  assert.throws(() => X.dpiPlan(10, 10, 10), /DPI/);
});
test('PNG pHYs and JPEG JFIF density are written and read back by an independent decoder', { skip: !hasPy() }, () => {
  const py = (code, args) => cp.execFileSync('python3', ['-I', '-c', code].concat(args)).toString().trim();
  const dir = tmp('img', ''); fs.unlinkSync(dir);
  py("import sys;from PIL import Image;Image.new('RGB',(20,10),(200,10,10)).save(sys.argv[1]+'.png');Image.new('RGB',(20,10),(200,10,10)).save(sys.argv[1]+'.jpg',quality=80)", [dir]);
  const png = X.pngSetDpi(fs.readFileSync(dir + '.png'), 600), jpg = X.jpegSetDpi(fs.readFileSync(dir + '.jpg'), 300);
  fs.writeFileSync(dir + '2.png', png); fs.writeFileSync(dir + '2.jpg', jpg);
  const out = py("import sys;from PIL import Image;a=Image.open(sys.argv[1]+'2.png');b=Image.open(sys.argv[1]+'2.jpg');a.load();b.load();print(round(a.info['dpi'][0]),round(b.info['dpi'][0]),a.size,b.size)", [dir]);
  assert.match(out, /^600 300 \(20, 10\) \(20, 10\)$/);
  assert.throws(() => X.pngSetDpi(new Uint8Array(40), 300), /PNG/); assert.throws(() => X.jpegSetDpi(new Uint8Array(40), 300), /JPEG/);
  // pHYs applied twice must not duplicate
  assert.strictEqual(X.pngSetDpi(png, 300).length, png.length);
});
test('PDF: valid structure, real text, swatches, embedded JPEG, multi-page legend', { skip: !hasPy() }, () => {
  const d = tmp('j', ''); fs.unlinkSync(d);
  cp.execFileSync('python3', ['-I', '-c', "import sys;from PIL import Image;Image.new('RGB',(64,32),(10,200,40)).save(sys.argv[1],quality=85)", d + '.jpg']);
  const rows = Array.from({ length: 70 }, (_, i) => ({ hex: i % 2 ? '#FF3B30' : '#39FF14', cells: ['XY-' + String(i).padStart(3, '0'), 'Colour “no. ' + i + '”', (i / 10).toFixed(1) + '%'] }));
  const bytes = X.pdf({ title: 'Rug – Test (A)', subtitle: 'Customer: Müller', meta: [['Size', '60 x 40 cm'], ['Shape', 'rect'], ['Pile', 'standard']], image: { jpeg: fs.readFileSync(d + '.jpg'), w: 64, h: 32 }, legend: { head: ['Code', 'Name', 'Share'], widths: [90, 250, 80], rows }, notes: ['A long note. '.repeat(40)], footer: 'XARO Studio' });
  const p = tmp('s.pdf', bytes);
  assert.strictEqual(cp.spawnSync('qpdf', ['--check', p]).status, 0, 'qpdf --check');
  const info = cp.execFileSync('python3', ['-I', '-c', "import sys;from pypdf import PdfReader;r=PdfReader(sys.argv[1]);print(len(r.pages));print(r.pages[0].extract_text());print(len(r.pages[0].images))", p]).toString();
  const lines = info.split('\n'); assert.ok(+lines[0] >= 2, 'legend spills to a second page'); assert.match(info, /Rug - Test \(A\)/); assert.match(info, /Customer: Müller/); assert.match(info, /XY-005/); assert.ok(+lines[lines.length - 2] === 1 || /\n1\n?$/.test(info), 'artwork embedded');
});
test('PDF: no image, no legend still valid', { skip: !hasPy() }, () => { const p = tmp('e.pdf', X.pdf({ title: 'Empty' })); assert.strictEqual(cp.spawnSync('qpdf', ['--check', p]).status, 0); });
test('PDF text: parentheses and backslashes cannot break the content stream', { skip: !hasPy() }, () => {
  const p = tmp('x.pdf', X.pdf({ title: 'a) Tj ET (b \\ c', meta: [['x)', '(y']] }));
  assert.strictEqual(cp.spawnSync('qpdf', ['--check', p]).status, 0);
  const t = cp.execFileSync('python3', ['-I', '-c', "import sys;from pypdf import PdfReader;print(PdfReader(sys.argv[1]).pages[0].extract_text())", p]).toString(); assert.match(t, /a\) Tj ET \(b \\ c/);
});
