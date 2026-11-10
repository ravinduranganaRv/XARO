/* ============ 3D Custom Studio: UI ============ */
(() => {
'use strict';
const L = window.XSTUDIO_LIB, esc = XD.esc, $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
const IN = 2.54, RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
let root, doc = L.newDoc(), imgs = {}, sel = '', hist = [], hi = -1, unit = 'cm', view = '', ltab = 'art', target = 'fill', viewer = null, dirty = false, an = null, seq = 0, t3 = 0, tA = 0, prevCv = null, prevRatio = 1, filt = { cat: '', q: '', tcat: '' }, drag = null, savedName = '', cloudId = '', editId = '', selNode = null, pen = null, spaceDown = false, v2 = { zoom: 1, grid: false, snap: false, rulers: false };
const E = window.XEDIT, D3 = window.XS3D, ROOM_S = 0.0225;
const cv2 = () => $('#stC', root), ov = () => $('#stO', root);

/* ---------------------------------------------------------------- tiny helpers */
let ttT; const toast = (m, bad) => { const t = $('.tt', root); t.textContent = m; t.className = 'tt on' + (bad ? ' bad' : ''); clearTimeout(ttT); ttT = setTimeout(() => { t.className = 'tt'; }, 2800); };
const fmtLen = cm => unit === 'cm' ? String(Math.round(cm * 10) / 10) : String(Math.round(cm / IN * 100) / 100);
const parseLen = v => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? (unit === 'cm' ? n : n * IN) : NaN; };
const ym = () => L.yarnMap();
const yname = id => (ym()[id] || { name: id }).name;
const layer = id => doc.layers.find(l => l.id === id);
const snap = () => JSON.stringify(doc);
function commit() { L.stampYarns(doc); hist = hist.slice(0, hi + 1); hist.push(snap()); if (hist.length > 80) hist.shift(); hi = hist.length - 1; dirty = true; changed(); }
function restore(i) { hi = i; doc = JSON.parse(hist[i]); selNode = null; if (sel && !layer(sel)) sel = ''; changed(true); }
function changed(full) { draw2D(); schedule(); if (full !== 'live') { panelL(); panelR(); } undoBtns(); }
function undoBtns() { const u = $('#stUndo', root), r = $('#stRedo', root); if (u) { u.disabled = hi <= 0; r.disabled = hi >= hist.length - 1; } }
function newDoc(d) { doc = d; sel = ''; hist = []; hi = -1; hist.push(snap()); hi = 0; dirty = false; savedName = ''; cloudId = ''; changed(true); camPreset('angle'); }

/* ---------------------------------------------------------------- 2D canvas */
function draw2D() {
  const c = cv2(); if (!c) return; const dummy = L.makeCanvas(doc, 1100); if (c.width !== dummy.width || c.height !== dummy.height) { c.width = dummy.width; c.height = dummy.height; ov().width = c.width; ov().height = c.height; }
  L.render(doc, c, imgs); fit(); drawOv();
}
function fit() {
  const c = cv2(), box = c.closest('.v2'); if (!box || !box.clientWidth) return; const aw = box.clientWidth - 24, ah = box.clientHeight - 24, s = Math.min(aw / c.width, ah / c.height) * v2.zoom; if (s <= 0) return;
  const w = Math.floor(c.width * s), h = Math.floor(c.height * s); c.style.width = ov().style.width = w + 'px'; c.style.height = ov().style.height = h + 'px'; $('.cw', root).style.width = w + 'px'; $('.cw', root).style.height = h + 'px';
}
const editing = () => { const l = layer(editId); return !!(l && editId === sel && l.vis && !l.lock && E.editable(l)); };
const WH = () => [ov().width, ov().height];
const snapN = pn => { if (!v2.snap) return pn; const st = E.gridStepCm(doc.widthCm, doc.heightCm); return [E.snap(pn[0], st / doc.widthCm), E.snap(pn[1], st / doc.heightCm)]; };
const nodePx = l => { const [W, H] = WH(); return E.rugRings(l, W, H).map(r => r.map(p => [p[0] * W, p[1] * H])); };
function drawGrid(x, W, H, k) {
  const st = E.gridStepCm(doc.widthCm, doc.heightCm), sx = st / doc.widthCm * W, sy = st / doc.heightCm * H; x.save(); x.lineWidth = k; x.strokeStyle = 'rgba(57,255,20,.25)'; x.beginPath();
  for (let i = 1; i * sx < W - 1; i++) { x.moveTo(i * sx, 0); x.lineTo(i * sx, H); } for (let j = 1; j * sy < H - 1; j++) { x.moveTo(0, j * sy); x.lineTo(W, j * sy); } x.stroke(); x.restore();
}
function drawRulers(x, W, H, k) {
  const st = E.gridStepCm(doc.widthCm, doc.heightCm), fs = 10 * k, bw = 16 * k; x.save(); x.font = fs + 'px monospace'; x.fillStyle = 'rgba(0,0,0,.6)'; x.fillRect(0, 0, W, bw); x.fillRect(0, 0, bw, H); x.fillStyle = x.strokeStyle = '#d8ffd0'; x.lineWidth = k;
  E.rulerTicks(doc.widthCm, st).forEach(v => { const px = v / doc.widthCm * W; x.beginPath(); x.moveTo(px, bw - 5 * k); x.lineTo(px, bw); x.stroke(); if (v > 0) x.fillText(fmtLen(v), px + 2 * k, fs); });
  E.rulerTicks(doc.heightCm, st).forEach(v => { const py = v / doc.heightCm * H; x.beginPath(); x.moveTo(bw - 5 * k, py); x.lineTo(bw, py); x.stroke(); if (v > 0) { x.save(); x.translate(fs, py - 2 * k); x.rotate(-Math.PI / 2); x.fillText(fmtLen(v), 0, 0); x.restore(); } });
  x.fillText(unit, 3 * k, fs); x.restore();
}
function drawOv() {
  const o = ov(), x = o.getContext('2d'); x.clearRect(0, 0, o.width, o.height); const W = o.width, H = o.height, k = W / (parseFloat(o.style.width) || W);
  if (v2.grid) drawGrid(x, W, H, k); if (v2.rulers) drawRulers(x, W, H, k);
  if (pen) { x.save(); x.lineWidth = 2 * k; x.strokeStyle = '#39FF14'; x.fillStyle = '#39FF14'; const q = pen.pts.map(a => [a[0] * W, a[1] * H]); x.beginPath(); q.forEach((a, i) => i ? x.lineTo(a[0], a[1]) : x.moveTo(a[0], a[1])); if (pen.cur && q.length) x.lineTo(pen.cur[0] * W, pen.cur[1] * H); x.stroke(); q.forEach((a, i) => { x.beginPath(); x.arc(a[0], a[1], (i ? 4 : 7) * k, 0, 7); i ? x.fill() : x.stroke(); }); x.restore(); return; }
  const l = layer(sel); if (!l || !l.vis) return; const w = l.w * W, h = l.h * H, ed = editing();
  x.save(); x.translate(l.cx * W, l.cy * H); x.rotate(l.rot * Math.PI / 180); x.lineWidth = 1.5 * k; x.setLineDash([6 * k, 4 * k]); x.strokeStyle = ed ? 'rgba(57,255,20,.35)' : '#39FF14'; x.strokeRect(-w / 2, -h / 2, w, h); x.setLineDash([]);
  if (!ed) { x.fillStyle = '#39FF14'; const hs = 7 * k; x.fillRect(w / 2 - hs, h / 2 - hs, hs * 2, hs * 2); x.beginPath(); x.moveTo(0, -h / 2); x.lineTo(0, -h / 2 - 26 * k); x.stroke(); x.beginPath(); x.arc(0, -h / 2 - 26 * k, 6 * k, 0, 7); x.fill(); } x.restore();
  if (ed) { x.save(); x.lineWidth = 1.5 * k; x.strokeStyle = '#39FF14'; const rg = nodePx(l); rg.forEach(r => { x.beginPath(); r.forEach((a, i) => i ? x.lineTo(a[0], a[1]) : x.moveTo(a[0], a[1])); x.closePath(); x.stroke(); });
    rg.forEach((r, ri) => r.forEach((a, ni) => { const on = selNode && selNode.ring === ri && selNode.node === ni; x.fillStyle = on ? '#39FF14' : '#0b0b0b'; x.strokeStyle = '#39FF14'; x.beginPath(); x.rect(a[0] - 5 * k, a[1] - 5 * k, 10 * k, 10 * k); x.fill(); x.stroke(); })); x.restore(); }
}
function pt(e) { const o = ov(), r = o.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * o.width, y: (e.clientY - r.top) / r.height * o.height }; }
function local(l, p) { const W = ov().width, H = ov().height, dx = p.x - l.cx * W, dy = p.y - l.cy * H, a = -l.rot * Math.PI / 180; return { x: dx * Math.cos(a) - dy * Math.sin(a), y: dx * Math.sin(a) + dy * Math.cos(a) }; }
function hit(p) { const W = ov().width, H = ov().height; for (let i = doc.layers.length - 1; i >= 0; i--) { const l = doc.layers[i]; if (!l.vis || l.lock) continue; const q = local(l, p); if (Math.abs(q.x) <= l.w * W / 2 && Math.abs(q.y) <= l.h * H / 2) return l; } return null; }
function bindCanvas() {
  const o = ov(), sc = () => $('.sc', root);
  o.addEventListener('pointerdown', e => {
    const p = pt(e), W = o.width, H = o.height, k = W / o.getBoundingClientRect().width, cur = layer(sel);
    if (e.button === 1 || spaceDown) { const s = sc(); drag = { mode: 'pan', x: e.clientX, y: e.clientY, sl: s.scrollLeft, st: s.scrollTop, moved: false }; o.setPointerCapture(e.pointerId); e.preventDefault(); return; }
    if (pen) { const f = pen.pts[0]; if (pen.pts.length >= 3 && Math.hypot(p.x - f[0] * W, p.y - f[1] * H) < 12 * k) finishPen(); else { pen.pts.push(snapN([p.x / W, p.y / H])); drawOv(); vtDraw(); } return; }
    if (editing()) {
      const rg = nodePx(cur), n = E.nearestNode(rg, [p.x, p.y], 11 * k);
      if (n) { selNode = { ring: n.ring, node: n.node }; drag = { mode: 'node', id: cur.id, ring: n.ring, node: n.node, moved: false }; o.setPointerCapture(e.pointerId); drawOv(); return; }
      const ed = E.nearestEdge(rg, [p.x, p.y], 9 * k);
      if (ed) { E.setRings(cur, E.insertNode(E.rings(cur), ed.ring, ed.seg, E.toUnit(cur, [ed.pt[0] / W, ed.pt[1] / H], W, H))); selNode = { ring: ed.ring, node: ed.seg + 1 }; drag = { mode: 'node', id: cur.id, ring: ed.ring, node: ed.seg + 1, moved: true }; o.setPointerCapture(e.pointerId); draw2D1(); panelR(); return; }
    }
    if (cur && cur.vis && !cur.lock && !editing()) {
      const q = local(cur, p);
      if (Math.hypot(q.x, q.y + cur.h * H / 2 + 26 * k) < 14 * k) { drag = { mode: 'rotate', id: cur.id, moved: false }; o.setPointerCapture(e.pointerId); return; }
      if (Math.hypot(q.x - cur.w * W / 2, q.y - cur.h * H / 2) < 16 * k) { drag = { mode: 'resize', id: cur.id, r: cur.w / cur.h, moved: false }; o.setPointerCapture(e.pointerId); return; }
    }
    const l = hit(p); if (l) { if (editId && editId !== l.id) { editId = ''; selNode = null; } sel = l.id; drag = { mode: 'move', id: l.id, ox: p.x - l.cx * W, oy: p.y - l.cy * H, moved: false }; o.setPointerCapture(e.pointerId); panelL(); panelR(); } else { sel = ''; editId = ''; selNode = null; panelL(); panelR(); }
    drawOv();
  });
  o.addEventListener('pointermove', e => {
    if (pen && !drag) { const p = pt(e); pen.cur = [p.x / o.width, p.y / o.height]; drawOv(); return; }
    if (!drag) return; if (drag.mode === 'pan') { const s = sc(); s.scrollLeft = drag.sl - (e.clientX - drag.x); s.scrollTop = drag.st - (e.clientY - drag.y); return; }
    const l = layer(drag.id); if (!l) return; const p = pt(e), W = o.width, H = o.height; drag.moved = true;
    if (drag.mode === 'move') { let nx = (p.x - drag.ox) / W, ny = (p.y - drag.oy) / H; if (v2.snap) [nx, ny] = snapN([nx, ny]); l.cx = Math.min(1.2, Math.max(-0.2, nx)); l.cy = Math.min(1.2, Math.max(-0.2, ny)); }
    else if (drag.mode === 'rotate') l.rot = E.angleTo(l, [p.x / W, p.y / H], W, H, e.shiftKey ? 15 : 0);
    else if (drag.mode === 'node') { const u = E.toUnit(l, snapN([p.x / W, p.y / H]), W, H); E.setRings(l, E.moveNode(E.rings(l), drag.ring, drag.node, u)); }
    else { const q = local(l, p); let nw = Math.max(0.02, 2 * Math.abs(q.x) / W), nh = Math.max(0.02, 2 * Math.abs(q.y) / H); if (e.shiftKey || l.type === 'image') { const f = Math.max(nw / l.w, nh / l.h); nw = l.w * f; nh = nw / drag.r; } l.w = Math.min(3, nw); l.h = Math.min(3, nh); }
    draw2D1(); schedule(); syncSliders();
  });
  const up = () => { if (drag && drag.moved && drag.mode !== 'pan') { if (drag.mode === 'node') { const l = layer(drag.id); if (l) E.fitBox(l, E.rings(l), o.width, o.height); } commit(); } drag = null; };
  o.addEventListener('pointerup', up); o.addEventListener('pointercancel', up);
  o.addEventListener('dblclick', e => {
    const p = pt(e), k = o.width / o.getBoundingClientRect().width;
    if (pen) { if (pen.pts.length > 3) pen.pts.pop(); finishPen(); return; }
    const l = layer(sel); if (!editing()) return; const n = E.nearestNode(nodePx(l), [p.x, p.y], 11 * k); if (n) { selNode = { ring: n.ring, node: n.node }; delNode(); }
  });
  o.addEventListener('wheel', e => { if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault(); zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15); }, { passive: false });
}
/* ---- vector editor actions ---- */
function zoomBy(f) { v2.zoom = f ? Math.min(6, Math.max(1, v2.zoom * f)) : 1; fit(); drawOv(); vtDraw(); }
function vtDraw() {
  const b = $('.vt', root); if (!b) return; const t = (k, n, on) => `<button class="sb sm" data-vt="${k}" ${on == null ? '' : `aria-pressed="${on}"`}>${n}</button>`;
  b.innerHTML = pen ? `<span class="note" style="margin:0 4px 0 0;align-self:center">${pen.pts.length} point${pen.pts.length === 1 ? '' : 's'}</span>${t('penDone', 'Finish shape')}${t('penUndo', 'Undo point')}${t('penCancel', 'Cancel')}`
    : t('grid', 'Grid', v2.grid) + t('snap', 'Snap', v2.snap) + t('rulers', 'Rulers', v2.rulers) + t('zout', 'Zoom -') + t('zin', 'Zoom +') + (v2.zoom !== 1 ? t('zfit', 'Fit ' + Math.round(v2.zoom * 100) + '%') : '');
}
function startPen(outline) { if (view === 'v3d') { view = 'v2d'; $('#stViews', root).className = 'views v2d'; $$('[data-v]', root).forEach(x => x.setAttribute('aria-pressed', x.dataset.v === 'v2d')); fit(); } pen = { pts: [], cur: null, outline: !!outline }; sel = ''; editId = ''; selNode = null; panelL(); panelR(); drawOv(); vtDraw(); toast('Click the design to place points. Click the first point or press Enter to close the shape.'); }
function finishPen() {
  if (!pen) return; if (pen.pts.length < 3) return toast('Place at least 3 points first.', true); if (pen.outline) { const pts = pen.pts; pen = null; vtDraw(); setOutline(pts); return toast('Rug outline set. Use Smooth corners or Fewer points to refine it.'); } const f = E.layerFromPoints(pen.pts); pen = null;
  const l = L.layer('poly', { pts: f.pts, cx: f.cx, cy: f.cy, w: f.w, h: f.h, name: 'Drawn shape' }); doc.layers.push(l); sel = l.id; vtDraw(); commit(); toast('Shape added. Choose Edit points to refine it.');
}
function cancelPen() { pen = null; vtDraw(); drawOv(); }
function delNode() {
  const l = layer(sel); if (!l || !selNode) return; const rg = E.rings(l); if (!rg[selNode.ring] || rg[selNode.ring].length <= 3) return toast('A shape needs at least 3 points.', true);
  const [W, H] = WH(); E.fitBox(l, E.removeNode(rg, selNode.ring, selNode.node), W, H); selNode = null; commit();
}
function editorClick(b) {
  const l = layer(sel), [W, H] = WH(), id = b.id;
  if (id === 'stPen') return startPen();
  if (b.dataset.vt) { const a = b.dataset.vt; if (a === 'grid' || a === 'snap' || a === 'rulers') { v2[a] = !v2[a]; vtDraw(); drawOv(); } else if (a === 'zin') zoomBy(1.25); else if (a === 'zout') zoomBy(1 / 1.25); else if (a === 'zfit') zoomBy(0); else if (a === 'penDone') finishPen(); else if (a === 'penUndo') { pen.pts.pop(); drawOv(); vtDraw(); } else if (a === 'penCancel') cancelPen(); return; }
  if (!l) return;
  if (b.dataset.al) { if (l.lock) return toast('This layer is locked.', true); Object.assign(l, E.align(l, b.dataset.al, W, H)); return commit(); }
  if (id === 'rEdit') { editId = editId === l.id ? '' : l.id; selNode = null; panelR(); drawOv(); return; }
  if (id === 'rSimp') { const n0 = E.nodeCount(l), rg = E.simplify(E.rings(l), 0.01), n1 = rg.reduce((s2, r) => s2 + r.length, 0); if (n1 >= n0) return toast('Already as simple as it can get.'); E.fitBox(l, rg, W, H); selNode = null; commit(); return toast('Simplified: ' + n0 + ' points down to ' + n1 + '. Undo if it looks too rough.'); }
  if (id === 'rSpeck') { const rg = E.rings(l), k2 = E.dropTiny(rg, 0.004); if (k2.length === rg.length) return toast('No tiny specks found.'); E.fitBox(l, k2, W, H); selNode = null; commit(); return toast('Removed ' + (rg.length - k2.length) + ' tiny piece' + (rg.length - k2.length === 1 ? '' : 's') + '.'); }
  if (id === 'rSplit') { const gs = E.splitRings(E.rings(l)); if (gs.length < 2) return toast('This shape is a single piece already.'); const i = doc.layers.indexOf(l), parts = gs.map((g, n) => { const c = JSON.parse(JSON.stringify(l)); c.id = L.uid(); c.name = (l.name || 'Shape') + ' ' + (n + 1); E.fitBox(c, g, W, H); return c; }); doc.layers.splice(i, 1, ...parts); sel = parts[0].id; editId = ''; selNode = null; commit(); return toast('Split into ' + parts.length + ' separate shapes.'); }
  if (id === 'rMerge') {
    const others = doc.layers.filter(x => x !== l && x.vis && !x.lock && E.editable(x) && x.fill === l.fill); if (!others.length) return toast('No other vector shape uses the same yarn colour.', true);
    const m = E.mergeLayers([l].concat(others), W, H, L.uid()); if (!m) return toast('Those shapes overlap, so joining them would punch holes. Move them apart first.', true);
    doc.layers = doc.layers.filter(x => !others.includes(x)); doc.layers.splice(doc.layers.indexOf(l), 1, m); sel = m.id; editId = ''; selNode = null; commit(); toast('Merged ' + (others.length + 1) + ' shapes into one.');
  }
}
function editorPanel(l) {
  const al = [['left', 'Left'], ['hcenter', 'Centre'], ['right', 'Right'], ['top', 'Top'], ['vcenter', 'Middle'], ['bottom', 'Bottom']];
  let h = `<h4>Align to rug</h4><div class="chips">${al.map(([k, n]) => `<button class="sb sm" data-al="${k}">${n}</button>`).join('')}</div>`;
  if (E.editable(l)) h += `<h4>Shape points</h4><div class="chips"><button class="sb sm" id="rEdit" aria-pressed="${editId === l.id}">Edit points</button><button class="sb sm" id="rSimp">Simplify</button>${l.type === 'path' ? '<button class="sb sm" id="rSpeck">Remove specks</button><button class="sb sm" id="rSplit">Split shapes</button>' : ''}<button class="sb sm" id="rMerge">Merge same colour</button></div>
    <p class="note">${E.nodeCount(l)} points.${editId === l.id ? ' Drag a point to move it, click an edge to add one, double-click a point (or press Delete) to remove it. Esc to finish.' : ' Rotate with the round handle above the object (hold Shift for 15 degree steps).'}</p>`;
  else h += '<p class="note">Rotate with the round handle above the object (hold Shift for 15 degree steps).</p>';
  return h;
}
const draw2D1 = () => { L.render(doc, cv2(), imgs); drawOv(); };

