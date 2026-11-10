/* ============ quotation document: one layout, drawn on a canvas, saved as PNG / JPG / PDF ============
   layout() is pure (it only needs a text-measuring function), so it is unit-tested without a browser. render() draws the result on canvases.
   A template is either the built-in layout (logo, business details, accent colour) or the maker's own uploaded template image used as the page
   background (their letterhead); in that case the content is placed inside the margins they set. */
(function (root) {
'use strict';
const Q = {};
const PW = 1240, PH = 1754, HEX = /^#[0-9A-Fa-f]{6}$/, FONT = '"Inter","Segoe UI",Arial,"Noto Sans","Noto Sans Sinhala",sans-serif';
Q.PAGE = { w: PW, h: PH };
Q.DEFAULT_TEMPLATE = { mode: 'builtin', accent: '#1F7A3A', title: 'QUOTATION', footer: 'Thank you for your business.', terms: '', bank: '', showLogo: true, showSign: true, bgPath: '', area: { top: 0.2, bottom: 0.1, left: 0.07, right: 0.07 } };
const num = (v, a, b, d) => { v = +v; return Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : d; };
const str = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, n);
Q.sanitize = t => { t = t || {}; const d = Q.DEFAULT_TEMPLATE, a = t.area || {};
  return { mode: t.mode === 'image' ? 'image' : 'builtin', accent: HEX.test(t.accent) ? t.accent.toUpperCase() : d.accent, title: str(t.title || d.title, 30), footer: t.footer == null ? d.footer : str(t.footer, 200), terms: str(t.terms, 1500), bank: str(t.bank, 600),
    showLogo: t.showLogo !== false, showSign: t.showSign !== false, bgPath: /^[A-Za-z0-9/._-]{0,200}$/.test(t.bgPath || '') ? (t.bgPath || '') : '',
    area: { top: num(a.top, 0, 0.6, d.area.top), bottom: num(a.bottom, 0, 0.4, d.area.bottom), left: num(a.left, 0, 0.3, d.area.left), right: num(a.right, 0, 0.3, d.area.right) } }; };
Q.money = (n, cur) => { n = Number(n) || 0; try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: /^[A-Z]{3}$/.test(cur) ? cur : 'USD', currencyDisplay: 'code', minimumFractionDigits: 2 }).format(n).replace(/ /g, ' '); } catch (e) { return n.toFixed(2) + ' ' + cur; } };
Q.totals = (items, o) => { o = o || {}; const sub = Math.round(items.reduce((s, i) => s + i.qty * i.unit, 0) * 100) / 100, dp = Math.min(100, Math.max(0, +o.discountPct || 0)), disc = Math.round(sub * dp) / 100, after = sub - disc, tp = Math.max(0, +o.taxPct || 0), tax = Math.round(after * tp) / 100;
  return { subtotal: sub, discountPct: dp, discount: disc, taxPct: tp, tax, total: Math.round((after + tax) * 100) / 100 }; };
const wrap = (text, size, maxW, measure, bold) => { const out = []; String(text || '').split(/\r?\n/).forEach(par => { let line = ''; par.split(/(\s+)/).forEach(w => { if (!w) return; const t = line + w; if (measure(t, size, bold) <= maxW || !line.trim()) line = t; else { out.push(line.trim()); line = w.trimStart(); } }); out.push(line.trim()); }); return out; };

/** model: {business:{name,owner,phone,email,address[],logo:{w,h}|null}, customer:{name,email,phone,address[]}|null, quote:{ref,date,validUntil,currency,status,project,notes,discountPct,taxPct}, items:[{desc,qty,unit}]}
 *  measure(text,size,bold) -> px width. Returns { pages:[{ops}], totals }. Ops use px on a 1240 x 1754 page. */
