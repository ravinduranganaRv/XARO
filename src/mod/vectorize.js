/* ============ image to vector: colour regions -> exact, gap-free SVG paths ============
   Pure functions (no DOM). Pipeline:
   1 quantise pixels to a palette (CIEDE2000 nearest)   2 label connected regions, merge speckles into their longest-bordering neighbour
   3 trace every boundary ONCE as an "arc" between junctions, simplify the arc, and give both neighbouring colours the same simplified arc
     (so shapes fit together with no gaps or overlaps)   4 chain arcs into closed rings per colour (even-odd fill, holes work). */
(function (root) {
'use strict';
const C = typeof require !== 'undefined' && typeof module !== 'undefined' && module.exports ? require('./colour.js') : root.XCOLOUR;
const V = {};
const HEX = /^#[0-9A-Fa-f]{6}$/, MAXPX = 25e6, WORK = 1200;
// level 1..5: speckle area (fraction of image), simplification tolerance (px at 1000px scale), colour tolerance for auto palettes
const LEVELS = [null, { speck: 2e-5, tol: 0.6, ctol: 2 }, { speck: 8e-5, tol: 1.0, ctol: 3 }, { speck: 2.5e-4, tol: 1.6, ctol: 4 }, { speck: 7e-4, tol: 2.4, ctol: 6 }, { speck: 1.5e-3, tol: 3.5, ctol: 8 }];
const r2 = v => Math.round(v * 100) / 100;

/* ---- 1. input, downscale, palette, label map ---- */
function checkImg(img) {
  if (!img || !(img.width > 0) || !(img.height > 0) || img.width !== Math.floor(img.width) || img.height !== Math.floor(img.height)) throw new Error('Image size must be positive whole numbers');
  if (img.width * img.height > MAXPX) throw new Error('Image is too large (limit 25 megapixels)');
  if (!img.data || img.data.length !== img.width * img.height * 4) throw new Error('Image data does not match its size');
}
function downscale(img) {
  const s = Math.max(1, Math.max(img.width, img.height) / WORK); if (s === 1) return { w: img.width, h: img.height, data: img.data, s: 1 };
  const w = Math.max(1, Math.round(img.width / s)), h = Math.max(1, Math.round(img.height / s)), sx = img.width / w, sy = img.height / h, out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const x0 = Math.floor(x * sx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx)), y0 = Math.floor(y * sy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy)); let r = 0, g = 0, b = 0, a = 0, n = 0;
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { const i = (yy * img.width + xx) * 4, al = img.data[i + 3]; r += img.data[i] * al; g += img.data[i + 1] * al; b += img.data[i + 2] * al; a += al; n++; }
    const o = (y * w + x) * 4; if (a > 0) { out[o] = r / a; out[o + 1] = g / a; out[o + 2] = b / a; } out[o + 3] = a / n;
  }
  return { w, h, data: out, s: img.width / w };
}
// palette extraction compares every colour bucket with every kept colour; on photos/noise that is slow. Rare buckets (a few pixels) are noise,
// so build a thinned sample of the colours that actually cover area and extract from that.
function paletteSample(d, rare) {
  if (d.w * d.h < 40000) return d.data; const m = new Map(); let tot = 0;
  for (let i = 0; i < d.data.length; i += 4) { if (d.data[i + 3] < 128) continue; const k = ((d.data[i] >> 3) << 10) | ((d.data[i + 1] >> 3) << 5) | (d.data[i + 2] >> 3); let b = m.get(k); if (!b) m.set(k, b = { n: 0, r: 0, g: 0, b: 0 }); b.n++; b.r += d.data[i]; b.g += d.data[i + 1]; b.b += d.data[i + 2]; tot++; }
  let keep = [...m.values()].filter(b => b.n >= Math.max(2, tot * (rare || 5e-5))).sort((a, b) => b.n - a.n).slice(0, 600); if (!keep.length) return d.data;
  const kt = keep.reduce((s, b) => s + b.n, 0), stride = Math.max(1, Math.ceil(kt / 150000)), out = [];
  for (const b of keep) { const reps = Math.max(1, Math.round(b.n / stride)), r = b.r / b.n, g = b.g / b.n, bl = b.b / b.n; for (let k = 0; k < reps; k++) out.push(r, g, bl, 255); }
  return out;
}
function buildPalette(d, opts, lv) {
  let list;
  if (opts.palette && opts.palette.length) { list = opts.palette.filter(h => HEX.test(h)).map(h => { const rgb = C.hex2rgb(h); return { rgb, lab: C.rgb2lab(rgb[0], rgb[1], rgb[2]) }; }); if (!list.length) throw new Error('Palette has no valid #RRGGBB colours'); }
  else {
    const n = opts.colours > 0 ? Math.min(64, Math.max(2, opts.colours | 0)) : 0;
    let pal = C.extract(opts.method === 'tufting' ? paletteSample(d, 1e-5) : paletteSample(d), { tol: n ? 2 : lv.ctol, max: n ? 64 : 24 });
    if (n && pal.colours.length > n) { const red = C.reduce(pal, n, [], opts.method === 'tufting' ? { power: 0.5 } : undefined); list = red.colours.map(c => ({ rgb: c.rgb, lab: C.rgb2lab(c.rgb[0], c.rgb[1], c.rgb[2]) })); } else list = pal.colours.map(c => ({ rgb: c.rgb, lab: c.lab }));
  }
  if (HEX.test(opts.background || '')) { const rgb = C.hex2rgb(opts.background); list.push({ rgb, lab: C.rgb2lab(rgb[0], rgb[1], rgb[2]), bg: true }); }
  return list;
}
function labelMap(d, pal, bgIdx) {
  const n = d.w * d.h, lab = new Int16Array(n), cache = new Map();
  for (let i = 0; i < n; i++) {
    const o = i * 4; if (d.data[o + 3] < 128) { lab[i] = bgIdx; continue; }
    const k = ((d.data[o] >> 3) << 10) | ((d.data[o + 1] >> 3) << 5) | (d.data[o + 2] >> 3); let v = cache.get(k);
    if (v === undefined) {
      const l = C.rgb2lab((d.data[o] & 248) | 4, (d.data[o + 1] & 248) | 4, (d.data[o + 2] & 248) | 4); let b1 = 0, b2 = -1, e1 = 1e18, e2 = 1e18;
      for (let j = 0; j < pal.length; j++) { const q = pal[j].lab, e = (l[0] - q[0]) ** 2 + (l[1] - q[1]) ** 2 + (l[2] - q[2]) ** 2; if (e < e1) { e2 = e1; b2 = b1; e1 = e; b1 = j; } else if (e < e2) { e2 = e; b2 = j; } }
      v = b1; if (b2 >= 0) { const d1 = C.deltaE(l, pal[b1].lab), d2 = C.deltaE(l, pal[b2].lab); if (d2 < d1) v = b2; }
      cache.set(k, v);
    }
    lab[i] = v;
  }
  return lab;
}

