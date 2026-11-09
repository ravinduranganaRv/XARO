/* ============ Studio 3D data helpers (pure functions, unit tested): outline distance field, edge walls, presets ============ */
(function (root) {
'use strict';
const S = {};
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** defaults for the 3D settings stored in a design (doc.d3); unknown values fall back, so old designs open fine */
S.PILE_STYLES = { cut: 'Cut pile (soft, fluffy)', loop: 'Loop pile (neat loops)' };
S.MATERIALS = { wool: { label: 'Wool', sheen: 0.3, spec: 0.05 }, acrylic: { label: 'Acrylic', sheen: 0.18, spec: 0.12 }, cotton: { label: 'Cotton', sheen: 0.38, spec: 0.02 }, polyester: { label: 'Polyester', sheen: 0.22, spec: 0.16 }, nylon: { label: 'Nylon', sheen: 0.25, spec: 0.22 } };
S.LIGHTS = {
  studio: { label: 'Studio', ptCol: [0.4, 0.45, 0.4], amb: [0.2, 0.22, 0.2], keyCol: [1.1, 1.08, 1.0], fillCol: [0.3, 0.25, 0.5], keyDir: [-0.4, 0.8, 0.6] },
  warm: { label: 'Warm evening', amb: [0.27, 0.22, 0.17], keyCol: [1.2, 0.93, 0.68], fillCol: [0.34, 0.2, 0.14], ptCol: [0.45, 0.3, 0.18], keyDir: [-0.6, 0.5, 0.65] },
  day: { label: 'Daylight', amb: [0.4, 0.42, 0.46], keyCol: [1.15, 1.15, 1.1], fillCol: [0.22, 0.3, 0.42], ptCol: [0.2, 0.22, 0.25], keyDir: [-0.2, 0.9, 0.55] },
  dramatic: { label: 'Dramatic side light', amb: [0.07, 0.07, 0.08], keyCol: [1.5, 1.4, 1.25], fillCol: [0.05, 0.05, 0.1], ptCol: [0.04, 0.04, 0.05], keyDir: [-0.95, 0.25, 0.3] }
};
S.FLOORS = { wood: 'Oak boards', tile: 'Grey tile', concrete: 'Polished concrete', carpet: 'Plain carpet' };
S.PILE_MM = { low: 6, standard: 10, high: 18, carved: 14 };     // preview pile heights per pile type; they never feed prices
S.d3 = doc => {
  const d = (doc && doc.d3) || {};
  return {
    style: S.PILE_STYLES[d.style] ? d.style : 'cut',
    pileMm: d.pileMm == null || !isFinite(+d.pileMm) ? null : clamp(+d.pileMm, 2, 30),
    thickMm: d.thickMm == null || !isFinite(+d.thickMm) ? 6 : clamp(+d.thickMm, 0, 25),
    mat: S.MATERIALS[d.mat] ? d.mat : 'wool',
    light: S.LIGHTS[d.light] ? d.light : 'studio',
    scene: d.scene === 'room' ? 'room' : 'studio',
    floor: S.FLOORS[d.floor] ? d.floor : 'wood',
    furn: d.furn !== false,
    quality: ['auto', 'high', 'low'].includes(d.quality) ? d.quality : 'auto'
  };
};
S.pileMm = doc => { const d = S.d3(doc); return d.pileMm != null ? d.pileMm : (S.PILE_MM[doc.pile] || S.PILE_MM.standard); };
/** world units per centimetre when the rug is shown at world width ww for a rug widthCm wide */
S.worldPerCm = (ww, widthCm) => ww / Math.max(1, widthCm);
S.pileWorld = (doc, ww) => Math.max(0.02, S.pileMm(doc) / 10 * S.worldPerCm(ww, doc.widthCm));
S.thickWorld = (doc, ww) => S.d3(doc).thickMm / 10 * S.worldPerCm(ww, doc.widthCm);

/** render quality: 'auto' picks low on phones and small/weak devices. env = {coarse, width, cores} */
S.quality = (q, env) => {
  env = env || {}; const low = q === 'low' || (q !== 'high' && (env.coarse || env.width < 700 || (env.cores || 8) <= 4));
  return low ? { name: 'low', shells: 14, lod: 0.35, dpr: 1.1 } : { name: 'high', shells: 34, lod: 0, dpr: 1.75 };
};

/** the colour of the exposed rug edge (the backing) for the preview; hex string -> 0..1 rgb */
S.backingRgb = b => ({ standard: [0.62, 0.56, 0.45], felt: [0.12, 0.12, 0.125], premium: [0.82, 0.8, 0.74] }[b] || [0.62, 0.56, 0.45]);
S.hexRgb = h => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return [0.07, 0.07, 0.075]; const n = parseInt(m[1], 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };

/* ---------------------------------------------------------------- outline distance field */
const inside = (x, y, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { if ((P[i][1] > y) !== (P[j][1] > y) && x < (P[j][0] - P[i][0]) * (y - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]) c = !c; } return c; };
const segD = (x, y, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy, t = l2 ? clamp(((x - a[0]) * dx + (y - a[1]) * dy) / l2, 0, 1) : 0; return Math.hypot(x - (a[0] + t * dx), y - (a[1] + t * dy)); };
/**
 * Signed distance field of a closed outline (unit square, y down) as bytes, row 0 = top of the rug.
 * Value 128 is the edge, higher is inside; one byte step = range / 127.5 world units. ww,hh = rug size in world units.
 */
S.sdf = (poly, N, ww, hh, range) => {
  const P = poly.map(p => [p[0] * ww, p[1] * hh]), out = new Uint8Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = (i + 0.5) / N * ww, y = (j + 0.5) / N * hh; let d = Infinity;
    for (let k = 0; k < P.length; k++) { const v = segD(x, y, P[k], P[(k + 1) % P.length]); if (v < d) d = v; }
    const sd = inside(x, y, P) ? d : -d; out[j * N + i] = Math.round(clamp(0.5 + sd / (2 * range), 0, 1) * 255);
  }
  return out;
};
/** the same field as an RGBA canvas (red channel carries the field) */
S.sdfCanvas = (poly, N, ww, hh, range) => {
  const f = S.sdf(poly, N, ww, hh, range), c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d'), im = x.createImageData(N, N);
  for (let i = 0; i < f.length; i++) { im.data[i * 4] = f[i]; im.data[i * 4 + 1] = f[i]; im.data[i * 4 + 2] = f[i]; im.data[i * 4 + 3] = 255; } x.putImageData(im, 0, 0); return c;
};

/* ---------------------------------------------------------------- rug edge (thickness) */
/**
 * Side wall of the rug following its outline, from the top surface (z = 0) down by `thick`.
 * Vertices: position(3) normal(3) uv(2), shared per outline point so the wall shades smoothly.
 * World x = (ux - 0.5) * ww, y = (0.5 - uy) * hh (the same mapping the pile plane uses).
 */
S.wallMesh = (poly, ww, hh, thick) => {
  const pts = []; poly.forEach(p => { const w = [(p[0] - 0.5) * ww, (0.5 - p[1]) * hh], q = pts[pts.length - 1]; if (!q || Math.hypot(w[0] - q[0], w[1] - q[1]) > 1e-6) pts.push(w); });
  if (pts.length > 2 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 1e-6) pts.pop();
  const n = pts.length; if (n < 3) return { v: new Float32Array(0), i: new Uint16Array(0), n: 0 };
  let area = 0; for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; } const ccw = area > 0;
  const en = pts.map((a, i) => { const b = pts[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return ccw ? [dy / l, -dx / l] : [-dy / l, dx / l]; });
  const v = new Float32Array(n * 2 * 8), idx = new (n * 2 > 65535 ? Uint32Array : Uint16Array)(n * 6); let len = 0; const cum = [0]; for (let i = 1; i <= n; i++) cum.push(cum[i - 1] + Math.hypot(pts[i % n][0] - pts[i - 1][0], pts[i % n][1] - pts[i - 1][1]));
  for (let i = 0; i < n; i++) {
    const a = en[(i + n - 1) % n], b = en[i]; let nx = a[0] + b[0], ny = a[1] + b[1]; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l; const u = cum[i] / cum[n];
    v.set([pts[i][0], pts[i][1], 0, nx, ny, 0, u, 0], i * 16); v.set([pts[i][0], pts[i][1], -thick, nx, ny, 0, u, 1], i * 16 + 8);
    const j = (i + 1) % n; idx.set([i * 2, i * 2 + 1, j * 2 + 1, i * 2, j * 2 + 1, j * 2], i * 6);
  }
  return { v, i: idx, n: idx.length };
};

/* ---------------------------------------------------------------- room */
/** boxes of the preview room in centimetres: [name, centre x, centre y (towards the wall), size x, size y, height, rgb]; the floor is z = 0 */
S.ROOM = { wallY: 260, halfW: 380, wallH: 260, sofa: { x: 0, y: 205, w: 210, d: 90, h: 80 }, table: { x: 165, y: 215, w: 50, d: 50, h: 52 }, plant: { x: -185, y: 205, r: 24, h: 90 } };

if (typeof module !== 'undefined' && module.exports) module.exports = S; else root.XS3D = S;
})(typeof window !== 'undefined' ? window : globalThis);
