const test = require('node:test'), assert = require('node:assert/strict');
const V = require('../src/mod/vectorize.js');
const mk = (w, h, f) => { const data = new Uint8ClampedArray(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = f(x, y) || [0, 0, 0, 0], i = (y * w + x) * 4; data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = c[3] == null ? 255 : c[3]; } return { width: w, height: h, data }; };
const RED = [200, 30, 40], BLUE = [20, 60, 200], GREEN = [30, 160, 60], WHITE = [250, 250, 250], BLACK = [10, 10, 10];
const hex = c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
// even-odd rasteriser: returns the fill of the shape containing the point (shapes do not overlap) or null
function inside(rings, px, py) { let c = false; for (const r of rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const a = r[i], b = r[j]; if ((a[1] > py) !== (b[1] > py) && px < (b[0] - a[0]) * (py - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
function raster(res) { const shapes = res.shapes.map(s => ({ fill: s.fill, rings: V.pathToRings(s.d) })); return (x, y) => { for (const s of shapes) if (inside(s.rings, x + .5, y + .5)) return s.fill; return null; }; }
function agreement(img, res, truth) { const f = raster(res); let ok = 0, n = 0; for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) { n++; if (f(x, y) === truth(x, y)) ok++; } return ok / n; }

test('two colours: rectangle on white', () => {
  const img = mk(100, 80, (x, y) => (x >= 20 && x < 70 && y >= 10 && y < 50) ? RED : WHITE), r = V.vectorize(img, { level: 1 });
  assert.equal(r.stats.colours, 2); const red = r.shapes.find(s => s.fill === hex(RED)); assert.ok(Math.abs(red.area - 2000) / 2000 < 0.01, 'area ' + red.area);
  const xs = V.pathToRings(red.d)[0].map(p => p[0]), ys = V.pathToRings(red.d)[0].map(p => p[1]); assert.deepEqual([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)], [20, 70, 10, 50]);
});
test('circle with a hole keeps the hole', () => {
  const f = (x, y) => { const d = Math.hypot(x - 60, y - 60); return d < 40 && d > 18 ? BLUE : WHITE; }, img = mk(120, 120, f), r = V.vectorize(img, { level: 1 });
  const ag = agreement(img, r, (x, y) => hex(f(x, y))); assert.ok(ag >= 0.97, 'agreement ' + ag); assert.ok(V.pathToRings(r.shapes.find(s => s.fill === hex(BLUE)).d).length >= 2, 'ring + hole');
});
test('adjacent rectangles: no gaps or overlaps', () => {
  const f = (x, y) => x < 40 ? RED : x < 90 ? (y < 50 ? GREEN : BLUE) : WHITE, img = mk(130, 100, f), r = V.vectorize(img, { level: 1 });
  const ag = agreement(img, r, (x, y) => hex(f(x, y))); assert.ok(ag >= 0.97, 'agreement ' + ag);
  // every pixel centre is covered exactly once (even-odd per shape, shapes disjoint)
  const sh = r.shapes.map(s => V.pathToRings(s.d)); let bad = 0; for (let y = 0; y < 100; y += 3) for (let x = 0; x < 130; x += 3) { const n = sh.filter(rg => inside(rg, x + .5, y + .5)).length; if (n !== 1) bad++; } assert.equal(bad, 0);
});
function noisy(w, h, seed) { let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  return mk(w, h, (x, y) => { let c = (x < w / 2) ? ((y < h / 2) ? RED : BLUE) : ((y < h / 2) ? GREEN : WHITE); if (x > w * 0.6 && y > h * 0.55) c = [Math.round(255 * (x / w)), Math.round(255 * (y / h)), 90];
    if (rnd() < 0.03) c = [Math.floor(rnd() * 255), Math.floor(rnd() * 255), Math.floor(rnd() * 255)]; return c; }); }
test('higher level = fewer points and shapes (noisy image)', () => {
  const img = noisy(300, 240, 7), res = [1, 2, 3, 4, 5].map(l => V.vectorize(img, { level: l, colours: 8 }));
  for (let i = 1; i < 5; i++) { assert.ok(res[i].stats.points <= res[i - 1].stats.points, 'points L' + (i + 1)); assert.ok(res[i].stats.shapes <= res[i - 1].stats.shapes, 'shapes L' + (i + 1)); }
  assert.ok(res[4].stats.points <= res[0].stats.points * 0.6, `level5 ${res[4].stats.points} vs level1 ${res[0].stats.points}`);
});
test('deterministic', () => { const img = noisy(120, 100, 3); assert.equal(V.vectorize(img, { level: 3, colours: 6 }).svg, V.vectorize(img, { level: 3, colours: 6 }).svg); });
test('forced palette: result colours are a subset', () => {
  const pal = ['#FF0000', '#00FF00', '#0000FF', '#FFFFFF'], r = V.vectorize(noisy(120, 100, 5), { level: 3, palette: pal }); assert.ok(r.palette.every(c => pal.includes(c)), r.palette.join());
});
test('transparent pixels produce no shapes; background option fills them', () => {
  const img = mk(60, 60, (x, y) => (x > 15 && x < 45 && y > 15 && y < 45) ? RED : [0, 0, 0, 0]), r = V.vectorize(img, { level: 1 });
  assert.equal(r.shapes.length, 1); assert.equal(r.shapes[0].fill, hex(RED)); const b = V.vectorize(img, { level: 1, background: '#FFFFFF' }); assert.equal(b.shapes.length, 2);
});
test('edit helpers: merge, recolour, remove keep a valid svg', () => {
  const f = (x, y) => x < 40 ? RED : x < 90 ? GREEN : BLUE, img = mk(130, 60, f), r = V.vectorize(img, { level: 1 });
  const m = V.mergeColours(r, hex(GREEN), hex(BLUE)); assert.equal(m.stats.colours, 2); const rc = V.recolour(r, hex(RED), '#112233'); assert.ok(rc.palette.includes('#112233'));
  const rm = V.removeShape(r, 0); assert.equal(rm.shapes.length, r.shapes.length - 1); for (const x of [m, rc, rm]) { assert.match(x.svg, /^<svg [^>]*>(<path [^>]*\/>)+<\/svg>$/); assert.ok(!/script|href|style|on\w+=/i.test(x.svg)); }
  assert.throws(() => V.recolour(r, hex(RED), 'red'), /#RRGGBB/); assert.throws(() => V.removeShape(r, 99), /No such shape/);
  const a = m.shapes.reduce((s, x) => s + x.area, 0); assert.ok(Math.abs(a - 130 * 60) / (130 * 60) < 0.01, 'merged areas still cover the image: ' + a);
});
test('invalid input is rejected', () => {
  assert.throws(() => V.vectorize({ width: 0, height: 5, data: [] }), /positive/); assert.throws(() => V.vectorize({ width: 2, height: 2, data: new Uint8ClampedArray(4) }), /does not match/);
  assert.throws(() => V.vectorize({ width: 6000, height: 6000, data: new Uint8ClampedArray(4) }), /too large/); assert.throws(() => V.vectorize(null), /positive/); assert.throws(() => V.vectorize(mk(5, 5, () => RED), { palette: ['nope'] }), /no valid/);
});
test('svg only contains fixed elements and validated colours', () => { const r = V.vectorize(noisy(80, 60, 2), { level: 2, colours: 5 }); assert.match(r.svg, /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox="0 0 80 60" width="80" height="60">/); assert.ok(r.shapes.every(s => /^#[0-9A-F]{6}$/.test(s.fill))); });
test('performance: 1200x900 image', () => {
  const img = noisy(1200, 900, 11), t = Date.now(), r = V.vectorize(img, { level: 3, colours: 8 }), ms = Date.now() - t; console.log('1200x900 level3: ' + ms + ' ms, shapes ' + r.stats.shapes + ', points ' + r.stats.points); assert.ok(ms < 15000, ms + ' ms');
});
test('large input is downscaled and coordinates map back to the original size', () => {
  const img = mk(2400, 1800, (x, y) => (x > 600 && x < 1800 && y > 450 && y < 1350) ? RED : WHITE), r = V.vectorize(img, { level: 2 }); const red = r.shapes.find(s => s.fill === hex(RED));
  assert.ok(Math.abs(red.area - 1200 * 900) / (1200 * 900) < 0.02, 'area ' + red.area); assert.match(r.svg, /viewBox="0 0 2400 1800"/);
});