/* ---- 2. regions and speckle removal ---- */
function components(lab, w, h) {
  const n = w * h, rid = new Int32Array(n).fill(-1), stack = new Int32Array(n), sizes = []; let R = 0;
  for (let s = 0; s < n; s++) {
    if (rid[s] >= 0) continue; let top = 0, cnt = 0; stack[top++] = s; rid[s] = R; const L = lab[s];
    while (top) { const p = stack[--top]; cnt++; const x = p % w, y = (p - x) / w;
      if (x > 0 && rid[p - 1] < 0 && lab[p - 1] === L) { rid[p - 1] = R; stack[top++] = p - 1; } if (x < w - 1 && rid[p + 1] < 0 && lab[p + 1] === L) { rid[p + 1] = R; stack[top++] = p + 1; }
      if (y > 0 && rid[p - w] < 0 && lab[p - w] === L) { rid[p - w] = R; stack[top++] = p - w; } if (y < h - 1 && rid[p + w] < 0 && lab[p + w] === L) { rid[p + w] = R; stack[top++] = p + w; } }
    sizes.push(cnt); R++;
  }
  return { rid, sizes, R };
}
function removeSpeckles(lab, w, h, thr, bgIdx) {
  if (thr < 2) return;
  for (let pass = 0; pass < 3; pass++) {
    const { rid, sizes, R } = components(lab, w, h), small = [];
    for (let r = 0; r < R; r++) if (sizes[r] < thr) small.push(r);
    if (!small.length) return;
    const isSmall = new Uint8Array(R), pix = new Map(); small.forEach(r => { isSmall[r] = 1; pix.set(r, []); });
    for (let i = 0; i < w * h; i++) if (isSmall[rid[i]]) pix.get(rid[i]).push(i);
    const regLab = new Int16Array(R); for (let i = 0; i < w * h; i++) regLab[rid[i]] = lab[i];
    small.sort((a, b) => sizes[a] - sizes[b] || a - b);
    let changed = 0;
    for (const r of small) {
      const ps = pix.get(r); if (!ps || sizes[r] >= thr) continue; if (regLab[r] === bgIdx) continue;
      const cnt = new Map();
      for (const p of ps) { const x = p % w, y = (p - x) / w; const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
        for (const q of nb) { if (q < 0) continue; const rr = rid[q]; if (rr !== r) cnt.set(rr, (cnt.get(rr) || 0) + 1); } }
      let best = -1, bc = -1; for (const [rr, c] of cnt) { if (regLab[rr] === bgIdx && cnt.size > 1) continue; if (c > bc || (c === bc && (sizes[rr] > sizes[best] || (sizes[rr] === sizes[best] && rr < best)))) { bc = c; best = rr; } }
      if (best < 0 || regLab[best] === bgIdx) continue;
      for (const p of ps) { rid[p] = best; lab[p] = regLab[best]; }
      sizes[best] += sizes[r]; sizes[r] = 0; if (isSmall[best]) { pix.get(best).push(...ps); } pix.delete(r); changed++;
    }
    if (!changed) return;
  }
}

