/* ============ admin: admin users + permissions, assistant, settings and data ============ */
(() => {
'use strict';
const A = window.XADM, { $, $$, esc, modal, toast } = A;

/* ---------------------------------------------------------------- admin users */
const PW_MIN = 8;
const pwOk = p => p.length >= PW_MIN && /[a-z]/i.test(p) && /\d/.test(p);
const userOk = u => /^[A-Za-z0-9._-]{3,32}$/.test(u);
const permLabel = k => (XD.ALL_PERMS.find(p => p[0] === k) || [k, k])[1];

A.reg('admins', 'Admin users', '♛', 'admins', box => {
  const me = A.me(), isOwner = me && me.role === 'owner';
  const draw = () => {
    const l = XD.admins();
    box.innerHTML = `<div class="tools"><button class="b2 pri" id="uAdd">+ New admin user</button></div>
    <div class="note2">Each admin signs in at the Staff login link with their own username and password. You choose which sections they can open. Only the owner can give the "Admin users" permission. Login happens in the browser of this demo version, so treat it as a convenience lock, not bank-grade security (see Settings).</div>
    <div class="tw"><table class="t"><thead><tr><th>User</th><th>Role</th><th>Can open</th><th>Status</th><th>Last sign-in</th><th></th></tr></thead><tbody>
    ${l.map(u => `<tr><td><b>${esc(u.username)}</b><br><small style="color:var(--mute)">${esc(u.name || '')}</small></td>
      <td><span class="pill ${u.role === 'owner' ? 'g' : ''}">${esc(u.role)}</span></td>
      <td style="max-width:360px">${u.role === 'owner' ? 'Everything' : ((u.perms || []).map(p => `<span class="pill" style="margin:1px">${esc(permLabel(p))}</span>`).join(' ') || '<small style="color:var(--mute)">nothing</small>')}</td>
      <td><span class="pill ${u.active ? 'g' : 'r'}">${u.active ? 'Active' : 'Disabled'}</span></td><td>${u.last ? A.dt(u.last) : '<small style="color:var(--mute)">never</small>'}</td>
      <td style="white-space:nowrap">${u.role === 'owner' && !isOwner ? '' : `<button class="b2 sm" data-e="${esc(u.username)}">Edit</button> <button class="b2 sm" data-r="${esc(u.username)}">Reset password</button>${u.role === 'owner' ? '' : ` <button class="b2 sm bad" data-d="${esc(u.username)}">Delete</button>`}`}</td></tr>`).join('')}
    </tbody></table></div>`;
    $('#uAdd').onclick = () => edit(null);
    $$('[data-e]', box).forEach(b => b.onclick = () => edit(b.dataset.e));
    $$('[data-r]', box).forEach(b => b.onclick = () => reset(b.dataset.r));
    $$('[data-d]', box).forEach(b => b.onclick = () => {
      const u = XD.admins().find(x => x.username === b.dataset.d); if (!u || u.role === 'owner') return;
      if (!confirm('Delete admin user "' + u.username + '"? They will no longer be able to sign in.')) return;
      XD.saveAdmins(XD.admins().filter(x => x.username !== u.username)); toast('Admin removed'); draw();
    });
  };
  function permBoxes(sel, owner) {
    return XD.ALL_PERMS.map(([k, t]) => { const locked = k === 'admins' && !owner; return `<label style="${locked ? 'opacity:.5' : ''}"><input type="checkbox" name="perm" value="${k}" ${sel.includes(k) ? 'checked' : ''} ${locked ? 'disabled' : ''}> ${esc(t)}</label>`; }).join('');
  }
  function edit(username) {
    const cur = username ? XD.admins().find(x => x.username === username) : null;
    const isOwnerRow = cur && cur.role === 'owner';
    const m = modal({
      title: cur ? 'Edit ' + cur.username : 'New admin user', wide: true,
      body: `<div class="f2a">
        <div class="field"><label for="uN">Username</label><input class="inp" id="uN" value="${esc(cur ? cur.username : '')}" ${cur ? 'disabled' : ''} autocapitalize="none" spellcheck="false" autocomplete="off"><small>Letters, numbers, dot, dash, underscore. 3 to 32 characters.</small></div>
        <div class="field"><label for="uF">Full name</label><input class="inp" id="uF" value="${esc(cur ? cur.name || '' : '')}" autocomplete="off"></div>
        ${cur ? '' : `<div class="field"><label for="uP">Password</label><input class="inp" id="uP" type="text" autocomplete="off" spellcheck="false"><small>At least ${PW_MIN} characters with a letter and a number. Share it with them privately.</small></div>
        <div class="field"><label>&nbsp;</label><button type="button" class="b2" id="uG">Generate a password</button></div>`}
      </div>
      ${isOwnerRow ? '<p class="note2">The owner always has every permission.</p>' : `<div class="field"><label>Permissions</label><div class="perms">${permBoxes((cur ? cur.perms : ['dashboard']) || [], isOwner)}</div>
        <p style="margin:8px 0 0;display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="b2 sm" id="uAll">Select all</button><button type="button" class="b2 sm" id="uNone">Clear</button><button type="button" class="b2 sm" id="uView">View-only preset</button></p></div>
        <label class="tg"><input type="checkbox" id="uA" ${!cur || cur.active ? 'checked' : ''}> <span>Account is active</span></label>`}
      <div class="err" id="uE" role="alert"></div>`,
      actions: [{ label: 'Cancel', run: c => c() }, {
        label: cur ? 'Save changes' : 'Create admin', cls: 'pri', run: async close => {
          const er = $('#uE', m.el); er.textContent = '';
          const perms = $$('[name=perm]:checked', m.el).map(x => x.value);
          if (cur) {
            const l = XD.admins(), u = l.find(x => x.username === cur.username); u.name = $('#uF', m.el).value.trim().slice(0, 60);
            if (!isOwnerRow) { u.perms = perms; u.active = $('#uA', m.el).checked; }
            XD.saveAdmins(l); toast('Saved'); close(); draw(); return;
          }
          const un = $('#uN', m.el).value.trim(), pw = $('#uP', m.el).value;
          if (!userOk(un)) { er.textContent = 'Username must be 3 to 32 characters: letters, numbers, . - _'; return; }
          if (XD.admins().some(x => x.username.toLowerCase() === un.toLowerCase())) { er.textContent = 'That username is already taken.'; return; }
          if (!pwOk(pw)) { er.textContent = `Password needs at least ${PW_MIN} characters with a letter and a number.`; return; }
          if (!perms.length) { er.textContent = 'Pick at least one permission.'; return; }
          if (!A.secure()) { er.textContent = 'Secure password storage needs https or localhost.'; return; }
          const salt = A.rand(16), iter = 310000, hash = await A.hashPw(pw, salt, iter);
          const l = XD.admins(); l.push({ username: un, name: $('#uF', m.el).value.trim().slice(0, 60), role: 'admin', perms, active: $('#uA', m.el).checked, salt, hash, iter, at: new Date().toISOString(), last: '' });
          XD.saveAdmins(l); toast('Admin created'); close(); draw();
        }
      }]
    });
    const g = $('#uG', m.el); if (g) g.onclick = () => { const c = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const r = crypto.getRandomValues(new Uint8Array(12)); $('#uP', m.el).value = [...r].map(x => c[x % c.length]).join('') + '7'; };
    const setAll = v => $$('[name=perm]:not(:disabled)', m.el).forEach(x => { x.checked = v; });
    const a = $('#uAll', m.el); if (a) { a.onclick = () => setAll(true); $('#uNone', m.el).onclick = () => setAll(false); $('#uView', m.el).onclick = () => { setAll(false); ['dashboard', 'customers', 'orders'].forEach(k => { const x = $('[value=' + k + ']', m.el); if (x) x.checked = true; }); }; }
  }
  function reset(username) {
    const u = XD.admins().find(x => x.username === username); if (!u) return;
    const m = modal({
      title: 'Reset password for ' + u.username,
      body: `<div class="field"><label for="rP">New password</label><input class="inp" id="rP" type="text" autocomplete="off" spellcheck="false"><small>At least ${PW_MIN} characters with a letter and a number.</small></div><div class="err" id="rE" role="alert"></div>`,
      actions: [{ label: 'Cancel', run: c => c() }, {
        label: 'Set password', cls: 'pri', run: async close => {
          const pw = $('#rP', m.el).value, er = $('#rE', m.el);
          if (!pwOk(pw)) { er.textContent = `Needs at least ${PW_MIN} characters with a letter and a number.`; return; }
          if (!A.secure()) { er.textContent = 'Needs https or localhost.'; return; }
          const l = XD.admins(), x = l.find(y => y.username === username); x.salt = A.rand(16); x.iter = 310000; x.hash = await A.hashPw(pw, x.salt, x.iter); XD.saveAdmins(l); toast('Password updated'); close();
        }
      }]
    });
  }
  draw();
});

/* ---------------------------------------------------------------- assistant */
A.reg('assistant', 'Assistant', '☻', 'assistant', box => {
  let tab = 'kb';
  const draw = () => {
    const s = XD.settings(), un = XD.unanswered(), kbl = XD.kb(), log = XD.chatlog();
    const sessions = new Set(log.map(x => x.sid)).size, usr = log.filter(x => x.role === 'user').length;
    box.innerHTML = `<div class="note2">${esc(s.botName)} is a rule-based assistant: it matches what customers type against the keywords below and answers with the text you write. It is not a generative AI, so it will never invent prices or promises. Questions it cannot answer land in "Unanswered" so you can teach it.</div>
    <div class="kpis"><div class="kpi"><small>Conversations</small><b>${sessions}</b></div><div class="kpi"><small>Customer messages</small><b>${usr}</b></div><div class="kpi"><small>Unanswered</small><b>${un.length}</b></div><div class="kpi"><small>Knowledge entries</small><b>${kbl.length}</b></div></div>
    <div class="tools"><button class="b2 ${tab === 'kb' ? 'pri' : ''}" data-t="kb">Knowledge</button><button class="b2 ${tab === 'un' ? 'pri' : ''}" data-t="un">Unanswered (${un.length})</button><button class="b2 ${tab === 'log' ? 'pri' : ''}" data-t="log">Conversations</button><button class="b2 ${tab === 'set' ? 'pri' : ''}" data-t="set">Assistant settings</button></div><div id="aBody"></div>`;
    $$('[data-t]', box).forEach(b => b.onclick = () => { tab = b.dataset.t; draw(); });
    const body = $('#aBody', box);
    if (tab === 'kb') kbView(body); else if (tab === 'un') unView(body); else if (tab === 'log') logView(body); else setView(body);
  };
  function kbView(body) {
    const l = XD.kb();
    body.innerHTML = `<div class="tools"><button class="b2 pri" id="kA">+ Add answer</button><button class="b2 bad" id="kR">Reset to defaults</button></div>
    <div class="tw"><table class="t"><thead><tr><th>Topic</th><th>Customer words that trigger it</th><th>Answer</th><th></th></tr></thead><tbody>
    ${l.map((k, i) => `<tr><td><b>${esc(k.name)}</b></td><td style="max-width:240px"><small>${esc((k.keys || []).join(', '))}</small></td><td style="max-width:380px"><small>${esc(k.a.length > 160 ? k.a.slice(0, 160) + '...' : k.a)}</small></td><td style="white-space:nowrap"><button class="b2 sm" data-e="${i}">Edit</button> <button class="b2 sm bad" data-d="${i}">Delete</button></td></tr>`).join('') || '<tr><td colspan="4"><div class="empty2">No answers yet.</div></td></tr>'}</tbody></table></div>`;
    $('#kA').onclick = () => kEdit(-1);
    $('#kR').onclick = () => { if (confirm('Replace all answers with the built-in defaults? Your edits to the knowledge list are lost.')) { XD.saveKb(XD.clone(XD.DEFAULT_KB)); toast('Defaults restored'); draw(); } };
    $$('[data-e]', body).forEach(b => b.onclick = () => kEdit(+b.dataset.e));
    $$('[data-d]', body).forEach(b => b.onclick = () => { const l2 = XD.kb(); if (confirm('Delete "' + l2[+b.dataset.d].name + '"?')) { l2.splice(+b.dataset.d, 1); XD.saveKb(l2); draw(); } });
  }
  function kEdit(i, pre) {
    const l = XD.kb(), k = i >= 0 ? l[i] : { name: '', keys: [], a: '' }; if (pre) { k.keys = pre.keys; k.a = pre.a || ''; k.name = pre.name || ''; }
    const m = modal({
      title: i >= 0 ? 'Edit answer' : 'Add answer', wide: true,
      body: `<div class="field"><label for="kN">Topic name</label><input class="inp" id="kN" value="${esc(k.name)}"></div>
      <div class="field"><label for="kK">Trigger words or phrases (comma separated)</label><input class="inp" id="kK" value="${esc((k.keys || []).join(', '))}"><small>Matches when the customer's message contains any of these. Use specific words.</small></div>
      <div class="field"><label for="kA2">Answer</label><textarea class="inp" id="kA2" rows="6" maxlength="900">${esc(k.a)}</textarea><small>Placeholders: {shipping} {payment} {contact} fill in the right text for the customer's country. Keep it honest and short.</small></div><div class="err" id="kE" role="alert"></div>`,
      actions: [{ label: 'Cancel', run: c => c() }, {
        label: 'Save', cls: 'pri', run: close => {
          const name = $('#kN', m.el).value.trim(), keys = $('#kK', m.el).value.split(',').map(x => x.trim().toLowerCase()).filter(Boolean), a = $('#kA2', m.el).value.trim(), er = $('#kE', m.el);
          if (!name || !keys.length || !a) { er.textContent = 'Fill in the topic, at least one trigger word and the answer.'; return; }
          const l2 = XD.kb(); const o = { id: k.id || 'k_' + XD.uid(), name, keys, a }; if (i >= 0) l2[i] = o; else l2.push(o); XD.saveKb(l2); toast('Saved'); close(); draw();
        }
      }]
    });
  }
  function unView(body) {
    const l = XD.unanswered().slice().reverse();
    body.innerHTML = l.length ? `<div class="tw"><table class="t"><thead><tr><th>Customer asked</th><th>When</th><th>Country</th><th></th></tr></thead><tbody>${l.map((u, i) => `<tr><td>${esc(u.q)}</td><td>${A.dt(u.t)}</td><td>${esc(u.country || '')}</td><td style="white-space:nowrap"><button class="b2 sm pri" data-a="${i}">Answer it</button> <button class="b2 sm" data-x="${i}">Dismiss</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty2">Nothing unanswered. Great.</div>';
    const rm = q => { XD.saveUnanswered(XD.unanswered().filter(x => x.q !== q)); };
    $$('[data-x]', body).forEach(b => b.onclick = () => { rm(l[+b.dataset.x].q); draw(); });
    $$('[data-a]', body).forEach(b => b.onclick = () => { const q = l[+b.dataset.a].q; const words = q.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 3).slice(0, 4); kEdit(-1, { name: q.slice(0, 40), keys: words, a: '' }); const iv = setInterval(() => { if (!$('#kN', A.root)) { clearInterval(iv); if (XD.kb().some(k => k.name === q.slice(0, 40))) rm(q); draw(); } }, 600); });
  }
  function logView(body) {
    const l = XD.chatlog().slice(-120).reverse();
    body.innerHTML = l.length ? `<div class="pan">${l.map(x => `<div class="logline"><small>${A.dt(x.t)} | ${esc(String(x.sid).slice(-5))}</small><br><span class="${x.role === 'user' ? 'u' : 'bt'}">${x.role === 'user' ? 'Customer' : esc(XD.settings().botName)}:</span> ${esc(x.text)}</div>`).join('')}</div><p style="margin-top:12px"><button class="b2 bad" id="lC">Clear conversation log</button> <button class="b2" id="lX">Export CSV</button></p>` : '<div class="empty2">No conversations yet.</div>';
    const c = $('#lC', body); if (c) { c.onclick = () => { if (confirm('Clear the whole conversation log?')) { XD.s('chat', []); draw(); } }; $('#lX', body).onclick = () => A.csv([['time', 'session', 'who', 'text']].concat(XD.chatlog().map(x => [new Date(x.t).toISOString(), x.sid, x.role, x.text])), 'xaro-chats.csv'); }
  }
  function setView(body) {
    const s = XD.settings();
    body.innerHTML = `<div class="pan" style="max-width:640px"><label class="tg"><input type="checkbox" id="sOn" ${s.botOn ? 'checked' : ''}> <span>Show the assistant to customers</span></label>
    <div class="field" style="margin-top:12px"><label for="sNm">Assistant name</label><input class="inp" id="sNm" maxlength="20" value="${esc(s.botName)}"></div>
    <button class="b2 pri" id="sSv">Save</button></div>`;
    $('#sSv').onclick = () => { XD.setSettings({ botOn: $('#sOn').checked, botName: $('#sNm').value.trim().slice(0, 20) || 'Zaro' }); window.dispatchEvent(new CustomEvent('xaro-bot-settings')); toast('Saved'); draw(); };
  }
  draw();
});

/* ---------------------------------------------------------------- settings and data */
A.reg('settings', 'Settings', '⚙', 'settings', box => {
  const draw = () => {
    const s = XD.settings(), cl = XD.countries().filter(c => c.code !== 'OT'), fx = XD.fxTable(), others = XD.CURRENCIES.filter(c => c !== 'USD');
    box.innerHTML = `
    <div class="grid2">
    <div class="pan"><h3>Store</h3>
      <div class="field"><label for="stN">Store name</label><input class="inp" id="stN" value="${esc(s.storeName)}"></div>
      <div class="f2a"><div class="field"><label for="stW">WhatsApp number (with country code)</label><input class="inp" id="stW" inputmode="tel" value="${esc(s.whatsapp)}" placeholder="+94 7X XXX XXXX"></div>
      <div class="field"><label for="stE">Contact email</label><input class="inp" id="stE" type="email" value="${esc(s.email)}"></div></div>
      <div class="field"><label for="stA">Announcement line (shown in the shop, optional)</label><input class="inp" id="stA" maxlength="120" value="${esc(s.announce)}"></div>
      <label class="tg"><input type="checkbox" id="stL" ${s.requireLogin ? 'checked' : ''}> <span>Customers must sign in (name, email, phone) before entering the shop</span></label>
      <p style="margin:12px 0 0"><button class="b2 pri" id="stSv">Save store settings</button></p></div>
    <div class="pan"><h3>Exchange rates (units per US$1)</h3>
      <p style="margin:0 0 10px;color:var(--mute);font-size:13px">Used when a product has no price entered for a country, and for the indicative "≈" amount when a visitor views prices in a different currency. Set these to today's rates.</p>
      <div class="pgrid">${others.map(c => `<div class="field"><label for="fx${c}">${c}</label><input class="inp" id="fx${c}" inputmode="decimal" value="${fx[c]}"></div>`).join('')}</div>
      <p style="margin:8px 0 0"><button class="b2 pri" id="fxSv">Save rates</button></p></div></div>
    <div class="pan" style="margin-bottom:14px"><h3>Countries</h3>
      <div class="tw"><table class="t"><thead><tr><th>Country</th><th>Currency</th><th>Selling</th><th>Delivery text customers see</th><th>Payment text</th></tr></thead><tbody>
      ${cl.map(c => `<tr><td><b>${esc(c.name)}</b></td><td>${c.cur}</td><td><label class="tg"><input type="checkbox" data-en="${c.code}" ${c.enabled ? 'checked' : ''}><span>${c.enabled ? 'Open' : 'Opening soon'}</span></label></td>
      <td><input class="inp" data-eta="${c.code}" value="${esc(c.eta)}" maxlength="140"></td><td><input class="inp" data-pay="${c.code}" value="${esc(c.pay)}" maxlength="140"></td></tr>`).join('')}</tbody></table></div>
      <p style="margin:10px 0 0"><button class="b2 pri" id="cSv">Save countries</button></p></div>
    <div class="grid2">
    <div class="pan"><h3>Save data to a Google Sheet (optional)</h3>
      <p style="margin:0 0 10px;color:var(--mute);font-size:13px;line-height:1.5">By default every sign-up and order is saved in the browser the customer or you are using, so you only see your own test data here. To collect real customers and orders from everyone into one Google Sheet, publish the included Apps Script as a web app and paste its https address below. See docs/BACKEND.md in the repository.</p>
      <div class="field"><label for="syU">Apps Script web app URL</label><input class="inp" id="syU" value="${esc(s.syncUrl)}" placeholder="https://script.google.com/macros/s/.../exec" autocapitalize="none" spellcheck="false"></div>
      <p style="margin:0;display:flex;gap:8px;flex-wrap:wrap"><button class="b2 pri" id="syS">Save</button><button class="b2" id="syT">Send a test row</button></p></div>
    <div class="pan"><h3>Backup and reset</h3>
      <p style="margin:0 0 10px;color:var(--mute);font-size:13px;line-height:1.5">Download everything held in this browser (products, prices, customers, orders, admins, assistant) or restore it on another device. The backup includes admin password hashes, so keep the file private.</p>
      <p style="margin:0;display:flex;gap:8px;flex-wrap:wrap"><button class="b2 pri" id="bkD">Download backup</button><label class="b2" style="cursor:pointer">Restore backup<input type="file" id="bkU" accept="application/json,.json" hidden></label><button class="b2 bad" id="bkR">Reset to demo data</button></p></div></div>`;
    const read = id => $('#' + id).value.trim();
    $('#stSv').onclick = () => {
      const w = read('stW'), e = read('stE');
      if (w && !/^\+?[0-9 ()-]{7,20}$/.test(w)) return toast('That WhatsApp number does not look right', true);
      if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) return toast('That email does not look right', true);
      XD.setSettings({ storeName: read('stN') || 'XARO Industries (Pvt) Ltd', whatsapp: w, email: e, announce: read('stA'), requireLogin: $('#stL').checked });
      toast('Saved'); if (window.XGATE && XGATE.check) XGATE.check(); if (window.XARO) XARO.refresh();
    };
    $('#fxSv').onclick = () => {
      const o = {}; for (const c of others) { const n = parseFloat(read('fx' + c)); if (!(n > 0) || !isFinite(n)) return toast(c + ' rate must be a positive number', true); o[c] = n; }
      XD.setFx(o); toast('Rates saved'); if (window.XARO) XARO.refresh();
    };
    $('#cSv').onclick = () => {
      const l = XD.countries().map(c => { if (c.code === 'OT') return c; const en = $('[data-en=' + c.code + ']'); return Object.assign({}, c, { enabled: en.checked, eta: $('[data-eta=' + c.code + ']').value.trim(), pay: $('[data-pay=' + c.code + ']').value.trim() }); });
      if (!l.some(c => c.enabled)) return toast('Keep at least one country open', true);
      XD.setCountries(l); toast('Countries saved'); if (window.XARO) { XARO.fillRegionSelects(); XARO.refresh(); } draw();
    };
    const url = () => read('syU');
    $('#syS').onclick = () => { const u = url(); if (u && !XD.syncOK(u)) return toast('Use the Google Apps Script web app address: https://script.google.com/macros/s/.../exec', true); XD.setSettings({ syncUrl: u }); toast(u ? 'Sync address saved' : 'Sync turned off'); };
    $('#syT').onclick = () => { const u = url(); if (!XD.syncOK(u)) return toast('Enter the Google Apps Script web app address first (https://script.google.com/macros/s/.../exec)', true); XD.setSettings({ syncUrl: u }); XD.sync('test', { note: 'Test from XARO admin', by: A.me().username }); toast('Test sent. Check your sheet in a few seconds. (The browser cannot read the reply.)'); };
    $('#bkD').onclick = () => { const b = new Blob([JSON.stringify(XD.exportAll(), null, 1)], { type: 'application/json' }), a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'xaro-backup-' + new Date().toISOString().slice(0, 10) + '.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
    $('#bkU').onchange = e => {
      const f = e.target.files[0]; if (!f) return; if (f.size > 20 * 1024 * 1024) return toast('That file is too large', true);
      const r = new FileReader(); r.onload = () => { try { const o = JSON.parse(r.result); if (!confirm('Restore this backup? It replaces the data held in this browser.')) return; XD.importAll(o); toast('Backup restored. Reloading...'); setTimeout(() => location.reload(), 900); } catch (err) { toast(err.message || 'Could not read that file', true); } }; r.readAsText(f);
    };
    $('#bkR').onclick = () => { if (!confirm('Reset ALL data in this browser to the demo defaults? Customers, orders, price edits and added products are deleted.')) return; if (prompt('Type RESET to confirm') !== 'RESET') return; XD.resetAll(); toast('Reset. Reloading...'); setTimeout(() => { location.hash = ''; location.reload(); }, 900); };
  };
  draw();
});
})();