Q.layout = (model, tpl, measure) => {
  tpl = Q.sanitize(tpl); const img = tpl.mode === 'image', B = model.business || {}, C = model.customer, qt = model.quote || {}, cur = qt.currency || 'USD', items = (model.items || []).map(i => ({ desc: str(i.desc, 400), qty: +i.qty || 0, unit: +i.unit || 0 }));
  const tot = Q.totals(items, qt), L = Math.round(PW * (img ? tpl.area.left : 0.07)), R = PW - Math.round(PW * (img ? tpl.area.right : 0.07)), TOP = img ? Math.round(PH * tpl.area.top) : 70, BOT = PH - Math.round(PH * (img ? tpl.area.bottom : 0.07)), W = R - L;
  const pages = []; let ops, y, pageNo = 0; const ink = '#1A1F1A', mute = '#5C665C', acc = tpl.accent;
  const T = (text, x, yy, s, o) => ops.push(Object.assign({ t: 'text', text: str(text, 600), x, y: yy, s, c: ink, a: 'l', b: false }, o || {}));
  const rect = (x, yy, w, h, fill, o) => ops.push(Object.assign({ t: 'rect', x, y: yy, w, h, f: fill }, o || {})), line = (x1, y1, x2, y2, c) => ops.push({ t: 'line', x1, y1, x2, y2, c: c || '#D5DAD5' });
  const newPage = () => { ops = []; pages.push({ ops }); pageNo++; if (img) ops.push({ t: 'img', key: 'bg', x: 0, y: 0, w: PW, h: PH }); y = TOP; };
  const foot = () => { if (tpl.footer) T(tpl.footer, PW / 2, PH - 38, 17, { c: mute, a: 'c' }); };
  newPage();
  // header
  if (!img) { rect(0, 0, PW, 16, acc); let hx = L; if (tpl.showLogo && B.logo) { const s = Math.min(240 / B.logo.w, 130 / B.logo.h, 1.5); ops.push({ t: 'img', key: 'logo', x: L, y: 50, w: Math.round(B.logo.w * s), h: Math.round(B.logo.h * s) }); y = 50 + Math.round(B.logo.h * s) + 14; } else y = 64;
    const bl = [B.name, B.address && B.address.join(', '), B.phone, B.email].filter(Boolean); T(B.name || '', L, y + 22, 30, { b: true }); let by = y + 48; bl.slice(1).forEach(s => { T(s, L, by, 18, { c: mute }); by += 25; }); y = Math.max(by, 190);
    T(tpl.title, R, 96, 46, { b: true, a: 'r', c: acc }); T(qt.ref || '', R, 134, 22, { a: 'r', b: true }); T('Date: ' + (qt.date || ''), R, 164, 19, { a: 'r', c: mute }); if (qt.validUntil) T('Valid until: ' + qt.validUntil, R, 190, 19, { a: 'r', c: mute }); }
  else { T(tpl.title, R, y + 30, 40, { b: true, a: 'r', c: acc }); T((qt.ref || '') + (qt.date ? '   ' + qt.date : ''), R, y + 64, 20, { a: 'r', b: true }); if (qt.validUntil) T('Valid until: ' + qt.validUntil, R, y + 92, 18, { a: 'r', c: mute }); }
  const topLeft = img ? y : y; y = img ? y + 8 : y + 12;
  // customer block
  const cl = C ? [C.name, ...(C.address || []), C.email, C.phone].filter(Boolean) : []; if (cl.length || qt.project) { T('PREPARED FOR', L, y + 18, 15, { b: true, c: acc }); let cy = y + 44; cl.forEach((s, i) => { T(s, L, cy, i ? 18 : 22, { b: !i, c: i ? mute : ink }); cy += i ? 25 : 30; }); if (qt.project) { T('Project: ' + qt.project, L, cy, 18, { c: mute }); cy += 25; } y = cy + 10; }
  // items table
  const cw = [Math.round(W * 0.52), Math.round(W * 0.1), Math.round(W * 0.19), W - Math.round(W * 0.52) - Math.round(W * 0.1) - Math.round(W * 0.19)], cx = [L, L + cw[0], L + cw[0] + cw[1], L + cw[0] + cw[1] + cw[2]];
  const head = () => { rect(L, y, W, 44, acc); [['Description', cx[0] + 14, 'l'], ['Qty', cx[1] + cw[1] - 10, 'r'], ['Unit price', cx[2] + cw[2] - 10, 'r'], ['Amount', cx[3] + cw[3] - 14, 'r']].forEach(([h, x, a]) => T(h, x, y + 29, 18, { c: '#FFFFFF', b: true, a })); y += 44; };
  head(); items.forEach((it, k) => { const ls = wrap(it.desc, 19, cw[0] - 28, measure), h = Math.max(46, ls.length * 26 + 20); if (y + h > BOT - 40) { foot(); newPage(); head(); }
    if (k % 2) rect(L, y, W, h, '#F3F6F3'); ls.forEach((s, i) => T(s, cx[0] + 14, y + 30 + i * 26, 19)); const m = y + 30; T(String(it.qty), cx[1] + cw[1] - 10, m, 19, { a: 'r' }); T(Q.money(it.unit, cur), cx[2] + cw[2] - 10, m, 19, { a: 'r' }); T(Q.money(it.qty * it.unit, cur), cx[3] + cw[3] - 14, m, 19, { a: 'r', b: true }); line(L, y + h, R, y + h); y += h; });
  // totals (kept together)
  const trows = [['Subtotal', tot.subtotal]]; if (tot.discount) trows.push(['Discount ' + tot.discountPct + '%', -tot.discount]); if (tot.tax) trows.push(['Tax ' + tot.taxPct + '%', tot.tax]);
  if (y + trows.length * 38 + 90 > BOT) { foot(); newPage(); }
  y += 18; const tx = L + Math.round(W * 0.5); trows.forEach(([a, v]) => { T(a, tx, y + 24, 19, { c: mute }); T(Q.money(v, cur), R - 14, y + 24, 19, { a: 'r' }); y += 38; });
  rect(tx, y + 4, R - tx, 60, acc); T('TOTAL', tx + 16, y + 43, 22, { c: '#FFFFFF', b: true }); T(Q.money(tot.total, cur), R - 16, y + 43, 26, { c: '#FFFFFF', b: true, a: 'r' }); y += 84;
  // notes / terms / bank
  const block = (title, text) => { if (!text) return; const ls = wrap(text, 17, W, measure), need = 34 + ls.length * 24; if (y + need > BOT - 10) { foot(); newPage(); } T(title, L, y + 20, 15, { b: true, c: acc }); ls.forEach((s, i) => T(s, L, y + 46 + i * 24, 17, { c: mute })); y += need + 6; };
  block('NOTES', qt.notes); block('TERMS', tpl.terms); block('BANK DETAILS', tpl.bank);
  if (tpl.showSign) { if (y + 110 > BOT) { foot(); newPage(); } y += 50; line(L, y + 30, L + 330, y + 30, '#8A948A'); T('Authorised signature', L, y + 52, 16, { c: mute }); line(R - 330, y + 30, R, y + 30, '#8A948A'); T('Customer acceptance', R - 330, y + 52, 16, { c: mute }); }
  foot(); pages.forEach((p, i) => p.ops.push({ t: 'text', text: 'Page ' + (i + 1) + ' of ' + pages.length, x: R, y: PH - 38, s: 15, c: mute, a: 'r', b: false }));
  return { pages, totals: tot, template: tpl };
};

