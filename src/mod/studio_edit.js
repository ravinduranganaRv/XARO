/* ============ Vector editing geometry for the Studio (pure functions, unit tested) ============
   Points are in the layer's own unit square (0..1) unless stated; layer boxes are normalised to the rug (cx, cy, w, h as fractions of width/height). */
(function (root) {
'use strict';
const E = {};
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const r5 = n => Math.round(n * 100000) / 100000;

/* ---- reading and writing the points of a layer ---- */
E.editable = l => !!l && (l.type === 'poly' || l.type === 'path');
E.rings = l => {
  if (l.type === 'poly') return [(l.pts || []).map(p => [p[0], p[1]])];
  if (l.type === 'path' && l.d) { const out = []; let cur = null; const t = l.d.match(/[MLZmlz]|-?\d*\.?\d+(?:e-?\d+)?/g) || []; for (let i = 0; i < t.length;) { const c = t[i]; if (c === 'M' || c === 'L') { const p = [+t[i + 1], +t[i + 2]]; i += 3; if (c === 'M') { cur = [p]; out.push(cur); } else if (cur) cur.push(p); } else if (c === 'Z' || c === 'z') { i++; cur = null; } else i++; } return out.filter(r => r.length >= 3); }
  return [];
};
E.setRings = (l, rings) => {
  rings = rings.filter(r => r.length >= 3);
  if (l.type === 'poly') l.pts = (rings[0] || []).map(p => [r5(p[0]), r5(p[1])]);
  else if (l.type === 'path') l.d = rings.map(r => 'M' + r.map(p => r5(p[0]) + ' ' + r5(p[1])).join(' L') + ' Z').join(' ');
  return l;
};
E.nodeCount = l => E.rings(l).reduce((s, r) => s + r.length, 0);

/* ---- hit testing (all in unit coordinates of the layer; tol in the same units) ---- */
E.nearestNode = (rings, p, tol) => { let best = null; rings.forEach((r, ri) => r.forEach((q, ni) => { const d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d <= tol && (!best || d < best.d)) best = { ring: ri, node: ni, d }; })); return best; };
const segDist = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy, t = l2 ? clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2, 0, 1) : 0, x = a[0] + t * dx, y = a[1] + t * dy; return { d: Math.hypot(p[0] - x, p[1] - y), t, pt: [x, y] }; };
E.nearestEdge = (rings, p, tol) => { let best = null; rings.forEach((r, ri) => r.forEach((a, i) => { const b = r[(i + 1) % r.length], s = segDist(p, a, b); if (s.d <= tol && (!best || s.d < best.d)) best = { ring: ri, seg: i, d: s.d, t: s.t, pt: s.pt }; })); return best; };