/* ---------------------------------------------------------------- 3D */
const PILE = { low: [0.05, 0.9], standard: [0.08, 1.2], high: [0.14, 1.4], carved: [0.13, 2.1] };
const envQ = () => ({ coarse: matchMedia('(pointer: coarse)').matches, width: innerWidth, cores: navigator.hardwareConcurrency });
function geo() {
  const d = D3.d3(doc), q = D3.quality(d.quality, envQ()), ar = doc.widthCm / doc.heightCm, wall = !!doc.frame, room = d.scene === 'room' && !wall; let w, h;
  if (room) { w = doc.widthCm * ROOM_S; h = doc.heightCm * ROOM_S; } else { const m = wall ? 4 : 4.4; if (ar >= 1) { w = m; h = m / ar; } else { h = m; w = m * ar; } }
  const circ = doc.shape === 'circle' || doc.shape === 'oval'; if (doc.shape === 'circle') { w = h = Math.min(w, h); }
  const P = PILE[doc.pile] || PILE.standard, mat = D3.MATERIALS[d.mat], bound = doc.borderType === 'bound', carvedEdge = doc.borderType === 'carved';
  return { k: wall ? 'wall' : 'rug', w: +w.toFixed(3), h: +h.toFixed(3), dens: 52, pile: wall ? P[0] * 1.6 : +D3.pileWorld(doc, w).toFixed(4), carveK: P[1], rad: circ ? 0.15 : Math.max(0.02, (doc.radius || 0) / 100 * Math.min(w, h)), circle: circ,
    shells: q.shells, lod: q.lod, dpr: q.dpr, loop: d.style === 'loop', sheen: mat.sheen, specK: mat.spec, light: d.light === 'studio' ? null : D3.LIGHTS[d.light],
    border: bound ? undefined : 0, edgeFade: carvedEdge ? 0.2 : 0, room: room, scene: d.scene };
}
/* heavy 3D assets (outline mask, edge wall, room textures) are rebuilt only when their inputs change */
let mCache = { key: '', cv: null }, wCache = { key: '' }, shCache = { key: '', cv: null }; const flCache = {};
function floorTex(kind) {
  if (flCache[kind]) return flCache[kind]; const c = document.createElement('canvas'); c.width = c.height = 1024; const x = c.getContext('2d'); let sd = 11; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  if (kind === 'wood') { x.fillStyle = '#9b6e44'; x.fillRect(0, 0, 1024, 1024); const rows = 26, rh = 1024 / rows; for (let r = 0; r < rows; r++) { let px = -rnd() * 300; while (px < 1024) { const len = 200 + rnd() * 240, tone = 0.82 + rnd() * 0.3; x.fillStyle = `rgb(${Math.round(176 * tone)},${Math.round(124 * tone)},${Math.round(78 * tone)})`; x.fillRect(px + 1, r * rh + 1, len - 2, rh - 2); x.strokeStyle = 'rgba(70,40,18,.22)'; x.lineWidth = 1; for (let g = 0; g < 4; g++) { const gy = r * rh + 3 + rnd() * (rh - 6); x.beginPath(); x.moveTo(px + 2, gy); x.lineTo(px + len - 2, gy + (rnd() - 0.5) * 3); x.stroke(); } px += len; } } }
  else if (kind === 'tile') { x.fillStyle = '#4a4d4f'; x.fillRect(0, 0, 1024, 1024); const nx = 13, ny = 9, tw = 1024 / nx, th = 1024 / ny; for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const t = 150 + Math.round(rnd() * 24); x.fillStyle = `rgb(${t},${t + 2},${t + 4})`; x.fillRect(i * tw + 3, j * th + 3, tw - 6, th - 6); } }
  else if (kind === 'concrete') { x.fillStyle = '#8e908e'; x.fillRect(0, 0, 1024, 1024); for (let n = 0; n < 900; n++) { x.fillStyle = `rgba(${rnd() < 0.5 ? '60,62,60' : '190,192,188'},${0.03 + rnd() * 0.05})`; x.beginPath(); x.arc(rnd() * 1024, rnd() * 1024, 8 + rnd() * 60, 0, 7); x.fill(); } }
  else { x.fillStyle = '#6c7078'; x.fillRect(0, 0, 1024, 1024); for (let n = 0; n < 9000; n++) { const t = rnd() < 0.5 ? 0 : 255; x.fillStyle = `rgba(${t},${t},${t},0.045)`; x.fillRect(rnd() * 1024, rnd() * 1024, 2, 2); } }
  return (flCache[kind] = c);
}
function shadowTex(poly, key) {
  if (shCache.key === key) return shCache.cv; if (shCache.cv && viewer) viewer.eng.dropTex(shCache.cv); const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, N, N);
  const k = 1 / 1.2, off = 4000; x.shadowColor = '#fff'; x.shadowBlur = 16; x.shadowOffsetX = off + 3; x.shadowOffsetY = 4; x.fillStyle = '#fff'; x.beginPath(); poly.forEach((p, i) => { const px = (0.5 + (p[0] - 0.5) * k) * N - off, py = (0.5 + (p[1] - 0.5) * k) * N; i ? x.lineTo(px, py) : x.moveTo(px, py); }); x.closePath(); x.fill();
  shCache = { key, cv: c }; return c;
}
function assets3(g) {
  const out = {}; if (doc.frame || g.k !== 'rug') return out; const d = D3.d3(doc), poly = E.outline(doc, 96), geoKey = JSON.stringify([doc.shape, doc.outline || 0, doc.radius, doc.widthCm, doc.heightCm, g.w, g.h]);
  if (doc.shape === 'custom') { if (mCache.key !== geoKey) { if (mCache.cv && viewer) viewer.eng.dropTex(mCache.cv); mCache = { key: geoKey, cv: D3.sdfCanvas(poly, 256, g.w, g.h, 0.3) }; } out.maskCv = mCache.cv; out.maskR = 0.3; }
  const th = D3.thickWorld(doc, g.w);
  if (th > 0.002) { const key = 'w3|' + geoKey + '|' + th.toFixed(4); if (wCache.key !== key) { if (wCache.key && viewer) viewer.eng.dropMesh(wCache.key); wCache = { key, data: D3.wallMesh(poly, g.w, g.h, th) }; } out.wall3d = { key, data: wCache.data, color: doc.borderType === 'bound' ? [0.07, 0.07, 0.075] : D3.backingRgb(doc.backing) }; }
  if (g.room) out.room = { s: ROOM_S, drop: th, cm: D3.ROOM, furn: d.furn, floorCv: floorTex(d.floor), floorSpec: d.floor === 'tile' ? 0.25 : d.floor === 'wood' ? 0.12 : 0.04, shadowCv: shadowTex(poly, geoKey) };
  return out;
}
function schedule() { clearTimeout(t3); t3 = setTimeout(update3D, 160); clearTimeout(tA); tA = setTimeout(() => { an = L.analyse(doc, imgs); refreshEst(); refreshUsage(); }, 120); }
let stale3 = false, lastScene = '';
function update3D() {
  if (!root || !root.classList.contains('on')) return; if (view === 'v2d') { stale3 = true; refreshEst(); return; } stale3 = false; ensureViewer(); if (!viewer) return;
  const aa = an = L.analyse(doc, imgs); let c = L.makeCanvas(doc, 640); L.render(doc, c, imgs); if (aa.sepOn) c = L.separate(c, aa.list); c.__id = ++seq;
  const g = Object.assign(geo(), assets3(geo())), pp = { sku: 'STUDIO', kind: 'custom', cat: 'custom', shape: g.circle ? 'round' : 'rug', w: doc.widthCm, h: doc.heightCm };
  const first = !viewer.prod; const old = viewer.img, oldRatio = prevRatio; viewer.prod = pp; viewer.img = c; viewer.design = ''; viewer.g = g; viewer.eng.dprCap = g.dpr; prevRatio = g.w / g.h; const sceneChanged = lastScene !== g.scene; lastScene = g.scene;
  if (first) { viewer.tilt = -0.85; viewer.yaw = 0; viewer.dist = baseDist(); } else if (sceneChanged || Math.abs(oldRatio - prevRatio) > 0.01) viewer.dist = baseDist();
  if (old && old.__id) XARO.dropArt(viewer, old, oldRatio);
  refreshEst();
}
function ensureViewer() { if (viewer) return; try { viewer = XARO.newViewer($('#st3', root)); viewer.maxDist = 34; } catch (e) { viewer = null; $('.v3', root).insertAdjacentHTML('beforeend', '<p class="note" style="position:absolute;inset:auto 12px 50px 12px">3D preview needs WebGL, which is not available here. The 2D design and price estimate still work.</p>'); } }
function baseDist() { const g0 = geo(); if (g0.room) return Math.min(28, Math.max(12, Math.max(g0.w, g0.h) * 1.8 + 9)); const c = $('#st3', root), asp = c && c.clientHeight ? c.clientWidth / c.clientHeight : 1.6, g = geo(), need = Math.max(g.w * 0.62 / (0.3057 * Math.max(0.3, asp)), g.h * 0.62 / 0.3057 * (g.k === 'wall' ? 1.1 : 1)); return Math.min(26, Math.max(8.6, need)); }
function camPreset(n) {
  if (!viewer) return; const d = baseDist(), P = { angle: [0, -0.85, d], front: [0, -0.04, d], top: [0, -1.3, d], side: [1.15, -0.25, d] }[n]; if (!P) return; viewer.yaw = P[0]; viewer.tilt = P[1]; viewer.dist = P[2]; viewer.idle = n === 'angle' ? performance.now() : Infinity;
}