/* ---- 3. boundary arcs ---- */
function trace(lab, w, h, tol, bgIdx) {
  const W1 = w + 1, nH = (h + 1) * w, at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? -2 : lab[y * w + x];
  const isH = e => e < nH, bH = (x, y) => at(x, y - 1) !== at(x, y), bV = (x, y) => at(x - 1, y) !== at(x, y);
  const hId = (x, y) => y * w + x, vId = (x, y) => nH + y * W1 + x, used = new Uint8Array(nH + h * W1);
  const incident = (x, y) => { const o = []; if (x < w && bH(x, y)) o.push(hId(x, y)); if (x > 0 && bH(x - 1, y)) o.push(hId(x - 1, y)); if (y < h && bV(x, y)) o.push(vId(x, y)); if (y > 0 && bV(x, y - 1)) o.push(vId(x, y - 1)); return o; };
  const ends = e => { if (isH(e)) { const y = Math.floor(e / w), x = e - y * w; return [[x, y], [x + 1, y]]; } const k = e - nH, y = Math.floor(k / W1), x = k - y * W1; return [[x, y], [x, y + 1]]; };
  const sides = (e, from) => { const [a] = ends(e); const fwd = from[0] === a[0] && from[1] === a[1];
    if (isH(e)) { const [x, y] = a; const L = at(x, y - 1), R = at(x, y); return fwd ? [L, R] : [R, L]; } const [x, y] = a; const L = at(x, y), R = at(x - 1, y); return fwd ? [L, R] : [R, L]; };
  const arcs = [], vkey = (x, y) => y * W1 + x;
  const walk = (sx, sy, e0) => {
    const pts = [[sx, sy]]; let cx = sx, cy = sy, e = e0; const lr = sides(e0, [sx, sy]);
    for (;;) { used[e] = 1; const [p, q] = ends(e); const nx = (p[0] === cx && p[1] === cy) ? q : p; pts.push(nx); cx = nx[0]; cy = nx[1];
      const inc = incident(cx, cy); if (inc.length !== 2) break; const ne = inc[0] === e ? inc[1] : inc[0]; if (used[ne]) break; e = ne; }
    return { pts, L: lr[0], R: lr[1] };
  };
  for (let y = 0; y <= h; y++) for (let x = 0; x <= w; x++) { const inc = incident(x, y); if (inc.length === 2) continue; for (const e of inc) if (!used[e]) arcs.push(walk(x, y, e)); }
  for (let e = 0; e < used.length; e++) { if (used[e]) continue; const [p, q] = ends(e); const isB = isH(e) ? bH(p[0], p[1]) : bV(p[0], p[1]); if (!isB) continue; arcs.push(walk(p[0], p[1], e)); }
  // simplify each arc once (end points are pinned junctions; closed loops are split in two)
  for (const a of arcs) { const P = a.pts, closed = P.length > 2 && P[0][0] === P[P.length - 1][0] && P[0][1] === P[P.length - 1][1];
    if (!closed) a.pts = dp(P, tol); else { let far = 1, fd = -1; for (let i = 1; i < P.length - 1; i++) { const d = (P[i][0] - P[0][0]) ** 2 + (P[i][1] - P[0][1]) ** 2; if (d > fd) { fd = d; far = i; } }
      const A = dp(P.slice(0, far + 1), tol), B = dp(P.slice(far), tol); a.pts = A.concat(B.slice(1)); } }
  return arcs.filter(a => a.pts.length >= 2);
}
function dp(P, tol) {
  if (P.length <= 2 || tol <= 0) return P; const keep = new Uint8Array(P.length); keep[0] = keep[P.length - 1] = 1; const st = [[0, P.length - 1]], t2 = tol * tol;
  while (st.length) { const [a, b] = st.pop(); const ax = P[a][0], ay = P[a][1], bx = P[b][0], by = P[b][1], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy; let mi = -1, md = -1;
    for (let i = a + 1; i < b; i++) { let d; if (L2 === 0) d = (P[i][0] - ax) ** 2 + (P[i][1] - ay) ** 2; else { const t = Math.max(0, Math.min(1, ((P[i][0] - ax) * dx + (P[i][1] - ay) * dy) / L2)); d = (P[i][0] - ax - t * dx) ** 2 + (P[i][1] - ay - t * dy) ** 2; } if (d > md) { md = d; mi = i; } }
    if (md > t2 && mi > 0) { keep[mi] = 1; st.push([a, mi], [mi, b]); } }
  return P.filter((_, i) => keep[i]);
}