/* ---- editing ---- */
E.insertNode = (rings, ring, seg, pt) => { const out = rings.map(r => r.map(p => p.slice())); out[ring].splice(seg + 1, 0, [pt[0], pt[1]]); return out; };
E.removeNode = (rings, ring, node) => { if (rings[ring].length <= 3) return rings; const out = rings.map(r => r.map(p => p.slice())); out[ring].splice(node, 1); return out; };
E.moveNode = (rings, ring, node, pt) => { const out = rings.map(r => r.map(p => p.slice())); out[ring][node] = [pt[0], pt[1]]; return out; };
/** Douglas-Peucker on a closed ring; tolerance in unit-square units. Never returns fewer than 3 points. */
E.simplifyRing = (ring, tol) => {
  if (ring.length <= 3) return ring.slice();
  // split the ring at its two farthest-apart points so each half is an open polyline
  let a = 0, b = 0, md = -1; for (let i = 0; i < ring.length; i++) for (let j = i + 1; j < ring.length; j++) { const d = Math.hypot(ring[i][0] - ring[j][0], ring[i][1] - ring[j][1]); if (d > md) { md = d; a = i; b = j; } }
  const half1 = ring.slice(a, b + 1), half2 = ring.slice(b).concat(ring.slice(0, a + 1));
  const dp = pts => { if (pts.length < 3) return pts; let mi = 0, mx = 0; const A = pts[0], B = pts[pts.length - 1]; for (let i = 1; i < pts.length - 1; i++) { const d = segDist(pts[i], A, B).d; if (d > mx) { mx = d; mi = i; } } return mx > tol ? dp(pts.slice(0, mi + 1)).slice(0, -1).concat(dp(pts.slice(mi))) : [A, B]; };
  const out = dp(half1).slice(0, -1).concat(dp(half2).slice(0, -1)); return out.length >= 3 ? out : ring.slice(0, 3);
};
E.simplify = (rings, tol) => rings.map(r => E.simplifyRing(r, tol));
E.ringArea = r => { let s = 0; for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length]; s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s) / 2; };
/** removes rings smaller than minArea (unit-square fraction); keeps at least the largest */
E.dropTiny = (rings, minArea) => { if (!rings.length) return rings; const big = rings.reduce((m, r) => (E.ringArea(r) > E.ringArea(m) ? r : m)); const k = rings.filter(r => E.ringArea(r) >= minArea); return k.length ? k : [big]; };
/** a path layer with several separate outlines becomes one layer per outline (holes are kept inside the ring that contains them) */
E.splitRings = rings => {
  const inside = (p, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { if ((r[i][1] > p[1]) !== (r[j][1] > p[1]) && p[0] < (r[j][0] - r[i][0]) * (p[1] - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0]) c = !c; } return c; };
  const order = rings.map((r, i) => ({ r, i, a: E.ringArea(r) })).sort((x, y) => y.a - x.a), groups = [];
  order.forEach(o => { const owner = groups.slice().reverse().find(g => inside(o.r[0], g.outer) && g.depth % 2 === 0); if (owner) owner.holes.push(o.r); else groups.push({ outer: o.r, holes: [], depth: 0 }); });
  return groups.map(g => [g.outer].concat(g.holes));
};

/* ---- from drawn points to a layer ---- */
/** points in rug-normalised coordinates (0..1 of width/height) -> {cx,cy,w,h,pts} where pts are in the new layer's unit square */
E.layerFromPoints = pts => {
  if (pts.length < 3) return null; const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), w = Math.max(0.01, x1 - x0), h = Math.max(0.01, y1 - y0);
  return { cx: r5((x0 + x1) / 2), cy: r5((y0 + y1) / 2), w: r5(w), h: r5(h), pts: pts.map(p => [r5((p[0] - x0) / w), r5((p[1] - y0) / h)]) };
};
/** unit-square point of a layer -> rug-normalised point (with rotation); W,H are the rug size in any common unit (aspect only matters) */
E.toRug = (l, u, W, H) => { const x = (u[0] - 0.5) * l.w * W, y = (u[1] - 0.5) * l.h * H, a = (l.rot || 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), fx = l.flip ? -x : x; return [(l.cx * W + fx * c - y * s) / W, (l.cy * H + fx * s + y * c) / H]; };
E.toUnit = (l, p, W, H) => { const dx = p[0] * W - l.cx * W, dy = p[1] * H - l.cy * H, a = -(l.rot || 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); let x = dx * c - dy * s; const y = dx * s + dy * c; if (l.flip) x = -x; return [x / (l.w * W) + 0.5, y / (l.h * H) + 0.5]; };