/* ---------------------------------------------------------------- estimate */
const catalogSku = () => { if (doc.frame) return 'CW'; const a = doc.widthCm * doc.heightCm; return a <= 1000 ? 'CK' : a <= 6500 ? 'CF' : 'CL'; };
function rates() { const r = XCOST.mergeRates(XCOST.DEFAULT_RATES, XD.costRates()); r.fx = Object.assign({}, r.fx, XD.fxTable()); return r; }
function inputs(d, cur) { const a = an || L.analyse(doc, imgs); return { widthCm: d.widthCm, heightCm: d.heightCm, shape: d.shape === 'circle' || d.shape === 'oval' ? 'oval' : d.shape === 'custom' && d.outline ? 'custom' : 'rect', areaFraction: d.shape === 'custom' && d.outline ? E.polyArea(d.outline) : undefined, perimeterM: d.shape === 'custom' && d.outline ? E.perimeterCm(d.outline, d.widthCm, d.heightCm) / 100 : undefined, colours: a.colours, pile: d.pile, backing: d.backing, border: d.borderCm > 0 ? (d.borderType === 'none' ? 'bound' : d.borderType) : 'none', frame: d.frame, dest: XARO.region().country === 'LK' ? 'local' : 'export', currency: cur }; }
function estimate() {
  const r = rates(), reg = XARO.region(), raw = XCOST.estimate(inputs(doc, reg.cur), r); if (!raw.ok) return { raw };
  const sku = catalogSku(), p = XARO.byId()[sku]; let cust = null, std = null;
  if (p) { const sw = { CK: [44, 16], CF: [60, 90], CL: [90, 90], CW: [61, 91] }[sku], sd = Object.assign({}, doc, { widthCm: sw[0], heightCm: sw[1], shape: 'rect', pile: 'standard', borderCm: 0, frame: sku === 'CW', backing: sku === 'CK' ? 'felt' : 'standard' });
    const se = XCOST.estimate(Object.assign(inputs(sd, reg.cur), { colours: 3, border: 'none' }), r); if (se.ok) { std = { p, se }; const ratio = raw.usd.sell / se.usd.sell, amt = XARO.priceOf(p) * ratio; cust = { p, ratio, amt, text: XARO.fmt(Math.ceil(amt / (XARO.ctry().cur === 'LKR' ? 100 : 5)) * (XARO.ctry().cur === 'LKR' ? 100 : 5)) }; } }
  return { raw, cust, sku };
}
function refreshEst() {
  const b = $('#stEst', root); if (!b) return; const e = estimate();
  if (!e.raw.ok) { b.innerHTML = `<div class="warn">${esc(e.raw.errors.join(' '))}</div>`; return; }
  b.innerHTML = `<div class="est"><small>Estimated price (not a quotation)</small><div class="big">${e.cust ? esc(e.cust.text) : '-'}</div>
  <div class="k"><span>Yarn colours</span><b>${e.raw.colours}</b></div><div class="k"><span>Area</span><b>${(e.raw.areaM2 * 10000).toFixed(0)} cm²</b></div>
  <div class="k"><span>Nearest standard</span><b>${e.cust ? esc(e.cust.p.name) : '-'}</b></div>
  <p class="note">Scaled from that product's price using the size, pile, colours and extras you chose. XARO confirms the final price in a quotation after artwork review. ${XARO.shipFee() ? '' : 'Shipping is included for supported countries.'}</p></div>`;
}
function refreshUsage() { const b = $('#stUse', root); if (!b || !an) return; b.innerHTML = an.rows.map(r => `<div class="yl"><i style="background:${r.yarn.hex}"></i><span>${esc(r.yarn.name)} <small>${esc(r.yarn.id)}</small></span><small>${r.pct.toFixed(1)}%</small></div>`).join(''); }

