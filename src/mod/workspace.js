/* ============ Rug-maker workspace: shell, shared helpers, Dashboard, My Designs, Account Settings ============
   A full-screen area inside the Studio for signed-in rug makers who have a business profile. Every request goes to Supabase as the signed-in
   user; the database (row-level security) decides what each person may read or change. Other sections register themselves with XWS.register. */
(function (root) {
'use strict';
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const WS = root.XWS = { sections: [] };
let el = null, ctx = null, cur = '', seq = 0;
const $ = (s, r) => (r || el).querySelector(s), $$ = (s, r) => [...(r || el).querySelectorAll(s)];
const SB = () => root.XSB, biz = () => (root.XACCT && XACCT.state().business) || null, prof = () => (root.XACCT && XACCT.state().profile) || null;
const canWrite = () => { const b = biz(); return !!b && (b.memberRole === 'owner' || b.memberRole === 'manager'); };

/* ---------------------------------------------------------------- helpers shared by every section */
let tt; const toast = (m, bad) => { const t = $('.xw-tt'); if (!t) return; t.textContent = m; t.className = 'xw-tt on' + (bad ? ' bad' : ''); clearTimeout(tt); tt = setTimeout(() => { t.className = 'xw-tt'; }, 3600); };
const msg = e => { const m = (e && e.message) || String(e); return /JWT|expired/i.test(m) ? 'Your session expired. Please sign in again.' : /row-level security|42501|permission denied/i.test(m) ? 'You do not have permission to do that.' : /23505|duplicate key/i.test(m) ? 'That already exists (a code or reference must be unique).' : /23503|foreign key/i.test(m) ? 'That item is still linked to other records.' : m; };
const guard = fn => async (...a) => { try { return await fn(...a); } catch (e) { toast(msg(e), true); } };
function dlg(title, body, actions, wide) {
  const m = document.createElement('div'); m.className = 'xw-mod'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', title);
  m.innerHTML = `<div class="xw-sheet"${wide ? ' style="width:min(980px,100%)"' : ''}><button class="xw-b sm x" aria-label="Close">✕</button><h3>${esc(title)}</h3><div class="xw-mb">${body}</div><div class="xw-acts"></div></div>`;
  el.appendChild(m); const close = () => { m.remove(); }; $('.x', m).onclick = close; m.addEventListener('mousedown', e => { if (e.target === m) close(); });
  (actions || []).forEach(a => { const b = document.createElement('button'); b.type = 'button'; b.className = 'xw-b ' + (a.cls || ''); b.textContent = a.label; b.onclick = guard(() => a.run(close, m)); $('.xw-acts', m).appendChild(b); });
  const f = $('input:not([type=file]),textarea,select', m); if (f) setTimeout(() => f.focus(), 30); return { m, close };
}
const ask = (text, yes) => new Promise(res => { const d = dlg('Please confirm', `<p>${esc(text)}</p>`, [{ label: 'Cancel', run: c => { c(); res(false); } }, { label: yes || 'Confirm', cls: 'bad', run: c => { c(); res(true); } }]); d.m.querySelector('.x').addEventListener('click', () => res(false)); });
const field = (id, label, val, o) => { o = o || {}; const v = val == null ? '' : val; return `<div class="xw-f${o.cls ? ' ' + o.cls : ''}"><label for="${id}">${esc(label)}</label>` + (o.type === 'select' ? `<select id="${id}">${(o.options || []).map(x => { const [k, t] = Array.isArray(x) ? x : [x, x]; return `<option value="${esc(k)}"${String(k) === String(v) ? ' selected' : ''}>${esc(t)}</option>`; }).join('')}</select>` : o.type === 'textarea' ? `<textarea id="${id}" rows="${o.rows || 3}" maxlength="${o.max || 4000}">${esc(v)}</textarea>` : `<input id="${id}" type="${o.type || 'text'}" value="${esc(v)}"${o.max ? ` maxlength="${o.max}"` : ''}${o.step ? ` step="${o.step}"` : ''}${o.min != null ? ` min="${o.min}"` : ''}${o.ph ? ` placeholder="${esc(o.ph)}"` : ''}${o.req ? ' required' : ''}>`) + (o.hint ? `<small>${esc(o.hint)}</small>` : '') + '</div>'; };
const val = (id, r) => { const x = $('#' + id, r); return x ? x.value : ''; };
const money = (n, cur) => { if (n == null || n === '') return '-'; const v = Number(n); try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur || 'USD', maximumFractionDigits: 2 }).format(v); } catch (e) { return v.toFixed(2) + ' ' + (cur || ''); } };
const dateS = d => { if (!d) return ''; const t = new Date(d); return isNaN(t) ? '' : t.toLocaleDateString('en-GB'); };
const download = (name, data, type) => { const a = document.createElement('a'), blob = data instanceof Blob ? data : new Blob([data], { type: type || 'text/plain' }); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
const safeName = s => String(s || 'file').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'file';
const empty = (t, b) => `<div class="xw-empty"><p>${esc(t)}</p>${b || ''}</div>`;
const badge = (t, kind) => `<span class="xw-badge ${kind || ''}">${esc(String(t).replace(/_/g, ' '))}</span>`;
const sw = hex => `<i class="xw-sw" style="background:${/^#[0-9a-fA-F]{6}$/.test(hex) ? hex : '#888'}"></i>`;
/* database access scoped to the business */
const db = {
  sel: (t, o) => SB().select(t, Object.assign({}, o, { eq: Object.assign({ business_id: biz().id }, o && o.eq) })),
  one: (t, o) => SB().single(t, Object.assign({}, o, { eq: Object.assign({ business_id: biz().id }, o && o.eq) })),
  ins: (t, row, o) => SB().insert(t, Array.isArray(row) ? row.map(r => Object.assign({ business_id: biz().id }, r)) : Object.assign({ business_id: biz().id }, row), o),
  upd: (t, patch, eq, o) => SB().update(t, patch, Object.assign({}, o, { eq: Object.assign({ business_id: biz().id }, eq) })),
  del: (t, eq) => SB().remove(t, { eq: Object.assign({ business_id: biz().id }, eq) })
};
const H = WS.h = { esc, $, $$, dlg, ask, field, val, money, dateS, download, safeName, empty, badge, sw, db, toast, guard, msg, canWrite, biz, prof, SB, nav: k => WS.open(k), yarnId: code => 'BY-' + code };
const readOnlyNote = () => canWrite() ? '' : '<p class="xw-note warn">Your role is staff: you can view this workspace but only owners and managers can change it.</p>';
H.readOnlyNote = readOnlyNote;

/* ---------------------------------------------------------------- the business yarn library inside the editor */
let yarnCache = [];
H.loadYarns = async () => { yarnCache = await db.sel('biz_yarns', { select: '*', order: 'code.asc', limit: 1000 }); return yarnCache; };
H.yarns = () => yarnCache;
H.studioYarns = () => yarnCache.filter(y => y.active !== false).map(y => ({ id: H.yarnId(y.code), name: y.name, hex: y.hex.toUpperCase(), material: y.material || '', availability: y.availability, active: true, _biz: y.id }));
H.applyYarnSource = on => { if (!root.XSTUDIO_LIB) return; XSTUDIO_LIB.useYarns(on && yarnCache.length ? H.studioYarns : null); };

/* ---------------------------------------------------------------- registry + shell */
WS.register = (key, label, render, hint) => { WS.sections.push({ key, label, render, hint }); };
WS.open = async key => {
  if (!el) return; if (!biz()) { toast('Create your business profile first (Account button).', true); return; }
  cur = key || cur || 'dashboard'; const s = WS.sections.find(x => x.key === cur) || WS.sections[0]; cur = s.key; const my = ++seq;
  $$('.xw-nav button').forEach(b => b.setAttribute('aria-current', b.dataset.k === cur ? 'page' : 'false'));
  const main = $('#xwMain'); main.innerHTML = `<div class="xw-load" role="status">Loading ${esc(s.label)}...</div>`;
  try { await H.loadYarns(); } catch (e) { /* sections that need yarns will show their own error */ }
  if (my !== seq) return;
  main.innerHTML = `<header class="xw-h"><h2>${esc(s.label)}</h2>${s.hint ? `<p class="xw-note">${esc(s.hint)}</p>` : ''}</header><div class="xw-body" id="xwBody"></div>`;
  try { await s.render($('#xwBody'), H); } catch (e) { if (my === seq) $('#xwBody').innerHTML = `<div class="xw-err" role="alert">${esc(msg(e))}</div>`; }
};
WS.close = () => { if (!el) return; el.classList.remove('on'); document.body.classList.remove('xw-open'); };
function build() {
  el = document.createElement('div'); el.id = 'xwork'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'XARO rug maker workspace');
  el.innerHTML = `<div class="xw-top"><h1>Rug maker <span>workspace</span></h1><span class="xw-biz" id="xwBiz"></span><span class="xw-sp"></span><button class="xw-b" id="xwStudio">Back to Studio</button><button class="xw-b" id="xwClose" aria-label="Close workspace">Close</button></div>
  <div class="xw-grid"><nav class="xw-nav" aria-label="Workspace sections"></nav><main id="xwMain" tabindex="-1"></main></div><div class="xw-tt" role="status" aria-live="polite"></div>`;
  document.body.appendChild(el);
  const ORDER = ['dashboard', 'designs', 'vector', 'colour', 'yarns', 'calculator', 'preview3d', 'sheets', 'projects', 'quotes', 'orders', 'inventory', 'reports', 'settings'];
  WS.sections.sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key));
  $('.xw-nav').innerHTML = WS.sections.map(s => `<button data-k="${s.key}">${esc(s.label)}</button>`).join('');
  $('.xw-nav').addEventListener('click', e => { const b = e.target.closest('button[data-k]'); if (b) WS.open(b.dataset.k); });
  $('#xwClose').onclick = WS.close; $('#xwStudio').onclick = () => { WS.close(); };
  addEventListener('keydown', e => { if (e.key === 'Escape' && el.classList.contains('on')) { const m = $$('.xw-mod'); if (m.length) m.pop().remove(); else WS.close(); } });
}
WS.show = key => { if (!biz()) return; if (!el) build(); $('#xwBiz').textContent = biz().name; el.classList.add('on'); document.body.classList.add('xw-open'); return WS.open(key || cur || 'dashboard'); };
H.loadDesignIntoStudio = async (id, view) => { const r = await XACCT.open(id), images = {}; for (const [k, v] of Object.entries(r.images || {})) { const im = await XSTUDIO_LIB.imageFromData(v.data); if (im) images[k] = { el: im, data: v.data, name: v.name, w: v.w, h: v.h }; } WS.close(); XSTUDIO.loadDoc(r.doc, { name: r.name, cloudId: r.id, images, view }); return r; };
/** called by the studio once it is built: shows the Workspace button for rug makers with a business */
WS.mount = c => {
  ctx = c; const btn = c.studioRoot.querySelector('#stWork'); if (!btn) return;
  const sync = () => { const b = biz(); btn.hidden = !b; if (b) { btn.textContent = 'Workspace'; H.loadYarns().then(() => H.applyYarnSource(true)).catch(() => {}); } else H.applyYarnSource(false); };
  btn.onclick = () => WS.show(); if (root.XACCT && XACCT.onState) XACCT.onState(sync); sync();
};

