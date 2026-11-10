/* ============ Workspace: Image to Vector, Colour Separation, 3D Preview entry ============ */
(function (root) {
'use strict';
const WS = root.XWS, H = WS.h, W = root.XWORK, { esc, field, val, dlg, download, empty, sw, db, toast, guard } = H;
const L = () => root.XSTUDIO_LIB, C = () => root.XCOLOUR, V = () => root.XVEC;
const handoff = { palette: null, canvas: null, name: '' };   // passed from Colour Separation to Image to Vector

/* before / after comparison: `after` is clipped by a slider, so both images stay perfectly aligned */
H.baSlider = (box, before, after) => {
  box.className = 'xw-view xw-ba'; box.innerHTML = ''; const a = document.createElement('div'); a.className = 'after'; a.appendChild(after); box.appendChild(before); box.appendChild(a);
  const bar = document.createElement('div'); bar.className = 'bar'; const r = document.createElement('input'); r.type = 'range'; r.min = 0; r.max = 100; r.value = 50; r.setAttribute('aria-label', 'Before and after slider'); box.appendChild(bar); box.appendChild(r);
  const set = p => { a.style.clipPath = 'inset(0 ' + (100 - p) + '% 0 0)'; bar.style.left = p + '%'; }; r.oninput = () => set(+r.value); set(50);
};
const readImage = async file => { const im = await L().intake(file, 8), c = document.createElement('canvas'), s = Math.min(1, 1200 / Math.max(im.el.width, im.el.height)); c.width = Math.max(1, Math.round(im.el.width * s)); c.height = Math.max(1, Math.round(im.el.height * s)); c.getContext('2d', { willReadFrequently: true }).drawImage(im.el, 0, 0, c.width, c.height); return { canvas: c, name: im.name }; };
const canvasToImg = c => { const i = new Image(); i.src = c.toDataURL('image/png'); i.alt = ''; return i; };
const dropZone = (id, label) => `<label class="xw-drop" id="${id}Z" for="${id}">${esc(label)}<input type="file" id="${id}" accept="image/png,image/jpeg,image/webp,image/svg+xml,.svg" hidden></label>`;
const wireDrop = (b, id, fn) => { const z = b.querySelector('#' + id + 'Z'); if (!z) return; b.querySelector('#' + id).onchange = guard(async e => { const f = e.target.files[0]; if (f) await fn(f); e.target.value = ''; }); z.addEventListener('dragover', e => { e.preventDefault(); z.classList.add('on'); }); z.addEventListener('dragleave', () => z.classList.remove('on')); z.addEventListener('drop', guard(async e => { e.preventDefault(); z.classList.remove('on'); if (e.dataTransfer.files[0]) await fn(e.dataTransfer.files[0]); })); };

/* ---------------------------------------------------------------- Image to Vector */
const LEVEL_NAMES = ['', 'Most detail', 'Detailed', 'Balanced', 'Simple', 'Simplest'];
WS.register('vector', 'Image to Vector', async (b) => {
  let src = handoff.canvas, name = handoff.name || '', res = null, level = 2, colours = 8, bg = '', pal = handoff.palette; handoff.canvas = null; handoff.palette = null;
  const run = async () => {
    if (!src) return; const out = b.querySelector('#vOut'); out.innerHTML = '<p class="xw-note" role="status">Vectorising...</p>'; await new Promise(r => setTimeout(r, 30));
    const id = src.getContext('2d').getImageData(0, 0, src.width, src.height), t0 = performance.now();
    res = V().vectorize({ width: id.width, height: id.height, data: id.data }, { level, colours: pal ? 0 : colours, palette: pal || undefined, background: bg || undefined, method: 'tufting' }); res.ms = Math.round(performance.now() - t0); show();
  };
  const show = () => {
    const out = b.querySelector('#vOut'); if (!res) { out.innerHTML = ''; return; }
    out.innerHTML = `<div id="vBA"></div><p class="xw-note">${res.stats.colours} colours | ${res.stats.shapes} shapes | ${res.stats.points} points | ${res.ms} ms. Drag the slider to compare with the original.</p>
    <h3 style="margin-top:12px">Colours</h3><div class="xw-pal">${res.shapes.map((s, i) => { const tot = res.shapes.reduce((a, x) => a + x.area, 0) || 1; return `<div class="xw-prow" data-i="${i}">${sw(s.fill)}<span><b>${esc(s.fill)}</b><small>${(s.area / tot * 100).toFixed(1)}% of the area | ${s.points} points</small></span><span class="xw-chips"><input type="color" data-rc value="${esc(s.fill.toLowerCase())}" aria-label="Recolour ${esc(s.fill)}" style="width:34px;padding:1px;height:28px"><select data-mg aria-label="Merge ${esc(s.fill)} into"><option value="">Merge into...</option>${res.shapes.filter((_, k) => k !== i).map(o => `<option value="${esc(o.fill)}">${esc(o.fill)}</option>`).join('')}</select><button class="xw-b sm bad" data-rm="${i}">Remove</button></span></div>`; }).join('')}</div>
    <div class="xw-bar" style="margin-top:12px"><button class="xw-b" id="vSvg">Download SVG</button><button class="xw-b pri" id="vSend">Send to design editor</button></div>`;
    const before = canvasToImg(src), after = new Image(); after.alt = ''; after.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(V().toSvg(res, { scale: 1 })); H.baSlider(out.querySelector('#vBA'), before, after);
  };
  b.innerHTML = `<div class="xw-split"><div>${dropZone('vFile', 'Drop a PNG, JPG, WebP or SVG here, or click to choose (max 8 MB)')}<div id="vView" style="margin-top:12px"></div><div id="vOut"></div></div>
  <section class="xw-sec"><h3>Settings</h3><div class="xw-f"><label for="vLv">Simplification: <b id="vLvN">${LEVEL_NAMES[level]}</b></label><input type="range" id="vLv" min="1" max="5" value="${level}"><small>Low = keeps small details. High = fewer, smoother shapes that are easier to tuft. Details and small accent colours are kept, up to the number of yarn colours you choose.</small></div>
  ${field('vCol', 'Number of colours', String(colours), { type: 'select', options: [['0', 'Automatic'], ...[2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24].map(n => [String(n), String(n)])] })}
  <div class="xw-f"><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="vBgOn" style="width:auto"> Leave one background colour out</label><input type="color" id="vBg" value="#ffffff" style="width:60px;height:34px;padding:2px" disabled></div>
  <p class="xw-note" id="vPal">${pal ? 'Using the ' + pal.length + ' colours from Colour Separation.' : ''}</p><button class="xw-b pri" id="vGo" disabled>Vectorise</button></section></div>`;
  const setSrc = (c, n) => { src = c; name = n; res = null; b.querySelector('#vView').innerHTML = ''; b.querySelector('#vGo').disabled = false; b.querySelector('#vOut').innerHTML = '<p class="xw-note">Image loaded (' + c.width + ' x ' + c.height + ' px). Adjust the settings, then press Vectorise.</p>'; };
  wireDrop(b, 'vFile', async f => { const r = await readImage(f); pal = null; b.querySelector('#vPal').textContent = ''; setSrc(r.canvas, r.name); await run(); });
  b.querySelector('#vLv').oninput = e => { level = +e.target.value; b.querySelector('#vLvN').textContent = LEVEL_NAMES[level]; };
  b.querySelector('#vCol').onchange = e => { colours = +e.target.value; };
  b.querySelector('#vBgOn').onchange = e => { b.querySelector('#vBg').disabled = !e.target.checked; bg = e.target.checked ? b.querySelector('#vBg').value.toUpperCase() : ''; }; b.querySelector('#vBg').oninput = e => { if (!e.target.disabled) bg = e.target.value.toUpperCase(); };
  b.querySelector('#vGo').onclick = guard(run);
  b.addEventListener('input', guard(async e => { const t = e.target; if (!res || !t.matches('[data-rc]')) return; const i = +t.closest('[data-i]').dataset.i; res = V().recolour(res, res.shapes[i].fill, t.value.toUpperCase()); show(); }), true);
  b.addEventListener('change', guard(async e => { const t = e.target; if (!res || !t.matches('[data-mg]') || !t.value) return; const i = +t.closest('[data-i]').dataset.i; res = V().mergeColours(res, res.shapes[i].fill, t.value); show(); toast('Merged'); }));
  b.addEventListener('click', guard(async e => {
    const t = e.target; if (t.dataset.rm !== undefined && res) { res = V().removeShape(res, +t.dataset.rm); show(); }
    else if (t.id === 'vSvg') download(H.safeName(name.replace(/\.[^.]+$/, '')) + '-vector.svg', V().toSvg(res, { scale: 1 }), 'image/svg+xml');
    else if (t.id === 'vSend') {
      const ar = res.width / res.height, d = dlg('Send to design editor', `<div class="xw-form">${field('sW', 'Rug width (cm)', 100, { type: 'number', min: 5, step: 'any' })}${field('sH', 'Rug height (cm)', Math.round(100 / ar * 10) / 10, { type: 'number', min: 5, step: 'any', hint: 'Keeps the artwork proportions unless you change it.' })}</div><p class="xw-note">Each colour becomes an editable vector layer, snapped to the nearest yarn in ${H.yarns().length ? 'your yarn library' : 'the XARO yarn range'}. The largest colour becomes the rug background.</p><p class="xw-err" id="sE" role="alert"></p>`,
        [{ label: 'Cancel', run: c => c() }, { label: 'Open in editor', cls: 'pri', run: c => { const w = +val('sW', d.m), h = +val('sH', d.m); if (!(w >= 5 && h >= 5 && w <= 600 && h <= 600)) { d.m.querySelector('#sE').textContent = 'Width and height must be between 5 and 600 cm.'; return; }
          H.applyYarnSource(true); const Lb = L(), specs = V().layerSpecs(res), big = res.shapes.reduce((m, s, i) => s.area > res.shapes[m].area ? i : m, 0), doc = Lb.newDoc({ widthCm: w, heightCm: h, bg: Lb.snapHex(res.shapes[big].fill) });
          specs.forEach((s, i) => { if (i === big && res.shapes.length > 1) return; doc.layers.push(Lb.layer('path', { name: s.name, cx: 0.5, cy: 0.5, w: 1, h: 1, fill: Lb.snapHex(s.hex), d: s.d, lock: false })); }); Lb.stampYarns(doc); c(); WS.close(); XSTUDIO.loadDoc(doc, { name: (name.replace(/\.[^.]+$/, '') || 'Vector artwork').slice(0, 40) }); } }]);
    }
  }));
  if (src) { setSrc(src, name); b.querySelector('#vGo').disabled = false; await run(); }
}, 'Turn a logo, drawing or photo into clean, tuftable vector shapes with a limited number of colours.');

/* ---------------------------------------------------------------- Colour Separation */
const TARGETS = [['0', 'Original colours'], ['20', '20'], ['15', '15'], ['12', '12'], ['10', '10'], ['8', '8'], ['6', '6'], ['4', '4'], ['custom', 'Custom']];
WS.register('colour', 'Colour Separation', async (b) => {
  let src = null, name = '', pal = null, red = null, target = '8', custom = 8, locked = new Set(), wCm = 100, hCm = 100;
  const rep = c => c.members.map(id => pal.colours.find(o => o.id === id)).sort((a, z) => z.n - a.n)[0].id;
  const reduce = () => { if (target === '0') { const t = pal.colours.length; red = C().reduce(pal, t, []); } else red = C().reduce(pal, target === 'custom' ? custom : +target, [...locked]); };
  const lockedFlags = () => red.colours.forEach(c => { c.locked = c.members.some(m => locked.has(m)); });
  const draw = () => {
    const out = b.querySelector('#cOut'); if (!pal) { out.innerHTML = ''; return; }
    const yarns = H.yarns(), area = wCm * hCm, map = C().mapYarns(red, yarns, area), id = src.getContext('2d').getImageData(0, 0, src.width, src.height), data = C().remap(id.data, pal, red), o = document.createElement('canvas'); o.width = src.width; o.height = src.height; o.getContext('2d').putImageData(new ImageData(data, src.width, src.height), 0, 0); out._canvas = o;
    out.innerHTML = `<div id="cBA"></div><p class="xw-note">Original: <b>${pal.colours.length}</b> visibly different colours. Now: <b>${red.colours.length}</b>.</p>
    <div class="xw-tw"><table class="xw-t"><thead><tr><th></th><th>Colour</th><th class="num">Share</th><th class="num">Area cm2</th><th>Nearest yarn</th><th>Lock</th><th>Replace</th><th>Merge</th></tr></thead><tbody>${map.map((m, i) => { const c = red.colours[i]; return `<tr data-c="${esc(c.id)}"><td>${sw(m.hex)}</td><td>${esc(m.hex)}</td><td class="num">${m.pct.toFixed(1)}%</td><td class="num">${m.areaCm2 == null ? '-' : Math.round(m.areaCm2)}</td><td>${m.yarn ? sw(m.yarn.hex) + ' ' + esc(m.yarn.code || m.yarn.name) + ' <small>(' + esc(C().describeDelta(m.deltaE)) + ', dE ' + m.deltaE.toFixed(1) + ')</small>' : '<small>add yarns to map</small>'}</td><td><input type="checkbox" data-lock style="width:auto"${c.locked ? ' checked' : ''} aria-label="Lock ${esc(m.hex)}"></td><td><input type="color" data-rep value="${esc(m.hex.toLowerCase())}" style="width:34px;padding:1px;height:28px" aria-label="Replace ${esc(m.hex)}"></td><td><select data-mrg aria-label="Merge ${esc(m.hex)} into"><option value="">...</option>${red.colours.filter(x => x.id !== c.id).map(x => `<option value="${esc(x.id)}">${esc(x.hex)}</option>`).join('')}</select></td></tr>`; }).join('')}</tbody></table></div>
    <div class="xw-bar" style="margin-top:12px"><button class="xw-b" id="cPng">Download separated PNG</button><button class="xw-b" id="cCsv">Export colour/yarn mapping CSV</button><button class="xw-b pri" id="cVec">Vectorise with these colours</button></div>`;
    const before = canvasToImg(src), after = canvasToImg(o); H.baSlider(out.querySelector('#cBA'), before, after); out._map = map;
  };
  b.innerHTML = `<div class="xw-split"><div>${dropZone('cFile', 'Drop a PNG, JPG, WebP or SVG here, or click to choose (max 8 MB)')}<div id="cOut" style="margin-top:12px"></div></div>
  <section class="xw-sec"><h3>Settings</h3>${field('cT', 'Reduce to', '8', { type: 'select', options: TARGETS })}<div class="xw-f" id="cCw" hidden><label for="cN">Custom number of colours (1 to 64)</label><input type="number" id="cN" min="1" max="64" value="8"></div>
  <div class="xw-form">${field('cWi', 'Rug width (cm)', 100, { type: 'number', min: 5, step: 'any' })}${field('cHi', 'Rug height (cm)', 100, { type: 'number', min: 5, step: 'any' })}</div><p class="xw-note">Colours are grouped by how different they look to the eye (CIEDE2000), not by raw RGB. Locked colours never change and may absorb similar ones. Width and height give the area per colour.</p></section></div>`;
  const rebuild = guard(async () => { reduce(); lockedFlags(); draw(); });
  wireDrop(b, 'cFile', async f => { const r = await readImage(f); src = r.canvas; name = r.name; const id = src.getContext('2d').getImageData(0, 0, src.width, src.height); pal = C().extract(id.data, { tol: 3, max: 64 }); if (!pal.colours.length) throw new Error('That image has no visible pixels.'); locked = new Set(); const ar = src.width / src.height; b.querySelector('#cHi').value = Math.round(wCm / ar * 10) / 10; hCm = +b.querySelector('#cHi').value; await rebuild(); });
  b.addEventListener('change', guard(async e => { const t = e.target;
    if (t.id === 'cT') { target = t.value; b.querySelector('#cCw').hidden = target !== 'custom'; if (pal) await rebuild(); }
    else if (t.id === 'cN') { custom = Math.min(64, Math.max(1, +t.value || 1)); t.value = custom; if (pal) await rebuild(); }
    else if (t.id === 'cWi' || t.id === 'cHi') { wCm = +b.querySelector('#cWi').value || 100; hCm = +b.querySelector('#cHi').value || 100; if (pal) draw(); }
    else if (t.matches('[data-lock]')) { const c = red.colours.find(x => x.id === t.closest('[data-c]').dataset.c); if (t.checked) locked.add(rep(c)); else c.members.forEach(m => locked.delete(m)); await rebuild(); }
    else if (t.matches('[data-mrg]') && t.value) { red = C().merge(red, t.closest('[data-c]').dataset.c, t.value); draw(); toast('Merged'); }
  }));
  b.addEventListener('input', guard(async e => { const t = e.target; if (t.matches('[data-rep]')) { C().replace(red, t.closest('[data-c]').dataset.c, t.value); draw(); } }), true);
  b.addEventListener('click', guard(async e => { const t = e.target, out = b.querySelector('#cOut');
    if (t.id === 'cPng') out._canvas.toBlob(bl => download(H.safeName(name.replace(/\.[^.]+$/, '')) + '-separated.png', bl), 'image/png');
    else if (t.id === 'cCsv') download('xaro-colour-mapping.csv', W.csvStringify([['colour', 'share_pct', 'area_cm2', 'nearest_yarn_code', 'yarn_name', 'delta_e', 'match']].concat(out._map.map(m => [m.hex, +m.pct.toFixed(2), m.areaCm2 == null ? '' : Math.round(m.areaCm2), m.yarn ? (m.yarn.code || '') : '', m.yarn ? m.yarn.name : '', m.deltaE == null ? '' : +m.deltaE.toFixed(2), C().describeDelta(m.deltaE)]))), 'text/csv');
    else if (t.id === 'cVec') { handoff.canvas = src; handoff.palette = red.colours.map(c => c.hex); handoff.name = name; await WS.open('vector'); }
  }));
}, 'Reduce an image to a limited colour set, see the share and area of each colour, and match them to your yarns.');

/* ---------------------------------------------------------------- 3D Preview entry */
WS.register('preview3d', '3D Preview', async (b) => {
  const designs = await db.sel('custom_designs', { select: 'id,name,status,doc->_thumb', order: 'updated_at.desc', limit: 200 }), live = designs.filter(d => d.status !== 'archived');
  b.innerHTML = live.length ? `<p class="xw-note">Pick a design to see it as a tufted rug in 3D: choose the shape, thickness, pile height and edge finish in the editor, then drag to rotate.</p><div class="xw-grid3">${live.map(d => `<button class="xw-dcard" data-d="${esc(d.id)}">${d._thumb ? `<img src="${esc(d._thumb)}" alt="">` : '<div class="xw-ph"></div>'}<b>${esc(d.name)}</b><small>Open in 3D</small></button>`).join('')}</div>` : empty('No designs yet. Save a design in the Studio first.');
  b.addEventListener('click', guard(async e => { const x = e.target.closest('[data-d]'); if (x) await H.loadDesignIntoStudio(x.dataset.d, 'v3d'); }));
});

})(typeof window !== 'undefined' ? window : globalThis);
