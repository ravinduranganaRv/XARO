/* ============ colour engine: palette extraction, perceptual reduction, yarn mapping ============
   Pure functions (no DOM). Distances use CIEDE2000 in CIELAB (D65), so "similar" means similar to the eye. */
(function (root) {
'use strict';
const C = {};
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
C.hex2rgb = h => { h = String(h).replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&'); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
C.rgb2hex = (r, g, b) => '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('').toUpperCase();
C.rgb2lab = (r, g, b) => {
  const f = v => { v /= 255; return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92; };
  const R = f(r), G = f(g), B = f(b);
  const X = (R * 0.4124564 + G * 0.3575761 + B * 0.1804375) / 0.95047, Y = R * 0.2126729 + G * 0.7151522 + B * 0.0721750, Z = (R * 0.0193339 + G * 0.1191920 + B * 0.9503041) / 1.08883;
  const h = t => t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116, fx = h(X), fy = h(Y), fz = h(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
};
C.lab2rgb = (L, a, b) => {
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200, inv = t => { const t3 = t * t * t; return t3 > 216 / 24389 ? t3 : (116 * t - 16) / (24389 / 27); };
  const X = inv(fx) * 0.95047, Y = inv(fy), Z = inv(fz) * 1.08883;
  const lin = [X * 3.2404542 - Y * 1.5371385 - Z * 0.4985314, -X * 0.9692660 + Y * 1.8760108 + Z * 0.0415560, X * 0.0556434 - Y * 0.2040259 + Z * 1.0572252];
  return lin.map(v => clamp(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055), 0, 255));
};
// CIEDE2000 (Sharma, Wu, Dalal 2005)
C.deltaE = (l1, l2) => {
  const rad = Math.PI / 180, [L1, a1, b1] = l1, [L2, a2, b2] = l2;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb = (C1 + C2) / 2, G = 0.5 * (1 - Math.sqrt(Math.pow(Cb, 7) / (Math.pow(Cb, 7) + Math.pow(25, 7))));
  const ap1 = (1 + G) * a1, ap2 = (1 + G) * a2, Cp1 = Math.hypot(ap1, b1), Cp2 = Math.hypot(ap2, b2);
  const hp = (b, a) => (b === 0 && a === 0) ? 0 : ((Math.atan2(b, a) / rad) + 360) % 360, hp1 = hp(b1, ap1), hp2 = hp(b2, ap2);
  const dL = L2 - L1, dC = Cp2 - Cp1; let dh = 0;
  if (Cp1 * Cp2 !== 0) { dh = hp2 - hp1; if (dh > 180) dh -= 360; else if (dh < -180) dh += 360; }
  const dH = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin(dh * rad / 2), Lb = (L1 + L2) / 2, Cpb = (Cp1 + Cp2) / 2;
  let hb = hp1 + hp2; if (Cp1 * Cp2 !== 0) { hb = Math.abs(hp1 - hp2) <= 180 ? (hp1 + hp2) / 2 : (hp1 + hp2 < 360 ? (hp1 + hp2 + 360) / 2 : (hp1 + hp2 - 360) / 2); }
  const T = 1 - 0.17 * Math.cos((hb - 30) * rad) + 0.24 * Math.cos(2 * hb * rad) + 0.32 * Math.cos((3 * hb + 6) * rad) - 0.20 * Math.cos((4 * hb - 63) * rad);
  const dTh = 30 * Math.exp(-Math.pow((hb - 275) / 25, 2)), Rc = 2 * Math.sqrt(Math.pow(Cpb, 7) / (Math.pow(Cpb, 7) + Math.pow(25, 7)));
  const Sl = 1 + 0.015 * Math.pow(Lb - 50, 2) / Math.sqrt(20 + Math.pow(Lb - 50, 2)), Sc = 1 + 0.045 * Cpb, Sh = 1 + 0.015 * Cpb * T, Rt = -Math.sin(2 * dTh * rad) * Rc;
  return Math.sqrt(Math.pow(dL / Sl, 2) + Math.pow(dC / Sc, 2) + Math.pow(dH / Sh, 2) + Rt * (dC / Sc) * (dH / Sh));
};
C.deltaERgb = (a, b) => C.deltaE(C.rgb2lab(a[0], a[1], a[2]), C.rgb2lab(b[0], b[1], b[2]));

/* ---- original palette from pixels. data = RGBA array; transparent pixels are ignored.
   Step 1 groups pixels by 5-bit channel buckets, step 2 merges buckets closer than `tol` (deltaE), so the "original colour count" is
   the number of visibly different colours, not the number of JPEG noise values. */
C.extract = (data, opt) => {
  opt = Object.assign({ tol: 3, alphaMin: 128, max: 64 }, opt || {});
  const buckets = new Map(); let total = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < opt.alphaMin) continue;
    const k = ((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3); let b = buckets.get(k);
    if (!b) buckets.set(k, b = { n: 0, r: 0, g: 0, b: 0 }); b.n++; b.r += data[i]; b.g += data[i + 1]; b.b += data[i + 2]; total++;
  }
  let list = [...buckets.values()].map(b => { const rgb = [b.r / b.n, b.g / b.n, b.b / b.n]; return { n: b.n, rgb, lab: C.rgb2lab(rgb[0], rgb[1], rgb[2]) }; }).sort((a, b) => b.n - a.n);
  const out = [];
  for (const b of list) {   // greedy: big buckets absorb near neighbours
    let host = null, best = opt.tol;
    for (const o of out) { const d = C.deltaE(o.lab, b.lab); if (d < best) { best = d; host = o; } }
    if (host) { const t = host.n + b.n; host.rgb = host.rgb.map((v, i) => (v * host.n + b.rgb[i] * b.n) / t); host.n = t; host.lab = C.rgb2lab(host.rgb[0], host.rgb[1], host.rgb[2]); } else out.push({ n: b.n, rgb: b.rgb.slice(), lab: b.lab });
  }
  out.sort((a, b) => b.n - a.n);
  // keep the strongest `max`; fold the rest into their nearest kept colour so coverage still sums to 100%
  const keep = out.slice(0, opt.max), rest = out.slice(opt.max);
  for (const r of rest) { let h = keep[0], bd = 1e9; for (const k of keep) { const d = C.deltaE(k.lab, r.lab); if (d < bd) { bd = d; h = k; } } h.n += r.n; }
  keep.sort((a, b) => b.n - a.n);
  return { total, colours: keep.map((c, i) => ({ id: 'o' + i, rgb: c.rgb.map(Math.round), hex: C.rgb2hex(...c.rgb), lab: c.lab, n: c.n, pct: total ? 100 * c.n / total : 0 })) };
};

/* ---- reduce the palette to `target` colours. Agglomerative merging (Ward-style cost, weighted by coverage, measured in Lab with deltaE),
   so rare, similar colours merge first and a large distinctive colour is never "just deleted".
   locked: array of original ids whose colour must survive exactly (they may absorb others but never move). */
C.reduce = (palette, target, locked) => {
  const lock = new Set(locked || []);
  let cl = palette.colours.map(c => ({ id: c.id, members: [c.id], n: c.n, lab: c.lab.slice(), rgb: c.rgb.slice(), locked: lock.has(c.id) }));
  target = Math.max(1, Math.floor(target) || 1);
  const minAllowed = Math.max(1, cl.filter(c => c.locked).length); target = Math.max(target, minAllowed);
  while (cl.length > target) {
    let bi = -1, bj = -1, bc = Infinity;
    for (let i = 0; i < cl.length; i++) for (let j = i + 1; j < cl.length; j++) {
      if (cl[i].locked && cl[j].locked) continue;
      const d = C.deltaE(cl[i].lab, cl[j].lab), cost = (cl[i].n * cl[j].n) / (cl[i].n + cl[j].n) * d * d;
      if (cost < bc) { bc = cost; bi = i; bj = j; }
    }
    if (bi < 0) break;
    const a = cl[bi], b = cl[bj], t = a.n + b.n;
    let lab = a.locked ? a.lab : b.locked ? b.lab : a.lab.map((v, k) => (v * a.n + b.lab[k] * b.n) / t);
    const rgb = a.locked ? a.rgb : b.locked ? b.rgb : C.lab2rgb(...lab).map(Math.round);
    cl.splice(bj, 1); cl[bi] = { id: a.locked ? a.id : b.locked ? b.id : (a.n >= b.n ? a.id : b.id), members: a.members.concat(b.members), n: t, lab, rgb, locked: a.locked || b.locked };
  }
  return C.finish(palette, cl);
};
C.finish = (palette, cl) => {
  const tot = palette.colours.reduce((s, c) => s + c.n, 0) || 1, map = {};
  const colours = cl.sort((a, b) => b.n - a.n).map((c, i) => { const id = 'r' + i; c.members.forEach(m => map[m] = id); return { id, rgb: c.rgb, hex: C.rgb2hex(...c.rgb), lab: c.lab, n: c.n, pct: 100 * c.n / tot, members: c.members.slice(), locked: !!c.locked }; });
  return { colours, map, originalCount: palette.colours.length };
};
// manual merge of two reduced colours (keeps the bigger one's colour unless one is locked)
C.merge = (red, idA, idB) => {
  if (idA === idB) return red; const a = red.colours.find(c => c.id === idA), b = red.colours.find(c => c.id === idB); if (!a || !b) return red;
  const keep = a.locked ? a : b.locked ? b : (a.n >= b.n ? a : b), t = a.n + b.n;
  const cl = red.colours.filter(c => c !== a && c !== b).map(c => ({ id: c.id, members: c.members, n: c.n, lab: c.lab, rgb: c.rgb, locked: c.locked }));
  cl.push({ id: keep.id, members: a.members.concat(b.members), n: t, lab: keep.lab, rgb: keep.rgb, locked: a.locked || b.locked }); return C.finish({ colours: red.colours.map(c => ({ n: c.n })) }, cl);
};
C.replace = (red, id, hex) => { const rgb = C.hex2rgb(hex), c = red.colours.find(x => x.id === id); if (!c) return red; c.rgb = rgb; c.hex = C.rgb2hex(...rgb); c.lab = C.rgb2lab(...rgb); return red; };
C.setLocked = (red, id, v) => { const c = red.colours.find(x => x.id === id); if (c) c.locked = !!v; return red; };

/* ---- recolour pixels: each pixel goes to the nearest ORIGINAL colour, then through the map to its reduced colour */
C.remap = (data, palette, red) => {
  const out = new Uint8ClampedArray(data.length), cache = new Map(), byId = new Map(red.colours.map(c => [c.id, c]));
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) { out[i + 3] = data[i + 3]; continue; }
    const k = ((data[i] >> 2) << 12) | ((data[i + 1] >> 2) << 6) | (data[i + 2] >> 2); let rgb = cache.get(k);
    if (!rgb) { const lab = C.rgb2lab(data[i], data[i + 1], data[i + 2]); let best = null, bd = 1e9; for (const o of palette.colours) { const d = Math.abs(lab[0] - o.lab[0]) + Math.abs(lab[1] - o.lab[1]) + Math.abs(lab[2] - o.lab[2]) > bd * 3 ? 1e9 : C.deltaE(lab, o.lab); if (d < bd) { bd = d; best = o; } } rgb = byId.get(red.map[best.id]).rgb; cache.set(k, rgb); }
    out[i] = rgb[0]; out[i + 1] = rgb[1]; out[i + 2] = rgb[2]; out[i + 3] = 255;
  }
  return out;
};

