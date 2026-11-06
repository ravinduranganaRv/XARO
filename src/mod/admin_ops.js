/* ============ admin: costing rates, yarn library, studio quotations ============ */
(() => {
'use strict';
const A = window.XADM, { $, $$, esc, modal, toast, dt, csv, money } = A;
const num = (v, d) => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : d; };

/* ---------------------------------------------------------------- costing */
const FIELDS = [
  ['Labour', [['labourRateUSD', 'Labour rate (US$ per hour)'], ['hoursFixed', 'Fixed hours per piece (setup, finishing)'], ['hoursPerM2', 'Tufting hours per m²'], ['hoursPerExtraColourPct', 'Extra hours per colour beyond the free ones (0.04 = 4%)'], ['colourFreeCount', 'Colours included at no extra time']]],
  ['Packaging', [['packagingFixed', 'Packaging per piece (US$)'], ['packagingPerM2', 'Packaging per m² (US$)']]],
  ['Business', [['targetMarginPct', 'Target margin on the selling price (0.30 = 30%)']]]
];
A.reg('costing', 'Costing', '∑', 'pricing', box => {
  const R0 = () => XCOST.mergeRates(XCOST.DEFAULT_RATES, XD.costRates());
  const draw = () => {
    const R = R0(), sample = XCOST.estimate({ widthCm: 44, heightCm: 16, colours: 4, pile: 'standard', backing: 'felt', border: 'none', dest: 'export', currency: 'USD' }, R), sampleL = XCOST.estimate({ widthCm: 44, heightCm: 16, colours: 4, pile: 'standard', backing: 'felt', border: 'none', dest: 'local', currency: 'LKR' }, R);
    const tbl = (key, cols) => `<div class="tw"><table class="t" style="min-width:0"><thead><tr><th>Option</th>${cols.map(c => `<th class="num">${c[1]}</th>`).join('')}</tr></thead><tbody>${Object.entries(R[key]).map(([k, v]) => `<tr><td>${esc(v.label || k)}</td>${cols.map(c => `<td class="num"><input class="inp" style="width:90px;text-align:right" inputmode="decimal" data-k="${key}.${k}.${c[0]}" value="${v[c[0]] == null ? '' : v[c[0]]}" aria-label="${esc((v.label || k) + ' ' + c[1])}"></td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    box.innerHTML = `<div class="note" style="margin:0 0 12px">These rates drive the studio estimate and every quotation. The defaults are <b>placeholders</b> taken from the project plan: replace them with your measured costs. Estimates are not quotations; you confirm each price by hand.</div>
    <div class="grid2"><div class="pan"><h3>General rates</h3>${FIELDS.map(([t, fs]) => `<h4 style="margin:12px 0 6px;font-family:var(--mono);font-size:11px;color:var(--mute);text-transform:uppercase;letter-spacing:.08em">${t}</h4><div class="pgrid">${fs.map(([k, l]) => `<div class="field"><label for="c_${k}">${l}</label><input class="inp" id="c_${k}" data-k="${k}" inputmode="decimal" value="${R[k]}"></div>`).join('')}</div>`).join('')}
      <h4 style="margin:12px 0 6px;font-family:var(--mono);font-size:11px;color:var(--mute);text-transform:uppercase;letter-spacing:.08em">Fees and duty (local / export)</h4><div class="pgrid">
      ${[['dutyPct', 'Import duty (0.15 = 15%)'], ['gatewayPct', 'Payment gateway %'], ['gatewayFixed', 'Gateway fixed fee (US$)'], ['platformPct', 'Platform fee %']].map(([k, l]) => ['local', 'export'].map(z => `<div class="field"><label for="c_${k}_${z}">${l} - ${z}</label><input class="inp" id="c_${k}_${z}" data-k="${k}.${z}" inputmode="decimal" value="${R[k][z]}"></div>`).join('')).join('')}</div>
      <h4 style="margin:12px 0 6px;font-family:var(--mono);font-size:11px;color:var(--mute);text-transform:uppercase;letter-spacing:.08em">Frame and rush</h4><div class="pgrid">
      <div class="field"><label for="c_ff">Frame flat cost (US$)</label><input class="inp" id="c_ff" data-k="finishing.frame.flat" inputmode="decimal" value="${R.finishing.frame.flat}"></div><div class="field"><label for="c_fm">Frame per m² (US$)</label><input class="inp" id="c_fm" data-k="finishing.frame.perM2" inputmode="decimal" value="${R.finishing.frame.perM2}"></div><div class="field"><label for="c_rp">Rush surcharge (0.15 = 15%)</label><input class="inp" id="c_rp" data-k="finishing.rush.pct" inputmode="decimal" value="${R.finishing.rush.pct}"></div></div></div>
    <div class="pan"><h3>Materials per m² (US$) and time multiplier</h3>${tbl('pileTypes', [['matPerM2', 'Yarn US$/m²'], ['hoursMul', 'Time ×']])}
      <h3 style="margin-top:16px">Backing (US$ per m²)</h3>${tbl('backing', [['perM2', 'US$/m²']])}
      <h3 style="margin-top:16px">Border (US$ per metre)</h3>${tbl('border', [['perM', 'US$/m'], ['hoursPerM', 'Hours/m']])}
      <h3 style="margin-top:16px">Yarn used (kg per m²)</h3><p class="note" style="margin:0 0 6px">Leave blank until you have weighed real pieces. Nothing is guessed.</p><div class="pgrid">${Object.keys(R.yarnKgPerM2).map(k => `<div class="field"><label for="c_y${k}">${esc(R.pileTypes[k].label)}</label><input class="inp" id="c_y${k}" data-k="yarnKgPerM2.${k}" inputmode="decimal" placeholder="not set" value="${R.yarnKgPerM2[k] == null ? '' : R.yarnKgPerM2[k]}"></div>`).join('')}</div></div></div>
    <div class="pan" style="margin-bottom:14px"><h3>Shipping bands (cost for pieces up to this area in m²)</h3><div class="grid2">${['local', 'export'].map(z => `<div><b>${esc(R.shipping[z].label)}</b>${R.shipping[z].bands.map((b, i) => `<div class="f2a" style="margin-top:6px"><div class="field" style="margin:0"><label for="s_${z}${i}a">Up to m²</label><input class="inp" id="s_${z}${i}a" data-b="${z}.${i}.0" inputmode="decimal" value="${b[0]}"></div><div class="field" style="margin:0"><label for="s_${z}${i}b">Cost US$</label><input class="inp" id="s_${z}${i}b" data-b="${z}.${i}.1" inputmode="decimal" value="${b[1]}"></div></div>`).join('')}</div>`).join('')}</div></div>
    <div class="pan"><h3>Check: 44 x 16 cm keyboard rug, 4 colours, felt back</h3><div class="pgrid">${[['Export', sample, 'USD'], ['Within Sri Lanka', sampleL, 'LKR']].map(([n, e, c]) => e.ok ? `<div><b>${n}</b><br>Cost (materials, labour, packaging, shipping, fees): <b>US$ ${e.usd.cost.toFixed(2)}</b><br>Selling price at the target margin: <b>US$ ${e.usd.sell.toFixed(2)}</b> (about ${money(e.local ? e.local.sell : e.usd.sell, c)})<br>Hours: ${e.hours.toFixed(2)}</div>` : `<div>${esc((e.errors || []).join(' '))}</div>`).join('')}</div></div>
    <p style="margin:14px 0 0"><button class="b2 pri" id="cSave">Save rates</button> <button class="b2" id="cReset">Reset to project-plan defaults</button></p>`;
    $('#cSave').onclick = save; $('#cReset').onclick = () => { if (confirm('Reset all costing rates to the defaults?')) { XD.setCostRates(null); draw(); toast('Rates reset'); } };
  };
  const save = () => {
    const R = R0(); let bad = '';
    $$('[data-k]', box).forEach(e => { const path = e.dataset.k.split('.'), raw = e.value.trim(); let o = R; for (let i = 0; i < path.length - 1; i++) o = o[path[i]]; const last = path[path.length - 1];
      if (raw === '' && path[0] === 'yarnKgPerM2') { o[last] = null; return; } if (raw === '' && o[last] === undefined) return; const n = num(raw, NaN); if (!isFinite(n) || n < 0) { bad = bad || 'Enter a number (0 or more) for: ' + (e.getAttribute('aria-label') || e.previousElementSibling.textContent); return; } o[last] = n; });
    $$('[data-b]', box).forEach(e => { const [z, i, j] = e.dataset.b.split('.'), n = num(e.value, NaN); if (!isFinite(n) || n < 0) { bad = bad || 'Shipping bands need numbers.'; return; } R.shipping[z].bands[+i][+j] = n; });
    for (const z of ['local', 'export']) { const b = R.shipping[z].bands; for (let i = 1; i < b.length; i++) if (b[i][0] < b[i - 1][0]) bad = bad || 'Shipping band limits must go up (' + z + ').'; }
    if (!bad && R.targetMarginPct + R.gatewayPct.export + R.platformPct.export >= 0.95) bad = 'Margin plus fees must stay below 95%.';
    if (!bad && R.targetMarginPct + R.gatewayPct.local + R.platformPct.local >= 0.95) bad = 'Margin plus fees must stay below 95% (local).';
    if (bad) return toast(bad, true);
    XD.setCostRates(R); draw(); toast('Costing rates saved'); XD.sync && XD.sync('audit', { what: 'costing rates changed', by: (A.me() || {}).username });
  };
  draw();
});

/* ---------------------------------------------------------------- yarn library */
const AVAIL = [['unknown', 'Not set'], ['in-stock', 'In stock'], ['low', 'Low stock'], ['out', 'Out of stock'], ['discontinued', 'Discontinued']];
A.reg('yarns', 'Yarn library', '◍', 'products', box => {
  let q = '';
  const hexOk = h => /^#[0-9a-fA-F]{6}$/.test(h);
  const draw = () => {
    const all = XD.yarns(), l = all.filter(y => !q || (y.name + y.id + y.hex).toLowerCase().includes(q.toLowerCase()));
    box.innerHTML = `<div class="note" style="margin:0 0 12px">These are the colours customers can pick in the studio. The starter list is <b>approximate screen colours</b>, not matched to a physical yarn card. Replace names, hex values, stock and cost with your real yarn. Colours marked Discontinued or Out of stock show a warning in the studio.</div>
    <div class="tools"><input class="inp" id="yQ" placeholder="Search colour, ID or hex" value="${esc(q)}" aria-label="Search yarns"><button class="b2 pri" id="yAdd">Add yarn</button><button class="b2" id="yX">Export CSV</button><span class="note" style="margin:0">${l.length} of ${all.length}</span></div>
    <div class="tw"><table class="t"><thead><tr><th>Colour</th><th>ID</th><th>Name</th><th>Hex</th><th>Material</th><th>Stock</th><th class="num">Kg</th><th class="num">Cost/kg</th></tr></thead><tbody>
    ${l.map(y => `<tr class="click" data-id="${esc(y.id)}"><td><i style="display:inline-block;width:26px;height:26px;border-radius:5px;background:${esc(y.hex)};border:1px solid #fff3"></i></td><td>${esc(y.id)}</td><td><b>${esc(y.name)}</b></td><td>${esc(y.hex)}</td><td>${esc(y.material || '')}</td><td>${esc((AVAIL.find(a => a[0] === y.availability) || AVAIL[0])[1])}</td><td class="num">${y.stock == null ? '-' : y.stock}</td><td class="num">${y.cost == null ? '-' : y.cost}</td></tr>`).join('') || '<tr><td colspan="8" style="color:var(--mute)">No yarns match.</td></tr>'}</tbody></table></div>`;
    $('#yQ').oninput = e => { q = e.target.value; const p = e.target.selectionStart; draw(); const n = $('#yQ'); n.focus(); n.setSelectionRange(p, p); };
    $('#yAdd').onclick = () => edit(null); $$('tr.click', box).forEach(r => r.onclick = () => edit(r.dataset.id));
    $('#yX').onclick = () => csv([['ID', 'Name', 'Hex', 'Material', 'Availability', 'Stock kg', 'Cost per kg']].concat(all.map(y => [y.id, y.name, y.hex, y.material, y.availability, y.stock, y.cost])), 'xaro-yarns.csv');
  };
  const edit = id => {
    const all = XD.yarns(), y = id ? all.find(x => x.id === id) : { id: '', name: '', hex: '#39FF14', material: 'Acrylic', availability: 'unknown', stock: null, cost: null, supplier: "", active: true };
    const m = modal({ title: id ? 'Edit yarn' : 'Add yarn', body: `<div class="f2a"><div class="field"><label for="yI">Yarn ID</label><input class="inp" id="yI" maxlength="16" value="${esc(y.id)}" ${id ? 'disabled' : ''} placeholder="e.g. XY-101"></div><div class="field"><label for="yN">Colour name</label><input class="inp" id="yN" maxlength="30" value="${esc(y.name)}"></div></div>
      <div class="f2a"><div class="field"><label for="yH">Hex colour</label><input class="inp" id="yH" maxlength="7" value="${esc(y.hex)}"></div><div class="field"><label for="yM">Material</label><input class="inp" id="yM" maxlength="30" value="${esc(y.material || '')}"></div></div>
      <div class="f2a"><div class="field"><label for="yA">Stock status</label><select class="inp" id="yA">${AVAIL.map(a => `<option value="${a[0]}" ${y.availability === a[0] ? 'selected' : ''}>${a[1]}</option>`).join('')}</select></div><div class="field"><label for="yK">Stock (kg)</label><input class="inp" id="yK" inputmode="decimal" value="${y.stock == null ? '' : y.stock}"></div></div>
      <div class="field"><label for="yC">Cost per kg (leave blank if unknown)</label><input class="inp" id="yC" inputmode="decimal" value="${y.cost == null ? '' : y.cost}"></div><div class="err" id="yE" role="alert" style="color:var(--bad);min-height:18px"></div>`,
      actions: (id ? [{ label: 'Delete', cls: 'bad', run: close => { if (!confirm('Delete this yarn? Saved customer designs that use it will show the nearest colour.')) return; XD.saveYarns(XD.yarns().filter(x => x.id !== id)); close(); draw(); toast('Yarn deleted'); } }] : []).concat([{ label: 'Save', cls: 'pri', run: close => {
        const v = k => $('#' + k, m.el).value.trim(), er = $('#yE', m.el), nid = id || v('yI').toUpperCase().replace(/[^A-Z0-9_-]/g, '');
        if (!nid) return er.textContent = 'Enter a yarn ID.'; if (!id && all.some(x => x.id === nid)) return er.textContent = 'That ID already exists.'; if (v('yN').length < 2) return er.textContent = 'Enter a colour name.'; if (!hexOk(v('yH'))) return er.textContent = 'Hex must look like #39FF14.';
        const sk = v('yK') === '' ? null : num(v('yK'), NaN), ck = v('yC') === '' ? null : num(v('yC'), NaN); if ((sk != null && !(sk >= 0)) || (ck != null && !(ck >= 0))) return er.textContent = 'Stock and cost must be numbers, 0 or more.';
        const o = { id: nid, name: v('yN'), hex: v('yH').toUpperCase(), material: v('yM'), availability: v('yA'), stock: sk, cost: ck, supplier: (all.find(x => x.id === nid) || {}).supplier || "", active: true }; const l = XD.yarns(); const i = l.findIndex(x => x.id === nid); if (i >= 0) l[i] = o; else l.push(o); XD.saveYarns(l); close(); draw(); toast('Yarn saved'); } }]) });
  };
  draw();
});

/* ---------------------------------------------------------------- studio quotations */
const QS = ['New', 'Reviewing', 'Quoted', 'Accepted', 'Rejected', 'Converted to order'];
A.reg('quotes', 'Quotations', '✎', 'orders', box => {
  let q = '', fs = '';
  const draw = () => {
    let l = XD.quotes(); if (q) { const k = q.toLowerCase(); l = l.filter(o => (o.id + o.name + o.email + o.phone).toLowerCase().includes(k)); } if (fs) l = l.filter(o => o.status === fs);
    box.innerHTML = `<div class="tools"><input class="inp" id="qQ" placeholder="Search reference, name, email, phone" value="${esc(q)}" aria-label="Search quotations"><select class="inp" id="qS" aria-label="Status"><option value="">All statuses</option>${QS.map(s => `<option ${fs === s ? 'selected' : ''}>${s}</option>`).join('')}</select><button class="b2" id="qX">Export CSV</button><span class="note" style="margin:0">${l.length} request(s)</span></div>
    <div class="tw"><table class="t"><thead><tr><th>Design</th><th>Reference</th><th>Date</th><th>Customer</th><th>Size</th><th class="num">Customer saw</th><th class="num">Confirmed</th><th>Status</th></tr></thead><tbody>
    ${l.map(o => `<tr class="click" data-id="${esc(o.id)}"><td>${o.thumb ? `<img src="${esc(o.thumb)}" alt="" style="width:64px;border-radius:4px;display:block">` : ''}</td><td><b>${esc(o.id)}</b></td><td>${dt(o.at)}</td><td>${esc(o.name)}<br><small style="color:var(--mute)">${esc(o.email)} ${esc(o.phone)}</small></td><td>${o.doc ? o.doc.widthCm + ' x ' + o.doc.heightCm + ' cm' : ''}<br><small style="color:var(--mute)">x${o.qty || 1}, ${(o.estimate || {}).colours || '?'} colours</small></td><td class="num">${esc((o.estimate || {}).customer || '-')}</td><td class="num">${o.confirmed != null ? money(o.confirmed, o.cur) : '-'}</td><td><span class="pill">${esc(o.status)}</span></td></tr>`).join('') || '<tr><td colspan="8" style="color:var(--mute)">No quotation requests yet. They appear here when a customer presses "Request quotation" in the studio.</td></tr>'}</tbody></table></div>`;
    $('#qQ').oninput = e => { q = e.target.value; const p = e.target.selectionStart; draw(); const n = $('#qQ'); n.focus(); n.setSelectionRange(p, p); }; $('#qS').onchange = e => { fs = e.target.value; draw(); };
    $('#qX').onclick = () => csv([['Reference', 'Date', 'Name', 'Email', 'Phone', 'Country', 'Currency', 'Qty', 'Width cm', 'Height cm', 'Shape', 'Colours', 'Customer saw', 'Confirmed', 'Status', 'Message', 'Notes']].concat(l.map(o => [o.id, o.at, o.name, o.email, o.phone, o.country, o.cur, o.qty, (o.doc || {}).widthCm, (o.doc || {}).heightCm, (o.doc || {}).shape, (o.estimate || {}).colours, (o.estimate || {}).customer, o.confirmed, o.status, o.message, o.notes])), 'xaro-quotations.csv');
    $$('tr.click', box).forEach(r => r.onclick = () => detail(r.dataset.id));
  };
  const detail = id => {
    const o = XD.quotes().find(x => x.id === id); if (!o) return; const d = o.doc || {}, e = o.estimate || {};
    const m = modal({ title: 'Quotation ' + o.id, wide: true, body: `<div class="f2a"><div>${o.thumb ? `<img src="${esc(o.thumb)}" alt="Customer design" style="max-width:100%;border-radius:8px;background:#000">` : ''}<p class="note">Colour-separated preview. The customer was asked to send the original artwork by email or WhatsApp${(o.art || []).length ? ': ' + (o.art || []).map(a => esc(a.name) + ' (' + esc(a.px) + ' px)').join(', ') : ''}.</p></div>
      <div><div class="lbl">Customer</div><p><b>${esc(o.name)}</b><br>${esc(o.email)}<br>${esc(o.phone)}<br>${esc(XD.country(o.country).name)} (${esc(o.cur)})</p>
      <div class="lbl">Piece</div><p>${d.widthCm} x ${d.heightCm} cm, ${esc(d.shape)}, ${esc(d.pile)} pile, quantity ${o.qty || 1}${d.frame ? ', framed' : ''}${d.borderCm ? ', border ' + d.borderCm + ' cm' : ''}</p>
      <div class="lbl">Yarns</div><p>${(o.yarns || []).map(y => esc(y.name) + ' ' + y.pct + '%').join('<br>') || '-'}</p>
      <div class="lbl">Customer message</div><p>${esc(o.message || '-')}</p>
      <div class="lbl">Estimate shown to customer</div><p><b>${esc(e.customer || '-')}</b> (engine: cost US$ ${e.usd ? e.usd.cost.toFixed(2) : '-'}, sell US$ ${e.usd ? e.usd.sell.toFixed(2) : '-'}, ${e.hours ? e.hours.toFixed(1) : '-'} h). Placeholder rates: confirm with your own costs.</p></div></div>
      <div class="f2a"><div class="field"><label for="qSt">Status</label><select class="inp" id="qSt">${QS.map(s => `<option ${o.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div><div class="field"><label for="qCf">Confirmed price (${esc(o.cur)}, for the whole quantity)</label><input class="inp" id="qCf" inputmode="decimal" value="${o.confirmed == null ? '' : o.confirmed}"></div></div>
      <div class="field"><label for="qNt">Internal notes</label><textarea class="inp" id="qNt">${esc(o.notes || '')}</textarea></div>`,
      actions: [{ label: 'Delete', cls: 'bad', run: close => { if (!confirm('Delete this quotation request?')) return; XD.saveQuotes(XD.quotes().filter(x => x.id !== id)); close(); draw(); toast('Deleted'); } },
        { label: 'Save', cls: 'pri', run: close => { const v = $('#qCf', m.el).value.trim(), n = v === '' ? null : num(v, NaN); if (n != null && !(n >= 0)) return toast('Confirmed price must be a number.', true); const l = XD.quotes(), x = l.find(y => y.id === id); x.status = $('#qSt', m.el).value; x.confirmed = n; x.notes = $('#qNt', m.el).value.slice(0, 1000); XD.saveQuotes(l); close(); draw(); toast('Quotation updated'); } }] });
  };
  draw();
});
})();
