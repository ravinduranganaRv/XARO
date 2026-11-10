/* ============ Workspace: quotation template (settings) and quotation documents (preview, PDF, PNG, JPG) ============ */
(function (root) {
'use strict';
const WS = root.XWS, H = WS.h, { esc, field, val, dlg, download, toast, guard, safeName, dateS } = H;
const SB = () => root.XSB, Q = () => root.XQUOTE, BUCKET = 'business-assets';
const loadImg = blob => new Promise((ok, no) => { const u = URL.createObjectURL(blob), i = new Image(); i.onload = () => { ok(i); }; i.onerror = () => no(new Error('That image could not be read.')); i.src = u; });
const fetchImg = async path => { if (!path) return null; try { const r = await fetch(await SB().signedUrl(BUCKET, path)); if (!r.ok) return null; return await loadImg(await r.blob()); } catch (e) { return null; } };
const tplOf = () => Q().sanitize(((H.biz().settings || {}).quoteTemplate) || {});
const bizModel = logo => { const bz = H.biz(), a = bz.address || {}; return { name: bz.name, owner: bz.owner_name, phone: bz.phone, email: bz.email, address: [a.line1, a.city].filter(Boolean), logo: logo ? { w: logo.naturalWidth, h: logo.naturalHeight } : null }; };
const lineItems = q => { const l = q.lines; return Array.isArray(l) ? { items: l, discountPct: 0, taxPct: 0 } : { items: (l && l.items) || [], discountPct: (l && l.discountPct) || 0, taxPct: (l && l.taxPct) || 0 }; };
const custModel = c => { if (!c) return null; const a = c.address || {}; return { name: c.name, email: c.email, phone: c.phone, address: [a.line1, a.city].filter(Boolean) }; };
const fmtDate = d => dateS(d || new Date());

/** builds the pages (canvases) for a quotation row or a sample, using the business logo and template */
async function pagesFor(model, tpl) {
  tpl = Q().sanitize(tpl); const [logo, bg] = await Promise.all([tpl.showLogo && tpl.mode === 'builtin' && H.biz().logo_path ? fetchImg(H.biz().logo_path) : null, tpl.mode === 'image' && tpl.bgPath ? fetchImg(tpl.bgPath) : tpl.mode === 'preset' ? Q().presetImage(tpl.preset) : null]);
  model.business = bizModel(logo); const lay = Q().layout(model, tpl, Q().measurer()); return { layout: lay, canvases: Q().render(lay, { logo, bg }), missingBg: (tpl.mode === 'image' && tpl.bgPath || tpl.mode === 'preset') && !bg };
}
const quoteModel = (q, cust, proj) => { const li = lineItems(q); return { customer: custModel(cust), quote: { ref: q.ref, date: fmtDate(q.created_at), validUntil: q.valid_until ? fmtDate(q.valid_until) : '', currency: q.currency, project: proj ? proj.title : '', notes: q.notes || '', discountPct: li.discountPct, taxPct: li.taxPct }, items: li.items.map(i => ({ desc: i.desc, qty: i.qty, unit: i.unit })) }; };
const SAMPLE = () => ({ customer: { name: 'Sample Customer', email: 'customer@example.com', phone: '+00 000 000 000', address: ['12 Example Street', 'Colombo'] }, quote: { ref: 'Q-SAMPLE-0001', date: fmtDate(), validUntil: '', currency: (H.biz().currency || 'USD').toUpperCase(), project: 'Custom keyboard rug', notes: 'This is a sample to preview your template.', discountPct: 0, taxPct: 0 }, items: [{ desc: 'Custom tufted keyboard rug 90 x 40 cm, standard pile', qty: 1, unit: 4500 }, { desc: 'Non-slip backing and binding', qty: 1, unit: 800 }] });

const showDoc = async (title, model, tpl, name) => {
  const out = await pagesFor(model, tpl), d = dlg(title, `<div class="xw-bar"><button class="xw-b pri" data-qd="pdf">Download PDF</button><button class="xw-b" data-qd="png">Download PNG</button><button class="xw-b" data-qd="jpg">Download JPG</button></div>${out.missingBg ? '<p class="xw-err">Your template image could not be loaded, so the plain page is shown.</p>' : ''}<div class="xw-qpv" id="qpv"></div>`);
  const box = d.m.querySelector('#qpv'); out.canvases.forEach(c => { c.style.cssText = 'width:100%;max-width:640px;height:auto;border:1px solid #2a342a;border-radius:6px;margin:0 auto 12px;display:block;background:#fff'; c.setAttribute('role', 'img'); c.setAttribute('aria-label', 'Quotation page'); box.appendChild(c); });
  d.m.addEventListener('click', guard(async e => { const b = e.target.closest('[data-qd]'); if (!b) return; const k = b.dataset.qd, base = safeName(name);
    if (k === 'pdf') { const pg = []; for (const c of out.canvases) { const bl = await Q().blob(c, 'image/jpeg', 0.92); pg.push({ jpeg: new Uint8Array(await bl.arrayBuffer()), w: c.width, h: c.height }); } download(base + '.pdf', new Blob([Q().pdf(pg)], { type: 'application/pdf' })); }
    else for (let i = 0; i < out.canvases.length; i++) download(base + (out.canvases.length > 1 ? '-page' + (i + 1) : '') + '.' + k, await Q().blob(out.canvases[i], k === 'png' ? 'image/png' : 'image/jpeg', 0.92)); }));
  return out;
};
const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
/** emails the quotation PDF to its customer through the send-quotation function. Returns { ok:true, to } or { ok:false, message } (never throws). */
async function emailQuote(q, cust, proj) {
  try { if (!cust || !cust.email) return { ok: false, message: 'This customer has no email address yet. Add one in Customer Projects.' };
    const out = await pagesFor(quoteModel(q, cust, proj), tplOf()), pg = []; for (const c of out.canvases) { const bl = await Q().blob(c, 'image/jpeg', 0.85); pg.push({ jpeg: new Uint8Array(await bl.arrayBuffer()), w: c.width, h: c.height }); }
    const r = await SB().fn('send-quotation', { quotationId: q.id, pdfBase64: b64(Q().pdf(pg)) }); return { ok: true, to: (r && r.to) || cust.email };
  } catch (e) { return { ok: false, message: e && e.status === 503 ? 'Email sending is not switched on yet. Download the PDF and send it yourself for now.' : String((e && e.message) || e) }; } }
H.quote = { template: tplOf, pagesFor, quoteModel, emailQuote, preview: (q, cust, proj) => showDoc('Quotation ' + q.ref, quoteModel(q, cust, proj), tplOf(), q.ref) };

/* ---- settings section: build / upload the template ---- */
H.quote.mount = b => {
  const bz = H.biz(), mayEdit = H.canWrite(); let t = tplOf(); const sec = document.createElement('section'); sec.className = 'xw-sec'; sec.id = 'qtSec';
  const pct = v => Math.round(v * 100);
  sec.innerHTML = `<h3>Quotation template</h3><p class="xw-note">Your logo, business details and the customer's details are filled in automatically. Choose the built-in layout, or upload your own template image (for example your letterhead) and the quotation is placed on it.</p>
  <div class="xw-form">${field('qtMode', 'Layout', t.mode === 'preset' ? t.preset : t.mode, { type: 'select', options: [['builtin', 'Built-in layout (logo + details)'], ['image', 'My uploaded template image']].concat(t.mode === 'preset' || /xaro/i.test(H.biz().name || '') ? [['xaro', 'XARO Industries template (A4 landscape)']] : []) })}${field('qtTitle', 'Document title', t.title, { max: 30 })}
  <div class="xw-f"><label for="qtAcc">Accent colour</label><input type="color" id="qtAcc" value="${esc(t.accent)}"></div>${field('qtFoot', 'Footer line', t.footer, { max: 200 })}</div>
  <div class="xw-f"><label for="qtBgF">Template image (PNG or JPG, A4 portrait works best, up to 6 MB)</label><input type="file" id="qtBgF" accept="image/png,image/jpeg"${mayEdit ? '' : ' disabled'}><small id="qtBgN">${t.bgPath ? 'A template image is saved.' : 'No template image uploaded.'}</small> <button class="xw-b sm" id="qtBgX"${t.bgPath && mayEdit ? '' : ' disabled'}>Remove image</button></div>
  <div class="xw-form" id="qtArea">${[['top', 'Content starts (% from top)'], ['bottom', 'Bottom margin (%)'], ['left', 'Left margin (%)'], ['right', 'Right margin (%)']].map(([k, l]) => field('qtA_' + k, l, pct(t.area[k]), { type: 'number', min: 0, max: 60, step: 1 })).join('')}</div>
  <small>When you use your own image, set the margins so the quotation stays inside the empty part of your template. The XARO template ignores the margins and fills its own blank areas.</small>
  ${field('qtTerms', 'Terms and conditions (printed on the quotation)', t.terms, { type: 'textarea', max: 1500 })}${field('qtBank', 'Bank / payment details', t.bank, { type: 'textarea', max: 600 })}
  <div class="xw-bar"><label><input type="checkbox" id="qtLogo"${t.showLogo ? ' checked' : ''}> Show my logo (built-in layout)</label><label><input type="checkbox" id="qtSign"${t.showSign ? ' checked' : ''}> Signature lines</label></div>
  <p class="xw-err" id="qtErr" role="alert"></p><div class="xw-bar"><button class="xw-b" id="qtPrev">Preview with sample data</button><button class="xw-b pri" id="qtSave"${mayEdit ? '' : ' disabled'}>Save template</button></div>`;
  const anchor = b.querySelector('section:nth-of-type(2)'); if (anchor) anchor.after(sec); else b.appendChild(sec);
  const read = () => Q().sanitize({ mode: Q().PRESETS[val('qtMode', sec)] ? 'preset' : val('qtMode', sec), preset: Q().PRESETS[val('qtMode', sec)] ? val('qtMode', sec) : '', title: val('qtTitle', sec).trim() || 'QUOTATION', accent: sec.querySelector('#qtAcc').value, footer: val('qtFoot', sec), terms: val('qtTerms', sec), bank: val('qtBank', sec), showLogo: sec.querySelector('#qtLogo').checked, showSign: sec.querySelector('#qtSign').checked, bgPath: t.bgPath,
    area: { top: val('qtA_top', sec) / 100, bottom: val('qtA_bottom', sec) / 100, left: val('qtA_left', sec) / 100, right: val('qtA_right', sec) / 100 } });
  sec.addEventListener('change', guard(async e => { if (e.target.id !== 'qtBgF') return; const f = e.target.files[0]; if (!f) return; if (!/^image\/(png|jpeg)$/.test(f.type)) return toast('Use a PNG or JPG image.', true); if (f.size > 6 * 1048576) return toast('That file is over 6 MB.', true);
    await loadImg(f); const path = SB().businessPath(bz.id, 'quote-template-' + Date.now() + (f.type === 'image/png' ? '.png' : '.jpg')); await SB().upload(BUCKET, path, f, f.type); t = Object.assign({}, read(), { bgPath: path, mode: 'image' }); sec.querySelector('#qtMode').value = 'image'; sec.querySelector('#qtBgN').textContent = 'Template image uploaded. Press Save template to keep it.'; sec.querySelector('#qtBgX').disabled = false; e.target.value = ''; toast('Image uploaded'); }));
  sec.addEventListener('click', guard(async e => { const id = e.target.id;
    if (id === 'qtBgX') { t = Object.assign({}, read(), { bgPath: '' }); sec.querySelector('#qtBgN').textContent = 'No template image. Press Save template to keep this.'; e.target.disabled = true; }
    else if (id === 'qtPrev') { const cur = read(); await showDoc('Template preview', SAMPLE(), cur, 'quotation-sample'); }
    else if (id === 'qtSave') { const cur = read(); if (cur.mode === 'image' && !cur.bgPath) { sec.querySelector('#qtErr').textContent = 'Upload a template image first, or choose the built-in layout.'; return; } sec.querySelector('#qtErr').textContent = '';
      await SB().update('businesses', { settings: Object.assign({}, bz.settings || {}, { quoteTemplate: cur }) }, { eq: { id: bz.id } }); await root.XACCT.refresh(); t = cur; toast('Quotation template saved'); } }));
};
})(typeof window !== 'undefined' ? window : globalThis);
