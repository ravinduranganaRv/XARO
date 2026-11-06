/* ============ Studio library: design document, renderer, colour separation, templates ============ */
(() => {
'use strict';
const L = window.XSTUDIO_LIB = {};
const uid = () => Math.random().toString(36).slice(2, 9);
L.uid = uid;

/* ---------------------------------------------------------------- yarn helpers */
const yarnList = () => XD.yarns().filter(y => y.active !== false);
const yarnMap = () => { const m = {}; XD.yarns().forEach(y => { m[y.id] = y; }); return m; };
L.yarnList = yarnList; L.yarnMap = yarnMap;
const rgbOf = y => y._rgb || (y._rgb = XD.hex2rgb(y.hex));
function nearest(r, g, b, list) {
  let best = list[0], bd = 1e12;
  for (let i = 0; i < list.length; i++) { const c = rgbOf(list[i]); const dr = r - c[0], dg = g - c[1], db = b - c[2], d = 2 * dr * dr + 4 * dg * dg + 3 * db * db; if (d < bd) { bd = d; best = list[i]; } }
  return best;
}
L.nearest = nearest;
L.snapHex = hex => { const c = XD.hex2rgb(hex); return nearest(c[0], c[1], c[2], yarnList()).id; };

/* ---------------------------------------------------------------- polygon presets (unit box 0..1) */
const star = n => { const p = []; for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + i * Math.PI / n, r = i % 2 ? 0.2 : 0.5; p.push([0.5 + Math.cos(a) * r, 0.5 + Math.sin(a) * r]); } return p; };
const ngon = n => { const p = []; for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + i * 2 * Math.PI / n; p.push([0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5]); } return p; };
const heart = () => { const p = []; for (let i = 0; i < 40; i++) { const t = i / 40 * Math.PI * 2, x = 16 * Math.pow(Math.sin(t), 3), y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)); p.push([0.5 + x / 34, 0.5 + y / 34 + 0.03]); } return p; };
L.POLY = {
  triangle: [[0.5, 0], [1, 1], [0, 1]], diamond: [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]], hexagon: ngon(6), pentagon: ngon(5), star: star(5), heart: heart(),
  crown: [[0, 0.85], [0, 0.25], [0.25, 0.55], [0.5, 0.05], [0.75, 0.55], [1, 0.25], [1, 0.85]], arrow: [[0, 0.3], [0.6, 0.3], [0.6, 0], [1, 0.5], [0.6, 1], [0.6, 0.7], [0, 0.7]],
  slash: [[0.25, 0], [1, 0], [0.75, 1], [0, 1]], arch: (() => { const p = [[0, 1], [0, 0.5]]; for (let i = 0; i <= 20; i++) { const a = Math.PI + i / 20 * Math.PI; p.push([0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5]); } p.push([1, 1]); return p; })()
};

/* ---------------------------------------------------------------- document */
L.newDoc = o => Object.assign({ v: 1, shape: 'rect', widthCm: 44, heightCm: 16, radius: 8, borderCm: 0, borderYarn: 'XY-001', bg: 'XY-002', pile: 'standard', backing: 'felt', borderType: 'none', frame: false, sepOn: false, maxColours: 8, layers: [], notes: '' }, o || {});
L.layer = (type, o) => Object.assign({ id: uid(), type, name: type, cx: 0.5, cy: 0.5, w: 0.3, h: 0.3, rot: 0, flip: false, fill: 'XY-007', stroke: '', sw: 0, vis: true, lock: false }, o || {});
L.TYPE_NAMES = { rect: 'Rectangle', ellipse: 'Ellipse', poly: 'Shape', text: 'Text', image: 'Artwork', wave: 'Wave', pix: 'Pixel art' };
L.FONTS = [['Anton', 'Anton, Impact, "Arial Narrow", sans-serif'], ['Archivo', 'Archivo, "Helvetica Neue", Arial, sans-serif'], ['Mono', '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace'], ['Serif', 'Georgia, "Times New Roman", serif'], ['Script', '"Brush Script MT", "Segoe Script", cursive']];