/* ---- 4. rings per colour ---- */
function ringsFor(arcs, label) {
  const dirs = [], byStart = new Map();
  for (const a of arcs) { let pts = null; if (a.L === label) pts = a.pts; else if (a.R === label) pts = a.pts.slice().reverse(); if (!pts) continue; const d = { pts, used: false }; dirs.push(d); const k = pts[0][0] + ',' + pts[0][1]; (byStart.get(k) || byStart.set(k, []).get(k)).push(d); }
  const rings = [];
  for (const d0 of dirs) { if (d0.used) continue; let ring = [], d = d0;
    while (d && !d.used) { d.used = true; ring = ring.concat(ring.length ? d.pts.slice(1) : d.pts); const e = d.pts[d.pts.length - 1], list = byStart.get(e[0] + ',' + e[1]); d = list ? list.find(x => !x.used) : null; }
    if (ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]) ring.pop(); if (ring.length >= 3) rings.push(ring); }
  return rings;
}
const area2 = r => { let s = 0; for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length]; s += a[0] * b[1] - b[0] * a[1]; } return s; };
V.ringsToPath = rings => rings.map(r => 'M' + r.map(p => r2(p[0]) + ' ' + r2(p[1])).join(' L') + ' Z').join(' ');
V.pathToRings = d => { const out = []; String(d || '').split('M').slice(1).forEach(seg => { const body = seg.replace(/Z\s*$/, '').trim(); if (!body) return; const r = body.split('L').map(t => t.trim().split(/\s+/).map(Number)).filter(p => p.length === 2 && isFinite(p[0]) && isFinite(p[1])); if (r.length) out.push(r); }); return out; };
const pointsOf = d => V.pathToRings(d).reduce((s, r) => s + r.length, 0);
const areaOf = d => Math.abs(V.pathToRings(d).reduce((s, r) => s + area2(r), 0)) / 2;


