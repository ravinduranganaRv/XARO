/* ============ XARO export engine: SVG, production-sheet PDF, print-resolution PNG/JPEG ============
   Pure functions (also used by the node tests). No watermark is ever added. Browser helpers at the bottom are only used when `document` exists. */
(function (root) {
'use strict';
const HEX = /^#[0-9a-fA-F]{6}$/, DATA_IMG = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const n2 = v => String(Math.round(v * 10000) / 10000);
const xmlEsc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
const hexOf = (ym, id, fb) => (ym[id] && HEX.test(ym[id].hex) ? ym[id].hex.toUpperCase() : fb);
const FONT_CSS = { Anton: 'Anton, Impact, Arial Narrow, sans-serif', Archivo: 'Archivo, Helvetica Neue, Arial, sans-serif', Mono: 'JetBrains Mono, ui-monospace, Menlo, Consolas, monospace', Serif: 'Georgia, Times New Roman, serif', Script: 'Brush Script MT, Segoe Script, cursive' };

/* ---------------------------------------------------------------- SVG */
function layerSvg(l, W, H, ym, imgs) {
  if (l.vis === false) return '';
  const w = l.w * W, h = l.h * H, f = hexOf(ym, l.fill, '#39FF14'), sk = l.stroke && ym[l.stroke] ? hexOf(ym, l.stroke, '') : '', sw = Math.max(0, (l.sw || 0) * Math.min(W, H));
  const strokeAttr = sk && sw > 0 ? ` stroke="${sk}" stroke-width="${n2(sw)}" stroke-linejoin="round"` : '';
  const tf = `translate(${n2(l.cx * W)} ${n2(l.cy * H)})${l.rot ? ` rotate(${n2(l.rot)})` : ''}${l.flip ? ' scale(-1 1)' : ''}`;
  let body = '';
  if (l.type === 'rect') body = `<rect x="${n2(-w / 2)}" y="${n2(-h / 2)}" width="${n2(w)}" height="${n2(h)}" fill="${f}"${strokeAttr}/>`;
  else if (l.type === 'ellipse') body = l.hollow
    ? `<ellipse rx="${n2(Math.max(0.01, w / 2))}" ry="${n2(Math.max(0.01, h / 2))}" fill="none" stroke="${f}" stroke-width="${n2(Math.max(0.1, (l.sw || 0.03) * Math.min(W, H)))}"/>`
    : `<ellipse rx="${n2(Math.max(0.01, w / 2))}" ry="${n2(Math.max(0.01, h / 2))}" fill="${f}"${strokeAttr}/>`;
  else if (l.type === 'poly') { const pts = (l.pts || []).map(q => n2(-w / 2 + q[0] * w) + ',' + n2(-h / 2 + q[1] * h)).join(' '); body = `<polygon points="${pts}" fill="${f}"${strokeAttr}/>`; }
  else if (l.type === 'wave') {
    const n = 64, pts = []; for (let i = 0; i <= n; i++) { const u = i / n, y = -h / 2 + h * (l.amp == null ? 0.3 : l.amp) * (0.5 - 0.5 * Math.sin(2 * Math.PI * ((l.freq || 1.5) * u + (l.phase || 0)))); pts.push(n2(-w / 2 + u * w) + ',' + n2(y)); }
    pts.push(n2(w / 2) + ',' + n2(h / 2), n2(-w / 2) + ',' + n2(h / 2)); body = `<polygon points="${pts.join(' ')}" fill="${f}"${strokeAttr}/>`;
  }
  else if (l.type === 'text') {
    const size = Math.max(0.5, h * 0.86), fam = FONT_CSS[l.font] || FONT_CSS.Anton;
    body = `<text x="0" y="${n2(h * 0.04)}" text-anchor="middle" dominant-baseline="central" font-family="${xmlEsc(fam)}" font-size="${n2(size)}" font-weight="${l.bold ? 800 : 400}" fill="${f}"${strokeAttr} textLength="${n2(w)}" lengthAdjust="spacingAndGlyphs">${xmlEsc(l.text || '')}</text>`;
  }
  else if (l.type === 'pix') {
    const R = l.rows || [], rn = R.length || 1, cn = Math.max(1, ...R.map(r => r.length)), cw = w / cn, ch = h / rn; let cells = '';
    R.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const yid = (l.pal || {})[row[x]]; if (!yid || !ym[yid]) continue; cells += `<rect x="${n2(-w / 2 + x * cw)}" y="${n2(-h / 2 + y * ch)}" width="${n2(cw + 0.02)}" height="${n2(ch + 0.02)}" fill="${hexOf(ym, yid, '#000000')}"/>`; } });
    body = cells;
  }
  else if (l.type === 'path') { if (l.d && /^[MLZCQAHVmlzcqahv0-9 .,\-eE]+$/.test(l.d)) body = `<path transform="translate(${n2(-w / 2)} ${n2(-h / 2)}) scale(${n2(w)} ${n2(h)})" d="${l.d}" fill="${f}" fill-rule="evenodd"/>`; }
  else if (l.type === 'image') {
    const im = imgs && imgs[l.img], data = im && im.data; if (data && DATA_IMG.test(data)) {
      const iw = im.w || 1, ih = im.h || 1, s = (l.fit === 'contain' ? Math.min : Math.max)(w / iw, h / ih), cid = 'c' + String(l.id || '').replace(/[^A-Za-z0-9]/g, '');
      body = `<clipPath id="${cid}"><rect x="${n2(-w / 2)}" y="${n2(-h / 2)}" width="${n2(w)}" height="${n2(h)}"/></clipPath><g clip-path="url(#${cid})"><image href="${data}" x="${n2(-iw * s / 2)}" y="${n2(-ih * s / 2)}" width="${n2(iw * s)}" height="${n2(ih * s)}"/></g>`;
    }
  }
  return body ? `<g transform="${tf}" data-layer="${xmlEsc(l.id || '')}">${body}</g>` : '';
}
/** doc: studio document; yarns: array of {id,hex,...}; opts: {transparent, images, widthPx} -> SVG string at true size (cm) */
function svg(doc, yarns, opts) {
  opts = opts || {}; const ym = {}; (yarns || []).forEach(y => { ym[y.id] = y; });
  const W = +doc.widthCm, H = +doc.heightCm; if (!(W > 0 && H > 0)) throw new Error('Design has no size');
  const custom = doc.shape === 'custom' && doc.outline && doc.outline.length >= 3, rx = custom || doc.shape === 'circle' || doc.shape === 'oval' ? null : Math.max(0, Math.min(50, doc.radius || 0)) / 100 * Math.min(W, H);
  const shape = custom ? `<polygon points="${doc.outline.map(p => n2(p[0] * W) + ',' + n2(p[1] * H)).join(' ')}"` : rx === null ? `<ellipse cx="${n2(W / 2)}" cy="${n2(H / 2)}" rx="${n2(W / 2)}" ry="${n2(H / 2)}"` : `<rect x="0" y="0" width="${n2(W)}" height="${n2(H)}" rx="${n2(rx)}"`;
  const bg = opts.transparent ? '' : `<rect width="${n2(W)}" height="${n2(H)}" fill="${hexOf(ym, doc.bg, '#2A2D2A')}"/>`;
  const layers = (doc.layers || []).map(l => layerSvg(l, W, H, ym, opts.images)).join('');
  const bw = doc.borderCm > 0 ? doc.borderCm * 2 : 0, border = bw ? `${shape} fill="none" stroke="${hexOf(ym, doc.borderYarn, '#0B0B0B')}" stroke-width="${n2(bw)}" clip-path="url(#xshape)"/>` : '';
  const pxW = opts.widthPx > 0 ? ` width="${n2(opts.widthPx)}" height="${n2(opts.widthPx * H / W)}"` : ` width="${n2(W)}cm" height="${n2(H)}cm"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n2(W)} ${n2(H)}"${pxW}><title>${xmlEsc(opts.title || 'XARO rug design')}</title><defs><clipPath id="xshape">${shape}/></clipPath></defs><g clip-path="url(#xshape)">${bg}${layers}</g>${border}</svg>`;
}

