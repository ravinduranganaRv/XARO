const test = require('node:test'), assert = require('node:assert/strict');
const C = require('../src/mod/colour.js');
const near = (a, b, e) => assert.ok(Math.abs(a - b) <= e, `${a} vs ${b}`);
test('CIEDE2000 matches published reference pairs (Sharma et al.)', () => {
  near(C.deltaE([50, 2.6772, -79.7751], [50, 0, -82.7485]), 2.0425, 1e-3);
  near(C.deltaE([50, 3.1571, -77.2803], [50, 0, -82.7485]), 2.8615, 1e-3);
  near(C.deltaE([50, 2.5, 0], [73, 25, -18]), 27.1492, 1e-3);
  near(C.deltaE([60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387]), 1.2644, 1e-3);
});
test('rgb <-> lab round trip', () => { for (const c of [[0, 0, 0], [255, 255, 255], [57, 255, 20], [200, 30, 90]]) { const l = C.rgb2lab(...c), b = C.lab2rgb(...l); c.forEach((v, i) => near(v, b[i], 1.01)); } });
// synthetic image: 25 colours = 5 families x 5 close shades, different areas
function image() {
  const fam = [[220, 30, 40], [30, 90, 220], [40, 190, 70], [240, 200, 30], [30, 30, 30]], px = [];
  fam.forEach((f, fi) => { for (let s = 0; s < 5; s++) { const n = 400 + 150 * fi - 30 * s; for (let k = 0; k < n; k++) px.push(f[0] + s * 4, f[1] + s * 3, f[2] + s * 4, 255); } });
  for (let k = 0; k < 300; k++) px.push(255, 255, 255, 0);       // transparent, must be ignored
  return Uint8ClampedArray.from(px);
}
test('extract finds visibly different colours, ignores transparent, coverage sums to 100', () => {
  const p = C.extract(image(), { tol: 6 }); assert.ok(p.colours.length >= 5 && p.colours.length <= 25);
  near(p.colours.reduce((s, c) => s + c.pct, 0), 100, 1e-6); let want = 0; for (let fi = 0; fi < 5; fi++) for (let k = 0; k < 5; k++) want += 400 + 150 * fi - 30 * k; assert.equal(p.total, want);
});
test('reduce to N gives exactly N colours, maps every original colour, merges similar shades first', () => {
  const p = C.extract(image(), { tol: 0.5 }); assert.ok(p.colours.length > 10);
  for (const n of [10, 8, 6, 5]) { const r = C.reduce(p, n); assert.equal(r.colours.length, n); assert.equal(Object.keys(r.map).length, p.colours.length); near(r.colours.reduce((s, c) => s + c.pct, 0), 100, 1e-6); }
  const five = C.reduce(p, 5); // five families remain: each reduced colour holds shades of one family only
  for (const c of five.colours) { const ms = c.members.map(id => p.colours.find(o => o.id === id)); for (const m of ms) assert.ok(C.deltaE(m.lab, c.lab) < 12); }
});
test('locked colour keeps its exact value and survives', () => {
  const p = C.extract(image(), { tol: 0.5 }), rare = p.colours[p.colours.length - 1];
  const r = C.reduce(p, 3, [rare.id]); const holder = r.colours.find(c => c.members.includes(rare.id)); assert.ok(holder.locked); assert.equal(holder.hex, rare.hex);
});
test('manual merge and replace', () => {
  const p = C.extract(image(), { tol: 6 }), r = C.reduce(p, 5), m = C.merge(r, r.colours[0].id, r.colours[1].id);
  assert.equal(m.colours.length, 4); near(m.colours.reduce((s, c) => s + c.pct, 0), 100, 1e-6);
  C.replace(m, m.colours[0].id, '#123456'); assert.equal(m.colours[0].hex, '#123456');
});
test('remap recolours pixels with only the reduced colours, keeps transparency', () => {
  const d = image(), p = C.extract(d, { tol: 3 }), r = C.reduce(p, 5), o = C.remap(d, p, r), set = new Set();
  for (let i = 0; i < o.length; i += 4) { if (d[i + 3] < 128) { assert.equal(o[i + 3], d[i + 3]); continue; } set.add(o[i] + ',' + o[i + 1] + ',' + o[i + 2]); }
  assert.equal(set.size, 5);
});
test('yarn mapping picks nearest usable yarn and skips out-of-stock when alternatives exist', () => {
  const p = C.extract(image(), { tol: 6 }), r = C.reduce(p, 5), red = r.colours[0].hex;
  const yarns = [{ id: 'A', hex: red, availability: 'out' }, { id: 'B', hex: '#FFFFFF', availability: 'in-stock' }, { id: 'C', hex: '#DD2030', availability: 'in-stock' }];
  const m = C.mapYarns(r, yarns, 1000); assert.ok(m.every(x => x.yarn.id !== 'A')); near(m.reduce((s, x) => s + x.areaCm2, 0), 1000, 1e-6);
  assert.equal(C.mapYarns(r, [{ id: 'A', hex: red, availability: 'out' }], 100)[0].yarn.id, 'A'); // only choice: still returned, caller shows the warning
});