/* ---------------------------------------------------------------- panels */
const TABS = [['art', 'Artwork'], ['tpl', 'Templates'], ['add', 'Shapes'], ['size', 'Size'], ['col', 'Colours'], ['d3', '3D'], ['lay', 'Layers']];
function panelL() {
  const t = $('.tabs', root); t.innerHTML = TABS.map(([k, n]) => `<button role="tab" data-lt="${k}" aria-selected="${ltab === k}">${n}</button>`).join('');
  const b = $('#stL', root);
  b.innerHTML = ({ art: tArt, tpl: tTpl, add: tAdd, size: tSize, col: tCol, d3: t3d, lay: tLay }[ltab])();
  if (ltab === 'tpl') paintTemplates();
  if (ltab === 'col') { if (!an) an = L.analyse(doc, imgs); refreshUsage(); }
}
const swatchBtn = (y, pressed) => `<button type="button" data-y="${esc(y.id)}" style="background:${y.hex}" aria-pressed="${pressed}" aria-label="${esc(y.name)}" title="${esc(y.name)} (${esc(y.id)})"></button>`;
function tArt() {
  const maxMb = XD.settings().maxUploadMb || 8, il = doc.layers.filter(l => l.type === 'image');
  return `<label class="drop" id="stDrop" for="stFile"><b>Upload artwork</b><br><small>PNG, JPG, WebP or SVG, up to ${maxMb} MB</small></label><input type="file" id="stFile" accept="image/png,image/jpeg,image/webp,image/svg+xml,.svg" hidden><div class="err" id="stErr" role="alert"></div>
  <p class="note">Your original file is never changed. The studio works on a copy and shows how it would look in a limited yarn palette. Keep the original: it is what the team uses to produce the final artwork.</p>
  <h4>Colour separation</h4>
  <label class="chips" style="align-items:center;gap:8px"><input type="checkbox" id="stSep" ${doc.sepOn ? 'checked' : ''} style="width:auto"> Reduce artwork to a yarn palette</label>
  <div class="fld" style="margin-top:8px"><label for="stMax">Maximum yarn colours: <b id="stMaxV">${doc.maxColours}</b></label><input type="range" id="stMax" min="2" max="14" value="${doc.maxColours}"></div>
  <h4>Artwork on this rug</h4>${il.length ? il.map(l => { const im = imgs[l.img], pxcm = im ? Math.round(im.w / Math.max(1, l.w * doc.widthCm)) : 0; return `<div class="ly" data-sel="${l.id}" aria-current="${sel === l.id}"><i style="background:#222"></i><span>${esc(im ? im.name : 'artwork')}</span></div><p class="note" style="margin-top:-2px">${im ? `${im.w} x ${im.h} px, about ${pxcm} px per cm at this size.` : ''}</p>${pxcm && pxcm < 8 ? '<div class="warn">Low resolution at this size: edges may look soft. A larger or vector (SVG) file gives crisper tufting.</div>' : ''}`; }).join('') : '<p class="note">No artwork yet. Upload an image, or start from Templates.</p>'}
  <div class="note">Photos with many colours are simplified. Tiny detail (thin lines, small text) is hard to tuft: keep strokes thicker than about 5 mm.</div>`;
}
function tTpl() {
  const cats = ['', ...L.CATEGORIES]; return `<div class="fld"><label for="stTc">Category</label><select id="stTc">${cats.map(c => `<option value="${esc(c)}" ${filt.tcat === c ? 'selected' : ''}>${c || 'All (' + L.TEMPLATES.length + ')'}</option>`).join('')}</select></div><div class="tg" id="stTg"></div><p class="note">Original starter designs. Every template is fully editable: change colours, move or delete any shape, add your own art. Loading one can be undone.</p>`;
}
function paintTemplates() {
  const g = $('#stTg', root); if (!g) return; g.innerHTML = ''; L.TEMPLATES.filter(t => !filt.tcat || t.cat === filt.tcat).forEach(t => {
    const d = L.fromTemplate(t), c = L.makeCanvas(d, 150); L.render(d, c, {}); const b = document.createElement('button'); b.type = 'button'; b.className = 'tc'; b.dataset.tpl = t.id; b.appendChild(c);
    b.insertAdjacentHTML('beforeend', `<b>${esc(t.name)}</b><small>${esc(t.cat)} | ${esc(L.complexity(t))} | ${t.widthCm}x${t.heightCm} cm</small>`); g.appendChild(b);
  });
}
function tAdd() {
  const sh = [['Rectangle', 'rect'], ['Ellipse', 'ellipse'], ['Triangle', 'poly:triangle'], ['Diamond', 'poly:diamond'], ['Hexagon', 'poly:hexagon'], ['Star', 'poly:star'], ['Heart', 'poly:heart'], ['Crown', 'poly:crown'], ['Arrow', 'poly:arrow'], ['Arch', 'poly:arch'], ['Wave', 'wave']];
  return `<h4>Shapes</h4><div class="chips">${sh.map(([n, k]) => `<button class="sb sm" data-add="${k}">${n}</button>`).join('')}</div>
  <h4>Text</h4><div class="fld"><input type="text" id="stTx" maxlength="40" value="YOUR TEXT" aria-label="Text"></div>
  <div class="fld"><select id="stFont" aria-label="Font">${L.FONTS.map(f => `<option>${f[0]}</option>`).join('')}</select></div><button class="sb pri" data-add="text">Add text</button>
  <p class="note">Tip: thick, simple letters tuft best. Fonts shown here are previews of the letter shapes.</p>
  <h4>Pen</h4><button class="sb pri" id="stPen">Draw a shape with the pen</button><p class="note">Click to place points, click the first point or press Enter to close the shape. Backspace removes the last point. Esc cancels.</p>`;
}
const OL = ['heart', 'star', 'hexagon', 'diamond', 'arch', 'crown', 'arrow', 'triangle'];
function outlinePanel() {
  const ed = layer(sel), can = ed && E.editable(ed);
  return `<h4>Outline</h4><div class="chips">${OL.filter(n => L.POLY[n]).map(n => `<button class="sb sm" data-ol="${n}">${n[0].toUpperCase() + n.slice(1)}</button>`).join('')}<button class="sb sm" data-ol="blob">Freeform blob</button></div>
  <div class="chips"><button class="sb sm" id="olPen">Draw with pen</button><button class="sb sm" id="olSel" ${can ? '' : 'disabled'}>Use selected shape</button><button class="sb sm" id="olSmooth">Smooth corners</button><button class="sb sm" id="olSimp">Fewer points</button></div>
  <p class="note">${(doc.outline || []).length} points. The outline stretches to the width and height. Artwork, border and exports are cut to it.${can ? '' : ' Select a vector shape to use it as the outline.'}</p>`;
}
function setOutline(pts) { if (!pts || pts.length < 3) return toast('An outline needs at least 3 points.', true); let o = E.fitUnit(pts); if (o.length > 400) o = E.fitUnit(E.simplifyRing(o, 0.002)); doc.shape = 'custom'; doc.outline = o; commit(); }
function outlineAction(b) {
  if (b.dataset.ol) { const n = b.dataset.ol; return setOutline(n === 'blob' ? E.presetOutline('blob') : L.POLY[n]); }
  if (b.id === 'olPen') return startPen(true);
  if (b.id === 'olSel') { const l = layer(sel); if (!l || !E.editable(l)) return; const [W, H] = WH(); return setOutline(E.rugRings(l, W, H)[0]); }
  if (b.id === 'olSmooth') { if (!doc.outline) return; if (doc.outline.length > 120) return toast('Already smooth.'); return setOutline(E.smoothClosed(doc.outline, 1)); }
  if (b.id === 'olSimp') { if (!doc.outline || doc.outline.length <= 4) return toast('Already as simple as it can get.'); const n = E.simplifyRing(doc.outline, 0.01); if (n.length >= doc.outline.length) return toast('Already as simple as it can get.'); return setOutline(n); }
}
function tSize() {
  const presets = [['Keyboard 44 x 16', 'rect', 44, 16], ['Compact 32 x 12', 'rect', 32, 12], ['Coaster 12 round', 'circle', 12, 12], ['Floor 60 x 90', 'rect', 60, 90], ['Logo 90 x 90', 'rect', 90, 90], ['Wall 61 x 91 framed', 'rect', 61, 91]];
  return `<div class="fld"><label for="stShape">Rug shape</label><select id="stShape">${[['rect', 'Rectangle'], ['square', 'Square'], ['circle', 'Circle'], ['oval', 'Oval'], ['custom', 'Custom outline']].map(([k, n]) => `<option value="${k}" ${doc.shape === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
  <div class="row2"><div class="fld"><label for="stW">Width (${unit})</label><input type="number" id="stW" step="any" min="1" value="${fmtLen(doc.widthCm)}"></div><div class="fld"><label for="stH">Height (${unit})</label><input type="number" id="stH" step="any" min="1" value="${fmtLen(doc.heightCm)}" ${doc.shape === 'square' || doc.shape === 'circle' ? 'disabled' : ''}></div></div>
  <div class="err" id="stSzErr" role="alert"></div>
  ${doc.shape === 'rect' || doc.shape === 'square' ? `<div class="fld"><label for="stRad">Corner radius: <b id="stRadV">${doc.radius}%</b></label><input type="range" id="stRad" min="0" max="50" value="${doc.radius}"></div>` : ''}
  <div class="fld"><label for="stBd">Border width: <b id="stBdV">${fmtLen(doc.borderCm)} ${unit}</b></label><input type="range" id="stBd" min="0" max="${unit === 'cm' ? 8 : 20}" step="${unit === 'cm' ? 0.5 : 1}" value="${unit === 'cm' ? doc.borderCm : Math.round(doc.borderCm / IN * 4) / 4}"></div>
  ${doc.borderCm > 0 ? `<h4>Border colour</h4>${colourPicker(L.yarnList(), doc.borderYarn, y => swatchBtn(y, doc.borderYarn === y.id).replace('data-y=', 'data-by='))}` : ''}
  ${doc.shape === 'custom' ? outlinePanel() : ''}
  <h4>Quick sizes</h4><div class="chips">${presets.map((p, i) => `<button class="sb sm" data-pre="${i}">${p[0]}</button>`).join('')}</div>
  <p class="note">Choose Custom outline for heart, star, freeform or hand-drawn rug shapes. The width and height above are the size of the box around the outline.</p>`;
}
const XCOL = () => window.XCOLOUR, PREVIEW_N = 30;
/* colour picker grouped into families (Reds, Blues, Browns ...); a family chip shows all of that family, "All" shows the first shades of each */
function colourPicker(list, cur, btn) {
  const groups = XCOL().groupYarns(list), fc = filt.q ? '' : filt.cat, shown = fc ? groups.filter(g => g.key === fc) : groups;   // a search looks through every family
  const chips = `<div class="fam" role="group" aria-label="Colour families"><button type="button" class="sb sm" data-fam="" aria-pressed="${!fc}">All <small>${list.length}</small></button>${groups.map(g => `<button type="button" class="sb sm" data-fam="${g.key}" aria-pressed="${fc === g.key}"><i style="background:${g.hex}"></i>${esc(g.label)} <small>${g.items.length}</small></button>`).join('')}</div>`;
  const body = shown.map(g => { const part = fc ? g.items : g.items.slice(0, PREVIEW_N); const more = !fc && g.items.length > PREVIEW_N, hid = more && cur && !part.some(y => y.id === cur) ? g.items.find(y => y.id === cur) : null;
    return `<div class="cg"><div class="cgh"><b>${esc(g.label)}</b><small>${g.items.length} shade${g.items.length === 1 ? '' : 's'}</small></div><div class="sw">${part.concat(hid ? [hid] : []).map(btn).join('')}</div>${more ? `<button type="button" class="sb sm" data-fam="${g.key}">Show all ${g.items.length} ${esc(g.label.toLowerCase())}</button>` : ''}</div>`; }).join('') || '<p class="note">No colours match.</p>';
  return chips + body;
}
const yarnOptions = (list, selId) => XCOL().groupYarns(list).map(g => `<optgroup label="${esc(g.label)}">${g.items.map(y => `<option value="${esc(y.id)}"${y.id === selId ? ' selected' : ''}>${esc(y.name)} (${esc(y.id)})</option>`).join('')}</optgroup>`).join('');
function tCol() {
  const all = L.yarnList(), q = filt.q.toLowerCase(), list = all.filter(y => !q || (y.name + y.id).toLowerCase().includes(q)), l = layer(sel), pals = XD.g('palettes', []);
  const cur = target === 'fill' ? (l && l.fill) : target === 'stroke' ? (l && l.stroke) : target === 'bg' ? doc.bg : doc.borderYarn;
  const used = an ? an.rows.map(r => r.yarn) : [];
  return `<div class="row2"><div class="fld"><label for="stCt">Apply colour to</label><select id="stCt"><option value="fill" ${target === 'fill' ? 'selected' : ''}>Selected object</option><option value="stroke" ${target === 'stroke' ? 'selected' : ''}>Object outline</option><option value="bg" ${target === 'bg' ? 'selected' : ''}>Background</option><option value="border" ${target === 'border' ? 'selected' : ''}>Rug border</option></select></div>
  <div class="fld"><label for="stCq">Search</label><input type="text" id="stCq" placeholder="Colour name or yarn ID" value="${esc(filt.q)}" aria-label="Search colours"></div></div>
  ${(target === 'fill' || target === 'stroke') && !l ? '<div class="warn">Select an object first, or choose Background.</div>' : ''}
  ${colourPicker(list, cur, y => swatchBtn(y, cur === y.id))}
  ${cur && ym()[cur] ? `<p class="note"><b>${esc(ym()[cur].name)}</b> | ${esc(ym()[cur].id)} | ${esc(ym()[cur].hex)} | rgb ${XD.hex2rgb(ym()[cur].hex).join(', ')} | ${esc(ym()[cur].material)}${ym()[cur].availability && ym()[cur].availability !== 'unknown' ? ' | ' + esc(ym()[cur].availability) : ''}</p>` : ''}
  <h4>Yarns used in this design</h4><div id="stUse"></div>
  <h4>Replace a colour everywhere</h4><div class="row2"><select id="stRf" aria-label="Replace">${used.map(y => `<option value="${y.id}">${esc(y.name)}</option>`).join('')}</select><select id="stRt" aria-label="With">${yarnOptions(all)}</select></div><button class="sb sm" id="stRep" style="margin-top:6px">Replace</button>
  <h4>Saved palettes</h4>${pals.map((p, i) => `<div class="fld"><div class="lb">${esc(p.name)} <button class="sb sm bad" data-pdel="${i}">x</button></div><div class="sw">${p.ids.filter(id => ym()[id]).map(id => swatchBtn(ym()[id], false)).join('')}</div></div>`).join('') || '<p class="note">None yet.</p>'}<button class="sb sm" id="stPal">Save this design's colours as a palette</button>`;
}
function t3d() {
  const d = D3.d3(doc), pm = D3.pileMm(doc), opt = (o, v) => Object.entries(o).map(([k, n]) => `<option value="${k}" ${k === v ? 'selected' : ''}>${esc(typeof n === 'string' ? n : n.label)}</option>`).join(''), sel3 = (k, label, o, v) => `<div class="fld"><label for="d3${k}">${label}</label><select id="d3${k}" data-d3="${k}">${opt(o, v)}</select></div>`;
  return `${view === 'v2d' ? '<div class="warn">Switch to Both or 3D (top right) to see these changes.</div>' : ''}
  <h4>Pile and rug body</h4>${sel3('style', 'Pile style', D3.PILE_STYLES, d.style)}
  <div class="fld"><label for="d3pileMm">Pile height: <b id="d3pileMmV">${pm} mm${d.pileMm == null ? ' (from pile type)' : ''}</b></label><input type="range" id="d3pileMm" data-d3="pileMm" data-n="1" min="2" max="30" step="1" value="${pm}" data-live="1"></div>
  ${d.pileMm == null ? '' : '<button class="sb sm" id="d3pileAuto">Use the pile type height</button>'}
  <div class="fld"><label for="d3thickMm">Rug thickness (edge): <b id="d3thickMmV">${d.thickMm} mm</b></label><input type="range" id="d3thickMm" data-d3="thickMm" data-n="1" min="0" max="25" step="1" value="${d.thickMm}" data-live="1"></div>
  ${sel3('mat', 'Yarn look', D3.MATERIALS, d.mat)}
  <p class="note">Edge finish follows Border finish on the right: twill binding shows a dark tape edge, carved lowers the pile at the edge, no border shows the backing. The edge colour is your Backing choice.</p>
  <h4>Light and scene</h4>${sel3('light', 'Lighting', D3.LIGHTS, d.light)}${sel3('scene', 'Scene', { studio: 'Studio (floating)', room: 'Living room at true size' }, d.scene)}
  ${d.scene === 'room' ? sel3('floor', 'Floor', D3.FLOORS, d.floor) + `<label class="chips"><input type="checkbox" id="d3furn" data-d3="furn" ${d.furn ? 'checked' : ''} style="width:auto"> Show sofa, table and plant</label><p class="note">The sofa is 210 cm wide, so you can judge the rug size. A rug over ${Math.round(2 * D3.ROOM.halfW)} cm wide will not fit this room.</p>` : ''}
  <h4>Performance</h4>${sel3('quality', 'Quality', { auto: 'Automatic (lighter on phones)', high: 'High', low: 'Light (older phones)' }, d.quality)}
  <p class="note">These settings change the preview only and are saved with the design. They do not change the price. The yarn look adjusts shine; this is a visual preview, not a physical simulation of loops or yarn.</p>`;
}
function setD3(k, v) { doc.d3 = Object.assign({}, doc.d3 || {}, { [k]: v }); commit(); }
function tLay() {
  const rows = doc.layers.slice().reverse().map(l => `<div class="ly" data-sel="${l.id}" aria-current="${sel === l.id}"><i style="background:${(ym()[l.fill] || { hex: '#444' }).hex}"></i><span>${esc(l.name || L.TYPE_NAMES[l.type])}${l.type === 'text' ? ': ' + esc(l.text) : ''}</span><div class="ac"><button data-lv="${l.id}" aria-label="${l.vis ? 'Hide' : 'Show'}">${l.vis ? '◉' : '○'}</button><button data-ll="${l.id}" aria-label="Lock">${l.lock ? '\u{1F512}' : '\u{1F513}'}</button><button data-lu="${l.id}" aria-label="Move up">↑</button><button data-ld="${l.id}" aria-label="Move down">↓</button><button data-lc="${l.id}" aria-label="Duplicate">⧉</button><button data-lx="${l.id}" aria-label="Delete">✕</button></div></div>`).join('');
  return `${rows || '<p class="note">No layers. Add shapes, text or artwork.</p>'}<p class="note">Top of the list is the front. Drag objects on the canvas to move them; drag the green square to resize.</p>`;
}
function slider(id, label, v, min, max, step, suf) { return `<div class="fld"><label for="${id}">${label}: <b id="${id}V">${suf ? v + suf : v}</b></label><input type="range" id="${id}" min="${min}" max="${max}" step="${step || 1}" value="${v}" data-live="1"></div>`; }
function panelR() {
  const b = $('#stR', root), l = layer(sel), R = rates(); let h = '';
  if (l) {
    h += `<h4>Selected: ${esc(L.TYPE_NAMES[l.type])}</h4><div class="fld"><label for="rName">Name</label><input type="text" id="rName" maxlength="30" value="${esc(l.name || '')}"></div>
    ${slider('rX', 'X position', Math.round(l.cx * 100), -10, 110, 1, '%')}${slider('rY', 'Y position', Math.round(l.cy * 100), -10, 110, 1, '%')}${slider('rW', 'Width', Math.round(l.w * 100), 2, 200, 1, '%')}${slider('rH', 'Height', Math.round(l.h * 100), 2, 200, 1, '%')}${slider('rR', 'Rotation', Math.round(l.rot), -180, 180, 1, '°')}
    <div class="chips"><button class="sb sm" id="rFlip" aria-pressed="${!!l.flip}">Flip</button><button class="sb sm" id="rCol">Pick colour</button><button class="sb sm" id="rDup">Duplicate</button><button class="sb sm bad" id="rDel">Delete</button></div>
    <p class="note">Fill: <b>${esc(yname(l.fill))}</b>${l.stroke ? ' | Outline: <b>' + esc(yname(l.stroke)) + '</b>' : ''}</p>`;
    h += editorPanel(l);
    if (l.type === 'text') h += `<div class="fld"><label for="rTx">Text</label><input type="text" id="rTx" maxlength="40" value="${esc(l.text)}"></div><div class="fld"><label for="rFont">Font</label><select id="rFont">${L.FONTS.map(f => `<option ${l.font === f[0] ? 'selected' : ''}>${f[0]}</option>`).join('')}</select></div><label class="chips"><input type="checkbox" id="rBold" ${l.bold ? 'checked' : ''} style="width:auto"> Bold</label>`;
    if (l.type === 'wave') h += slider('rAmp', 'Wave height', Math.round((l.amp == null ? 0.3 : l.amp) * 100), 5, 100, 1, '%') + slider('rFq', 'Waves', l.freq || 1.5, 0.5, 6, 0.1) + slider('rPh', 'Shift', Math.round((l.phase || 0) * 100), 0, 100, 1, '%');
    if (l.type === 'ellipse') h += `<label class="chips"><input type="checkbox" id="rHol" ${l.hollow ? 'checked' : ''} style="width:auto"> Ring (outline only)</label>`;
    if (l.type === 'image') h += `<div class="fld"><label for="rFit">Fit</label><select id="rFit"><option value="cover" ${l.fit !== 'contain' ? 'selected' : ''}>Fill the box (crop)</option><option value="contain" ${l.fit === 'contain' ? 'selected' : ''}>Show whole image</option></select></div>`;
    if (['rect', 'ellipse', 'poly', 'text'].includes(l.type)) h += slider('rSw', 'Outline width', Math.round((l.sw || 0) * 1000) / 10, 0, 8, 0.1, '%');
  } else h += `<h4>Rug settings</h4><p class="note">Select an object on the canvas to edit it. Choose Size and Colours on the left for the rug itself.</p>`;
  h += `<h4>Material</h4><div class="fld"><label for="mPile">Pile</label><select id="mPile">${Object.entries(R.pileTypes).map(([k, v]) => `<option value="${k}" ${doc.pile === k ? 'selected' : ''}>${esc(v.label)}</option>`).join('')}</select></div>
  <div class="fld"><label for="mBack">Backing</label><select id="mBack">${Object.entries(R.backing).map(([k, v]) => `<option value="${k}" ${doc.backing === k ? 'selected' : ''}>${esc(v.label)}</option>`).join('')}</select></div>
  <div class="fld"><label for="mBord">Border finish</label><select id="mBord">${Object.entries(R.border).map(([k, v]) => `<option value="${k}" ${doc.borderType === k ? 'selected' : ''}>${esc(v.label)}</option>`).join('')}</select></div>
  <label class="chips"><input type="checkbox" id="mFrame" ${doc.frame ? 'checked' : ''} style="width:auto"> Wall piece with black wood frame</label>
  <p class="note">The 3D preview shows pile height and carving depth. It does not simulate individual loop or cut yarn.</p>
  <h4>Estimate</h4><div id="stEst"></div>`;
  b.innerHTML = h; refreshEst();
}
function syncSliders() { const l = layer(sel); if (!l) return; const set = (id, v, s) => { const e = $('#' + id, root); if (e) { e.value = v; const o = $('#' + id + 'V', root); if (o) o.textContent = v + (s || ''); } }; set('rX', Math.round(l.cx * 100), '%'); set('rY', Math.round(l.cy * 100), '%'); set('rW', Math.round(l.w * 100), '%'); set('rH', Math.round(l.h * 100), '%'); set('rR', Math.round(l.rot), '°'); }

/* ---------------------------------------------------------------- actions */
function addLayer(kind, extra) {
  let l; const [t, p] = kind.split(':');
  if (t === 'poly') l = L.layer('poly', { pts: L.POLY[p], name: p[0].toUpperCase() + p.slice(1), w: 0.3, h: 0.3 });
  else if (t === 'text') l = L.layer('text', { text: ($('#stTx', root) || {}).value || 'TEXT', font: ($('#stFont', root) || {}).value || 'Anton', w: 0.6, h: 0.25, name: 'Text' });
  else if (t === 'wave') l = L.layer('wave', { cx: 0.5, cy: 0.7, w: 1, h: 0.5, amp: 0.4, freq: 1.5 });
  else l = L.layer(t, { w: t === 'rect' ? 0.4 : 0.3, h: t === 'rect' ? 0.25 : 0.3 });
  Object.assign(l, extra || {}); const cur = target === 'fill' ? null : null; doc.layers.push(l); sel = l.id; commit();
}
async function upload(file) {
  const er = $('#stErr', root); er.textContent = ''; if (!file) return;
  try { const im = await L.intake(file, XD.settings().maxUploadMb || 8), id = L.uid(); imgs[id] = { el: im.el, data: im.data, name: im.name, w: im.w, h: im.h, file, kind: im.kind };
    const ar = im.w / im.h, dar = doc.widthCm / doc.heightCm; let w = 0.8, h = w / ar * dar; if (h > 0.9) { h = 0.9; w = h * ar / dar; }
    const l = L.layer('image', { img: id, name: im.name.slice(0, 24), w, h, cx: 0.5, cy: 0.5, fit: 'cover' }); doc.layers.push(l); sel = l.id; doc.sepOn = true; commit(); XARO.emit('upload', {}, false); toast('Artwork added. Colour separation is on.');
  } catch (e) { er.textContent = e.message || 'Could not use that file.'; XARO.emit('oops', { why: 'file' }, false); }
}
let szMsg = '';
function setSize(w, h, shape) {
  const er = $('#stSzErr', root); szMsg = ''; if (!(w >= 5 && w <= 600 && h >= 5 && h <= 600)) { szMsg = 'Size must be between ' + fmtLen(5) + ' and ' + fmtLen(600) + ' ' + unit + '.'; if (er) er.textContent = szMsg; return false; }
  const ow = doc.widthCm, oh = doc.heightCm; doc.widthCm = Math.round(w * 10) / 10; doc.heightCm = Math.round(h * 10) / 10; if (shape) doc.shape = shape;
  // keep layers visually in place when the aspect changes: scale h of layers relative to canvas? keep fractions (artwork stretches with the canvas box) but compensate non-image heights
  const k = (ow / oh) / (doc.widthCm / doc.heightCm); doc.layers.forEach(l => { if (l.type !== 'poly' && l.type !== 'ellipse' || true) { l.h = Math.min(3, l.h * k); } });
  commit(); return true;
}
function download(name, blobOrUrl, text) { const a = document.createElement('a'); a.href = text ? URL.createObjectURL(new Blob([text], { type: 'application/json' })) : blobOrUrl; a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
const productionCanvas = long => { let c = L.makeCanvas(doc, long); L.render(doc, c, imgs); const a = L.analyse(doc, imgs); if (a.sepOn) c = L.separate(c, a.list); return c; };
const thumb = (px, q) => { const c = productionCanvas(px), o = document.createElement('canvas'); o.width = c.width; o.height = c.height; const x = o.getContext('2d'); x.fillStyle = '#0b0b0b'; x.fillRect(0, 0, o.width, o.height); x.drawImage(c, 0, 0); return o.toDataURL('image/jpeg', q || 0.8); };
function sheet(title, body, actions, wide) {
  const m = document.createElement('div'); m.className = 'mod'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.innerHTML = `<div class="sheet" ${wide ? 'style="width:min(920px,100%)"' : ''}><button class="sb sm x" aria-label="Close">✕</button><h3>${esc(title)}</h3><div class="mb">${body}</div><div class="chips" style="margin-top:14px;justify-content:flex-end" id="mAct"></div></div>`;
  root.appendChild(m); const close = () => m.remove(); $('.x', m).onclick = close; m.addEventListener('mousedown', e => { if (e.target === m) close(); });
  (actions || []).forEach(a => { const b = document.createElement('button'); b.type = 'button'; b.className = 'sb ' + (a.cls || ''); b.textContent = a.label; b.onclick = () => a.run(close, m); $('#mAct', m).appendChild(b); }); const f = $('input,textarea,select', m); if (f) setTimeout(() => f.focus(), 40); return { m, close };
}
const cloudOn = () => !!(window.XSB && XSB.signedIn() && window.XACCT);
function saveDesign() {
  const s = sheet('Save design', `<div class="fld"><label for="sdN">Design name</label><input type="text" id="sdN" maxlength="40" value="${esc(savedName || 'My rug')}"></div><div class="err" id="sdE" role="alert"></div><p class="note">${cloudOn() ? 'Saved to your XARO account (private) and to this browser.' : 'Saved in this browser only. Sign in (top bar) to keep designs in your account on any device.'}</p>`, [{ label: 'Cancel', run: c => c() }, { label: 'Save', cls: 'pri', run: close => {
    const name = $('#sdN', s.m).value.trim() || 'My rug', usedImgs = {}; doc.layers.forEach(l => { if (l.type === 'image' && imgs[l.img]) usedImgs[l.img] = { name: imgs[l.img].name, data: imgs[l.img].data, w: imgs[l.img].w, h: imgs[l.img].h }; });
    const list = XD.designs().filter(d => d.name !== name); list.unshift({ id: L.uid(), name, at: new Date().toISOString(), doc: JSON.parse(snap()), images: usedImgs, thumb: thumb(200, 0.7) });
    const localOk = XD.saveDesigns(list.slice(0, 20)); if (!localOk && !cloudOn()) { $('#sdE', s.m).textContent = 'Browser storage is full. Delete an old design first.'; return; }
    savedName = name; dirty = false; close();
    if (cloudOn()) { toast('Saving to your account...'); XACCT.save({ name, doc: JSON.parse(snap()), imgs, thumb: thumb(200, 0.7), cloudId }).then(id => { cloudId = id; toast('Saved to your account'); }).catch(e => toast((localOk ? 'Saved on this device only. ' : 'Not saved. ') + (e.message || ''), true)); } else toast('Design saved');
  } }]);
}
function myDesigns() {
  const draw = () => { const l = XD.designs(); $('.mb', s.m).innerHTML = l.length ? l.map(d => `<div class="ly" style="grid-template-columns:70px minmax(0,1fr) auto;cursor:default"><img src="${esc(d.thumb)}" alt="" style="width:70px;border-radius:5px"><span><b>${esc(d.name)}</b><br><small>${esc(new Date(d.at).toLocaleDateString('en-GB'))} | ${d.doc.widthCm} x ${d.doc.heightCm} cm</small></span><div class="chips"><button class="sb sm pri" data-open="${d.id}">Open</button><button class="sb sm bad" data-rm="${d.id}">Delete</button></div></div>`).join('') : '<p class="note">No saved designs yet.</p>';
    $$('[data-open]', s.m).forEach(b => b.onclick = async () => { const d = XD.designs().find(x => x.id === b.dataset.open); if (!d) return; imgs = {}; for (const [id, v] of Object.entries(d.images || {})) { const el = await L.imageFromData(v.data); if (el) imgs[id] = { el, data: v.data, name: v.name, w: v.w, h: v.h }; } newDoc(JSON.parse(JSON.stringify(d.doc))); savedName = d.name; s.close(); toast('Opened ' + d.name); });
    $$('[data-rm]', s.m).forEach(b => b.onclick = () => { if (confirm('Delete this saved design?')) { XD.saveDesigns(XD.designs().filter(x => x.id !== b.dataset.rm)); draw(); } }); };
  const s = sheet('My designs', '', [{ label: 'Close', run: c => c() }]); draw();
  if (cloudOn()) cloudList(s);
}
async function cloudList(s) {
  const box = document.createElement('div'); box.innerHTML = '<h4 style="margin:14px 0 6px">In your account</h4><div class="cl"><p class="note">Loading...</p></div>'; $('.mb', s.m).appendChild(box); const cl = $('.cl', box);
  const draw = async () => { let rows; try { rows = await XACCT.list(); } catch (e) { cl.innerHTML = '<p class="note">' + esc(e.message) + '</p>'; return; }
    cl.innerHTML = rows.length ? rows.map(d => `<div class="ly" style="grid-template-columns:70px minmax(0,1fr) auto;cursor:default">${d._thumb ? `<img src="${esc(d._thumb)}" alt="" style="width:70px;border-radius:5px">` : '<span></span>'}<span><b>${esc(d.name)}</b>${d.status === 'archived' ? ' <small>(archived)</small>' : ''}<br><small>${esc(new Date(d.updated_at).toLocaleDateString('en-GB'))}${d.business_id ? ' | shared with your team' : ''}</small></span><div class="chips"><button class="sb sm pri" data-co="${esc(d.id)}">Open</button><button class="sb sm" data-cd="${esc(d.id)}">Duplicate</button><button class="sb sm bad" data-cr="${esc(d.id)}">Delete</button></div></div>`).join('') : '<p class="note">Nothing saved to your account yet.</p>';
    $$('[data-co]', cl).forEach(b => b.onclick = async () => { try { const o = await XACCT.open(b.dataset.co); imgs = {}; for (const [id, v] of Object.entries(o.images)) { const el = await L.imageFromData(v.data); if (el) imgs[id] = { el, data: v.data, name: v.name, w: v.w, h: v.h }; } newDoc(o.doc); savedName = o.name; cloudId = o.id; s.close(); toast('Opened ' + o.name); } catch (e) { toast(e.message, true); } });
    $$('[data-cd]', cl).forEach(b => b.onclick = async () => { try { await XACCT.duplicate(b.dataset.cd); toast('Duplicated'); draw(); } catch (e) { toast(e.message, true); } });
    $$('[data-cr]', cl).forEach(b => b.onclick = async () => { if (!confirm('Delete this design from your account? This cannot be undone.')) return; try { await XACCT.remove(b.dataset.cr); draw(); } catch (e) { toast(e.message, true); } }); };
  draw();
}
function preview() {
  ensureViewer(); const snapUrl = viewer ? $('#st3', root).toDataURL('image/png') : '', flat = thumb(700, 0.9), e = estimate();
  sheet('Design preview', `<div class="row2"><div><div class="lb">3D view</div>${snapUrl ? `<img src="${snapUrl}" alt="3D preview of your rug">` : '<p class="note">3D not available on this device.</p>'}</div><div><div class="lb">Flat artwork (colour separated)</div><img src="${flat}" alt="Flat artwork"></div></div>
  <p class="note">${doc.widthCm} x ${doc.heightCm} cm | ${esc(doc.shape)} | ${(an || L.analyse(doc, imgs)).colours} yarn colours | ${esc(XCOST.DEFAULT_RATES.pileTypes[doc.pile].label)}${e.cust ? ' | estimate ' + esc(e.cust.text) : ''}</p><p class="note">This is a visual preview, not a physical simulation of yarn. Final colour and pile can vary slightly on a hand-made piece.</p>`,
    [{ label: 'Download 3D view', run: () => snapUrl && download('xaro-rug-3d.png', snapUrl) }, { label: 'Close', cls: 'pri', run: c => c() }], true);
}
function downloadDesign() {
  const c = productionCanvas(2048), nm = 'xaro-rug-' + doc.widthCm + 'x' + doc.heightCm + 'cm'; download(nm + '.png', c.toDataURL('image/png'));
  const meta = { app: 'xaro-studio', v: 1, widthCm: doc.widthCm, heightCm: doc.heightCm, shape: doc.shape, pile: doc.pile, yarns: (an || L.analyse(doc, imgs)).rows.map(r => ({ id: r.yarn.id, name: r.yarn.name, hex: r.yarn.hex, pct: +r.pct.toFixed(1) })), note: 'Estimate only. Original artwork files are kept by the customer.' };
  setTimeout(() => download(nm + '.json', '', JSON.stringify(meta, null, 1)), 300); toast('Downloaded the production artwork (PNG) and colour list (JSON)');
}
function quote() {
  const me = XD.me() || {}, e = estimate(); if (!e.raw.ok) return toast(e.raw.errors.join(' '), true);
  const s = sheet('Request a quotation', `<div class="row2"><div class="fld"><label for="qN">Name</label><input type="text" id="qN" value="${esc(me.name || '')}" maxlength="60"></div><div class="fld"><label for="qE">Email</label><input type="text" id="qE" value="${esc(me.email || '')}" maxlength="80"></div></div><div class="row2"><div class="fld"><label for="qP">Phone</label><input type="text" id="qP" value="${esc(me.phone || '')}" maxlength="24"></div><div class="fld"><label for="qQ">Quantity</label><input type="number" id="qQ" min="1" max="500" value="1"></div></div>
    <div class="fld"><label for="qT">Anything the team should know</label><textarea id="qT" rows="3" maxlength="400" placeholder="Deadline, where it will be used, colours that must match..."></textarea></div>
    <p class="note">${doc.widthCm} x ${doc.heightCm} cm ${esc(doc.shape)} | ${e.raw.colours} yarn colours${e.cust ? ' | estimate ' + esc(e.cust.text) : ''}. This is an estimate; the team sends a confirmed quotation after reviewing your artwork.${doc.layers.some(l => l.type === 'image') ? ' Please send your original artwork file(s) by email or WhatsApp when the team replies: the studio only keeps a reduced copy.' : ''}</p><div class="err" id="qErr" role="alert"></div>`,
    [{ label: 'Cancel', run: c => c() }, { label: 'Send request', cls: 'pri', run: close => {
      const v = id => $('#' + id, s.m).value.trim(), er = $('#qErr', s.m); if (v('qN').length < 2) return er.textContent = 'Enter your name.'; if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v('qE'))) return er.textContent = 'Enter a valid email address.'; const ph = v('qP').replace(/\D/g, ''); if (ph.length < 6) return er.textContent = 'Enter a valid phone number.';
      const cu = XD.upsertCustomer({ name: v('qN'), email: v('qE'), phone: v('qP'), country: XARO.region().country, cur: XARO.region().cur, source: 'quote' }); const art = doc.layers.filter(l => l.type === 'image').map(l => ({ name: imgs[l.img] ? imgs[l.img].name : '', px: imgs[l.img] ? imgs[l.img].w + 'x' + imgs[l.img].h : '' }));
      const q = XD.addQuote({ customerId: cu.id, name: v('qN'), email: v('qE').toLowerCase(), phone: v('qP'), qty: Math.max(1, Math.min(500, +v('qQ') || 1)), message: v('qT'), country: XARO.region().country, cur: XARO.region().cur, doc: JSON.parse(snap()), thumb: thumb(360, 0.75), art, yarns: (an || L.analyse(doc, imgs)).rows.map(r => ({ id: r.yarn.id, name: r.yarn.name, pct: +r.pct.toFixed(1) })), estimate: { customer: e.cust ? e.cust.text : '', sku: e.sku, usd: e.raw.usd, marginPct: e.raw.marginPct, hours: e.raw.hours, colours: e.raw.colours } });
      XD.track('quote'); XD.sync('quote', { id: q.id, name: q.name, email: q.email, phone: q.phone, country: q.country, size: doc.widthCm + 'x' + doc.heightCm, shape: doc.shape, estimate: q.estimate.customer, note: q.message }); XARO.emit('lead', {}, false); close(); sheet('Request sent', `<p>Thank you, ${esc(q.name.split(' ')[0])}. Your reference is <b>${esc(q.id)}</b>. The team will review your design and reply with a confirmed quotation by email or phone.</p>`, [{ label: 'Done', cls: 'pri', run: c => c() }]); dirty = false;
    } }]);
}
function toCart() {
  const sku = catalogSku(), p = XARO.byId()[sku]; if (!p) return toast('Custom products are not available right now.', true);
  if (!doc.layers.length) return toast('Add some artwork or a shape first.', true);
  const note = `Studio design ${doc.widthCm}x${doc.heightCm}cm ${doc.shape}, ${(an || L.analyse(doc, imgs)).colours} yarn colours, ${doc.pile} pile${doc.frame ? ', framed' : ''}. ${doc.notes || ''}`.slice(0, 300);
  XARO.addToCart(sku, { note, file: doc.layers.some(l => l.type === 'image') ? 'studio design (send original artwork by email)' : 'studio design' }); toast('Added the nearest standard product (' + p.name + ') as a deposit. Final size and price are confirmed by the team.'); }