/* ---- tufting method: clean the picture, keep small distinct accents, tidy the boundaries ---- */
function median3(d) {   // 3x3 median per channel: removes JPEG noise and anti-alias fringes, keeps edges and lines 2 px wide or more
  const w = d.w, h = d.h, src = d.data, out = new Uint8ClampedArray(src.length), win = new Array(9);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 4; out[o + 3] = src[o + 3];
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1) { out[o] = src[o]; out[o + 1] = src[o + 1]; out[o + 2] = src[o + 2]; continue; }
    for (let c = 0; c < 3; c++) { let k = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) win[k++] = src[((y + dy) * w + x + dx) * 4 + c]; win.sort((a, b) => a - b); out[o + c] = win[4]; }
  }
  return { w, h, data: out, s: d.s };
}
function tidyLabels(lab, w, h, bgIdx) {   // a pixel whose neighbours (>= 6 of 8) all agree on another colour joins them: removes isolated jaggies and dots
  const out = lab.slice(), cnt = new Map();
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x, me = lab[i]; cnt.clear(); let best = -1, bc = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const l = lab[i + dy * w + dx], c = (cnt.get(l) || 0) + 1; cnt.set(l, c); if (c > bc) { bc = c; best = l; } }
    if (best !== me && bc >= 6 && best !== bgIdx) out[i] = best;
  }
  return out;
}

