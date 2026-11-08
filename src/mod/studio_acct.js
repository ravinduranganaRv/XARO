/* ============ Studio accounts and cloud designs (Supabase) ============
   Lives inside the Studio only. Customers keep personal designs; rug makers create a business profile and share designs with their team.
   All access rules are enforced by the database (row-level security); this file only builds requests and screens. */
(function (root) {
'use strict';
const A = {};
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let ctx = null, prof = null, biz = null, SBx = null;
const SBref = () => SBx || root.XSB;
A._inject = sb => { SBx = sb; };
A.state = () => ({ profile: prof, business: biz });

/* ---------- pure helpers (unit tested) ---------- */
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp'];
A.dataUrlMime = d => { const m = /^data:([^;,]+)[;,]/.exec(String(d || '')); return m ? m[1].toLowerCase() : ''; };
A.dataUrlToBlob = d => { const i = d.indexOf(','), head = d.slice(0, i), mime = A.dataUrlMime(d), b64 = /;base64/.test(head), body = d.slice(i + 1); const bin = b64 ? atob(body) : decodeURIComponent(body); const u = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) u[k] = bin.charCodeAt(k); return new Blob([u], { type: mime }); };
// the design document that goes to the database: image pixels are NOT inside it (they are uploaded to private storage); only their paths are
A.buildDoc = (doc, imageRefs, thumb) => { const d = JSON.parse(JSON.stringify(doc)); d._images = imageRefs || {}; if (thumb && thumb.length < 60000) d._thumb = thumb; return d; };
A.buildRow = ({ name, doc, ownerId, businessId, folderId, templateId }) => { const r = { name: String(name || 'My rug').trim().slice(0, 120) || 'My rug', doc, status: 'draft' }; if (ownerId) r.owner_id = ownerId; if (businessId) r.business_id = businessId; if (folderId) r.folder_id = folderId; if (templateId) r.template_id = templateId; return r; };
A.roleLabel = p => !p ? '' : p.role === 'owner' ? 'Store owner' : p.account_type === 'rugmaker' ? 'Rug maker' : 'Customer';
A.passwordHint = pw => { pw = String(pw || ''); let s = 0; if (pw.length >= 8) s++; if (pw.length >= 12) s++; if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++; if (/\d/.test(pw)) s++; if (/[^A-Za-z0-9]/.test(pw)) s++; return ['Too short', 'Weak', 'Fair', 'Good', 'Strong', 'Strong'][pw.length < 8 ? 0 : Math.max(1, s - 1)]; };

/* ---------- data calls ---------- */
const listeners = []; A.onState = fn => { listeners.push(fn); };
A.refresh = async () => {
  const SB = SBref(); prof = null; biz = null;
  try {
    if (SB.signedIn()) { try { prof = await SB.profile(); if (prof && prof.account_type === 'rugmaker') biz = await SB.myBusiness(); } catch (e) { if (e.status === 401) await SB.signOut(); } }
  } finally { listeners.forEach(f => { try { f(A.state()); } catch (e) {} }); }
  return A.state();
};
A.uploadImages = async (doc, imgs) => {
  const SB = SBref(), u = SB.user(), refs = {}, used = {};
  (doc.layers || []).forEach(l => { if (l.type === 'image' && imgs[l.img]) used[l.img] = imgs[l.img]; });
  for (const [id, im] of Object.entries(used)) {
    let data = im.data, mime = A.dataUrlMime(data);
    if (ALLOWED.indexOf(mime) < 0) { data = await ctx.toPng(im); mime = 'image/png'; } // SVG / GIF etc. are flattened to PNG before upload
    const blob = A.dataUrlToBlob(data), ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
    const path = biz ? SB.businessPath(biz.id, 'art-' + id + '.' + ext) : SB.personalPath('art-' + id + '.' + ext);
    await SB.upload('design-originals', path, blob, mime); refs[id] = { path, name: String(im.name || 'artwork').slice(0, 60), w: im.w, h: im.h };
  }
  return refs;
};
A.save = async ({ name, doc, imgs, thumb, cloudId }) => {
  const SB = SBref(), u = SB.user(); if (!u) throw new Error('Please sign in first.');
  const refs = await A.uploadImages(doc, imgs), payload = A.buildDoc(doc, refs, thumb);
  if (cloudId) { await SB.update('custom_designs', { name: String(name).slice(0, 120), doc: payload }, { eq: { id: cloudId } }); return cloudId; }
  const rows = await SB.insert('custom_designs', A.buildRow({ name, doc: payload, ownerId: u.id, businessId: biz && biz.id }), { select: 'id' });
  return rows[0].id;
};
A.list = async (q) => { const SB = SBref(); const o = { select: 'id,name,status,updated_at,business_id,folder_id,doc->_thumb', order: 'updated_at.desc', limit: 100 }; if (q) o.ilike = { name: q }; return SB.select('custom_designs', o); };
A.open = async id => {
  const SB = SBref(), row = await SB.single('custom_designs', { select: 'id,name,doc', eq: { id } }); if (!row) throw new Error('That design was not found.');
  const images = {}, refs = row.doc._images || {};
  for (const [iid, r] of Object.entries(refs)) { const url = await SB.signedUrl('design-originals', r.path, 300); const res = await fetch(url); if (!res.ok) continue; images[iid] = { data: await ctx.blobToDataUrl(await res.blob()), name: r.name, w: r.w, h: r.h }; }
  const doc = JSON.parse(JSON.stringify(row.doc)); delete doc._images; delete doc._thumb; return { id: row.id, name: row.name, doc, images };
};
A.remove = id => SBref().remove('custom_designs', { eq: { id } });
A.history = id => SBref().select('design_versions', { select: 'version,created_at', eq: { design_id: id }, order: 'version.desc', limit: 50 });
A.duplicate = async id => { const SB = SBref(), u = SB.user(); const row = await SB.single('custom_designs', { select: 'name,doc', eq: { id } }); const o = { name: row.name }; const rows = await SB.insert('custom_designs', A.buildRow({ name: 'Copy of ' + o.name, doc: row.doc, ownerId: u.id, businessId: biz && biz.id }), { select: 'id' }); return rows[0].id; };
A.archive = id => SBref().update('custom_designs', { status: 'archived' }, { eq: { id } });

/* ---------- screens ---------- */
function chip() { const b = ctx && ctx.$('#stAcct'); if (!b) return; const SB = SBref(), u = SB.user(); b.textContent = u ? ((prof && prof.full_name || u.email || 'Account').split(' ')[0].slice(0, 14)) : 'Sign in'; b.title = u ? A.roleLabel(prof) + ' | ' + (u.email || '') : 'Sign in or create an account'; }
A.openAccount = () => { const SB = SBref(); if (!SB.signedIn()) return authSheet('in'); return accountSheet(); };
function authSheet(mode, type) {
  const SB = SBref();
  const body = () => `<div class="chips" role="tablist" style="margin-bottom:10px"><button class="sb sm" data-m="in" aria-pressed="${mode === 'in'}">Sign in</button><button class="sb sm" data-m="up" aria-pressed="${mode === 'up'}">Create account</button></div>
  ${mode === 'up' ? `<div class="fld"><label>I am a</label><div class="chips"><button class="sb sm" data-t="customer" aria-pressed="${type !== 'rugmaker'}">Customer (design a rug)</button><button class="sb sm" data-t="rugmaker" aria-pressed="${type === 'rugmaker'}">Rug maker (run a tufting business)</button></div></div>
  <div class="fld"><label for="acN">Full name</label><input type="text" id="acN" maxlength="120" autocomplete="name"></div>` : ''}
  <div class="fld"><label for="acE">Email</label><input type="email" id="acE" autocomplete="email" inputmode="email"></div>
  <div class="fld"><label for="acP">Password</label><input type="password" id="acP" autocomplete="${mode === 'up' ? 'new-password' : 'current-password'}" minlength="8"></div>
  ${mode === 'up' ? '<p class="note" id="acH">Use at least 8 characters. We email you a link to confirm your address.</p>' : '<p class="note"><a href="#" id="acF">Forgot your password?</a></p>'}
  <div class="err" id="acR" role="alert"></div>`;
  const s = ctx.sheet(mode === 'up' ? 'Create your XARO account' : 'Sign in to XARO', body(), [{ label: 'Cancel', run: c => c() }, { label: mode === 'up' ? 'Create account' : 'Sign in', cls: 'pri', run: async (close, m) => {
    const err = m.querySelector('#acR'), E = m.querySelector('#acE').value, P = m.querySelector('#acP').value; err.textContent = '';
    try {
      if (mode === 'up') { const r = await SB.signUp({ email: E, password: P, fullName: m.querySelector('#acN').value, accountType: type }); if (r.needsConfirmation) { m.querySelector('.mb').innerHTML = '<p><b>Check your email.</b></p><p class="note">We sent a confirmation link to ' + esc(E) + '. Open it, then come back and sign in.</p>'; return; } }
      else await SB.signIn(E, P);
      await A.refresh(); chip(); close(); ctx.toast('Signed in'); if (prof && prof.account_type === 'rugmaker' && !biz) businessSheet();
    } catch (e) { err.textContent = e.message || 'Something went wrong.'; }
  } }]);
  const m = s.m;
  m.addEventListener('click', e => { const b = e.target.closest('[data-m],[data-t]'); if (b) { const keep = { E: m.querySelector('#acE').value }; s.close(); authSheet(b.dataset.m || mode, b.dataset.t || type); const n = ctx.$('#acE'); if (n) n.value = keep.E; } if (e.target.id === 'acF') { e.preventDefault(); const E = m.querySelector('#acE').value, er = m.querySelector('#acR'); SB.resetPassword(E).then(() => { er.textContent = ''; er.style.color = 'var(--neon)'; er.textContent = 'If that address has an account, a reset link is on its way.'; }).catch(x => { er.style.color = ''; er.textContent = x.message; }); } });
  const pw = m.querySelector('#acP'), h = m.querySelector('#acH'); if (pw && h) pw.oninput = () => { h.textContent = 'Password strength: ' + A.passwordHint(pw.value) + '. Use at least 8 characters.'; };
  m.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { const b = m.querySelector('#mAct .pri'); b && b.click(); } });
}
function businessSheet() {
  const SB = SBref(); const cs = (root.XD && root.XD.countries) ? root.XD.countries() : [{ code: 'LK', name: 'Sri Lanka', cur: 'LKR' }];
  const s = ctx.sheet('Set up your rug-making business', `<p class="note">This creates your private workspace. Only people you add can see your designs, yarns, customers and quotations.</p>
  <div class="fld"><label for="bzN">Business name</label><input type="text" id="bzN" maxlength="120"></div><div class="fld"><label for="bzO">Owner name</label><input type="text" id="bzO" maxlength="120" value="${esc(prof && prof.full_name || '')}"></div>
  <div class="fld"><label for="bzP">Phone</label><input type="tel" id="bzP" maxlength="30"></div>
  <div class="fld"><label for="bzC">Country</label><select id="bzC">${cs.map(c => `<option value="${esc(c.code)}" data-cur="${esc(c.cur || '')}">${esc(c.name)}</option>`).join('')}</select></div>
  <div class="fld"><label for="bzU">Currency (3 letters, e.g. LKR)</label><input type="text" id="bzU" maxlength="3" style="text-transform:uppercase"></div>
  <div class="fld"><label for="bzA">City / address (optional)</label><input type="text" id="bzA" maxlength="200"></div><div class="err" id="bzR" role="alert"></div>`, [{ label: 'Later', run: c => c() }, { label: 'Create business', cls: 'pri', run: async (close, m) => {
    const q = id => m.querySelector(id).value.trim(), err = m.querySelector('#bzR'); err.textContent = '';
    if (q('#bzN').length < 2) { err.textContent = 'Enter your business name.'; return; } if (!/^[A-Za-z]{3}$/.test(q('#bzU'))) { err.textContent = 'Enter a 3-letter currency code.'; return; }
    try { await SB.createBusiness({ name: q('#bzN'), ownerName: q('#bzO'), phone: q('#bzP'), country: q('#bzC'), currency: q('#bzU'), address: { line: q('#bzA') } }); await A.refresh(); chip(); close(); ctx.toast('Business created'); document.dispatchEvent(new CustomEvent('xaro-business-ready')); }
    catch (e) { err.textContent = e.message; } } }]);
  const c = s.m.querySelector('#bzC'), u = s.m.querySelector('#bzU'); const sync = () => { const o = c.selectedOptions[0]; if (o && o.dataset.cur) u.value = o.dataset.cur; }; c.onchange = sync; sync();
}
function accountSheet() {
  const SB = SBref(), u = SB.user();
  ctx.sheet('Your account', `<p><b>${esc(prof && prof.full_name || u.email)}</b><br><small>${esc(u.email || '')} | ${esc(A.roleLabel(prof))}</small></p>
  ${prof && prof.account_type === 'rugmaker' ? (biz ? `<p class="note">Business: <b>${esc(biz.name)}</b> (${esc(biz.memberRole)}) | ${esc(biz.currency || '')}</p>` : '<p class="note">You have not set up your business yet.</p><button class="sb pri" id="acB">Set up business</button>') : '<p class="note">Customer account. Your saved designs are private to you.</p><button class="sb" id="acR2">I am a rug maker: upgrade this account</button>'}`,
    [{ label: 'Sign out', cls: 'bad', run: async c => { await SB.signOut(); prof = null; biz = null; chip(); c(); ctx.toast('Signed out'); } }, { label: 'Close', run: c => c() }]).m.addEventListener('click', async e => {
    if (e.target.id === 'acB') { e.target.closest('.mod').remove(); businessSheet(); }
    if (e.target.id === 'acR2') { try { await SB.becomeRugmaker(); await A.refresh(); chip(); e.target.closest('.mod').remove(); businessSheet(); } catch (x) { ctx.toast(x.message, true); } } });
}
A.mount = c => { ctx = c; const b = ctx.$('#stAcct'); if (b) b.onclick = A.openAccount; const SB = SBref(); SB.consumeUrlSession(); A.refresh().then(chip); SB.onChange(() => { A.refresh().then(chip); }); chip(); };

if (typeof module !== 'undefined' && module.exports) module.exports = A; else root.XACCT = A;
})(typeof window !== 'undefined' ? window : globalThis);