/* ---------------------------------------------------------------- Dashboard */
WS.register('dashboard', 'Dashboard', async (b) => {
  const [designs, projects, orders, quotes, stock, rates, yarnCount] = await Promise.all([
    db.sel('custom_designs', { select: 'id,name,status,updated_at,doc->_thumb', order: 'updated_at.desc', limit: 200 }), db.sel('biz_projects', { select: 'id,title,status,due_date', limit: 500 }), db.sel('biz_orders', { select: 'id,ref,status,total,paid,currency,due_date', limit: 500 }),
    db.sel('biz_quotations', { select: 'id,status', limit: 500 }), db.sel('v_yarn_stock', { select: '*', limit: 1000 }), db.one('biz_rates', { select: 'rates' }), db.sel('biz_yarns', { select: 'id', limit: 1 })]);
  const W = root.XWORK, rep = W.report({ orders, quotes, projects, stock }), active = projects.filter(p => !['delivered', 'cancelled'].includes(p.status)).length, openOrders = orders.filter(o => ['open', 'in_production', 'ready'].includes(o.status));
  const soon = openOrders.filter(o => o.due_date).sort((x, y) => x.due_date < y.due_date ? -1 : 1).slice(0, 5), low = stock.filter(s => s.low_stock), recent = designs.filter(d => d.status !== 'archived').slice(0, 6);
  const ratesSet = rates && rates.rates && Object.keys(rates.rates).length > 0, steps = [['Add your yarns', yarnCount.length > 0, 'yarns'], ['Enter your calculator rates', ratesSet, 'calculator'], ['Create your first design', designs.length > 0, 'designs']];
  b.innerHTML = `<div class="xw-cards">${[['Designs', designs.filter(d => d.status !== 'archived').length, 'designs'], ['Active projects', active, 'projects'], ['Open orders', openOrders.length, 'orders'], ['Quotes awaiting reply', quotes.filter(q => q.status === 'sent').length, 'quotes'], ['Low-stock yarns', low.length, 'inventory']].map(c => `<button class="xw-card" data-go="${c[2]}"><b>${c[1]}</b><span>${esc(c[0])}</span></button>`).join('')}</div>
  ${steps.some(s => !s[1]) ? `<section class="xw-sec"><h3>Getting set up</h3><ul class="xw-check">${steps.map(s => `<li class="${s[1] ? 'done' : ''}"><span aria-hidden="true">${s[1] ? '✓' : '○'}</span> ${s[1] ? esc(s[0]) : `<a href="#" data-go="${s[2]}">${esc(s[0])}</a>`}</li>`).join('')}</ul></section>` : ''}
  <section class="xw-sec"><h3>Money</h3>${rep.money.length ? `<table class="xw-t"><thead><tr><th>Currency</th><th>Orders</th><th>Total</th><th>Paid</th><th>Outstanding</th></tr></thead><tbody>${rep.money.map(m => `<tr><td>${esc(m.currency)}</td><td>${m.orders}</td><td>${money(m.total, m.currency)}</td><td>${money(m.paid, m.currency)}</td><td>${money(m.outstanding, m.currency)}</td></tr>`).join('')}</tbody></table>` : '<p class="xw-note">No orders yet.</p>'}</section>
  <div class="xw-two"><section class="xw-sec"><h3>Due soon</h3>${soon.length ? `<ul class="xw-list">${soon.map(o => `<li><b>${esc(o.ref)}</b> ${badge(o.status)} <span>${esc(dateS(o.due_date))}</span></li>`).join('')}</ul>` : '<p class="xw-note">No orders with a due date.</p>'}</section>
  <section class="xw-sec"><h3>Low stock</h3>${low.length ? `<ul class="xw-list">${low.map(s => `<li>${sw(s.hex)} <b>${esc(s.code)}</b> ${esc(s.name)} <span>${Number(s.stock_kg)} kg left</span></li>`).join('')}</ul>` : '<p class="xw-note">Nothing is below its reorder level.</p>'}</section></div>
  <section class="xw-sec"><h3>Recent designs</h3>${recent.length ? `<div class="xw-grid3">${recent.map(d => `<button class="xw-dcard" data-open="${esc(d.id)}">${d._thumb ? `<img src="${esc(d._thumb)}" alt="">` : '<div class="xw-ph"></div>'}<b>${esc(d.name)}</b><small>${esc(dateS(d.updated_at))}</small></button>`).join('')}</div>` : '<p class="xw-note">No designs yet. Open the Studio and press Save.</p>'}</section>`;
  b.addEventListener('click', guard(async e => { const g = e.target.closest('[data-go]'); if (g) { e.preventDefault(); return WS.open(g.dataset.go); } const o = e.target.closest('[data-open]'); if (o) await H.loadDesignIntoStudio(o.dataset.open); }));
});