/* ---- keeping the layer box tight around its points, merging ---- */
/** rewrites the layer's rings (given in its own unit square) and shrinks/grows its box so the points span exactly 0..1; position, rotation and flip are preserved */
E.fitBox = (l, rings, W, H) => {
  const all = [].concat(...rings); if (!all.length) return l;
  const xs = all.map(p => p[0]), ys = all.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), bw = Math.max(x1 - x0, 1e-4), bh = Math.max(y1 - y0, 1e-4);
  const c = E.toRug(l, [(x0 + x1) / 2, (y0 + y1) / 2], W, H);
  const nr = rings.map(r => r.map(p => [(p[0] - x0) / bw, (p[1] - y0) / bh]));
  l.cx = r5(c[0]); l.cy = r5(c[1]); l.w = r5(l.w * bw); l.h = r5(l.h * bh);
  return E.setRings(l, nr);
};
/** true when no two rings' bounding boxes touch (so joining them in one even-odd path cannot create accidental holes) */
E.bboxesDisjoint = rings => {
  const bb = rings.map(r => { const xs = r.map(p => p[0]), ys = r.map(p => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; });
  for (let i = 0; i < bb.length; i++) for (let j = i + 1; j < bb.length; j++) { const a = bb[i], b = bb[j]; if (a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3]) return false; }
  return true;
};
/** layers (poly/path) -> rings in rug-normalised coordinates */
E.rugRings = (l, W, H) => E.rings(l).map(r => r.map(p => E.toRug(l, p, W, H)));
/** joins several poly/path layers into one path layer (copy of the first, upright); returns null when the pieces overlap */
E.mergeLayers = (layers, W, H, id) => {
  const rings = [].concat(...layers.map(l => E.rugRings(l, W, H))); if (rings.length < 2 || !E.bboxesDisjoint(rings)) return null;
  const m = JSON.parse(JSON.stringify(layers[0])); m.type = 'path'; delete m.pts; m.id = id || m.id; m.cx = 0.5; m.cy = 0.5; m.w = 1; m.h = 1; m.rot = 0; m.flip = false;
  return E.fitBox(m, rings, W, H);
};

/* ---- alignment ---- */
/** axis-aligned half extents of a rotated layer, as fractions of the rug */
E.halfExtent = (l, W, H) => { const a = (l.rot || 0) * Math.PI / 180, w = l.w * W, h = l.h * H, hx = (Math.abs(w * Math.cos(a)) + Math.abs(h * Math.sin(a))) / 2, hy = (Math.abs(w * Math.sin(a)) + Math.abs(h * Math.cos(a))) / 2; return [hx / W, hy / H]; };
E.align = (l, how, W, H) => { const [hx, hy] = E.halfExtent(l, W, H), o = { cx: l.cx, cy: l.cy }; if (how === 'left') o.cx = hx; if (how === 'right') o.cx = 1 - hx; if (how === 'hcenter') o.cx = 0.5; if (how === 'top') o.cy = hy; if (how === 'bottom') o.cy = 1 - hy; if (how === 'vcenter') o.cy = 0.5; return { cx: r5(o.cx), cy: r5(o.cy) }; };
/** distributes layers evenly between the left-most and right-most (or top and bottom) one; returns [{id,cx|cy}] */
E.distribute = (layers, axis, W, H) => { if (layers.length < 3) return []; const k = axis === 'h' ? 'cx' : 'cy', s = layers.slice().sort((a, b) => a[k] - b[k]), a = s[0][k], b = s[s.length - 1][k]; return s.slice(1, -1).map((l, i) => ({ id: l.id, [k]: r5(a + (b - a) * (i + 1) / (s.length - 1)) })); };

/* ---- rotation, grid and snapping ---- */
E.angleTo = (l, p, W, H, snapDeg) => { let d = Math.atan2(p[1] * H - l.cy * H, p[0] * W - l.cx * W) * 180 / Math.PI + 90; d = ((d % 360) + 360) % 360; if (d > 180) d -= 360; if (snapDeg) d = Math.round(d / snapDeg) * snapDeg; return Math.round(d * 10) / 10; };
/** a grid step in cm that gives roughly 10-25 lines across the shorter side */
E.gridStepCm = (wCm, hCm) => { const m = Math.min(wCm, hCm), steps = [0.5, 1, 2, 2.5, 5, 10, 20, 25, 50]; return steps.find(s => m / s <= 22) || 50; };
E.snap = (v, stepNorm) => (stepNorm > 0 ? Math.round(v / stepNorm) * stepNorm : v);
E.rulerTicks = (lenCm, step) => { const out = []; for (let v = 0; v <= lenCm + 1e-9; v += step) out.push(Math.round(v * 100) / 100); return out; };

if (typeof module !== 'undefined' && module.exports) module.exports = E; else root.XEDIT = E;
})(typeof window !== 'undefined' ? window : globalThis);