/* ---------------------------------------------------------------- build / events */
function build() {
  root = document.createElement('div'); root.id = 'studio'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'XARO 3D Custom Studio');
  root.innerHTML = `<div class="sh"><img src="${IMG.logoBlock}" alt=""><h2>Custom <span class="neon">Studio</span></h2><span class="sp"></span>
    <button class="sb sm" id="stWork" aria-label="Rug maker workspace" hidden>Workspace</button><button class="sb sm" id="stAcct" aria-label="Account">Sign in</button><button class="sb sm" id="stUnit" aria-label="Switch units">cm</button>
    <button class="sb sm" data-v="vboth" aria-pressed="true">Both</button><button class="sb sm" data-v="v2d" aria-pressed="false">Design</button><button class="sb sm" data-v="v3d" aria-pressed="false">3D</button>
    <button class="sb" id="stClose" aria-label="Close studio">Close</button></div>
  <div class="main"><aside class="pn"><div class="tabs" role="tablist" aria-label="Design tools"></div><div class="pb" id="stL"></div></aside>
    <section class="stage"><div class="views vboth" id="stViews"><div class="v2"><div class="sc"><div class="cw"><canvas id="stC" aria-label="Rug design canvas"></canvas><canvas id="stO" aria-hidden="true"></canvas></div></div><div class="vt" role="toolbar" aria-label="Canvas tools"></div><span class="tag">Design</span></div>
      <div class="v3"><canvas id="st3" data-keep aria-label="Interactive 3D preview of your rug" tabindex="0"></canvas><span class="tag">3D preview | drag to rotate</span><div class="cam"><button class="sb sm" data-cam="angle">Angle</button><button class="sb sm" data-cam="front">Front</button><button class="sb sm" data-cam="top">Top</button><button class="sb sm" data-cam="side">Side</button><button class="sb sm" data-zoom="-1" aria-label="Zoom in">+</button><button class="sb sm" data-zoom="1" aria-label="Zoom out">−</button></div></div></div></section>
    <aside class="pn r"><div class="pb" id="stR"></div></aside></div>
  <div class="tb"><button class="sb" id="stUndo">Undo</button><button class="sb" id="stRedo">Redo</button><button class="sb" id="stReset">Reset</button><span class="sp"></span><button class="sb" id="stSave">Save</button><button class="sb" id="stMine">My designs</button><button class="sb" id="stPrev">Preview</button><button class="sb" id="stDl">Download</button><button class="sb" id="stQuote">Request quotation</button><button class="sb pri" id="stCart">Add to cart</button></div><div class="tt" role="status"></div>`;
  document.body.appendChild(root); bindCanvas(); vtDraw(); root.addEventListener('click', e => { const b = e.target.closest('button'); if (b && (b.dataset.ol || ['olPen', 'olSel', 'olSmooth', 'olSimp'].includes(b.id))) outlineAction(b); else if (b && b.id === 'd3pileAuto') setD3('pileMm', null); else if (b && (b.id === 'stPen' || b.dataset.vt || b.dataset.al || ['rEdit', 'rSimp', 'rSpeck', 'rSplit', 'rMerge'].includes(b.id))) editorClick(b); });
  root.addEventListener('click', e => {
    const t = e.target, c = s => t.closest(s);
    let b;
    if (b = c('[data-lt]')) { ltab = b.dataset.lt; panelL(); }
    else if (b = c('[data-v]')) { view = b.dataset.v; $('#stViews', root).className = 'views ' + view; $$('[data-v]', root).forEach(x => x.setAttribute('aria-pressed', x === b)); setTimeout(() => { fit(); if (view !== 'v2d' && (stale3 || !viewer)) update3D(); }, 30); }
    else if (b = c('[data-cam]')) camPreset(b.dataset.cam);
    else if (b = c('[data-zoom]')) { if (viewer) viewer.dist = Math.max(4.2, Math.min(32, viewer.dist * (1 + 0.15 * +b.dataset.zoom))); }
    else if (b = c('[data-tpl]')) { const tp = L.TEMPLATES.find(x => x.id === b.dataset.tpl); if (tp) { if (doc.layers.length && dirty && !confirm('Replace your current design with this template? You can undo.')) return; doc = L.fromTemplate(tp); sel = ''; commit(); toast(tp.name + ' loaded. Everything is editable.'); if (innerWidth <= 900) { const mn = $('.main', root); if (mn) mn.scrollTop = 0; } } }
    else if (b = c('[data-add]')) addLayer(b.dataset.add);
    else if (b = c('[data-pre]')) { const p = [['rect', 44, 16], ['rect', 32, 12], ['circle', 12, 12], ['rect', 60, 90], ['rect', 90, 90], ['rect', 61, 91]][+b.dataset.pre]; doc.frame = +b.dataset.pre === 5; setSize(p[1], p[2], p[0]); }
    else if (b = c('[data-by]')) { doc.borderYarn = b.dataset.by; commit(); }
    else if (b = c('[data-fam]')) { filt.cat = b.dataset.fam; panelL(); e.stopPropagation(); }
    else if (b = c('[data-y]')) { const id = b.dataset.y, l = layer(sel); if (target === 'bg') doc.bg = id; else if (target === 'border') doc.borderYarn = id; else if (!l) return toast('Select an object first, or apply to Background.', true); else if (target === 'stroke') { l.stroke = id; if (!l.sw) l.sw = 0.015; } else l.fill = id; commit(); }
    else if (b = c('[data-pdel]')) { const p = XD.g('palettes', []); p.splice(+b.dataset.pdel, 1); XD.s('palettes', p); panelL(); }
    else if (b = c('[data-lv]')) { const l = layer(b.dataset.lv); l.vis = !l.vis; commit(); e.stopPropagation(); }
    else if (b = c('[data-ll]')) { const l = layer(b.dataset.ll); l.lock = !l.lock; commit(); e.stopPropagation(); }
    else if (b = c('[data-lu]')) { mv(b.dataset.lu, 1); e.stopPropagation(); }
    else if (b = c('[data-ld]')) { mv(b.dataset.ld, -1); e.stopPropagation(); }
    else if (b = c('[data-lc]')) { dup(b.dataset.lc); e.stopPropagation(); }
    else if (b = c('[data-lx]')) { del(b.dataset.lx); e.stopPropagation(); }
    else if (b = c('[data-sel]')) { sel = b.dataset.sel; panelL(); panelR(); drawOv(); }
  });
  root.addEventListener('input', e => {
    const t = e.target, l = layer(sel), live = id => { const o = $('#' + id + 'V', root); return o; };
    if (t.dataset && t.dataset.d3 && t.dataset.n) { const k = t.dataset.d3; doc.d3 = Object.assign({}, doc.d3 || {}, { [k]: +t.value }); const o = $('#' + t.id + 'V', root); if (o) o.textContent = t.value + ' mm'; changed('live'); return; }
    if (t.id === 'stMax') { doc.maxColours = +t.value; $('#stMaxV', root).textContent = t.value; changed('live'); return; }
    if (t.id === 'stRad') { doc.radius = +t.value; $('#stRadV', root).textContent = t.value + '%'; changed('live'); return; }
    if (t.id === 'stBd') { doc.borderCm = unit === 'cm' ? +t.value : +t.value * IN; $('#stBdV', root).textContent = fmtLen(doc.borderCm) + ' ' + unit; changed('live'); return; }
    if (t.id === 'stCq') { filt.q = t.value; const p = t.selectionStart; panelL(); const n = $('#stCq', root); n.focus(); n.setSelectionRange(p, p); return; }
    if (!l) return; const map = { rX: v => { l.cx = v / 100; }, rY: v => { l.cy = v / 100; }, rW: v => { l.w = v / 100; }, rH: v => { l.h = v / 100; }, rR: v => { l.rot = v; }, rAmp: v => { l.amp = v / 100; }, rFq: v => { l.freq = v; }, rPh: v => { l.phase = v / 100; }, rSw: v => { l.sw = v / 100; } };
    if (map[t.id]) { const v = parseFloat(t.value); map[t.id](v); const o = live(t.id); if (o) o.textContent = t.value + ({ rX: '%', rY: '%', rW: '%', rH: '%', rR: '°', rAmp: '%', rPh: '%', rSw: '%' }[t.id] || ''); draw2D1(); schedule(); }
    if (t.id === 'rTx') { l.text = t.value; draw2D1(); schedule(); }
    if (t.id === 'rName') l.name = t.value;
  });
  root.addEventListener('change', e => {
    const t = e.target, l = layer(sel);
    if (t.id === 'stFile') { upload(t.files[0]); t.value = ''; return; }
    if (t.id === 'stSep') { doc.sepOn = t.checked; commit(); return; }
    if (['stMax', 'stRad', 'stBd'].includes(t.id)) { commit(); return; }
    if (t.id === 'stTc') { filt.tcat = t.value; panelL(); return; }
    if (t.id === 'stCt') { target = t.value; panelL(); return; }
    if (t.id === 'stCc') { filt.cat = t.value; panelL(); return; }
    if (t.dataset && t.dataset.d3) { const k = t.dataset.d3; setD3(k, t.type === 'checkbox' ? t.checked : t.dataset.n ? +t.value : t.value); return; }
    if (t.id === 'stShape') { const v = t.value; if (v === 'custom') { if (!doc.outline) doc.outline = E.presetOutline('blob'); doc.shape = 'custom'; commit(); return; } if (v === 'square' || v === 'circle') setSize(doc.widthCm, doc.widthCm, v); else { doc.shape = v; commit(); } return; }
    if (t.id === 'stW' || t.id === 'stH') { let w = parseLen($('#stW', root).value), h = parseLen($('#stH', root).value); if (doc.shape === 'square' || doc.shape === 'circle') h = w; if (!isFinite(w) || !isFinite(h)) return; if (!setSize(w, h)) { const msg = szMsg; panelL(); const e2 = $('#stSzErr', root); if (e2) e2.textContent = msg; } return; }
    if (t.id === 'mPile') { doc.pile = t.value; commit(); return; } if (t.id === 'mBack') { doc.backing = t.value; commit(); return; } if (t.id === 'mBord') { doc.borderType = t.value; commit(); return; } if (t.id === 'mFrame') { doc.frame = t.checked; commit(); return; }
    if (!l) return;
    if (t.id === 'rFont') { l.font = t.value; commit(); } else if (t.id === 'rBold') { l.bold = t.checked; commit(); } else if (t.id === 'rHol') { l.hollow = t.checked; if (t.checked && !l.sw) l.sw = 0.04; commit(); } else if (t.id === 'rFit') { l.fit = t.value; commit(); }
    else if (['rX', 'rY', 'rW', 'rH', 'rR', 'rAmp', 'rFq', 'rPh', 'rSw', 'rTx', 'rName'].includes(t.id)) commit();
  });
  root.addEventListener('click', e => {
    const id = e.target.id; if (!id) return;
    if (id === 'rFlip') { const l = layer(sel); l.flip = !l.flip; commit(); } else if (id === 'rCol') { target = 'fill'; ltab = 'col'; panelL(); } else if (id === 'rDup') dup(sel); else if (id === 'rDel') del(sel);
    else if (id === 'stRep') { const f = $('#stRf', root).value, tt = $('#stRt', root).value; if (f && f !== tt) { const n = L.replaceYarn(doc, f, tt); if (n) { commit(); toast('Replaced ' + n + ' use' + (n > 1 ? 's' : '')); } else toast('That colour is part of an uploaded image; it changes through colour separation instead.', true); } }
    else if (id === 'stPal') { const name = prompt('Palette name', 'My palette'); if (!name) return; const p = XD.g('palettes', []); p.push({ name: name.slice(0, 30), ids: (an || L.analyse(doc, imgs)).rows.map(r => r.yarn.id) }); XD.s('palettes', p.slice(-12)); panelL(); toast('Palette saved'); }
  });
  const drop = () => $('#stDrop', root); root.addEventListener('dragover', e => { if (e.target.closest('#stDrop')) { e.preventDefault(); drop().classList.add('on'); } }); root.addEventListener('dragleave', e => { if (drop()) drop().classList.remove('on'); }); root.addEventListener('drop', e => { if (e.target.closest('#stDrop')) { e.preventDefault(); upload(e.dataTransfer.files[0]); } });
  $('#stUnit', root).onclick = () => { unit = unit === 'cm' ? 'in' : 'cm'; $('#stUnit', root).textContent = unit; panelL(); };
  $('#stClose', root).onclick = closeStudio; $('#stUndo', root).onclick = () => hi > 0 && restore(hi - 1); $('#stRedo', root).onclick = () => hi < hist.length - 1 && restore(hi + 1);
  $('#stReset', root).onclick = () => { if (confirm('Clear the whole design and start again?')) { imgs = {}; newDoc(L.newDoc()); } };
  if (window.XWS) XWS.mount({ studioRoot: root, toast });
  if (window.XACCT) XACCT.mount({ $: q => $(q, root), sheet, toast, toPng: async im => { const c = document.createElement('canvas'); c.width = im.w; c.height = im.h; c.getContext('2d').drawImage(im.el, 0, 0, im.w, im.h); return c.toDataURL('image/png'); }, blobToDataUrl: b => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); }) });
  $('#stSave', root).onclick = saveDesign; $('#stMine', root).onclick = myDesigns; $('#stPrev', root).onclick = preview; $('#stDl', root).onclick = downloadDesign; $('#stQuote', root).onclick = quote; $('#stCart', root).onclick = toCart;
  addEventListener('keydown', e => {
    if (!root.classList.contains('on')) return; const tag = (e.target.tagName || '').toLowerCase(); if (e.key === 'Escape') { if ($('.mod', root)) { $$('.mod', root).pop().remove(); } else if (pen) cancelPen(); else if (editId) { editId = ''; selNode = null; panelR(); drawOv(); } else closeStudio(); return; }
    if (['input', 'textarea', 'select'].includes(tag)) return; const l = layer(sel);
    if (e.key === ' ' && tag !== 'button') { e.preventDefault(); spaceDown = true; ov().style.cursor = 'grab'; return; }
    if (pen) { if (e.key === 'Enter') { e.preventDefault(); finishPen(); } else if (e.key === 'Backspace') { e.preventDefault(); pen.pts.pop(); drawOv(); vtDraw(); } return; }
    if (editing() && selNode && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); delNode(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? hi < hist.length - 1 && restore(hi + 1) : hi > 0 && restore(hi - 1); } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); hi < hist.length - 1 && restore(hi + 1); }
    else if (l && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); del(l.id); } else if (l && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); dup(l.id); }
    else if (l && e.key.startsWith('Arrow') && !l.lock) { e.preventDefault(); const s = e.shiftKey ? 0.02 : 0.005; if (e.key === 'ArrowLeft') l.cx -= s; if (e.key === 'ArrowRight') l.cx += s; if (e.key === 'ArrowUp') l.cy -= s; if (e.key === 'ArrowDown') l.cy += s; commit(); }
  });
  addEventListener('keyup', e => { if (e.key === ' ') { spaceDown = false; if (ov()) ov().style.cursor = ''; } });
  new ResizeObserver(() => fit()).observe($('.stage', root)); addEventListener('resize', () => fit());
}
function mv(id, dir) { const i = doc.layers.findIndex(l => l.id === id), j = i + dir; if (i < 0 || j < 0 || j >= doc.layers.length) return; const [l] = doc.layers.splice(i, 1); doc.layers.splice(j, 0, l); commit(); }
function dup(id) { const l = layer(id); if (!l) return; const c = JSON.parse(JSON.stringify(l)); c.id = L.uid(); c.cx += 0.04; c.cy += 0.04; c.name = (l.name || L.TYPE_NAMES[l.type]) + ' copy'; doc.layers.splice(doc.layers.indexOf(l) + 1, 0, c); sel = c.id; commit(); }
function del(id) { doc.layers = doc.layers.filter(l => l.id !== id); if (sel === id) sel = ''; commit(); }

