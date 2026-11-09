const test = require('node:test'), assert = require('node:assert'); const S = require('../src/mod/studio3d.js'), E = require('../src/mod/studio_edit.js');
const near = (a, b, e = 1e-3) => assert.ok(Math.abs(a - b) <= e, a + ' vs ' + b);
test('outline: rectangle, rounded rectangle, ellipse and custom areas', () => {
  near(E.polyArea(E.outline({ shape: 'rect', widthCm: 60, heightCm: 40, radius: 0 })), 1);
  const w = 60, h = 40, r = 0.2 * 40, exp = (w * h - (4 - Math.PI) * r * r) / (w * h); near(E.polyArea(E.outline({ shape: 'rect', widthCm: w, heightCm: h, radius: 20 }, 200)), exp, 2e-3);
  near(E.polyArea(E.outline({ shape: 'oval', widthCm: 60, heightCm: 40 }, 360)), Math.PI / 4, 1e-3);
  const tri = [[0, 1], [0.5, 0], [1, 1]]; assert.deepStrictEqual(E.outline({ shape: 'custom', outline: tri }), tri); near(E.polyArea(tri), 0.5);
  assert.ok(E.outline({ shape: 'custom', outline: [[0, 0]] }).length > 3, 'a broken outline falls back to the rectangle');
  near(E.perimeterCm([[0, 0], [1, 0], [1, 1], [0, 1]], 60, 40), 200);
});
test('outline helpers: smoothing keeps size, blob is fitted to the unit square', () => {
  const sm = E.smoothClosed([[0, 0], [1, 0], [1, 1], [0, 1]], 2); assert.strictEqual(sm.length, 16); assert.ok(E.polyArea(sm) < 1 && E.polyArea(sm) > 0.8);
  const b = E.presetOutline('blob'), xs = b.map(p => p[0]), ys = b.map(p => p[1]); near(Math.min(...xs), 0); near(Math.max(...xs), 1); near(Math.min(...ys), 0); near(Math.max(...ys), 1); assert.ok(E.polyArea(b) > 0.5 && E.polyArea(b) < 0.9);
  assert.strictEqual(E.presetOutline('nope'), null);
});
test('sdf: edge at 128, inside brighter, outside darker, distance in world units', () => {
  const f = S.sdf([[0.2, 0.2], [0.8, 0.2], [0.8, 0.8], [0.2, 0.8]], 64, 4, 2, 0.5), at = (x, y) => f[Math.floor(y * 64) * 64 + Math.floor(x * 64)];
  assert.ok(at(0.5, 0.5) > 200, 'centre well inside'); assert.ok(at(0.05, 0.05) < 30, 'corner outside');
  // a point 0.3 world units inside the left edge: x = 0.2*4 + 0.3 = 1.1 -> u = 0.275 ; byte = 0.5 + 0.3/(2*0.5) = 0.8 * 255 = 204
  near(f[32 * 64 + Math.round(0.275 * 64 - 0.5)], 204, 6);
});
test('wallMesh: closed strip with outward unit normals and the right depth, for both winding orders', () => {
  const sq = [[0, 0], [1, 0], [1, 1], [0, 1]];
  [sq, sq.slice().reverse()].forEach(poly => {
    const m = S.wallMesh(poly, 4, 2, 0.1); assert.strictEqual(m.v.length, 4 * 2 * 8); assert.strictEqual(m.n, 24);
    for (let i = 0; i < 8; i++) { const o = i * 8, x = m.v[o], y = m.v[o + 1], z = m.v[o + 2], nx = m.v[o + 3], ny = m.v[o + 4]; near(Math.hypot(nx, ny), 1, 1e-4); assert.ok(nx * x + ny * y > 0, 'normal points away from the centre'); assert.ok(z === 0 || Math.abs(z + 0.1) < 1e-6); }
    assert.ok(Math.max(...m.i) < 8);
  });
  assert.strictEqual(S.wallMesh([[0, 0], [1, 1]], 1, 1, 0.1).n, 0);
  const dup = S.wallMesh([[0, 0], [0, 0], [1, 0], [1, 1], [0, 1], [0, 0]], 1, 1, 0.1); assert.strictEqual(dup.v.length, 4 * 2 * 8, 'repeated points are dropped');
});
test('d3 defaults and sanitising, pile heights, quality', () => {
  const d = S.d3({}); assert.deepStrictEqual([d.style, d.pileMm, d.thickMm, d.mat, d.light, d.scene, d.floor, d.furn, d.quality], ['cut', null, 6, 'wool', 'studio', 'studio', 'wood', true, 'auto']);
  const x = S.d3({ d3: { style: 'x', pileMm: 99, thickMm: -5, mat: 'gold', light: '?', scene: 'room', floor: 'lava', furn: false, quality: 'ultra' } }); assert.deepStrictEqual([x.style, x.pileMm, x.thickMm, x.mat, x.light, x.scene, x.floor, x.furn, x.quality], ['cut', 30, 0, 'wool', 'studio', 'room', 'wood', false, 'auto']);
  assert.strictEqual(S.pileMm({ pile: 'high' }), 18); assert.strictEqual(S.pileMm({ pile: 'high', d3: { pileMm: 12 } }), 12);
  near(S.pileWorld({ pile: 'standard', widthCm: 100 }, 4.4), 0.044, 1e-6); assert.ok(S.pileWorld({ pile: 'low', widthCm: 600 }, 1) >= 0.02);
  near(S.thickWorld({ widthCm: 100, d3: { thickMm: 10 } }, 4), 0.04, 1e-6);
  assert.strictEqual(S.quality('auto', { coarse: true, width: 390 }).name, 'low'); assert.strictEqual(S.quality('auto', { coarse: false, width: 1400, cores: 8 }).name, 'high'); assert.strictEqual(S.quality('high', { coarse: true, width: 390 }).name, 'high'); assert.strictEqual(S.quality('low', { width: 2000 }).shells, 14);
  assert.deepStrictEqual(S.hexRgb('#FF0000'), [1, 0, 0]); assert.strictEqual(S.hexRgb('bad').length, 3);
});