/* ---- canvas drawing (browser only) ---- */
Q.render = (layout, images) => layout.pages.map(pg => { const c = document.createElement('canvas'); c.width = PW; c.height = PH; const g = c.getContext('2d'); g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, PW, PH); g.textBaseline = 'alphabetic';
  pg.ops.forEach(o => { if (o.t === 'rect') { g.fillStyle = o.f; g.fillRect(o.x, o.y, o.w, o.h); } else if (o.t === 'line') { g.strokeStyle = o.c; g.lineWidth = 1.5; g.beginPath(); g.moveTo(o.x1, o.y1); g.lineTo(o.x2, o.y2); g.stroke(); }
    else if (o.t === 'img') { const im = images && images[o.key]; if (im) g.drawImage(im, o.x, o.y, o.w, o.h); } else if (o.t === 'text') { g.fillStyle = o.c; g.font = (o.b ? '700 ' : '400 ') + o.s + 'px ' + FONT; g.textAlign = o.a === 'r' ? 'right' : o.a === 'c' ? 'center' : 'left'; g.fillText(o.text, o.x, o.y); } });
  return c; });
Q.measurer = () => { const g = document.createElement('canvas').getContext('2d'); return (t, s, b) => { g.font = (b ? '700 ' : '400 ') + s + 'px ' + FONT; return g.measureText(t).width; }; };
Q.blob = (canvas, type, q) => new Promise(res => canvas.toBlob(res, type, q || 0.92));

/* ---- PDF: one A4 page per canvas, each a full-page JPEG (so any language and any template image prints exactly as previewed) ---- */
const enc = s => { const o = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) o[i] = s.charCodeAt(i) & 255; return o; };
Q.pdf = pages => {   // pages: [{jpeg:Uint8Array, w, h}]
  const PWpt = 595.28, PHpt = 841.89, objs = [], add = b => { objs.push(b); return objs.length; }, cat = (...a) => { const n = a.reduce((s, x) => s + x.length, 0), o = new Uint8Array(n); let p = 0; a.forEach(x => { o.set(x, p); p += x.length; }); return o; };
  const imgIds = pages.map(p => add(cat(enc(`<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`), p.jpeg, enc('\nendstream'))));
  const conts = pages.map((p, i) => { const body = enc(`q ${PWpt} 0 0 ${PHpt} 0 0 cm /Im${i} Do Q`); return add(cat(enc(`<< /Length ${body.length} >>\nstream\n`), body, enc('\nendstream'))); });
  const pagesId = objs.length + pages.length + 1, pageIds = pages.map((p, i) => add(enc(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PWpt} ${PHpt}] /Resources << /XObject << /Im${i} ${imgIds[i]} 0 R >> >> /Contents ${conts[i]} 0 R >>`)));
  add(enc(`<< /Type /Pages /Kids [${pageIds.map(i => i + ' 0 R').join(' ')}] /Count ${pageIds.length} >>`)); const root_ = add(enc(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`));
  const chunks = [enc('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')], offs = []; let pos = chunks[0].length;
  objs.forEach((b, i) => { offs.push(pos); const a = enc(`${i + 1} 0 obj\n`), z = enc('\nendobj\n'); chunks.push(a, b, z); pos += a.length + b.length + z.length; });
  chunks.push(enc(['xref', `0 ${objs.length + 1}`, '0000000000 65535 f '].concat(offs.map(o => String(o).padStart(10, '0') + ' 00000 n ')).join('\n') + `\ntrailer\n<< /Size ${objs.length + 1} /Root ${root_} 0 R >>\nstartxref\n${pos}\n%%EOF\n`)); return cat(...chunks); };

if (typeof module !== 'undefined' && module.exports) module.exports = Q; else root.XQUOTE = Q;
})(typeof window !== 'undefined' ? window : globalThis);
