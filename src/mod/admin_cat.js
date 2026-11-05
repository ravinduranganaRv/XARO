/* ============ admin: products (add / update / remove) and price matrix ============ */
(() => {
'use strict';
const A = window.XADM, { $, $$, esc, modal, toast } = A;
const pcs = () => XD.countries().filter(c => c.code !== 'OT');
const CATS = [['desk', 'Desk setup'], ['wall', 'Wall art'], ['home', 'Floor rugs'], ['custom', 'Custom'], ['apparel', 'Apparel'], ['other', 'More']];
const DESIGN_LIST = ['XARO Logo', 'Street Crown', 'Neon Waves', 'Pixel Pad'];
const thumb = p => esc(p.img || (IMG['p_' + p.sku]) || IMG.logoBlock);
const cleanNum = v => { const n = parseFloat(String(v).replace(/,/g, '')); return isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null; };

function squareJpeg(file, size) {
  return new Promise((res, rej) => {
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) return rej(new Error('Use a PNG, JPG or WebP image.'));
    if (file.size > 8 * 1024 * 1024) return rej(new Error('That image is over 8 MB.'));
    const r = new FileReader(); r.onerror = () => rej(new Error('Could not read the file.'));
    r.onload = () => { const im = new Image(); im.onerror = () => rej(new Error('Could not read the image.')); im.onload = () => { const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d'); x.fillStyle = '#0b0d0b'; x.fillRect(0, 0, size, size); const s = Math.max(size / im.width, size / im.height); x.drawImage(im, (size - im.width * s) / 2, (size - im.height * s) / 2, im.width * s, im.height * s); res(c.toDataURL('image/jpeg', 0.82)); }; im.src = r.result; };
    r.readAsDataURL(file);
  });
}
const marginHtml = (cost, price, cur) => { if (!cost || !price) return ''; const u = price / (XD.fxTable()[cur] || 1), m = (u - cost) / u * 100, cls = m < 0 ? 'neg' : m < 25 ? 'low' : 'ok'; return `<div class="mg ${cls}">margin ${m.toFixed(0)}%</div>`; };

/* ---------------------------------------------------------------- products */
A.reg('products', 'Products', '▣', 'products', box => {
  let q = '', fcat = '', fst = '';
  const draw = () => {
    let l = XD.products(); if (q) { const k = q.toLowerCase(); l = l.filter(p => (p.name + ' ' + p.sku).toLowerCase().includes(k)); } if (fcat) l = l.filter(p => p.cat === fcat); if (fst) l = l.filter(p => fst === 'on' ? p.active !== false : p.active === false);
    const lk = XD.country('LK');
    box.innerHTML = `<div class="tools"><button class="b2 pri" id="pAdd">+ Add product</button><input class="inp" id="pQ" placeholder="Search name or SKU" value="${esc(q)}" aria-label="Search products"><select class="inp" id="pC" aria-label="Category"><option value="">All categories</option>${CATS.map(c => `<option value="${c[0]}" ${fcat === c[0] ? 'selected' : ''}>${c[1]}</option>`).join('')}</select>
    <select class="inp" id="pS" aria-label="Visibility"><option value="">All</option><option value="on" ${fst === 'on' ? 'selected' : ''}>Visible in shop</option><option value="off" ${fst === 'off' ? 'selected' : ''}>Hidden</option></select><span class="note" style="margin:0">${l.length} product(s)</span></div>
    <div class="tw"><table class="t"><thead><tr><th></th><th>Product</th><th>Type</th><th class="num">${lk.cur}</th><th class="num">US$</th><th>Stock</th><th>Shop</th><th></th></tr></thead><tbody>
    ${l.map(p => `<tr><td><img class="thumb" src="${thumb(p)}" alt=""></td><td><b>${esc(p.name)}</b><br><small style="color:var(--mute)">${esc(p.sku)} | ${esc(p.size)}</small></td><td><span class="pill ${p.kind === 'custom' ? 'w' : ''}">${esc(p.kind)}</span> <span class="pill">${esc((CATS.find(c => c[0] === p.cat) || ['', p.cat])[1])}</span></td>
    <td class="num">${p.prices && p.prices.LK ? Number(p.prices.LK).toLocaleString('en') : '-'}</td><td class="num">${p.prices && p.prices.US ? p.prices.US : p.price || '-'}</td><td>${p.stock == null ? '<small style="color:var(--mute)">made to order</small>' : p.stock <= 0 ? '<span class="pill r">sold out</span>' : p.stock + ' left'}</td>
    <td><label class="tg"><input type="checkbox" data-act="${esc(p.sku)}" ${p.active !== false ? 'checked' : ''} aria-label="Show ${esc(p.name)} in shop"><span>${p.active !== false ? 'Visible' : 'Hidden'}</span></label></td>
    <td style="white-space:nowrap"><button class="b2 sm" data-edit="${esc(p.sku)}">Edit</button> <button class="b2 sm bad" data-del="${esc(p.sku)}">Remove</button></td></tr>`).join('') || '<tr><td colspan="8"><div class="empty2">No products match.</div></td></tr>'}</tbody></table></div>`;
    $('#pAdd').onclick = () => edit(null);
    $('#pQ').oninput = e => { q = e.target.value; const p = e.target.selectionStart; draw(); const n = $('#pQ'); n.focus(); n.setSelectionRange(p, p); }; $('#pC').onchange = e => { fcat = e.target.value; draw(); }; $('#pS').onchange = e => { fst = e.target.value; draw(); };
    $$('[data-edit]', box).forEach(b => b.onclick = () => edit(b.dataset.edit));
    $$('[data-del]', box).forEach(b => b.onclick = () => { const p = XD.products().find(x => x.sku === b.dataset.del); if (!p || !confirm('Remove "' + p.name + '" from the store? This cannot be undone. (To hide it temporarily, switch it to Hidden instead.)')) return; XD.saveProducts(XD.products().filter(x => x.sku !== p.sku)); XARO.refresh(); draw(); toast('Product removed'); });
    $$('[data-act]', box).forEach(b => b.onchange = () => { const l2 = XD.products(), p = l2.find(x => x.sku === b.dataset.act); p.active = b.checked; XD.saveProducts(l2); XARO.refresh(); draw(); toast(b.checked ? 'Now visible in the shop' : 'Hidden from the shop'); });
  };
  function edit(sku) {
    const isNew = !sku, cur = isNew ? { sku: '', name: '', cat: 'desk', kind: 'common', size: '', desc: '', lead: '10-14 business days', designs: [], deposit: false, weight: '', active: true, img: '', stock: null, cost: null, shape: 'rug', w: 0, h: 0, price: 0, prices: {} } : XD.clone(XD.products().find(x => x.sku === sku));
    let img = cur.img || '';
    const cs = pcs(), usdCost = cur.cost;
    const body = `<div class="f3"><div class="field"><label for="fSku">SKU (unique code)</label><input class="inp" id="fSku" value="${esc(cur.sku)}" ${isNew ? '' : 'readonly'} maxlength="16" placeholder="e.g. XK-N" style="text-transform:uppercase"></div>
      <div class="field" style="grid-column:span 2"><label for="fName">Product name</label><input class="inp" id="fName" value="${esc(cur.name)}" maxlength="60"></div></div>
      <div class="f3"><div class="field"><label for="fCat">Category</label><select class="inp" id="fCat">${CATS.map(c => `<option value="${c[0]}" ${cur.cat === c[0] ? 'selected' : ''}>${c[1]}</option>`).join('')}</select></div>
      <div class="field"><label for="fKind">Type</label><select class="inp" id="fKind"><option value="common" ${cur.kind === 'common' ? 'selected' : ''}>Common (ready design)</option><option value="custom" ${cur.kind === 'custom' ? 'selected' : ''}>Custom (customer art)</option></select></div>
      <div class="field"><label for="fShape">3D shape</label><select class="inp" id="fShape"><option value="rug" ${cur.shape !== 'round' && cur.shape !== 'wall' ? 'selected' : ''}>Rug (flat, rectangle)</option><option value="round" ${cur.shape === 'round' ? 'selected' : ''}>Round coaster</option><option value="wall" ${cur.shape === 'wall' ? 'selected' : ''}>Framed wall piece</option></select></div></div>
      <div class="f3"><div class="field"><label for="fSize">Size text</label><input class="inp" id="fSize" value="${esc(cur.size)}" placeholder="44 x 16 cm"></div><div class="field"><label for="fW">Width (cm, for 3D)</label><input class="inp" id="fW" inputmode="decimal" value="${cur.w || ''}"></div><div class="field"><label for="fH">Height (cm, for 3D)</label><input class="inp" id="fH" inputmode="decimal" value="${cur.h || ''}"></div></div>
      <div class="field"><label for="fDesc">Description</label><textarea class="inp" id="fDesc" maxlength="400">${esc(cur.desc)}</textarea></div>
      <div class="f3"><div class="field"><label for="fLead">Lead time</label><input class="inp" id="fLead" value="${esc(cur.lead)}"></div><div class="field"><label for="fWeight">Weight</label><input class="inp" id="fWeight" value="${esc(cur.weight)}" placeholder="0.5 kg"></div><div class="field"><label for="fStock">Stock (blank = made to order)</label><input class="inp" id="fStock" inputmode="numeric" value="${cur.stock == null ? '' : cur.stock}"></div></div>
      <div class="field"><span class="lbl">Designs offered (common products)</span><div class="perms">${DESIGN_LIST.map(d => `<label><input type="checkbox" name="fDes" value="${esc(d)}" ${cur.designs.includes(d) ? 'checked' : ''}>${esc(d)}</label>`).join('')}</div></div>
      <div class="field"><div class="imgbox"><img id="fImg" src="${esc(img || IMG['p_' + cur.sku] || IMG.logoBlock)}" alt="Product image"><div><input type="file" id="fFile" accept="image/png,image/jpeg,image/webp" class="sr"><button type="button" class="b2" id="fPick">Upload image</button> <button type="button" class="b2" id="fClr">Use default</button><br><small>Square images look best. Saved at 560 px.</small><div class="err" id="fImgE"></div></div></div></div>
      <div class="field"><span class="lbl">Prices (each country in its own currency)</span><div class="pgrid">${cs.map(c => `<div class="field"><label for="fP_${c.code}">${esc(c.name)} (${c.cur})</label><input class="inp" id="fP_${c.code}" data-pc="${c.code}" inputmode="decimal" value="${cur.prices && cur.prices[c.code] != null ? cur.prices[c.code] : ''}"><div id="fM_${c.code}"></div></div>`).join('')}</div>
      <small>Leave a country blank to convert from the US$ price automatically. Prices are what the customer pays in that country's currency.</small></div>
      <div class="f3"><div class="field"><label for="fCost">Your unit cost in US$ (optional)</label><input class="inp" id="fCost" inputmode="decimal" value="${usdCost || ''}"><small>Materials + packaging + labour (+ shipping). Only used to show margin here; never shown to customers.</small></div>
      <div class="field"><label class="tg" style="margin-top:26px"><input type="checkbox" id="fDep" ${cur.deposit ? 'checked' : ''}><span>Take 50% deposit</span></label></div><div class="field"><label class="tg" style="margin-top:26px"><input type="checkbox" id="fAct" ${cur.active !== false ? 'checked' : ''}><span>Visible in shop</span></label></div></div><div class="err" id="fErr" role="alert"></div>`;
    const m = modal({ title: isNew ? 'Add product' : 'Edit ' + cur.name, wide: true, body, actions: [{ label: 'Cancel', run: c => c() }, { label: isNew ? 'Add product' : 'Save changes', cls: 'pri', run: close => save(close) }] });
    const refreshM = () => { const cost = cleanNum($('#fCost').value); cs.forEach(c => { const v = cleanNum($('#fP_' + c.code).value); $('#fM_' + c.code).innerHTML = marginHtml(cost, v, c.cur); }); };
    $$('[data-pc]', m.el).forEach(i => i.oninput = refreshM); $('#fCost').oninput = refreshM; refreshM();
    $('#fPick').onclick = () => $('#fFile').click();
    $('#fFile').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { img = await squareJpeg(f, 560); $('#fImg').src = img; $('#fImgE').textContent = ''; } catch (x) { $('#fImgE').textContent = x.message; } };
    $('#fClr').onclick = () => { img = ''; $('#fImg').src = IMG['p_' + cur.sku] || IMG.logoBlock; };
    function save(close) {
      const er = $('#fErr'), v = id => $('#' + id).value.trim(), sku = v('fSku').toUpperCase(), all = XD.products();
      if (!/^[A-Z0-9][A-Z0-9_-]{1,15}$/.test(sku)) { er.textContent = 'SKU must be 2-16 letters, numbers, - or _.'; return; }
      if (isNew && all.some(x => x.sku === sku)) { er.textContent = 'That SKU already exists.'; return; }
      if (v('fName').length < 2) { er.textContent = 'Enter a product name.'; return; }
      const prices = {}; let any = false; $$('[data-pc]', m.el).forEach(i => { const n = cleanNum(i.value); if (i.value.trim() && n == null) { er.textContent = 'Prices must be numbers greater than 0.'; any = 'bad'; } if (n != null) { prices[i.dataset.pc] = n; any = any || true; } });
      if (any === 'bad') return; if (!any) { er.textContent = 'Enter at least one price.'; return; }
      const stockRaw = v('fStock'); if (stockRaw !== '' && !/^\d+$/.test(stockRaw)) { er.textContent = 'Stock must be a whole number or blank.'; return; }
      const usd = prices.US || (prices.LK ? prices.LK / XD.fxTable().LKR : Object.values(prices)[0] / 3);
      const p = { sku, name: v('fName'), cat: v('fCat'), kind: v('fKind'), size: v('fSize'), desc: v('fDesc'), lead: v('fLead') || 'Made to order', designs: $$('[name=fDes]:checked', m.el).map(x => x.value), deposit: $('#fDep').checked || v('fKind') === 'custom' && $('#fDep').checked, weight: v('fWeight'),
        active: $('#fAct').checked, img, stock: stockRaw === '' ? null : +stockRaw, cost: cleanNum(v('fCost')), shape: v('fShape'), w: cleanNum(v('fW')) || 0, h: cleanNum(v('fH')) || 0, price: Math.round(usd * 100) / 100, prices };
      if (v('fKind') === 'custom') p.designs = [];
      const idx = all.findIndex(x => x.sku === sku); if (idx >= 0) all[idx] = Object.assign({}, all[idx], p); else all.push(p);
      if (!XD.saveProducts(all)) { er.textContent = 'Browser storage is full. Use a smaller image or remove products you do not need.'; return; }
      XARO.refresh(); close(); draw(); toast(isNew ? 'Product added to the shop' : 'Product updated');
    }
  }
  draw();
});

/* ---------------------------------------------------------------- price matrix */
A.reg('pricing', 'Prices', '$', 'pricing', box => {
  const cs = pcs(), draw = () => {
    const ps = XD.products(), fx = XD.fxTable();
    box.innerHTML = `<div class="note2">Each country has its own price list in its own currency, so Sri Lanka can have LKR prices that are not a conversion of the dollar price. Change any cell, then press <b>Save all prices</b>. Customers see the new prices immediately after they reload or switch country.</div>
    <div class="tools"><button class="b2 pri" id="xSave">Save all prices</button><select class="inp" id="xC" aria-label="Country for bulk change">${cs.map(c => `<option value="${c.code}">${esc(c.name)} (${c.cur})</option>`).join('')}</select><label class="sr" for="xP">Percent change</label><input class="inp" id="xP" inputmode="decimal" placeholder="% change e.g. 10 or -5" style="min-width:150px">
    <select class="inp" id="xR" aria-label="Round to"><option value="1">round to 1</option><option value="5">to 5</option><option value="10">to 10</option><option value="50" selected>to 50</option><option value="100">to 100</option></select><button class="b2" id="xApply">Apply % to column</button><button class="b2" id="xFill">Fill blanks from US$ x rate</button></div>
    <div class="tw"><table class="t pxt"><thead><tr><th>Product</th>${cs.map(c => `<th class="num">${esc(c.name)}<br>${c.cur}</th>`).join('')}</tr></thead><tbody>
    ${ps.map(p => `<tr data-sku="${esc(p.sku)}"><td><b>${esc(p.name)}</b><br><small style="color:var(--mute)">${esc(p.sku)}${p.active === false ? ' | hidden' : ''}</small></td>${cs.map(c => `<td><input class="inp" data-c="${c.code}" inputmode="decimal" value="${p.prices && p.prices[c.code] != null ? p.prices[c.code] : ''}" aria-label="${esc(p.name)} price in ${c.cur}"><div class="mgc"></div></td>`).join('')}</tr>`).join('')}</tbody></table></div>
    <p class="note" style="margin-top:12px">Exchange rates used for blanks and for display conversion (edit in Settings): ${Object.entries(fx).filter(([k]) => k !== 'USD').map(([k, v]) => '1 USD = ' + v + ' ' + k).join(' | ')}</p>`;
    const margins = () => $$('tr[data-sku]', box).forEach(tr => { const p = ps.find(x => x.sku === tr.dataset.sku); $$('input[data-c]', tr).forEach(i => { const c = XD.country(i.dataset.c), v = cleanNum(i.value); i.parentElement.querySelector('.mgc').innerHTML = marginHtml(p.cost, v, c.cur); }); });
    margins(); $$('input[data-c]', box).forEach(i => i.oninput = margins);
    $('#xSave').onclick = () => {
      const l = XD.products(); let bad = 0;
      $$('tr[data-sku]', box).forEach(tr => { const p = l.find(x => x.sku === tr.dataset.sku); p.prices = p.prices || {}; $$('input[data-c]', tr).forEach(i => { const v = i.value.trim(); if (v === '') { delete p.prices[i.dataset.c]; return; } const n = cleanNum(v); if (n == null) { bad++; i.style.borderColor = 'var(--bad)'; } else { p.prices[i.dataset.c] = n; i.style.borderColor = ''; } }); if (p.prices.US) p.price = p.prices.US; });
      if (bad) { toast(bad + ' cell(s) are not valid numbers', true); return; } XD.saveProducts(l); XARO.refresh(); toast('Prices saved'); draw();
    };
    $('#xApply').onclick = () => { const pct = parseFloat($('#xP').value); if (!isFinite(pct)) { toast('Enter a percent such as 10 or -5', true); return; } const c = $('#xC').value, step = +$('#xR').value; $$('input[data-c="' + c + '"]', box).forEach(i => { const n = cleanNum(i.value); if (n != null) i.value = Math.max(step, Math.round(n * (1 + pct / 100) / step) * step); }); margins(); toast('Applied to the column. Press Save to keep it.'); };
    $('#xFill').onclick = () => { $$('tr[data-sku]', box).forEach(tr => { const us = cleanNum($('input[data-c="US"]', tr).value); if (!us) return; $$('input[data-c]', tr).forEach(i => { if (i.value.trim() === '') { const c = XD.country(i.dataset.c), v = XD.convert(us, 'USD', c.cur); i.value = c.cur === 'LKR' ? Math.round(v / 50) * 50 : Math.round(v); } }); }); margins(); toast('Blanks filled. Press Save to keep them.'); };
  };
  draw();
});
})();