/* ---------------------------------------------------------------- renderer */
function shapePath(c, doc, W, H) {
  c.beginPath();
  if (doc.shape === 'circle' || doc.shape === 'oval') c.ellipse(W / 2, H / 2, W / 2, H / 2, 0, 0, Math.PI * 2);
  else { const r = Math.max(0, Math.min(50, doc.radius || 0)) / 100 * Math.min(W, H); if (c.roundRect && r > 0) c.roundRect(0, 0, W, H, r); else c.rect(0, 0, W, H); }
}
L.shapePath = shapePath;
function drawLayer(c, l, W, H, ym, imgs) {
  if (!l.vis) return;
  const w = l.w * W, h = l.h * H, f = ym[l.fill] ? ym[l.fill].hex : '#39FF14', sk = l.stroke && ym[l.stroke] ? ym[l.stroke].hex : '';
  c.save(); c.translate(l.cx * W, l.cy * H); c.rotate(l.rot * Math.PI / 180); if (l.flip) c.scale(-1, 1);
  c.fillStyle = f; c.strokeStyle = sk || f; c.lineWidth = Math.max(0, (l.sw || 0) * Math.min(W, H)); c.lineJoin = 'round';
  const st = () => { if (sk && l.sw > 0) c.stroke(); };
  if (l.type === 'rect') { c.fillRect(-w / 2, -h / 2, w, h); if (sk && l.sw > 0) c.strokeRect(-w / 2, -h / 2, w, h); }
  else if (l.type === 'ellipse') { c.beginPath(); c.ellipse(0, 0, Math.max(0.1, w / 2), Math.max(0.1, h / 2), 0, 0, Math.PI * 2); if (l.hollow) { c.lineWidth = Math.max(2, (l.sw || 0.03) * Math.min(W, H)); c.strokeStyle = f; c.stroke(); } else { c.fill(); st(); } }
  else if (l.type === 'poly') { const p = l.pts || L.POLY.triangle; c.beginPath(); p.forEach((q, i) => { const x = -w / 2 + q[0] * w, y = -h / 2 + q[1] * h; i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.closePath(); c.fill(); st(); }
  else if (l.type === 'text') {
    const fam = (L.FONTS.find(x => x[0] === l.font) || L.FONTS[0])[1], size = Math.max(6, h * 0.86); c.font = `${l.bold ? '800 ' : '400 '}${size}px ${fam}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    const t = String(l.text || ''), m = c.measureText(t).width; if (m > w && m > 0) c.scale(w / m, 1); c.fillText(t, 0, h * 0.04); if (sk && l.sw > 0) c.strokeText(t, 0, h * 0.04);
  }
  else if (l.type === 'wave') {
    c.beginPath(); const n = 64; for (let i = 0; i <= n; i++) { const u = i / n, y = -h / 2 + h * (l.amp == null ? 0.3 : l.amp) * (0.5 - 0.5 * Math.sin(2 * Math.PI * ((l.freq || 1.5) * u + (l.phase || 0)))); const x = -w / 2 + u * w; i ? c.lineTo(x, y) : c.moveTo(x, y); }
    c.lineTo(w / 2, h / 2); c.lineTo(-w / 2, h / 2); c.closePath(); c.fill(); st();
  }
  else if (l.type === 'pix') {
    const R = l.rows || [], rn = R.length, cn = Math.max(...R.map(r => r.length), 1), cw = w / cn, ch = h / rn;
    R.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const k = row[x], yid = (l.pal || {})[k]; if (!yid || !ym[yid]) continue; c.fillStyle = ym[yid].hex; c.fillRect(-w / 2 + x * cw - 0.4, -h / 2 + y * ch - 0.4, cw + 0.8, ch + 0.8); } });
  }
  else if (l.type === 'image') {
    const im = imgs[l.img]; if (im && im.el) { c.beginPath(); c.rect(-w / 2, -h / 2, w, h); c.clip(); const iw = im.el.naturalWidth || im.el.width, ih = im.el.naturalHeight || im.el.height, s = (l.fit === 'contain' ? Math.min : Math.max)(w / iw, h / ih); c.drawImage(im.el, -iw * s / 2, -ih * s / 2, iw * s, ih * s); }
  }
  c.restore();
}
L.drawLayer = drawLayer;
/** draws the artwork. opts.clip=false skips the shape mask */
L.render = (doc, canvas, imgs, opts) => {
  opts = opts || {}; const c = canvas.getContext('2d'), W = canvas.width, H = canvas.height, ym = yarnMap();
  c.clearRect(0, 0, W, H); c.save(); if (opts.clip !== false) { shapePath(c, doc, W, H); c.clip(); }
  c.fillStyle = (ym[doc.bg] || { hex: '#2A2D2A' }).hex; c.fillRect(0, 0, W, H);
  doc.layers.forEach(l => drawLayer(c, l, W, H, ym, imgs));
  if (doc.borderCm > 0) { const bw = doc.borderCm / Math.max(1, doc.widthCm) * W * 2; shapePath(c, doc, W, H); c.lineWidth = bw; c.strokeStyle = (ym[doc.borderYarn] || { hex: '#0B0B0B' }).hex; c.stroke(); }
  c.restore();
};
L.makeCanvas = (doc, longSide) => { const ar = doc.widthCm / doc.heightCm, c = document.createElement('canvas'); if (ar >= 1) { c.width = longSide; c.height = Math.max(8, Math.round(longSide / ar)); } else { c.height = longSide; c.width = Math.max(8, Math.round(longSide * ar)); } try { c.getContext('2d', { willReadFrequently: true }); } catch (e) {} return c; };

/* ---------------------------------------------------------------- colour separation + yarn usage */
L.analyse = (doc, imgs) => {
  const hasImg = doc.layers.some(l => l.type === 'image' && l.vis), all = yarnList(), cv = L.makeCanvas(doc, 220); L.render(doc, cv, imgs);
  const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data, cache = new Map(), cnt = {}; let total = 0;
  for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 128) continue; const k = (d[i] >> 3) << 10 | (d[i + 1] >> 3) << 5 | (d[i + 2] >> 3); let y = cache.get(k); if (!y) { y = nearest(d[i], d[i + 1], d[i + 2], all); cache.set(k, y); } cnt[y.id] = (cnt[y.id] || 0) + 1; total++; }
  let usage = Object.keys(cnt).map(id => ({ id, n: cnt[id] })).sort((a, b) => b.n - a.n);
  let chosen = usage.filter(u => u.n / total >= 0.004);
  const sepOn = doc.sepOn && hasImg;
  if (sepOn) chosen = chosen.slice(0, Math.max(2, doc.maxColours || 8));
  if (!chosen.length) chosen = usage.slice(0, 1);
  const list = chosen.map(u => yarnMap()[u.id]).filter(Boolean);
  let seen = {}; list.forEach(y => { seen[y.id] = 1; });
  // area share after separation: remap the dropped colours to the nearest chosen one
  const share = {}; list.forEach(y => { share[y.id] = 0; });
  usage.forEach(u => { const y = seen[u.id] ? yarnMap()[u.id] : nearest(...XD.hex2rgb(yarnMap()[u.id].hex), list); share[y.id] += u.n; });
  const rows = list.map(y => ({ yarn: y, pct: total ? share[y.id] / total * 100 : 0 })).sort((a, b) => b.pct - a.pct);
  return { colours: rows.length, rows, list, hasImg, sepOn, total };
};
/** returns a canvas with every pixel snapped to the given yarn list (the colour-separated art) */
L.separate = (src, list) => {
  const out = document.createElement('canvas'); out.width = src.width; out.height = src.height; const c = out.getContext('2d', { willReadFrequently: true }), im = src.getContext('2d').getImageData(0, 0, src.width, src.height), d = im.data, cache = new Map();
  for (let i = 0; i < d.length; i += 4) { const k = (d[i] >> 3) << 10 | (d[i + 1] >> 3) << 5 | (d[i + 2] >> 3); let y = cache.get(k); if (!y) { y = nearest(d[i], d[i + 1], d[i + 2], list); cache.set(k, y); } const r = rgbOf(y); d[i] = r[0]; d[i + 1] = r[1]; d[i + 2] = r[2]; d[i + 3] = 255; }
  c.putImageData(im, 0, 0); return out;
};
L.replaceYarn = (doc, from, to) => { let n = 0; const sw = o => { for (const k of ['fill', 'stroke']) if (o[k] === from) { o[k] = to; n++; } }; doc.layers.forEach(l => { sw(l); if (l.pal) Object.keys(l.pal).forEach(k => { if (l.pal[k] === from) { l.pal[k] = to; n++; } }); }); if (doc.bg === from) { doc.bg = to; n++; } if (doc.borderYarn === from) { doc.borderYarn = to; n++; } return n; };

/* ---------------------------------------------------------------- image intake (validation, SVG sanitising, downscale) */
const MAXPX = 1600;
function rasterise(el, max) { const w = el.naturalWidth || el.width, h = el.naturalHeight || el.height, s = Math.min(1, max / Math.max(w, h)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s)); c.getContext('2d').drawImage(el, 0, 0, c.width, c.height); return c; }
L.sanitiseSvg = text => {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml'); if (doc.querySelector('parsererror') || !doc.documentElement || doc.documentElement.nodeName.toLowerCase() !== 'svg') throw new Error('That SVG could not be read.');
  doc.querySelectorAll('script,foreignObject,iframe,object,embed,audio,video,animate,set,style').forEach(n => n.remove());
  doc.querySelectorAll('*').forEach(n => { [...n.attributes].forEach(a => { const nm = a.name.toLowerCase(), v = a.value.trim(); if (nm.startsWith('on')) n.removeAttribute(a.name); else if ((nm === 'href' || nm === 'xlink:href') && !/^#|^data:image\/(png|jpe?g|webp);base64,/i.test(v)) n.removeAttribute(a.name); else if (/url\(\s*['"]?\s*(https?:|\/\/|javascript:)/i.test(v)) n.removeAttribute(a.name); }); });
  const r = doc.documentElement; if (!r.getAttribute('viewBox') && r.getAttribute('width') && r.getAttribute('height')) r.setAttribute('viewBox', `0 0 ${parseFloat(r.getAttribute('width'))} ${parseFloat(r.getAttribute('height'))}`);
  if (!r.getAttribute('width')) r.setAttribute('width', '1024'); if (!r.getAttribute('height')) r.setAttribute('height', '1024');
  return new XMLSerializer().serializeToString(r);
};
/** resolves to {el(canvas), data(dataURL, <=900px), name, w, h, kind} */
L.intake = (file, maxMb) => new Promise((res, rej) => {
  const ok = /^image\/(png|jpe?g|webp|svg\+xml)$/.test(file.type) || /\.(png|jpe?g|webp|svg)$/i.test(file.name || '');
  if (!ok) return rej(new Error('Use a PNG, JPG, WebP or SVG image.'));
  if (file.size > (maxMb || 8) * 1048576) return rej(new Error('That file is over ' + (maxMb || 8) + ' MB.'));
  const done = (img, kind) => { try { const full = rasterise(img, MAXPX), small = rasterise(full, 900), png = kind === 'svg' || file.type === 'image/png'; res({ el: full, data: small.toDataURL(png ? 'image/png' : 'image/jpeg', 0.86), name: file.name || 'artwork', w: img.naturalWidth || img.width, h: img.naturalHeight || img.height, kind }); } catch (e) { rej(new Error('That image could not be read.')); } };
  const r = new FileReader(); r.onerror = () => rej(new Error('That file could not be read.'));
  if (/svg/.test(file.type) || /\.svg$/i.test(file.name || '')) { r.onload = () => { try { const clean = L.sanitiseSvg(String(r.result)), url = URL.createObjectURL(new Blob([clean], { type: 'image/svg+xml' })), im = new Image(); im.onload = () => { URL.revokeObjectURL(url); done(im, 'svg'); }; im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('That SVG could not be drawn.')); }; im.src = url; } catch (e) { rej(e); } }; r.readAsText(file); }
  else { r.onload = () => { const im = new Image(); im.onload = () => done(im, 'raster'); im.onerror = () => rej(new Error('That image could not be read.')); im.src = r.result; }; r.readAsDataURL(file); }
});
L.imageFromData = data => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = data; });

/* ---------------------------------------------------------------- templates (12 categories, procedurally defined, editable layers) */
const T = [], H = hex => L.snapHex(hex);
const mk = (cat, name, o) => T.push(Object.assign({ cat, name, shape: 'rect', widthCm: 60, heightCm: 90 }, o));
const R = (cx, cy, w, h, c, o) => L.layer('rect', Object.assign({ cx, cy, w, h, fill: H(c) }, o)), E = (cx, cy, w, h, c, o) => L.layer('ellipse', Object.assign({ cx, cy, w, h, fill: H(c) }, o));
const P = (name, cx, cy, w, h, c, o) => L.layer('poly', Object.assign({ cx, cy, w, h, fill: H(c), pts: L.POLY[name] }, o)), TX = (t, cx, cy, w, h, c, o) => L.layer('text', Object.assign({ text: t, cx, cy, w, h, fill: H(c), font: 'Anton', bold: false }, o));
const W = (cy, h, c, o) => L.layer('wave', Object.assign({ cx: 0.5, cy, w: 1.2, h, fill: H(c) }, o));
const PX = (rows, pal, cx, cy, w, h, o) => L.layer('pix', Object.assign({ rows, pal: Object.fromEntries(Object.entries(pal).map(([k, v]) => [k, H(v)])), cx, cy, w, h }, o));
const rnd = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

// Abstract
mk('Abstract', 'Fluid Waves', { bg: H('#101C4A'), layers: [W(0.35, 0.5, '#2547D0', { freq: 1.2, amp: 0.5 }), W(0.5, 0.5, '#4DA3FF', { freq: 1.6, amp: 0.45, phase: 0.2 }), W(0.65, 0.5, '#7DE3B0', { freq: 2, amp: 0.4, phase: 0.45 }), W(0.8, 0.5, '#EDEDE6', { freq: 2.4, amp: 0.35, phase: 0.7 })] });
mk('Abstract', 'Colour Blocks', { bg: H('#EDEDE6'), layers: [R(0.25, 0.3, 0.5, 0.6, '#E02B2B'), R(0.78, 0.2, 0.44, 0.4, '#2547D0'), R(0.78, 0.62, 0.44, 0.3, '#FFE53B'), R(0.25, 0.82, 0.5, 0.3, '#0B0B0B'), R(0.5, 0.5, 0.025, 1.2, '#0B0B0B'), R(0.5, 0.45, 1.2, 0.025, '#0B0B0B')] });
mk('Abstract', 'Orbit Circles', { shape: 'circle', widthCm: 80, heightCm: 80, bg: H('#0B0B0B'), layers: [E(0.5, 0.5, 0.9, 0.9, '#7A3CFF'), E(0.5, 0.5, 0.7, 0.7, '#E0359A'), E(0.5, 0.5, 0.5, 0.5, '#FF7A1A'), E(0.5, 0.5, 0.3, 0.3, '#FFE53B'), E(0.5, 0.5, 0.12, 0.12, '#FFFFFF')] });
// Geometric
mk('Geometric', 'Hex Grid', { bg: H('#0B0B0B'), layers: (() => { const l = [], c = ['#39FF14', '#0FA3A3', '#A4D62B', '#1F6B35']; for (let y = 0; y < 6; y++) for (let x = 0; x < 4; x++) l.push(P('hexagon', 0.15 + x * 0.23 + (y % 2) * 0.115, 0.1 + y * 0.16, 0.2, 0.17, c[(x + y) % 4])); return l; })() });
mk('Geometric', 'Diamond Lattice', { bg: H('#101C4A'), layers: (() => { const l = []; for (let y = 0; y < 5; y++) for (let x = 0; x < 4; x++) l.push(P('diamond', 0.14 + x * 0.24 + (y % 2) * 0.12, 0.1 + y * 0.2, 0.22, 0.2, (x + y) % 2 ? '#C9A227' : '#F4C6C6')); return l; })() });
mk('Geometric', 'Triangle Fan', { bg: H('#FFFFFF'), layers: (() => { const l = [], c = ['#E02B2B', '#FF7A1A', '#FFB020', '#FFE53B', '#A4D62B']; for (let i = 0; i < 10; i++) l.push(P('triangle', 0.5, 0.78, 0.18, 0.72, c[i % 5], { rot: -72 + i * 16, cy: 0.5 })); return l; })() });
// Minimal
mk('Minimal', 'Single Line Circle', { bg: H('#EDEDE6'), layers: [L.layer('ellipse', { cx: 0.5, cy: 0.5, w: 0.7, h: 0.4, fill: H('#0B0B0B'), hollow: true, sw: 0.02 })] });
mk('Minimal', 'Half Moon', { bg: H('#D9C3A0'), layers: [E(0.5, 0.5, 0.6, 0.4, '#0B0B0B'), E(0.62, 0.5, 0.5, 0.34, '#D9C3A0')] });
mk('Minimal', 'Stripe Pair', { bg: H('#0B0B0B'), layers: [R(0.5, 0.42, 0.7, 0.08, '#EDEDE6'), R(0.5, 0.58, 0.45, 0.08, '#39FF14')] });
// Streetwear
mk('Streetwear', 'Crown Tag', { bg: H('#0B0B0B'), layers: [P('crown', 0.5, 0.28, 0.5, 0.2, '#C9A227'), TX('YOUR TAG', 0.5, 0.52, 0.86, 0.3, '#39FF14', { bold: true }), R(0.5, 0.72, 0.7, 0.025, '#EDEDE6'), TX('EST. 2026', 0.5, 0.8, 0.4, 0.07, '#EDEDE6', { font: 'Mono' })] });
mk('Streetwear', 'Drip Block', { bg: H('#FF5D8F'), layers: [R(0.5, 0.35, 1, 0.5, '#0B0B0B'), ...[0.12, 0.3, 0.52, 0.74, 0.9].map((x, i) => E(x, 0.6 + (i % 2) * 0.06, 0.08, 0.14 + (i % 3) * 0.04, '#0B0B0B')), TX('DRIP', 0.5, 0.35, 0.8, 0.34, '#FFFFFF')] });
mk('Streetwear', 'Hazard Tape', { bg: H('#0B0B0B'), layers: [...[0, 1, 2, 3, 4, 5, 6, 7].map(i => P('slash', 0.07 + i * 0.13, 0.5, 0.12, 1, '#FFE53B')), R(0.5, 0.5, 0.8, 0.26, '#0B0B0B'), TX('CAUTION', 0.5, 0.5, 0.74, 0.18, '#FFE53B')] });
// Gaming
const HEART = ['..XX..XX..', '.XXXXXXXXX', 'XXXXXXXXXX', 'XXXXXXXXXX', '.XXXXXXXX.', '..XXXXXX..', '...XXXX...', '....XX....'];
mk('Gaming', 'Pixel Heart', { bg: H('#0B0B0B'), layers: [PX(HEART, { X: '#E02B2B' }, 0.5, 0.5, 0.82, 0.66)] });
const INV = ['..X.....X..', '...X...X...', '..XXXXXXX..', '.XX.XXX.XX.', 'XXXXXXXXXXX', 'X.XXXXXXX.X', 'X.X.....X.X', '...XX.XX...'];
mk('Gaming', 'Pixel Invader', { bg: H('#101C4A'), layers: [PX(INV, { X: '#39FF14' }, 0.5, 0.5, 0.84, 0.66)] });
mk('Gaming', 'D-Pad Pro', { bg: H('#2A2D2A'), layers: [R(0.28, 0.5, 0.36, 0.12, '#0B0B0B'), R(0.28, 0.5, 0.12, 0.36, '#0B0B0B'), E(0.72, 0.38, 0.14, 0.14, '#E02B2B'), E(0.84, 0.5, 0.14, 0.14, '#FFE53B'), E(0.72, 0.62, 0.14, 0.14, '#39FF14'), E(0.6, 0.5, 0.14, 0.14, '#4DA3FF')] });
// Anime-inspired (original)
mk('Anime-inspired original', 'Sun Spirit', { shape: 'circle', widthCm: 80, heightCm: 80, bg: H('#FF7A1A'), layers: [...Array.from({ length: 12 }, (_, i) => P('triangle', 0.5, 0.5, 0.1, 0.5, '#FFE53B', { rot: i * 30 })), E(0.5, 0.5, 0.42, 0.42, '#FFE53B'), E(0.42, 0.48, 0.05, 0.08, '#0B0B0B'), E(0.58, 0.48, 0.05, 0.08, '#0B0B0B'), E(0.5, 0.6, 0.12, 0.05, '#E02B2B')] });
mk('Anime-inspired original', 'Cloud Rider', { bg: H('#4DA3FF'), layers: [E(0.35, 0.65, 0.4, 0.2, '#FFFFFF'), E(0.55, 0.6, 0.4, 0.26, '#FFFFFF'), E(0.72, 0.67, 0.3, 0.18, '#FFFFFF'), P('star', 0.2, 0.2, 0.1, 0.07, '#FFE53B'), P('star', 0.75, 0.15, 0.07, 0.05, '#FFE53B'), P('star', 0.5, 0.3, 0.06, 0.04, '#FFFFFF')] });
mk('Anime-inspired original', 'Fox Mask', { bg: H('#0B0B0B'), layers: [E(0.5, 0.5, 0.6, 0.7, '#EDEDE6'), P('triangle', 0.3, 0.18, 0.2, 0.22, '#EDEDE6', { rot: -15 }), P('triangle', 0.7, 0.18, 0.2, 0.22, '#EDEDE6', { rot: 15 }), P('slash', 0.38, 0.46, 0.14, 0.1, '#E02B2B', { rot: 12 }), P('slash', 0.62, 0.46, 0.14, 0.1, '#E02B2B', { flip: true, rot: -12 }), E(0.5, 0.62, 0.07, 0.05, '#0B0B0B')] });
// Nature
mk('Nature', 'Mountain Dawn', { bg: H('#FFB020'), layers: [E(0.5, 0.45, 0.35, 0.22, '#FF7A1A'), P('triangle', 0.3, 0.7, 0.7, 0.55, '#2A2D2A'), P('triangle', 0.7, 0.75, 0.6, 0.45, '#101C4A'), R(0.5, 0.95, 1, 0.1, '#0B0B0B')] });
mk('Nature', 'Leaf Pair', { bg: H('#EDEDE6'), layers: [E(0.36, 0.5, 0.22, 0.7, '#1F6B35', { rot: -25 }), E(0.64, 0.5, 0.22, 0.7, '#A4D62B', { rot: 25 }), R(0.5, 0.78, 0.02, 0.28, '#6B4423')] });
mk('Nature', 'Ocean Lines', { bg: H('#0FA3A3'), layers: [W(0.3, 0.3, '#4DA3FF', { freq: 2 }), W(0.45, 0.3, '#2547D0', { freq: 2, phase: 0.3 }), W(0.6, 0.3, '#101C4A', { freq: 2, phase: 0.6 }), W(0.75, 0.3, '#0B0B0B', { freq: 2, phase: 0.9 })] });
// Typography
mk('Typography', 'Big Letter X', { bg: H('#0B0B0B'), layers: [TX('X', 0.5, 0.5, 0.9, 0.9, '#39FF14', { bold: true })] });
mk('Typography', 'Name Plate', { widthCm: 90, heightCm: 40, bg: H('#EDEDE6'), layers: [R(0.5, 0.5, 0.94, 0.8, '#0B0B0B'), TX('YOUR NAME', 0.5, 0.5, 0.84, 0.5, '#EDEDE6')] });
mk('Typography', 'Stacked Words', { bg: H('#E0359A'), layers: [TX('MAKE', 0.5, 0.22, 0.8, 0.22, '#FFFFFF'), TX('IT', 0.5, 0.5, 0.45, 0.22, '#0B0B0B'), TX('LOUD', 0.5, 0.78, 0.8, 0.22, '#FFE53B')] });
// Luxury
mk('Luxury', 'Gold Border Navy', { bg: H('#101C4A'), borderCm: 3, borderYarn: H('#C9A227'), layers: [R(0.5, 0.5, 0.78, 0.84, '#101C4A', { stroke: H('#C9A227'), sw: 0.008 }), P('diamond', 0.5, 0.5, 0.3, 0.2, '#C9A227'), P('diamond', 0.5, 0.5, 0.16, 0.11, '#101C4A')] });
mk('Luxury', 'Art Deco Fan', { bg: H('#0B0B0B'), layers: [...Array.from({ length: 9 }, (_, i) => P('triangle', 0.5, 0.5, 0.1, 0.9, i % 2 ? '#C9A227' : '#EDEDE6', { rot: -80 + i * 20 })), E(0.5, 0.95, 0.5, 0.2, '#0B0B0B'), E(0.5, 0.97, 0.28, 0.1, '#C9A227')] });
mk('Luxury', 'Marble Veins', { bg: H('#EDEDE6'), layers: [W(0.25, 0.05, '#C9A227', { freq: 1.3 }), W(0.5, 0.04, '#A5ABA5', { freq: 2.1, phase: 0.2 }), W(0.72, 0.05, '#C9A227', { freq: 1.7, phase: 0.6 })] });
// Kids
mk('Kids', 'Rainbow Arcs', { bg: H('#4DA3FF'), layers: [E(0.5, 0.78, 0.9, 0.62, '#E02B2B'), E(0.5, 0.78, 0.76, 0.52, '#FF7A1A'), E(0.5, 0.78, 0.62, 0.42, '#FFE53B'), E(0.5, 0.78, 0.48, 0.32, '#A4D62B'), E(0.5, 0.78, 0.34, 0.22, '#4DA3FF'), E(0.2, 0.9, 0.3, 0.1, '#FFFFFF'), E(0.8, 0.9, 0.3, 0.1, '#FFFFFF')] });
mk('Kids', 'Happy Sun', { bg: H('#7DE3B0'), layers: [E(0.5, 0.45, 0.45, 0.45, '#FFE53B'), E(0.4, 0.42, 0.05, 0.06, '#0B0B0B'), E(0.6, 0.42, 0.05, 0.06, '#0B0B0B'), E(0.5, 0.54, 0.16, 0.06, '#E02B2B'), E(0.25, 0.85, 0.35, 0.14, '#FFFFFF'), E(0.7, 0.88, 0.4, 0.14, '#FFFFFF')] });
mk('Kids', 'Star Field', { bg: H('#101C4A'), layers: (() => { const r = rnd(7), l = []; for (let i = 0; i < 16; i++) l.push(P('star', 0.08 + r() * 0.84, 0.06 + r() * 0.88, 0.1 + r() * 0.08, 0.1 + r() * 0.08, ['#FFE53B', '#FFFFFF', '#FF5D8F', '#7DE3B0'][i % 4], { rot: r() * 60 })); return l; })() });
// Home decor
mk('Home Decor', 'Boho Arches', { bg: H('#F4C6C6'), layers: [P('arch', 0.25, 0.62, 0.26, 0.6, '#D9C3A0'), P('arch', 0.5, 0.58, 0.26, 0.7, '#6B4423'), P('arch', 0.75, 0.62, 0.26, 0.6, '#FF7A1A'), R(0.5, 0.96, 1, 0.08, '#EDEDE6')] });
mk('Home Decor', 'Checker Border', { bg: H('#EDEDE6'), layers: (() => { const l = []; for (let y = 0; y < 9; y++) for (let x = 0; x < 6; x++) if ((x + y) % 2 === 0) l.push(R(x / 6 + 1 / 12, y / 9 + 1 / 18, 1 / 6, 1 / 9, '#0B0B0B')); return l; })() });
mk('Home Decor', 'Terrazzo', { bg: H('#EDEDE6'), layers: (() => { const r = rnd(11), l = [], c = ['#E02B2B', '#2547D0', '#FFB020', '#1F6B35', '#0B0B0B']; for (let i = 0; i < 26; i++) l.push(P(['triangle', 'pentagon', 'diamond'][i % 3], r(), r(), 0.07 + r() * 0.09, 0.07 + r() * 0.09, c[i % 5], { rot: r() * 360 })); return l; })() });
// Custom shapes
mk('Custom Shapes', 'Round Target', { shape: 'circle', widthCm: 80, heightCm: 80, bg: H('#EDEDE6'), layers: [E(0.5, 0.5, 0.92, 0.92, '#E02B2B'), E(0.5, 0.5, 0.7, 0.7, '#EDEDE6'), E(0.5, 0.5, 0.5, 0.5, '#E02B2B'), E(0.5, 0.5, 0.28, 0.28, '#EDEDE6'), E(0.5, 0.5, 0.12, 0.12, '#E02B2B')] });
mk('Custom Shapes', 'Oval Ripple', { shape: 'oval', widthCm: 100, heightCm: 60, bg: H('#0FA3A3'), layers: [E(0.5, 0.5, 0.8, 0.75, '#4DA3FF'), E(0.5, 0.5, 0.55, 0.5, '#2547D0'), E(0.5, 0.5, 0.3, 0.26, '#101C4A')] });
mk('Custom Shapes', 'Pill Desk Mat', { widthCm: 80, heightCm: 30, radius: 50, bg: H('#2A2D2A'), layers: [R(0.5, 0.5, 0.9, 0.06, '#39FF14'), TX('XARO', 0.5, 0.5, 0.3, 0.4, '#0B0B0B', { bold: true }), P('arrow', 0.12, 0.5, 0.1, 0.3, '#39FF14'), P('arrow', 0.88, 0.5, 0.1, 0.3, '#39FF14', { flip: true })] });
T.forEach((t, i) => { t.id = 'T-' + String(i + 1).padStart(3, '0'); });
L.TEMPLATES = T;
L.CATEGORIES = [...new Set(T.map(t => t.cat))];
/** instantiate a template into a fresh document with fresh layer ids */
L.fromTemplate = t => { const d = L.newDoc({ shape: t.shape, widthCm: t.widthCm, heightCm: t.heightCm, radius: t.radius == null ? 8 : t.radius, bg: t.bg, borderCm: t.borderCm || 0, borderYarn: t.borderYarn || 'XY-001', pile: 'standard', backing: t.widthCm * t.heightCm > 2500 ? 'standard' : 'felt', template: t.id, layers: JSON.parse(JSON.stringify(t.layers)) }); d.layers.forEach(l => { l.id = uid(); }); return d; };
L.complexity = t => { const n = t.layers.length, cols = new Set(t.layers.map(l => l.fill).concat([t.bg])).size; const s = n + cols * 2; return s < 8 ? 'Simple' : s < 22 ? 'Medium' : 'Detailed'; };
L.templateColours = t => [...new Set(t.layers.map(l => l.fill).concat([t.bg]).concat(t.layers.flatMap(l => l.pal ? Object.values(l.pal) : [])))];
})();