/* ---------------------------------------------------------------- print resolution */
const MAX_SIDE = 12000, MAX_PIXELS = 80e6;
/** pixel size for a physical size at a DPI, reduced (and reported) if it would exceed what a browser canvas can hold */
function dpiPlan(widthCm, heightCm, dpi) {
  dpi = +dpi; if (!(dpi >= 72 && dpi <= 1200)) throw new Error('DPI must be between 72 and 1200');
  let w = widthCm / 2.54 * dpi, h = heightCm / 2.54 * dpi, k = Math.min(1, MAX_SIDE / Math.max(w, h), Math.sqrt(MAX_PIXELS / (w * h)));
  const pw = Math.max(1, Math.round(w * k)), ph = Math.max(1, Math.round(h * k));
  return { w: pw, h: ph, dpi: Math.round(dpi * k * 10) / 10, requested: dpi, capped: k < 1 };
}
const crcTable = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = u8 => { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = crcTable[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
const be32 = (a, o, v) => { a[o] = v >>> 24; a[o + 1] = v >>> 16 & 255; a[o + 2] = v >>> 8 & 255; a[o + 3] = v & 255; };
/** writes a pHYs chunk so print software reads the real DPI */
function pngSetDpi(bytes, dpi) {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), sig = [137, 80, 78, 71, 13, 10, 26, 10];
  if (u.length < 33 || sig.some((v, i) => u[i] !== v)) throw new Error('Not a PNG');
  const ppm = Math.round(dpi / 0.0254), chunk = new Uint8Array(21); be32(chunk, 0, 9); chunk.set([112, 72, 89, 115], 4); be32(chunk, 8, ppm); be32(chunk, 12, ppm); chunk[16] = 1;
  be32(chunk, 17, crc32(chunk.subarray(4, 17)));
  // strip an existing pHYs, then insert after IHDR (8 + 25 bytes)
  const parts = [u.subarray(0, 33)]; let p = 33;
  while (p + 12 <= u.length) { const len = ((u[p] << 24) | (u[p + 1] << 16) | (u[p + 2] << 8) | u[p + 3]) >>> 0, type = String.fromCharCode(u[p + 4], u[p + 5], u[p + 6], u[p + 7]); const end = p + 12 + len; if (type !== 'pHYs') parts.push(u.subarray(p, end)); p = end; }
  parts.splice(1, 0, chunk); const out = new Uint8Array(parts.reduce((s, a) => s + a.length, 0)); let o = 0; parts.forEach(a => { out.set(a, o); o += a.length; }); return out;
}
/** sets JFIF density in a JPEG (adds a JFIF header if the encoder wrote none) */
function jpegSetDpi(bytes, dpi) {
  let u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes); if (u[0] !== 0xFF || u[1] !== 0xD8) throw new Error('Not a JPEG');
  const d = Math.round(dpi), dens = [1, d >> 8 & 255, d & 255, d >> 8 & 255, d & 255];
  if (u[2] === 0xFF && u[3] === 0xE0 && u[6] === 0x4A && u[7] === 0x46) { const o = new Uint8Array(u); o.set(dens, 13); return o; }
  const app0 = new Uint8Array([0xFF, 0xE0, 0, 16, 0x4A, 0x46, 0x49, 0x46, 0, 1, 1, ...dens, 0, 0]), o = new Uint8Array(u.length + app0.length); o.set(u.subarray(0, 2), 0); o.set(app0, 2); o.set(u.subarray(2), 2 + app0.length); return o;
}

