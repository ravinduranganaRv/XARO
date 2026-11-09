/* ============ admin panel core: login, session, shell, dashboard, customers, orders ============ */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)], esc = XD.esc;
const enc = new TextEncoder();
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const unhex = h => new Uint8Array(h.match(/../g).map(x => parseInt(x, 16)));
const rand = n => hex(crypto.getRandomValues(new Uint8Array(n)));
async function hashPw(pw, saltHex, iter) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: unhex(saltHex), iterations: iter, hash: 'SHA-256' }, key, 256));
}
const secure = () => !!(window.crypto && crypto.subtle);
const SESSION_MS = 30 * 60 * 1000;
const root = document.createElement('div'); root.id = 'adm'; root.setAttribute('role', 'region'); root.setAttribute('aria-label', 'Admin panel'); document.body.appendChild(root);
const tt = document.createElement('div'); tt.className = 'tt'; tt.setAttribute('role', 'status'); root.appendChild(tt);
let ttT; const toast = (m, bad) => { tt.textContent = m; tt.className = 'tt on' + (bad ? ' bad' : ''); clearTimeout(ttT); ttT = setTimeout(() => { tt.className = 'tt'; }, 2600); };

/* ---------------------------------------------------------------- session */
const sess = () => { try { const v = JSON.parse(sessionStorage.getItem('xaro.adm') || 'null'); return v && v.exp > Date.now() ? v : null; } catch (e) { return null; } };
const setSess = u => { try { if (u) sessionStorage.setItem('xaro.adm', JSON.stringify({ u, exp: Date.now() + SESSION_MS })); else sessionStorage.removeItem('xaro.adm'); } catch (e) {} };
const meAdmin = () => { const s = sess(); if (!s) return null; const a = XD.admins().find(x => x.username === s.u && x.active); return a || null; };
const can = p => { const a = meAdmin(); return !!a && (a.role === 'owner' || (a.perms || []).includes(p)); };
let lastTouch = 0; const touch = () => { const n = Date.now(); if (n - lastTouch < 15000) return; lastTouch = n; const s = sess(); if (s) setSess(s.u); };
['pointerdown', 'keydown'].forEach(ev => addEventListener(ev, () => { if (root.classList.contains('on')) touch(); }, { passive: true }));
setInterval(() => { if (root.classList.contains('on') && root.querySelector('.shell') && !sess()) { toast('Session expired. Please sign in again.', true); render(); } }, 20000);

