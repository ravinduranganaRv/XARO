/* ============ customer sign-in gate (name, email, phone, country, currency) ============ */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s), esc = XD.esc;
const emailOK = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
const adminRoute = () => /^#\/?admin/i.test(location.hash);
const box = document.createElement('div');
box.id = 'gate'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', 'gateT');
document.body.appendChild(box);

function build() {
  const r = XD.region(), cs = XD.countries();
  box.innerHTML = `<div class="box"><div class="hero"><img src="${IMG.logoBlock}" alt="XARO logo"><div class="cap">Hand-tufted in Sri Lanka<br>Shipped worldwide</div></div>
  <form id="gateForm" novalidate><h2 id="gateT">Enter the <span class="neon">store</span></h2><p class="sub">Sign in with your name, email and phone to see prices for your country and place orders.</p>
  <div class="field"><label for="gName">Full name</label><input class="inp" id="gName" autocomplete="name"></div>
  <div class="row2"><div class="field"><label for="gMail">Email (Gmail is fine)</label><input class="inp" id="gMail" type="email" autocomplete="email" inputmode="email"></div>
  <div class="field"><label for="gPhone">Phone number</label><div class="ph"><span class="dial" id="gDial"></span><input class="inp" id="gPhone" type="tel" autocomplete="tel-national" inputmode="tel"></div></div></div>
  <div class="row2"><div class="field"><label for="gCountry">Country</label><select class="inp" id="gCountry">${cs.map(c => `<option value="${c.code}">${esc(c.name)}</option>`).join('')}</select></div>
  <div class="field"><label for="gCur">Currency</label><select class="inp" id="gCur">${XD.CURRENCIES.map(c => `<option>${c}</option>`).join('')}</select></div></div>
  <label class="chk"><input type="checkbox" id="gOk"><span>I agree that XARO Industries may store my name, email and phone to handle my orders and contact me about them and about new drops. I can ask for my details to be deleted at any time.</span></label>
  <div class="err" id="gErr" role="alert"></div><button class="btn" type="submit">Enter the store</button>
  <p class="fine">Preview store: your details are saved in this browser, and sent to the store owner's sheet if one is connected. Email and phone are not verified yet. <a href="#admin" id="gStaff">Staff login</a></p></form></div>`;
  $('#gCountry').value = r.country; $('#gCur').value = r.cur; setDial();
  $('#gCountry').onchange = () => { $('#gCur').value = XD.country($('#gCountry').value).cur; setDial(); };
  $('#gStaff').onclick = () => { hide(); };
  $('#gateForm').addEventListener('submit', submit);
}
const setDial = () => { $('#gDial').textContent = XD.country($('#gCountry').value).dial || '+'; };
function show() { if (!$('#gateForm')) build(); box.classList.add('on'); document.body.classList.add('gate-open'); setTimeout(() => { const f = $('#gName'); f && f.focus(); }, 80); }
function hide() { box.classList.remove('on'); document.body.classList.remove('gate-open'); }

function submit(e) {
  e.preventDefault(); const er = $('#gErr'), v = id => $('#' + id).value.trim(), bad = (m, id) => { er.textContent = m; XARO.emit('oops', { why: 'gate' }, false); $('#' + id).focus(); };
  if (v('gName').length < 2) return bad('Enter your full name.', 'gName');
  if (!emailOK(v('gMail'))) return bad('Enter a valid email address.', 'gMail');
  const ph = v('gPhone').replace(/\D/g, ''); if (ph.length < 6 || ph.length > 12) return bad('Enter a valid phone number (digits only, without the country code).', 'gPhone');
  if (!$('#gOk').checked) return bad('Please tick the box to agree.', 'gOk');
  const code = $('#gCountry').value, cur = $('#gCur').value, dial = XD.country(code).dial, phone = (dial ? dial + ' ' : '') + ph.replace(/^0+/, '');
  const existed = XD.customers().some(c => c.email === v('gMail').toLowerCase());
  const c = XD.upsertCustomer({ name: v('gName'), email: v('gMail'), phone, country: code, cur, consent: true, source: 'signup' });
  XD.setMe(c.id); XD.track('signup', { returning: existed }); XD.sync('signup', { name: c.name, email: c.email, phone: c.phone, country: code, cur });
  hide(); XARO.applyRegion({ country: code, cur }, true); me(); XARO.emit('login', { name: c.name.split(' ')[0], returning: existed }, false);
  XARO.toast(existed ? 'Welcome back, ' + c.name.split(' ')[0] : 'Welcome, ' + c.name.split(' ')[0]);
}
function me() {
  const f = $('footer .cols > div:last-child'); if (!f) return; let line = $('#meLine');
  if (!line) { line = document.createElement('p'); line.id = 'meLine'; line.style.cssText = 'margin:12px 0 0;font-size:13px;color:var(--mute)'; f.appendChild(line); }
  const c = XD.me(); line.innerHTML = c ? `Signed in as <b style="color:var(--fg)">${esc(c.name)}</b> | <a href="#" id="signOut" style="color:var(--neon)">Switch account</a>` : '';
  const so = $('#signOut'); if (so) so.onclick = ev => { ev.preventDefault(); XD.setMe(''); me(); gateCheck(); };
}
function gateCheck() { if (adminRoute()) { hide(); return; } if (XD.settings().requireLogin && !XD.me()) show(); else hide(); }
addEventListener('hashchange', gateCheck);
addEventListener('xaro-admin-exit', gateCheck);
me(); gateCheck();
window.XGATE = { show, hide, check: gateCheck, me };
})();