/* ---------------------------------------------------------------- PDF production sheet (A4 pages, real text, vector swatches, embedded JPEG artwork) */
const latin1 = s => String(s == null ? '' : s).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...').replace(/[^\x20-\x7E\xA0-\xFF]/g, '?');
const pdfStr = s => '(' + latin1(s).replace(/([\\()])/g, '\\$1') + ')';
const enc = s => { const a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i) & 255; return a; };
const rgbF = hex => { const h = HEX.test(hex) ? hex : '#888888'; return [1, 3, 5].map(i => (parseInt(h.slice(i, i + 2), 16) / 255).toFixed(3)).join(' '); };
const widthHelv = (s, size) => latin1(s).length * size * 0.5;   // coarse, used only for truncation
function fit(s, size, maxW) { s = latin1(s); const maxC = Math.floor(maxW / (size * 0.5)); return s.length > maxC ? s.slice(0, Math.max(1, maxC - 1)) + '.' : s; }
/**
 * spec = { title, subtitle, meta:[[label,value]...], image:{jpeg:Uint8Array,w,h}|null, legend:{head:[..], rows:[{hex, cells:[..]}]}, notes:[..], footer }
 * returns Uint8Array of a PDF. Multi-page when the legend is long.
 */
function pdf(spec) {
  const PW = 595.28, PH = 841.89, M = 42, objs = [], add = body => { objs.push(body); return objs.length; };
  const fontR = add(enc('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')), fontB = add(enc('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'));
  let imgObj = 0, imgW = 0, imgH = 0;
  if (spec.image && spec.image.jpeg) { const j = spec.image.jpeg; imgW = spec.image.w; imgH = spec.image.h; const head = enc(`<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${j.length} >>\nstream\n`), tail = enc('\nendstream'), b = new Uint8Array(head.length + j.length + tail.length); b.set(head, 0); b.set(j, head.length); b.set(tail, head.length + j.length); imgObj = add(b); }
  const pages = []; let cs = [], y = 0, pageNo = 0;
  const T = (txt, x, yy, size, bold) => cs.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x.toFixed(2)} ${yy.toFixed(2)} Td ${pdfStr(txt)} Tj ET`);
  const R = (x, yy, w, h, hex) => cs.push(`${rgbF(hex)} rg ${x.toFixed(2)} ${yy.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
  const Ln = (x1, y1, x2, y2) => cs.push(`0.80 0.80 0.80 RG 0.5 w ${x1} ${y1} m ${x2} ${y2} l S`);
  const newPage = first => { if (cs.length) pages.push({ cs, img: pages.length === 0 && !!imgObj }); cs = []; pageNo++; y = PH - M; };
  const closePage = () => { T((spec.footer || '') , M, 26, 7.5, false); T('Page ' + pageNo, PW - M - 34, 26, 7.5, false); };
  newPage(true);
  T(spec.title || 'Production sheet', M, y - 18, 20, true); y -= 26;
  if (spec.subtitle) { T(spec.subtitle, M, y - 10, 10, false); y -= 16; }
  Ln(M, y - 4, PW - M, y - 4); y -= 14;
  // meta in two columns
  const meta = spec.meta || [], colW = (PW - 2 * M) / 2;
  for (let i = 0; i < meta.length; i += 2) { [0, 1].forEach(k => { const m = meta[i + k]; if (!m) return; const x = M + k * colW; T(m[0], x, y - 9, 8, true); T(fit(m[1], 10, colW - 14), x, y - 21, 10, false); }); y -= 28; }
  // artwork
  let imgPlace = null;
  if (imgObj) { const maxW = PW - 2 * M, maxH = 300, s = Math.min(maxW / imgW, maxH / imgH), w = imgW * s, h = imgH * s; y -= 4; imgPlace = { x: M + (maxW - w) / 2, y: y - h, w, h }; cs.push(`q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${imgPlace.x.toFixed(2)} ${imgPlace.y.toFixed(2)} cm /Im1 Do Q`); cs.push(`0.6 0.6 0.6 RG 0.5 w ${imgPlace.x.toFixed(2)} ${imgPlace.y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S`); y -= h + 16; }
  // legend table
  const lg = spec.legend;
  if (lg && lg.rows && lg.rows.length) {
    const head = lg.head || [], n = head.length, off = lg.noSwatch ? 0 : 22, avail = PW - 2 * M - off, cw = lg.widths || head.map(() => avail / n);
    const header = () => { T(lg.title || 'Yarn legend', M, y - 12, 12, true); y -= 20; let x = M + off; head.forEach((h, i) => { T(h, x, y - 8, 8, true); x += cw[i]; }); Ln(M, y - 12, PW - M, y - 12); y -= 18; };
    if (y < 120) { closePage(); newPage(); } header();
    lg.rows.forEach(r => { if (y < 60) { closePage(); newPage(); header(); } if (!lg.noSwatch) { R(M, y - 12, 16, 12, r.hex); cs.push(`0.4 0.4 0.4 RG 0.4 w ${M} ${(y - 12).toFixed(2)} 16 12 re S`); } let x = M + off; (r.cells || []).forEach((c, i) => { T(fit(c, 9, cw[i] - 6), x, y - 9, 9, i === 0); x += cw[i]; }); y -= 18; });
  }
  const notes = (spec.notes || []).filter(Boolean);
  if (notes.length) { if (y < 90) { closePage(); newPage(); } y -= 6; T('Notes', M, y - 12, 12, true); y -= 20; notes.forEach(nt => { latin1(nt).match(/.{1,100}(\s|$)/g).forEach(line => { if (y < 50) { closePage(); newPage(); } T(line.trim(), M, y - 9, 9, false); y -= 13; }); }); }
  closePage(); pages.push({ cs, img: pages.length === 0 && !!imgObj }); cs = [];
  // page objects: contents first, then page, then the pages tree and catalog
  const pageIds = [], contentIds = [], pagesId = objs.length + pages.length * 2 + 1;
  pages.forEach(p => { const body = enc(p.cs.join('\n')); contentIds.push(add(concat([enc(`<< /Length ${body.length} >>\nstream\n`), body, enc('\nendstream')]))); const res = `<< /Font << /F1 ${fontR} 0 R /F2 ${fontB} 0 R >>${p.img ? ` /XObject << /Im1 ${imgObj} 0 R >>` : ''} >>`; pageIds.push(add(enc(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources ${res} /Contents ${contentIds[contentIds.length - 1]} 0 R >>`))); });
  if (add(enc(`<< /Type /Pages /Kids [${pageIds.map(i => i + ' 0 R').join(' ')}] /Count ${pageIds.length} >>`)) !== pagesId) throw new Error('pdf: page tree id');
  const info = add(enc(`<< /Title ${pdfStr(spec.title || 'Production sheet')} /Producer ${pdfStr('XARO Studio')} >>`)), cat = add(enc(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`));
  const chunks = [enc('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')], offs = []; let pos = chunks[0].length;
  objs.forEach((b, i) => { offs.push(pos); const a = enc(`${i + 1} 0 obj\n`), z = enc('\nendobj\n'); chunks.push(a, b, z); pos += a.length + b.length + z.length; });
  const xr = ['xref', `0 ${objs.length + 1}`, '0000000000 65535 f '].concat(offs.map(o => String(o).padStart(10, '0') + ' 00000 n ')).join('\n') + '\n';
  chunks.push(enc(xr + `trailer\n<< /Size ${objs.length + 1} /Root ${cat} 0 R /Info ${info} 0 R >>\nstartxref\n${pos}\n%%EOF\n`));
  return concat(chunks);
}
function concat(parts) { const out = new Uint8Array(parts.reduce((s, a) => s + a.length, 0)); let o = 0; parts.forEach(a => { out.set(a, o); o += a.length; }); return out; }

const api = { svg, dpiPlan, pngSetDpi, jpegSetDpi, pdf, crc32, xmlEsc, latin1 };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.XEXP = api;
})(typeof window !== 'undefined' ? window : globalThis);