/* ---------------------------------------------------------------- helpers shared with the other admin modules */
const dt = v => { const d = new Date(v); return isNaN(d) ? '' : d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }); };
const dd = v => { const d = new Date(v); return isNaN(d) ? '' : d.toLocaleDateString('en-GB', { dateStyle: 'medium' }); };
const usdEq = (amt, cur) => (+amt || 0) / (XD.fxTable()[cur] || 1);
const money = (a, c) => XD.money(a, c);
const STATUS = ['Order received', 'In production', 'Quality check and packing', 'Dispatched', 'Delivered'];
const statusOf = o => o.cancelled ? 'Cancelled' : STATUS[o.stage] || '';
function csv(rows, name) {
  const cell = v => { v = v == null ? '' : String(v); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
  const blob = new Blob(['﻿' + rows.map(r => r.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }); const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function modal(o) {
  const m = document.createElement('div'); m.className = 'amod'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
  m.innerHTML = `<div class="sh ${o.wide ? 'wide' : ''}"><button class="x" aria-label="Close">&times;</button><h3>${esc(o.title)}</h3><div class="bd">${o.body}</div><div class="ft"></div></div>`;
  root.appendChild(m); const close = () => m.remove(); $('.x', m).onclick = close; m.addEventListener('mousedown', e => { if (e.target === m) close(); });
  const ft = $('.ft', m); (o.actions || []).forEach(a => { const b = document.createElement('button'); b.type = 'button'; b.className = 'b2 ' + (a.cls || ''); b.textContent = a.label; b.onclick = () => a.run(close, m); ft.appendChild(b); });
  if (!(o.actions || []).length) ft.remove(); const f = $('input,select,textarea', $('.bd', m)); if (f && !o.noFocus) setTimeout(() => f.focus(), 40);
  return { el: m, close };
}
const XADM = window.XADM = { $, $$, esc, root, toast, modal, csv, dt, dd, usdEq, money, can, me: meAdmin, hashPw, rand, secure, STATUS, statusOf, tabs: {}, order: [], render: () => render(), go: t => { location.hash = '#admin/' + t; } };
const reg = (id, title, icon, perm, fn) => { XADM.tabs[id] = { title, icon, perm, fn }; if (!XADM.order.includes(id)) XADM.order.push(id); };
XADM.reg = reg;

/* ---------------------------------------------------------------- login */
const LOCK = 'lock';
const lockState = () => XD.g(LOCK, { n: 0, until: 0 });
function loginView() {
  root.innerHTML = `<div class="login"><form class="lcard" id="admForm" novalidate><img src="${IMG.logoBlock}" alt="XARO"><h2>Admin <span class="neon">login</span></h2><p>XARO Industries staff only</p>
  <div class="field"><label for="aU">Username</label><input class="inp" id="aU" autocomplete="username" autocapitalize="none" spellcheck="false"></div>
  <div class="field"><label for="aP">Password</label><div class="pw"><input class="inp" id="aP" type="password" autocomplete="current-password"><button type="button" id="aShow" aria-label="Show password">SHOW</button></div></div>
  <div class="err" id="aErr" role="alert"></div><button class="btn" type="submit" id="aGo">Sign in</button>
  <p style="margin-top:12px"><a href="#" id="aBack" style="color:var(--neon)">Back to the store</a></p></form></div>`;
  root.appendChild(tt); const err = $('#aErr');
  if (!secure()) err.textContent = 'Admin login needs a secure connection (https). Open the site over https.';
  $('#aShow').onclick = () => { const p = $('#aP'); p.type = p.type === 'password' ? 'text' : 'password'; $('#aShow').textContent = p.type === 'password' ? 'SHOW' : 'HIDE'; };
  $('#aBack').onclick = e => { e.preventDefault(); location.hash = ''; };
  $('#admForm').addEventListener('submit', async e => {
    e.preventDefault(); if (!secure()) return; const u = $('#aU').value.trim(), p = $('#aP').value; const L = lockState();
    if (L.until > Date.now()) { err.textContent = 'Too many attempts. Try again in ' + Math.ceil((L.until - Date.now()) / 60000) + ' min.'; return; }
    if (!u || !p) { err.textContent = 'Enter your username and password.'; return; }
    $('#aGo').disabled = true; err.textContent = '';
    const a = XD.admins().find(x => x.username.toLowerCase() === u.toLowerCase()); let ok = false;
    try { const h = await hashPw(p, a ? a.salt : '00'.repeat(16), a ? a.iter : 120000); ok = !!(a && a.active && h === a.hash); } catch (x) { ok = false; }
    $('#aGo').disabled = false;
    if (ok) { XD.s(LOCK, { n: 0, until: 0 }); setSess(a.username); const l = XD.admins(); l.find(x => x.username === a.username).last = new Date().toISOString(); XD.saveAdmins(l); if (!/^#\/?admin\/\w+/i.test(location.hash)) location.hash = '#admin/dashboard'; render(); }
    else { const n = (L.n || 0) + 1; XD.s(LOCK, n >= 5 ? { n: 0, until: Date.now() + 5 * 60000 } : { n, until: 0 }); err.textContent = n >= 5 ? 'Too many attempts. Locked for 5 minutes.' : (a && !a.active ? 'This account is disabled.' : 'Wrong username or password.') + ' (' + Math.max(0, 5 - n) + ' tries left)'; $('#aP').value = ''; $('#aP').focus(); }
  });
  setTimeout(() => $('#aU').focus(), 60);
}

/* ---------------------------------------------------------------- shell */
let cur = 'dashboard';
const routeTab = () => { const m = location.hash.match(/^#\/?admin\/(\w+)/i); return m ? m[1].toLowerCase() : 'dashboard'; };
function render() {
  const a = meAdmin(); if (!a) { setSess(null); loginView(); return; }
  const allowed = XADM.order.filter(id => XADM.tabs[id] && can(XADM.tabs[id].perm));
  cur = routeTab(); if (!allowed.includes(cur)) cur = allowed[0] || '';
  root.innerHTML = `<div class="shell"><nav class="side" aria-label="Admin sections"><div class="lg"><img src="${IMG.logoBlock}" alt=""><div><b>XARO</b><small>Admin</small></div></div>
  ${allowed.map(id => `<button class="nv" data-tab="${id}" ${id === cur ? 'aria-current="page"' : ''}><i>${XADM.tabs[id].icon}</i>${esc(XADM.tabs[id].title)}</button>`).join('')}
  <div class="who"><b>${esc(a.name || a.username)}</b>${esc(a.username)} | ${a.role === 'owner' ? 'owner' : 'admin'}</div></nav>
  <div class="main"><div class="bar"><h1>${esc(cur ? XADM.tabs[cur].title : 'No access')}</h1><div class="acts"><button class="b2" id="aPw">My password</button><button class="b2" id="aView">View store</button><button class="b2 bad" id="aOut">Log out</button></div></div><div id="admMain"></div></div></div>`;
  root.appendChild(tt);
  $$('.nv', root).forEach(b => b.onclick = () => { location.hash = '#admin/' + b.dataset.tab; });
  $('#aView').onclick = () => { location.hash = ''; }; $('#aOut').onclick = () => { setSess(null); render(); };
  $('#aPw').onclick = myPassword;
  const box = $('#admMain'); if (!cur) { box.innerHTML = '<div class="empty2">Your account has no permissions yet. Ask the owner to enable some.</div>'; return; }
  try { XADM.tabs[cur].fn(box); } catch (e) { box.innerHTML = '<div class="empty2">Something went wrong in this section.</div>'; console.error(e); }
}
function myPassword() {
  const a = meAdmin(); if (!a) return;
  modal({ title: 'Change my password', body: `<div class="field"><label for="pwO">Current password</label><input class="inp" id="pwO" type="password" autocomplete="current-password"></div><div class="field"><label for="pwN">New password (8+ characters)</label><input class="inp" id="pwN" type="password" autocomplete="new-password"></div><div class="field"><label for="pwC">Repeat new password</label><input class="inp" id="pwC" type="password" autocomplete="new-password"></div><div class="err" id="pwE"></div>`,
    actions: [{ label: 'Save password', cls: 'pri', run: async close => {
      const e = $('#pwE'), o = $('#pwO').value, n = $('#pwN').value, c = $('#pwC').value;
      if (await hashPw(o, a.salt, a.iter) !== a.hash) { e.textContent = 'Current password is wrong.'; return; }
      if (n.length < 8) { e.textContent = 'Use at least 8 characters.'; return; } if (n !== c) { e.textContent = 'The two new passwords do not match.'; return; }
      const l = XD.admins(), x = l.find(y => y.username === a.username); x.salt = rand(16); x.iter = 310000; x.hash = await hashPw(n, x.salt, x.iter); XD.saveAdmins(l); close(); toast('Password changed'); } }] });
}

/* ---------------------------------------------------------------- charts (inline SVG) */
function barsSvg(labels, vals, vals2) {
  const W = 600, H = 190, pl = 30, pb = 22, n = labels.length, bw = (W - pl) / n, mx = Math.max(1, ...vals), m2 = Math.max(1, ...(vals2 || [0]));
  let g = '';[0, .5, 1].forEach(f => { const y = H - pb - f * (H - pb - 10); g += `<line x1="${pl}" x2="${W}" y1="${y}" y2="${y}" stroke="#1d241c"/><text x="2" y="${y + 4}" fill="#7d8777" font-size="10">${Math.round(mx * f)}</text>`; });
  vals.forEach((v, i) => { const h = v / mx * (H - pb - 10), x = pl + i * bw + bw * .18; g += `<rect x="${x}" y="${H - pb - h}" width="${bw * .64}" height="${Math.max(h, v ? 1.5 : 0)}" fill="#2a6b1c" rx="2"><title>${esc(labels[i])}: ${v} visitors</title></rect>`; });
  if (vals2) { const pts = vals2.map((v, i) => [pl + i * bw + bw / 2, H - pb - v / m2 * (H - pb - 10)]); g += `<polyline fill="none" stroke="#39FF14" stroke-width="2" points="${pts.map(p => p.join(',')).join(' ')}"/>` + pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="#39FF14"><title>${esc(labels[i])}: ${vals2[i]} orders</title></circle>`).join(''); }
  const step = Math.ceil(n / 7); labels.forEach((l, i) => { if (i % step === 0 || i === n - 1) g += `<text x="${pl + i * bw + bw / 2}" y="${H - 6}" fill="#7d8777" font-size="10" text-anchor="middle">${esc(l)}</text>`; });
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Daily visitors and orders">${g}</svg>`;
}
const hbars = (items, f) => { const mx = Math.max(1, ...items.map(i => i.v)); return items.length ? items.map(i => `<div class="hbar"><span>${esc(i.l)}</span><span class="tr"><i style="width:${Math.max(2, i.v / mx * 100)}%"></i></span><span>${f ? f(i.v) : i.v}</span></div>`).join('') : '<div class="empty2">No data yet</div>'; };

/* ---------------------------------------------------------------- dashboard */
reg('dashboard', 'Dashboard', '▦', 'dashboard', box => {
  let days = +(XD.g('adm_days', 14)) || 14;
  const draw = () => {
    const now = Date.now(), from = now - days * 864e5, ev = XD.events().filter(e => e.t >= from), ords = XD.orders().filter(o => new Date(o.at).getTime() >= from), live = ords.filter(o => !o.cancelled);
    const uniq = t => new Set(ev.filter(e => e.type === t).map(e => e.sid)).size, visitors = uniq('visit'), visits = ev.filter(e => e.type === 'visit').length;
    const rev = live.reduce((a, o) => a + usdEq(o.total, o.cur), 0), cust = XD.customers(), newC = cust.filter(c => new Date(c.at).getTime() >= from).length;
    const dayKey = t => new Date(t).toISOString().slice(0, 10), labs = [], dv = [], dord = [], map = {};
    for (let i = days - 1; i >= 0; i--) { const d = new Date(now - i * 864e5), k = d.toISOString().slice(0, 10); map[k] = { v: new Set(), o: 0 }; labs.push(d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })); }
    ev.forEach(e => { const k = dayKey(e.t); if (map[k] && e.type === 'visit') map[k].v.add(e.sid); }); live.forEach(o => { const k = dayKey(new Date(o.at).getTime()); if (map[k]) map[k].o++; });
    Object.values(map).forEach(m => { dv.push(m.v.size); dord.push(m.o); });
    const fun = [['Visitors', visitors], ['Viewed a product', uniq('view')], ['Added to cart', uniq('add')], ['Reached checkout', uniq('checkout')], ['Placed an order', uniq('order')]];
    const prod = {}; ev.forEach(e => { if (e.sku) { (prod[e.sku] = prod[e.sku] || { v: 0, a: 0, o: 0 }); if (e.type === 'view') prod[e.sku].v++; if (e.type === 'add') prod[e.sku].a++; } }); live.forEach(o => o.items.forEach(i => { (prod[i.sku] = prod[i.sku] || { v: 0, a: 0, o: 0 }).o += i.qty; }));
    const names = Object.fromEntries(XD.products().map(p => [p.sku, p.name]));
    const byC = {}; live.forEach(o => { byC[o.country] = (byC[o.country] || 0) + usdEq(o.total, o.cur); }); const custC = {}; cust.forEach(c => { custC[c.country || '?'] = (custC[c.country || '?'] || 0) + 1; });
    const chat = XD.chatlog().filter(c => c.t >= from), convs = new Set(chat.map(c => c.sid)).size, un = XD.unanswered().filter(u => u.t >= from).length;
    const recentO = XD.orders().slice(-6).reverse(), recentC = cust.slice(-6).reverse();
    box.innerHTML = `<div class="note2">The dashboard shows data saved in <b>this browser</b>. Visitors on other devices appear here only after the store is connected to a backend. Their sign-ups and orders can be sent to your own Google Sheet today (Settings, Sync).</div>
    <div class="tools"><label for="dRange" class="sr">Date range</label><select class="inp" id="dRange">${[7, 14, 30, 90].map(n => `<option value="${n}" ${n === days ? 'selected' : ''}>Last ${n} days</option>`).join('')}</select><span class="note" style="margin:0">Revenue is an approximate US$ value using your exchange rates.</span></div>
    <div class="kpis"><div class="kpi"><small>Visitors</small><b>${visitors}</b><em>${visits} page loads</em></div><div class="kpi"><small>New customers</small><b>${newC}</b><em>${cust.length} total</em></div><div class="kpi"><small>Orders</small><b>${live.length}</b><em>${ords.length - live.length} cancelled</em></div>
    <div class="kpi"><small>Revenue (approx.)</small><b>$${Math.round(rev).toLocaleString('en')}</b><em>avg $${live.length ? Math.round(rev / live.length).toLocaleString('en') : 0} per order</em></div><div class="kpi"><small>Conversion</small><b>${visitors ? (fun[4][1] / visitors * 100).toFixed(1) : '0.0'}%</b><em>visitors who ordered</em></div><div class="kpi"><small>Assistant chats</small><b>${convs}</b><em>${un} unanswered</em></div></div>
    <div class="grid2"><div class="pan"><h3>Daily visitors (bars) and orders (line)</h3>${barsSvg(labs, dv, dord)}</div><div class="pan"><h3>Shopping funnel</h3>${hbars(fun.map(f => ({ l: f[0], v: f[1] })))}</div></div>
    <div class="grid2"><div class="pan"><h3>Revenue by country (approx. US$)</h3>${hbars(Object.entries(byC).sort((a, b) => b[1] - a[1]).map(([c, v]) => ({ l: XD.country(c).name, v: Math.round(v) })), v => '$' + v.toLocaleString('en'))}</div>
    <div class="pan"><h3>Customers by country</h3>${hbars(Object.entries(custC).sort((a, b) => b[1] - a[1]).map(([c, v]) => ({ l: c === '?' ? 'Unknown' : XD.country(c).name, v })))}</div></div>
    <div class="grid2"><div class="pan"><h3>Top products (views / carts / units ordered)</h3>${Object.entries(prod).sort((a, b) => (b[1].v + b[1].a * 3 + b[1].o * 8) - (a[1].v + a[1].a * 3 + a[1].o * 8)).slice(0, 6).map(([k, v]) => `<div class="logline"><b>${esc(names[k] || k)}</b> <small>${v.v} views | ${v.a} carts | ${v.o} ordered</small></div>`).join('') || '<div class="empty2">No data yet</div>'}</div>
    <div class="pan"><h3>Latest orders</h3>${recentO.map(o => `<div class="logline"><b>${esc(o.id)}</b> ${esc(o.name)} <small>${money(o.total, o.cur)} | ${esc(statusOf(o))} | ${dt(o.at)}</small></div>`).join('') || '<div class="empty2">No orders yet</div>'}</div></div>
    <div class="pan"><h3>Latest customers (name, email, phone, country)</h3>${recentC.map(c => `<div class="logline"><b>${esc(c.name || '(no name)')}</b> ${esc(c.email)} ${esc(c.phone)} <small>${esc(XD.country(c.country).name)} | ${esc(c.source)} | ${dt(c.at)}</small></div>`).join('') || '<div class="empty2">No customers yet</div>'}</div>`;
    $('#dRange').onchange = e => { days = +e.target.value; XD.s('adm_days', days); draw(); };
  };
  draw();
});

/* ---------------------------------------------------------------- customers */
reg('customers', 'Customers', '☺', 'customers', box => {
  let q = '', fc = '', sort = 'last';
  const rows = () => { const os = XD.orders(); let l = XD.customers().map(c => { const mine = os.filter(o => !o.cancelled && (o.cid === c.id || String(o.email).toLowerCase() === c.email)); return Object.assign({}, c, { n: mine.length, spent: mine.reduce((a, o) => a + usdEq(o.total, o.cur), 0) }); });
    if (q) { const k = q.toLowerCase(); l = l.filter(c => (c.name + ' ' + c.email + ' ' + c.phone).toLowerCase().includes(k)); } if (fc) l = l.filter(c => c.country === fc);
    l.sort((a, b) => sort === 'spent' ? b.spent - a.spent : sort === 'name' ? String(a.name).localeCompare(b.name) : new Date(b.last) - new Date(a.last)); return l; };
  const draw = () => {
    const l = rows();
    box.innerHTML = `<div class="tools"><input class="inp" id="cQ" placeholder="Search name, email or phone" value="${esc(q)}" aria-label="Search customers"><select class="inp" id="cC" aria-label="Country"><option value="">All countries</option>${XD.countries().map(c => `<option value="${c.code}" ${c.code === fc ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
    <select class="inp" id="cS" aria-label="Sort"><option value="last" ${sort === 'last' ? 'selected' : ''}>Last seen</option><option value="spent" ${sort === 'spent' ? 'selected' : ''}>Most spent</option><option value="name" ${sort === 'name' ? 'selected' : ''}>Name</option></select><button class="b2" id="cX">Export CSV</button><span class="note" style="margin:0">${l.length} customer(s)</span></div>
    <div class="tw"><table class="t"><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Country</th><th>Source</th><th>Joined</th><th>Last seen</th><th class="num">Orders</th><th class="num">Spent (US$ approx)</th></tr></thead><tbody>
    ${l.map(c => `<tr class="click" data-id="${esc(c.id)}"><td><b>${esc(c.name || '(no name)')}</b></td><td>${esc(c.email)}</td><td>${esc(c.phone)}</td><td>${esc(XD.country(c.country).name)}</td><td><span class="pill ${c.source === 'order' ? 'g' : ''}">${esc(c.source)}</span></td><td>${dd(c.at)}</td><td>${dt(c.last)}</td><td class="num">${c.n}</td><td class="num">${Math.round(c.spent).toLocaleString('en')}</td></tr>`).join('') || '<tr><td colspan="9"><div class="empty2">No customers yet. They appear here when someone signs in to the store, joins the waitlist or orders.</div></td></tr>'}</tbody></table></div>`;
    $('#cQ').oninput = e => { q = e.target.value; const p = e.target.selectionStart; draw(); const n = $('#cQ'); n.focus(); n.setSelectionRange(p, p); }; $('#cC').onchange = e => { fc = e.target.value; draw(); }; $('#cS').onchange = e => { sort = e.target.value; draw(); };
    $('#cX').onclick = () => csv([['Name', 'Email', 'Phone', 'Country', 'Currency', 'Source', 'Joined', 'Last seen', 'Orders', 'Spent USD approx', 'Notes']].concat(l.map(c => [c.name, c.email, c.phone, XD.country(c.country).name, c.cur, c.source, c.at, c.last, c.n, Math.round(c.spent), c.notes])), 'xaro-customers.csv');
    $$('tr.click', box).forEach(r => r.onclick = () => detail(r.dataset.id));
  };
  const detail = id => {
    const c = XD.customers().find(x => x.id === id); if (!c) return; const os = XD.orders().filter(o => o.cid === c.id || String(o.email).toLowerCase() === c.email);
    modal({ title: c.name || c.email, wide: true, body: `<div class="f2a"><div><div class="lbl">Email</div><p>${esc(c.email)}</p><div class="lbl">Phone</div><p>${esc(c.phone) || '-'}</p></div><div><div class="lbl">Country / currency</div><p>${esc(XD.country(c.country).name)} | ${esc(c.cur)}</p><div class="lbl">Joined / last seen</div><p>${dt(c.at)}<br>${dt(c.last)} (${c.visits || 1} visits)</p></div></div>
      <div class="field"><label for="cNote">Internal notes</label><textarea class="inp" id="cNote">${esc(c.notes || '')}</textarea></div>
      <div class="lbl" style="margin-bottom:6px">Orders (${os.length})</div>${os.map(o => `<div class="logline"><b>${esc(o.id)}</b> ${money(o.total, o.cur)} <small>${esc(statusOf(o))} | ${dt(o.at)}</small></div>`).join('') || '<p class="note">No orders yet.</p>'}`,
      actions: [{ label: 'Delete customer', cls: 'bad', run: close => { if (!confirm('Delete this customer record? Their orders stay.')) return; XD.saveCustomers(XD.customers().filter(x => x.id !== id)); close(); draw(); toast('Customer deleted'); } },
        { label: 'Save notes', cls: 'pri', run: close => { const l = XD.customers(); l.find(x => x.id === id).notes = $('#cNote').value.slice(0, 1000); XD.saveCustomers(l); close(); draw(); toast('Saved'); } }] });
  };
  draw();
});

/* ---------------------------------------------------------------- orders */
reg('orders', 'Orders', '☰', 'orders', box => {
  let q = '', fs = '', fc = '';
  const list = () => { let l = XD.orders().slice().reverse(); if (q) { const k = q.toLowerCase(); l = l.filter(o => (o.id + ' ' + o.name + ' ' + o.email + ' ' + o.phone).toLowerCase().includes(k)); } if (fc) l = l.filter(o => o.country === fc); if (fs !== '') l = l.filter(o => fs === 'x' ? o.cancelled : (!o.cancelled && o.stage === +fs)); return l; };
  const draw = () => {
    const l = list();
    box.innerHTML = `<div class="tools"><input class="inp" id="oQ" placeholder="Search order, name, email, phone" value="${esc(q)}" aria-label="Search orders"><select class="inp" id="oS" aria-label="Status"><option value="">All statuses</option>${STATUS.map((s, i) => `<option value="${i}" ${fs === String(i) ? 'selected' : ''}>${s}</option>`).join('')}<option value="x" ${fs === 'x' ? 'selected' : ''}>Cancelled</option></select>
    <select class="inp" id="oC" aria-label="Country"><option value="">All countries</option>${XD.countries().map(c => `<option value="${c.code}" ${c.code === fc ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select><button class="b2" id="oX">Export CSV</button><span class="note" style="margin:0">${l.length} order(s)</span></div>
    <div class="tw"><table class="t"><thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Country</th><th>Items</th><th class="num">Total</th><th>Status</th></tr></thead><tbody>
    ${l.map(o => `<tr class="click" data-id="${esc(o.id)}"><td><b>${esc(o.id)}</b></td><td>${dt(o.at)}</td><td>${esc(o.name)}<br><small style="color:var(--mute)">${esc(o.email)} ${esc(o.phone)}</small></td><td>${esc(XD.country(o.country).name)}</td><td>${o.items.reduce((a, i) => a + i.qty, 0)}</td><td class="num">${money(o.total, o.cur)}</td><td><span class="pill ${o.cancelled ? 'r' : o.stage === 4 ? 'g' : 'w'}">${esc(statusOf(o))}</span></td></tr>`).join('') || '<tr><td colspan="7"><div class="empty2">No orders yet.</div></td></tr>'}</tbody></table></div>`;
    $('#oQ').oninput = e => { q = e.target.value; const p = e.target.selectionStart; draw(); const n = $('#oQ'); n.focus(); n.setSelectionRange(p, p); }; $('#oS').onchange = e => { fs = e.target.value; draw(); }; $('#oC').onchange = e => { fc = e.target.value; draw(); };
    $('#oX').onclick = () => csv([['Order', 'Date', 'Name', 'Email', 'Phone', 'Country', 'Currency', 'Total', 'Status', 'Tracking', 'Address', 'City', 'Postcode', 'Items']].concat(l.map(o => [o.id, o.at, o.name, o.email, o.phone, XD.country(o.country).name, o.cur, o.total, statusOf(o), o.tracking, (o.address || {}).line, (o.address || {}).city, (o.address || {}).zip, o.items.map(i => i.qty + 'x ' + i.name).join('; ')])), 'xaro-orders.csv');
    $$('tr.click', box).forEach(r => r.onclick = () => detail(r.dataset.id));
  };
  const detail = id => {
    const o = XD.orders().find(x => x.id === id); if (!o) return; const a = o.address || {};
    modal({ title: 'Order ' + o.id, wide: true, body: `<div class="f2a"><div><div class="lbl">Customer</div><p><b>${esc(o.name)}</b><br>${esc(o.email)}<br>${esc(o.phone)}</p></div><div><div class="lbl">Ship to</div><p>${esc(a.line)}<br>${esc(a.city)} ${esc(a.zip)}<br>${esc(XD.country(o.country).name)}</p></div></div>
      <div class="tw" style="margin-bottom:12px"><table class="t" style="min-width:0"><thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Unit</th></tr></thead><tbody>${o.items.map(i => `<tr><td>${esc(i.name || i.sku)}<br><small style="color:var(--mute)">${esc(i.sku)}${i.design ? ' | ' + esc(i.design) : ''}${i.dep ? ' | 50% deposit' : ''}${i.file ? ' | art: ' + esc(i.file) : ''}${i.note ? ' | ' + esc(i.note) : ''}</small></td><td class="num">${i.qty}</td><td class="num">${money(i.unit, o.cur)}</td></tr>`).join('')}</tbody></table></div>
      <p>Total due today: <b>${money(o.total, o.cur)}</b> ${o.ship ? '(includes shipping ' + money(o.ship, o.cur) + ')' : ''} | Payment: ${esc(o.pay || 'Preview')} | Placed ${dt(o.at)}</p>
      <div class="f2a"><div class="field"><label for="oSt">Status</label><select class="inp" id="oSt">${STATUS.map((s, i) => `<option value="${i}" ${!o.cancelled && o.stage === i ? 'selected' : ''}>${s}</option>`).join('')}<option value="x" ${o.cancelled ? 'selected' : ''}>Cancelled</option></select></div><div class="field"><label for="oTr">Courier tracking number</label><input class="inp" id="oTr" value="${esc(o.tracking || '')}"></div></div>
      <div class="field"><label for="oNt">Internal notes</label><textarea class="inp" id="oNt">${esc(o.notes || '')}</textarea></div>`,
      actions: [{ label: 'Delete order', cls: 'bad', run: close => { if (!confirm('Delete this order permanently?')) return; XD.saveOrders(XD.orders().filter(x => x.id !== id)); close(); draw(); toast('Order deleted'); } },
        { label: 'Save', cls: 'pri', run: close => { const l = XD.orders(), x = l.find(y => y.id === id), v = $('#oSt').value; x.cancelled = v === 'x'; if (!x.cancelled) x.stage = +v; x.tracking = $('#oTr').value.trim().slice(0, 60); x.notes = $('#oNt').value.slice(0, 1000); XD.saveOrders(l); close(); draw(); toast('Order updated'); } }] });
  };
  draw();
});

/* ---------------------------------------------------------------- routing */
function route() {
  const on = /^#\/?admin/i.test(location.hash);
  if (on) { root.classList.add('on'); document.body.classList.add('admin-open'); render(); }
  else if (root.classList.contains('on')) { root.classList.remove('on'); document.body.classList.remove('admin-open'); root.innerHTML = ''; dispatchEvent(new Event('xaro-admin-exit')); try { XARO.refresh(); } catch (e) {} }
}
addEventListener('hashchange', route); route();
})();