/* ---- yarn mapping: nearest available yarn per reduced colour. Yarns marked out/discontinued are skipped unless nothing else exists. */
C.mapYarns = (red, yarns, areaCm2) => {
  const usable = yarns.filter(y => y.active !== false && y.availability !== 'discontinued' && y.availability !== 'out'), pool = usable.length ? usable : yarns;
  return red.colours.map(c => {
    let best = null, bd = 1e9; for (const y of pool) { const d = C.deltaE(c.lab, C.rgb2lab(...C.hex2rgb(y.hex))); if (d < bd) { bd = d; best = y; } }
    return { colourId: c.id, hex: c.hex, pct: c.pct, areaCm2: areaCm2 ? areaCm2 * c.pct / 100 : null, yarn: best, deltaE: best ? bd : null, close: best ? bd <= 6 : false, members: c.members };
  });
};
C.describeDelta = d => d == null ? 'no yarn' : d <= 2 ? 'near identical' : d <= 6 ? 'close match' : d <= 12 ? 'noticeable difference' : 'different colour';


/* ---- colour families: a shelf-style grouping for large yarn libraries (1000+ shades) ---- */
C.FAMILIES = [
  { key: 'whites', label: 'Whites and creams', hex: '#F4F1E8' }, { key: 'greys', label: 'Greys', hex: '#8A8A8A' }, { key: 'blacks', label: 'Blacks', hex: '#161616' },
  { key: 'reds', label: 'Reds', hex: '#D62828' }, { key: 'pinks', label: 'Pinks and magentas', hex: '#E86AA6' }, { key: 'oranges', label: 'Oranges', hex: '#F28C28' },
  { key: 'yellows', label: 'Yellows', hex: '#F2D027' }, { key: 'browns', label: 'Browns', hex: '#7A4A2A' }, { key: 'beiges', label: 'Beige and skin tones', hex: '#DDB892' },
  { key: 'greens', label: 'Greens', hex: '#3FA34D' }, { key: 'teals', label: 'Teals and aqua', hex: '#1FA5A0' }, { key: 'blues', label: 'Blues', hex: '#2F6FDB' },
  { key: 'purples', label: 'Purples', hex: '#7B4BC2' }
];
C.hsl = hex => { const [r, g, b] = C.hex2rgb(hex).map(v => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1)); let h = d === 0 ? 0 : mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h = (h * 60 + 360) % 360; return { h, s, l }; };
C.family = hex => { const { h, s, l } = C.hsl(hex);
  if (s < 0.14 || l < 0.1 || l > 0.95) return l < 0.16 ? 'blacks' : l > 0.86 ? 'whites' : 'greys';
  if (h >= 8 && h < 52 && l < 0.42 && s < 0.92) return 'browns';
  if (h >= 14 && h < 52 && l >= 0.5 && s >= 0.2 && s < 0.7) return 'beiges';
  if (h >= 345 || h < 12) return l > 0.72 ? 'pinks' : 'reds';
  if (h < 40) return l > 0.8 ? 'beiges' : 'oranges';
  if (h < 70) return 'yellows'; if (h < 160) return 'greens'; if (h < 200) return 'teals'; if (h < 255) return 'blues'; if (h < 295) return 'purples'; if (h < 320) return l < 0.35 ? 'purples' : 'pinks'; return 'pinks'; };
/* shade order inside a family: by hue band, then dark to light (neutrals: dark to light only) */
C.shadeKey = hex => { const { h, l } = C.hsl(hex), f = C.family(hex); return (f === 'whites' || f === 'greys' || f === 'blacks' ? 0 : Math.round(h / 8) * 8) * 10 + l; };
C.sortYarns = list => list.slice().sort((a, b) => C.shadeKey(a.hex) - C.shadeKey(b.hex) || String(a.id || a.code).localeCompare(String(b.id || b.code)));
/** [{key,label,hex,items}] for the families that have at least one yarn, in shelf order, each sorted by shade */
C.groupYarns = list => { const m = {}; C.FAMILIES.forEach(f => { m[f.key] = []; }); (list || []).forEach(y => { m[C.family(y.hex)].push(y); });
  return C.FAMILIES.filter(f => m[f.key].length).map(f => ({ key: f.key, label: f.label, hex: f.hex, items: C.sortYarns(m[f.key]) })); };
if (typeof module !== 'undefined' && module.exports) module.exports = C; else root.XCOLOUR = C;
})(typeof window !== 'undefined' ? window : globalThis);