function mergeFragments(lab, w, h, maxFrag) {   // touching tiny pieces of different colours are one small detail seen through blur (a star, a thin line): give it one colour
  const { rid, sizes, R } = components(lab, w, h), par = new Int32Array(R).map((_, i) => i), find = a => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
  const tiny = r => sizes[r] <= maxFrag; let any = false;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x, a = rid[i]; if (!tiny(a)) continue;
    for (const j of [x + 1 < w ? i + 1 : -1, y + 1 < h ? i + w : -1]) { if (j < 0) continue; const b = rid[j]; if (b !== a && tiny(b)) { const ra = find(a), rb = find(b); if (ra !== rb) { par[ra] = rb; any = true; } } } }
  if (!any) return lab; const per = new Map();
  for (let i = 0; i < w * h; i++) { if (!tiny(rid[i])) continue; const c = find(rid[i]); let m = per.get(c); if (!m) per.set(c, m = new Map()); m.set(lab[i], (m.get(lab[i]) || 0) + 1); }
  const win = new Map(); for (const [c, m] of per) { let best = -1, bn = 0; for (const [l, n] of m) if (n > bn) { bn = n; best = l; } win.set(c, best); }
  const out = lab.slice(); for (let i = 0; i < w * h; i++) if (tiny(rid[i])) out[i] = win.get(find(rid[i])); return out;
}
V.vectorize = (img, opts) => {
  opts = opts || {}; checkImg(img); const level = Math.min(5, Math.max(1, Math.round(opts.level || 3))), lv = LEVELS[level];
  const tuft = opts.method === 'tufting'; let d = downscale(img); if (tuft) d = median3(d);
  const pal = buildPalette(d, opts, lv), bgIdx = pal.findIndex(p => p.bg) >= 0 ? pal.findIndex(p => p.bg) : -1;
  let lab = labelMap(d, pal, bgIdx); if (tuft) { lab = tidyLabels(lab, d.w, d.h, bgIdx); lab = mergeFragments(lab, d.w, d.h, Math.max(6, Math.round(d.w * d.h * 4.5e-5))); } removeSpeckles(lab, d.w, d.h, Math.floor(d.w * d.h * (tuft ? Math.min(lv.speck, 4e-5) : lv.speck)), bgIdx);
  const tol = lv.tol * Math.max(d.w, d.h) / 1000, arcs = trace(lab, d.w, d.h, tol, bgIdx), shapes = [];
  const present = new Set(); for (let i = 0; i < lab.length; i++) present.add(lab[i]);
  for (const li of present) { if (li < 0) continue; const rings = ringsFor(arcs, li); if (!rings.length) continue;
    const sc = rings.map(r => r.map(p => [p[0] * d.s, p[1] * d.s])), dstr = V.ringsToPath(sc); shapes.push({ fill: C.rgb2hex(...pal[li].rgb), d: dstr, area: r2(areaOf(dstr)), points: sc.reduce((s, r) => s + r.length, 0) }); }
  shapes.sort((a, b) => b.area - a.area || (a.fill < b.fill ? -1 : 1));
  return V.build(img.width, img.height, shapes);
};
V.build = (width, height, shapes) => { const palette = [...new Set(shapes.map(s => s.fill))]; const res = { width, height, palette, shapes, stats: { colours: palette.length, shapes: shapes.length, points: shapes.reduce((s, x) => s + x.points, 0) } }; res.svg = V.toSvg(res); return res; };
V.toSvg = (res, o) => {
  const sc = o && o.scale > 0 ? o.scale : 1, W = r2(res.width * sc), H = r2(res.height * sc);
  const body = res.shapes.filter(s => HEX.test(s.fill) && /^[MLZ0-9 .\-]+$/.test(s.d)).map(s => `<path fill="${s.fill.toUpperCase()}" fill-rule="evenodd" d="${s.d}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${res.width} ${res.height}" width="${W}" height="${H}">${body}</svg>`;
};
const norm = h => String(h).toUpperCase();
V.recolour = (res, from, to) => {
  if (!HEX.test(to)) throw new Error('Colour must be #RRGGBB'); from = norm(from); to = norm(to); const map = new Map(), order = [];
  res.shapes.forEach(s => { const f = norm(s.fill) === from ? to : norm(s.fill); const o = map.get(f); if (o) { o.d += ' ' + s.d; o.area = r2(o.area + s.area); o.points += s.points; } else { const n = { fill: f, d: s.d, area: s.area, points: s.points }; map.set(f, n); order.push(n); } });
  order.sort((a, b) => b.area - a.area || (a.fill < b.fill ? -1 : 1)); return V.build(res.width, res.height, order);
};
V.mergeColours = (res, from, to) => V.recolour(res, from, to);
V.removeShape = (res, i) => { if (!(i >= 0 && i < res.shapes.length)) throw new Error('No such shape'); return V.build(res.width, res.height, res.shapes.filter((_, k) => k !== i).map(s => Object.assign({}, s))); };
/** path in pixel units -> path in the unit square (what the studio's `path` layer stores) */
V.unitPath = (d, w, h) => { if (!(w > 0 && h > 0)) throw new Error('Bad size'); const f = n => String(Math.round(n * 100000) / 100000); return V.pathToRings(d).map(r => 'M' + r.map(p => f(p[0] / w) + ' ' + f(p[1] / h)).join(' L') + ' Z').join(' '); };
/** one full-canvas layer spec per colour; the caller assigns the yarn (fill) and adds them to a design */
V.layerSpecs = res => res.shapes.map((s, i) => ({ type: 'path', name: 'Vector ' + (i + 1), cx: 0.5, cy: 0.5, w: 1, h: 1, hex: s.fill, d: V.unitPath(s.d, res.width, res.height) }));
V.shapeStats = d => ({ area: r2(areaOf(d)), points: pointsOf(d) });

if (typeof module !== 'undefined' && module.exports) module.exports = V; else root.XVEC = V;
})(typeof window !== 'undefined' ? window : globalThis);
