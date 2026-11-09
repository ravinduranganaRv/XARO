const test = require('node:test'), assert = require('node:assert'); const E = require('../src/mod/studio_edit.js');
const sq = [[0, 0], [1, 0], [1, 1], [0, 1]];
const near = (a, b, e = 1e-4) => assert.ok(Math.abs(a - b) <= e, a + ' vs ' + b);
test('rings: poly and path round-trip, holes kept as separate rings', () => {
  const p = { type: 'poly', pts: sq }; assert.deepStrictEqual(E.rings(p), [sq]); E.setRings(p, [[[0, 0], [0.5, 0], [0.5, 0.5]]]); assert.strictEqual(p.pts.length, 3);
  const l = { type: 'path', d: 'M0 0 L1 0 L1 1 L0 1 Z M0.25 0.25 L0.75 0.25 L0.75 0.75 L0.25 0.75 Z' }; const r = E.rings(l); assert.strictEqual(r.length, 2); assert.strictEqual(E.nodeCount(l), 8); E.setRings(l, r); assert.deepStrictEqual(E.rings(l), r);
  assert.deepStrictEqual(E.rings({ type: 'rect' }), []); assert.ok(!E.editable({ type: 'text' })); assert.ok(E.editable(p));
});
test('hit testing finds the nearest node and edge within tolerance only', () => {
  assert.deepStrictEqual(E.nearestNode([sq], [0.02, 0.01], 0.05), { ring: 0, node: 0, d: Math.hypot(0.02, 0.01) }); assert.strictEqual(E.nearestNode([sq], [0.5, 0.5], 0.05), null);
  const e = E.nearestEdge([sq], [0.5, 0.02], 0.05); assert.strictEqual(e.seg, 0); near(e.pt[0], 0.5); near(e.pt[1], 0); assert.strictEqual(E.nearestEdge([sq], [0.5, 0.5], 0.05), null);
  assert.strictEqual(E.nearestEdge([sq], [0.02, 0.5], 0.05).seg, 3, 'closing edge counts');
});
test('insert, move, remove nodes without mutating the input; never below 3 nodes', () => {
  const a = E.insertNode([sq], 0, 0, [0.5, 0]); assert.strictEqual(a[0].length, 5); assert.deepStrictEqual(a[0][1], [0.5, 0]); assert.strictEqual(sq.length, 4);
  const m = E.moveNode([sq], 0, 2, [2, 2]); assert.deepStrictEqual(m[0][2], [2, 2]); assert.deepStrictEqual(sq[2], [1, 1]);
  const r = E.removeNode([sq], 0, 1); assert.strictEqual(r[0].length, 3); assert.strictEqual(E.removeNode(r, 0, 0)[0].length, 3);
});
test('simplify reduces nodes, keeps shape within tolerance and a valid polygon', () => {
  const circle = Array.from({ length: 200 }, (_, i) => [0.5 + 0.4 * Math.cos(i / 200 * 2 * Math.PI), 0.5 + 0.4 * Math.sin(i / 200 * 2 * Math.PI)]);
  const s = E.simplifyRing(circle, 0.01); assert.ok(s.length >= 8 && s.length < 60, 'nodes ' + s.length); assert.ok(E.ringArea(s) > 0.9 * E.ringArea(circle));
  s.forEach(p => near(Math.hypot(p[0] - 0.5, p[1] - 0.5), 0.4, 1e-6));
  const flat = E.simplifyRing([[0, 0], [0.5, 0.0001], [1, 0], [1, 1], [0, 1]], 0.01); assert.strictEqual(flat.length, 4); assert.strictEqual(E.simplifyRing(sq.slice(0, 3), 0.5).length, 3);
  assert.strictEqual(E.simplifyRing(sq, 5).length >= 3, true);
});
test('dropTiny and splitRings (outline with a hole stays together)', () => {
  const big = sq, hole = [[0.4, 0.4], [0.6, 0.4], [0.6, 0.6], [0.4, 0.6]], dot = [[2, 2], [2.05, 2], [2.05, 2.05], [2, 2.05]], other = [[3, 0], [4, 0], [4, 1], [3, 1]];
  assert.strictEqual(E.dropTiny([big, hole, dot], 0.01).length, 2); assert.strictEqual(E.dropTiny([dot], 1).length, 1, 'keeps the largest');
  const g = E.splitRings([big, hole, other]); assert.strictEqual(g.length, 2); assert.strictEqual(g.find(x => x.length === 2).length, 2);
});
test('layerFromPoints normalises drawn points to a box', () => {
  const l = E.layerFromPoints([[0.2, 0.2], [0.6, 0.2], [0.4, 0.8]]); assert.deepStrictEqual([l.cx, l.cy, l.w, l.h], [0.4, 0.5, 0.4, 0.6]); assert.deepStrictEqual(l.pts, [[0, 0], [1, 0], [0.5, 1]]); assert.strictEqual(E.layerFromPoints([[0, 0], [1, 1]]), null);
});
test('toRug/toUnit are inverses under rotation, flip and non-square rugs', () => {
  const l = { cx: 0.4, cy: 0.6, w: 0.3, h: 0.2, rot: 33, flip: true }; [[0, 0], [1, 1], [0.3, 0.8]].forEach(u => { const p = E.toRug(l, u, 90, 60), b = E.toUnit(l, p, 90, 60); near(b[0], u[0]); near(b[1], u[1]); });
  const c = E.toRug({ cx: 0.5, cy: 0.5, w: 0.4, h: 0.4, rot: 0 }, [0.5, 0.5], 100, 50); near(c[0], 0.5); near(c[1], 0.5);
});
test('align accounts for rotation and rug aspect', () => {
  const l = { cx: 0.3, cy: 0.3, w: 0.2, h: 0.2, rot: 0 }; assert.deepStrictEqual(E.align(l, 'left', 100, 100), { cx: 0.1, cy: 0.3 }); assert.deepStrictEqual(E.align(l, 'bottom', 100, 100), { cx: 0.3, cy: 0.9 }); assert.deepStrictEqual(E.align(l, 'hcenter', 100, 100), { cx: 0.5, cy: 0.3 });
  const r = { cx: 0.3, cy: 0.3, w: 0.2, h: 0.2, rot: 45 }; near(E.align(r, 'left', 100, 100).cx, 0.2 * Math.SQRT2 / 2); const wide = E.align({ cx: 0, cy: 0, w: 0.2, h: 0.2, rot: 0 }, 'top', 200, 100); assert.strictEqual(wide.cy, 0.1);
});
test('distribute spaces the middle layers evenly', () => {
  const d = E.distribute([{ id: 'a', cx: 0.1 }, { id: 'b', cx: 0.2 }, { id: 'c', cx: 0.9 }], 'h'); assert.deepStrictEqual(d, [{ id: 'b', cx: 0.5 }]); assert.deepStrictEqual(E.distribute([{ id: 'a', cx: 0 }], 'h'), []);
});
test('rotation angle from pointer, with snapping', () => {
  const l = { cx: 0.5, cy: 0.5 }; assert.strictEqual(E.angleTo(l, [0.5, 0.2], 100, 100), 0); assert.strictEqual(E.angleTo(l, [0.8, 0.5], 100, 100), 90); assert.strictEqual(E.angleTo(l, [0.5, 0.8], 100, 100), 180); assert.strictEqual(E.angleTo(l, [0.2, 0.5], 100, 100), -90); assert.strictEqual(E.angleTo(l, [0.8, 0.22], 100, 100, 15), 45);
});
test('grid: sensible steps, snapping, ruler ticks', () => {
  assert.strictEqual(E.gridStepCm(44, 16), 1); assert.strictEqual(E.gridStepCm(60, 90), 5); assert.strictEqual(E.gridStepCm(300, 200), 10); assert.strictEqual(E.snap(0.237, 0.05), 0.25); assert.strictEqual(E.snap(0.3, 0), 0.3); assert.deepStrictEqual(E.rulerTicks(10, 5), [0, 5, 10]);
});
test('fitBox: moving a node outside the box grows it while every point keeps its place on the rug', () => {
  const l = { type: 'poly', cx: 0.5, cy: 0.5, w: 0.4, h: 0.4, rot: 30, flip: true, pts: sq }; const W = 200, H = 100;
  const rings = E.moveNode(E.rings(l), 0, 0, [-0.5, -0.25]); const before = rings[0].map(p => E.toRug(l, p, W, H));
  E.fitBox(l, rings, W, H); const after = E.rings(l)[0].map(p => E.toRug(l, p, W, H));
  before.forEach((b, i) => { near(b[0], after[i][0], 2e-4); near(b[1], after[i][1], 2e-4); });
  const xs = l.pts.map(p => p[0]), ys = l.pts.map(p => p[1]); near(Math.min(...xs), 0); near(Math.max(...xs), 1); near(Math.min(...ys), 0); near(Math.max(...ys), 1); assert.ok(l.w > 0.4);
});
test('mergeLayers: separate pieces join into one path, overlapping pieces are refused', () => {
  const mk = (cx, cy, rot) => ({ id: 'a' + cx, type: 'poly', cx, cy, w: 0.2, h: 0.2, rot: rot || 0, flip: false, fill: 'Y', pts: sq });
  const m = E.mergeLayers([mk(0.2, 0.2), mk(0.7, 0.7, 45)], 100, 100, 'new'); assert.ok(m); assert.strictEqual(m.type, 'path'); assert.strictEqual(m.id, 'new'); assert.strictEqual(E.rings(m).length, 2);
  const c0 = E.toRug(m, E.rings(m)[0][0], 100, 100), c1 = E.toRug(mk(0.2, 0.2), sq[0], 100, 100); near(c0[0], c1[0], 2e-4); near(c0[1], c1[1], 2e-4);
  assert.strictEqual(E.mergeLayers([mk(0.2, 0.2), mk(0.25, 0.25)], 100, 100), null);
  assert.strictEqual(E.splitRings(E.rings(m)).length, 2);
});