/* ---------------------------------------------------------------- My Designs */
WS.register('designs', 'My Designs', async (b) => {
  let folders = await db.sel('design_folders', { select: 'id,name,parent_id', order: 'name.asc', limit: 200 }), q = '', folder = '', status = 'active', rows = [];
  const load = async () => { const o = { select: 'id,name,status,updated_at,folder_id,doc->_thumb', order: 'updated_at.desc', limit: 300 }; if (q) o.ilike = { name: q }; if (folder === '_none') o.is = { folder_id: null }; else if (folder) o.eq = { folder_id: folder }; rows = (await db.sel('custom_designs', o)).filter(d => status === 'archived' ? d.status === 'archived' : d.status !== 'archived'); };
  const draw = () => {
    b.innerHTML = `${readOnlyNote()}<div class="xw-bar"><input type="search" id="dq" placeholder="Search designs" value="${esc(q)}" aria-label="Search designs"><select id="df" aria-label="Folder"><option value="">All folders</option><option value="_none"${folder === '_none' ? ' selected' : ''}>No folder</option>${folders.map(f => `<option value="${esc(f.id)}"${folder === f.id ? ' selected' : ''}>${esc(f.name)}</option>`).join('')}</select>
      <select id="ds" aria-label="Show"><option value="active"${status === 'active' ? ' selected' : ''}>Active</option><option value="archived"${status === 'archived' ? ' selected' : ''}>Archived</option></select><span class="xw-sp"></span><button class="xw-b" id="dnf">New folder</button><button class="xw-b pri" id="dnew">New design</button></div>
    ${rows.length ? `<div class="xw-grid3">${rows.map(d => `<article class="xw-dcard"><button class="xw-thumb" data-open="${esc(d.id)}" aria-label="Open ${esc(d.name)}">${d._thumb ? `<img src="${esc(d._thumb)}" alt="">` : '<div class="xw-ph"></div>'}</button><b>${esc(d.name)}</b><small>${esc(dateS(d.updated_at))}${d.folder_id ? ' | ' + esc((folders.find(f => f.id === d.folder_id) || {}).name || '') : ''}</small>
      <div class="xw-chips"><button class="xw-b sm" data-open="${esc(d.id)}">Open</button><button class="xw-b sm" data-dup="${esc(d.id)}">Duplicate</button><button class="xw-b sm" data-ren="${esc(d.id)}">Rename</button><button class="xw-b sm" data-mv="${esc(d.id)}">Move</button><button class="xw-b sm" data-hist="${esc(d.id)}">History</button>
      <button class="xw-b sm" data-arc="${esc(d.id)}">${d.status === 'archived' ? 'Restore' : 'Archive'}</button><button class="xw-b sm bad" data-rm="${esc(d.id)}">Delete</button></div></article>`).join('')}</div>` : empty(q || folder ? 'No designs match.' : status === 'archived' ? 'No archived designs.' : 'No designs yet. Click New design, make something, and press Save.')}`;
  };
  const refresh = async () => { await load(); draw(); };
  b.addEventListener('input', e => { if (e.target.id === 'dq') { clearTimeout(b._t); b._t = setTimeout(guard(async () => { q = e.target.value.trim(); await refresh(); b.querySelector('#dq').focus(); b.querySelector('#dq').setSelectionRange(q.length, q.length); }), 250); } });
  b.addEventListener('change', guard(async e => { if (e.target.id === 'df') { folder = e.target.value; await refresh(); } if (e.target.id === 'ds') { status = e.target.value; await refresh(); } }));
  b.addEventListener('click', guard(async e => {
    const t = e.target, g = a => t.closest('[' + a + ']'); let x;
    if (t.closest('#dnew')) { WS.close(); XSTUDIO.loadDoc(XSTUDIO_LIB.newDoc({ layers: [] }), {}); }
    else if (t.closest('#dnf')) { const d = dlg('New folder', field('fn', 'Folder name', '', { max: 80 }), [{ label: 'Cancel', run: c => c() }, { label: 'Create', cls: 'pri', run: async c => { const n = val('fn', d.m).trim(); if (!n) return toast('Enter a name.', true); await SB().insert('design_folders', { name: n.slice(0, 80), owner_id: SB().user().id, business_id: biz().id }); c(); folders = await db.sel('design_folders', { select: 'id,name,parent_id', order: 'name.asc', limit: 200 }); await refresh(); } }]); }
    else if (x = g('data-open')) await H.loadDesignIntoStudio(x.dataset.open);
    else if (x = g('data-dup')) { await XACCT.duplicate(x.dataset.dup); toast('Duplicated'); await refresh(); }
    else if (x = g('data-ren')) { const id = x.dataset.ren, cur0 = rows.find(r => r.id === id); const d = dlg('Rename design', field('rn', 'Name', cur0 && cur0.name, { max: 120 }), [{ label: 'Cancel', run: c => c() }, { label: 'Save', cls: 'pri', run: async c => { const n = val('rn', d.m).trim(); if (!n) return toast('Enter a name.', true); await db.upd('custom_designs', { name: n.slice(0, 120) }, { id }); c(); await refresh(); } }]); }
    else if (x = g('data-mv')) { const id = x.dataset.mv; const d = dlg('Move to folder', field('mf', 'Folder', rows.find(r => r.id === id).folder_id || '', { type: 'select', options: [['', 'No folder']].concat(folders.map(f => [f.id, f.name])) }), [{ label: 'Cancel', run: c => c() }, { label: 'Move', cls: 'pri', run: async c => { await db.upd('custom_designs', { folder_id: val('mf', d.m) || null }, { id }); c(); await refresh(); } }]); }
    else if (x = g('data-arc')) { const d0 = rows.find(r => r.id === x.dataset.arc); await db.upd('custom_designs', { status: d0.status === 'archived' ? 'draft' : 'archived' }, { id: d0.id }); await refresh(); }
    else if (x = g('data-rm')) { if (await ask('Delete this design permanently? Its saved versions are deleted too.', 'Delete')) { await db.del('custom_designs', { id: x.dataset.rm }); toast('Deleted'); await refresh(); } }
    else if (x = g('data-hist')) { const id = x.dataset.hist, vs = await SB().select('design_versions', { select: 'version,created_at', eq: { design_id: id }, order: 'version.desc', limit: 50 });
      const d = dlg('Version history', vs.length ? `<p class="xw-note">Each save is kept (last 50). Restoring copies that version back as the current design; nothing is lost.</p><ul class="xw-list">${vs.map(v => `<li><b>Version ${v.version}</b> <span>${esc(new Date(v.created_at).toLocaleString('en-GB'))}</span><button class="xw-b sm" data-rest="${v.version}">Restore</button></li>`).join('')}</ul>` : '<p>No versions yet.</p>', [{ label: 'Close', run: c => c() }]);
      d.m.addEventListener('click', guard(async ev => { const r = ev.target.closest('[data-rest]'); if (!r) return; const row = await SB().single('design_versions', { select: 'doc', eq: { design_id: id, version: r.dataset.rest } }); if (!row) throw new Error('That version was not found.'); await db.upd('custom_designs', { doc: row.doc }, { id }); d.close(); toast('Restored version ' + r.dataset.rest); await refresh(); })); }
  }));
  await refresh();
});