/* ---------------------------------------------------------------- open / close */
function openStudio(opts) {
  if (!root) { build(); newDoc(L.newDoc({ layers: [] })); }
  root.classList.add('on'); document.body.classList.add('studio-open'); if (location.hash !== '#studio') { try { history.replaceState(null, '', '#studio'); } catch (e) {} }
  if (!hist.length) newDoc(L.newDoc()); if (!view) view = innerWidth >= 1180 ? 'vboth' : 'v2d'; $('#stViews', root).className = 'views ' + view; $$('[data-v]', root).forEach(x => x.setAttribute('aria-pressed', x.dataset.v === view));
  if (opts && opts.tpl) { const tp = L.TEMPLATES.find(t => t.id === opts.tpl); if (tp) { doc = L.fromTemplate(tp); commit(); } }
  panelL(); panelR(); draw2D(); setTimeout(() => { fit(); update3D(); camPreset('angle'); }, 60); XD.track('studio'); XARO.emit('studio', {}, false); $('#stClose', root).focus();
}
function closeStudio() { if (dirty && doc.layers.length && !confirm('Close the studio? Unsaved changes will be lost. Use Save to keep this design.')) return; root.classList.remove('on'); document.body.classList.remove('studio-open'); if (location.hash === '#studio') { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { location.hash = ''; } } }
/* hooks used by the rug-maker workspace: load a design into the editor, read the current one */
function loadDoc(d, o) { o = o || {}; openStudio(); imgs = {}; Object.entries(o.images || {}).forEach(([k, v]) => { if (v && v.el) imgs[k] = v; }); newDoc(JSON.parse(JSON.stringify(d))); savedName = o.name || ''; cloudId = o.cloudId || ''; if (o.view) { view = o.view; $('#stViews', root).className = 'views ' + view; $$('[data-v]', root).forEach(x => x.setAttribute('aria-pressed', x.dataset.v === view)); setTimeout(() => { fit(); update3D(); }, 60); } }
window.XSTUDIO = { viewer: () => viewer, open: openStudio, close: closeStudio, loadDoc, getDoc: () => ({ doc: JSON.parse(JSON.stringify(doc)), imgs, name: savedName, cloudId }), setCloudId: id => { cloudId = id || ''; } };
document.addEventListener('click', e => { const b = e.target.closest('[data-open-studio]'); if (b) { e.preventDefault(); openStudio(); } });
addEventListener('hashchange', () => { if (location.hash === '#studio') openStudio(); });
if (location.hash === '#studio') setTimeout(openStudio, 400);
})();