/* ---------------------------------------------------------------- Account Settings */
WS.register('settings', 'Account Settings', async (b) => {
  const bz = biz(), members = await SB().select('business_members', { select: 'user_id,role,created_at', eq: { business_id: bz.id } }), me = SB().user(), owner = bz.memberRole === 'owner', a = bz.address || {};
  b.innerHTML = `${readOnlyNote()}<section class="xw-sec"><h3>Business profile</h3><div class="xw-form">${field('bn', 'Business name', bz.name, { max: 120 })}${field('bo', 'Owner name', bz.owner_name, { max: 120 })}${field('bp', 'Phone', bz.phone, { max: 30 })}${field('bc', 'Country (2 letters)', bz.country, { max: 2 })}${field('bu', 'Currency (3 letters)', bz.currency, { max: 3 })}${field('ba', 'Address', a.line1 || '', { max: 200 })}${field('bt', 'City', a.city || '', { max: 100 })}</div><p class="xw-err" id="bErr" role="alert"></p><button class="xw-b pri" id="bSave"${canWrite() ? '' : ' disabled'}>Save profile</button></section>
  <section class="xw-sec"><h3>Logo</h3><div id="logoBox" class="xw-note">${bz.logo_path ? 'A logo is saved.' : 'No logo yet.'}</div><input type="file" id="logoF" accept="image/png,image/jpeg,image/webp"${canWrite() ? '' : ' disabled'}><p class="xw-note">PNG, JPG or WebP up to 2 MB. Stored privately for your team.</p></section>
  <section class="xw-sec"><h3>Team</h3><table class="xw-t"><thead><tr><th>Member</th><th>Role</th><th>Joined</th><th></th></tr></thead><tbody>${members.map(m => `<tr><td>${m.user_id === me.id ? 'You' : 'Team member ' + esc(m.user_id.slice(0, 6))}</td><td>${badge(m.role)}</td><td>${esc(dateS(m.created_at))}</td><td>${owner && m.role !== 'owner' ? `<button class="xw-b sm bad" data-rmm="${esc(m.user_id)}">Remove</button>` : ''}</td></tr>`).join('')}</tbody></table>
  ${owner ? `<div class="xw-bar"><input type="email" id="mE" placeholder="Their account email" aria-label="Team member email"><select id="mR" aria-label="Role"><option value="staff">Staff (view only)</option><option value="manager">Manager (can edit)</option></select><button class="xw-b" id="mAdd">Add member</button></div><p class="xw-note">The person must already have a XARO rug maker account. Staff can view; managers can edit; only the owner can manage the team.</p>` : '<p class="xw-note">Only the owner can add or remove team members.</p>'}</section>
  <section class="xw-sec"><h3>Your data</h3><p class="xw-note">Download everything stored for this business as a JSON file (designs without artwork pixels, yarns, customers, projects, quotations, orders, stock movements).</p><button class="xw-b" id="xport">Export my data</button></section>
  <section class="xw-sec"><h3>Password and sign-out</h3><div class="xw-bar"><input type="password" id="pw" autocomplete="new-password" placeholder="New password (8+ characters)" aria-label="New password"><button class="xw-b" id="pwSave">Change password</button><button class="xw-b" id="so">Sign out</button></div></section>`;
  b.addEventListener('click', guard(async e => {
    const t = e.target;
    if (t.id === 'bSave') { const n = val('bn').trim(), cc = val('bc').trim().toUpperCase(), cu = val('bu').trim().toUpperCase(), err = $('#bErr'); err.textContent = '';
      if (n.length < 2) return err.textContent = 'Business name needs at least 2 characters.'; if (cc && !/^[A-Z]{2}$/.test(cc)) return err.textContent = 'Country must be 2 letters, for example LK.'; if (cu && !/^[A-Z]{3}$/.test(cu)) return err.textContent = 'Currency must be 3 letters, for example USD.';
      await SB().update('businesses', { name: n, owner_name: val('bo').trim() || null, phone: val('bp').trim() || null, country: cc || null, currency: cu || null, address: { line1: val('ba').trim(), city: val('bt').trim() } }, { eq: { id: bz.id } }); await XACCT.refresh(); $('#xwBiz').textContent = biz().name; toast('Profile saved'); }
    else if (t.id === 'mAdd') { const em = val('mE').trim(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return toast('Enter a valid email.', true); await SB().addMember(bz.id, em, val('mR')); toast('Member added'); await WS.open('settings'); }
    else if (t.dataset.rmm) { if (await ask('Remove this member from the business?', 'Remove')) { await SB().remove('business_members', { eq: { business_id: bz.id, user_id: t.dataset.rmm } }); await WS.open('settings'); } }
    else if (t.id === 'xport') { const out = { exported_at: new Date().toISOString(), business: { id: bz.id, name: bz.name } }; for (const [k, tbl, sel] of [['designs', 'custom_designs', 'id,name,status,folder_id,created_at,updated_at,doc'], ['yarns', 'biz_yarns', '*'], ['customers', 'biz_customers', '*'], ['projects', 'biz_projects', '*'], ['quotations', 'biz_quotations', '*'], ['orders', 'biz_orders', '*'], ['yarn_movements', 'yarn_movements', '*'], ['production_sheets', 'production_sheets', '*']]) out[k] = await db.sel(tbl, { select: sel, limit: 1000 }); out.designs.forEach(d => { if (d.doc) { delete d.doc._thumb; } }); download('xaro-business-' + safeName(bz.name) + '.json', JSON.stringify(out, null, 2), 'application/json'); toast('Exported'); }
    else if (t.id === 'pwSave') { const p = val('pw'); if (p.length < 8) return toast('Use at least 8 characters.', true); await SB().updatePassword(p); $('#pw').value = ''; toast('Password changed'); }
    else if (t.id === 'so') { await SB().signOut(); WS.close(); }
  }));
  b.addEventListener('change', guard(async e => { if (e.target.id !== 'logoF') return; const f = e.target.files[0]; if (!f) return; if (!/^image\/(png|jpeg|webp)$/.test(f.type)) return toast('Use a PNG, JPG or WebP image.', true); if (f.size > 2 * 1048576) return toast('That file is over 2 MB.', true);
    const path = SB().businessPath(bz.id, 'logo-' + Date.now() + '.' + (f.type === 'image/png' ? 'png' : f.type === 'image/webp' ? 'webp' : 'jpg')); await SB().upload('business-assets', path, f, f.type); await SB().update('businesses', { logo_path: path }, { eq: { id: bz.id } }); await XACCT.refresh(); $('#logoBox').textContent = 'Logo saved.'; toast('Logo saved'); }));
});

})(typeof window !== 'undefined' ? window : globalThis);
