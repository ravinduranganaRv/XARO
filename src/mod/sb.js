/* ============ Supabase client (plain fetch, no library) ============
   Uses ONLY the project URL and the public publishable key. Real security is enforced by row-level security in the database,
   so nothing here is trusted: it just carries the signed-in user's token. Never put a service-role key in this file. */
(function (root) {
'use strict';
const SB = {};
SB.url = 'https://mlrydpclqokizsqmigen.supabase.co';
SB.key = 'sb_publishable_fhkcnyc6oDugf4CIWnFnpg_Vys92zTM';
const SKEY = 'xaro_sb_session';
let session = null, listeners = [], fetchImpl = null, store = null;
const F = (...a) => (fetchImpl || root.fetch.bind(root))(...a);
SB._setFetch = f => { fetchImpl = f; };
SB._setStore = s => { store = s; session = null; };
const mem = {}; // fallback when localStorage is blocked (private windows)
const ls = () => store || { getItem: k => { try { return root.localStorage.getItem(k); } catch (e) { return mem[k] || null; } }, setItem: (k, v) => { try { root.localStorage.setItem(k, v); } catch (e) { mem[k] = v; } }, removeItem: k => { try { root.localStorage.removeItem(k); } catch (e) { delete mem[k]; } } };
const now = () => Math.floor(Date.now() / 1000);
const emit = () => listeners.forEach(f => { try { f(SB.user()); } catch (e) { } });
function load() { if (session) return session; try { const s = JSON.parse(ls().getItem(SKEY) || 'null'); if (s && s.access_token && s.refresh_token) session = s; } catch (e) { } return session; }
function save(s) { session = s; if (s) ls().setItem(SKEY, JSON.stringify(s)); else ls().removeItem(SKEY); emit(); }
SB.user = () => { const s = load(); return s ? s.user : null; };
SB.signedIn = () => !!load();
SB.onChange = f => { listeners.push(f); return () => { listeners = listeners.filter(x => x !== f); }; };

class SBError extends Error { constructor(msg, status, code) { super(msg); this.status = status; this.code = code; } }
SB.SBError = SBError;
// human-readable messages for the errors a visitor can actually hit
const NICE = { invalid_credentials: 'Email or password is not correct.', email_not_confirmed: 'Please confirm your email first. Check your inbox for the link.', user_already_exists: 'An account with this email already exists. Try signing in.', weak_password: 'Choose a stronger password (at least 8 characters, mixing letters and numbers).', over_request_rate_limit: 'Too many attempts. Please wait a minute and try again.', over_email_send_rate_limit: 'Too many emails sent. Please wait a few minutes.', signup_disabled: 'Sign-up is turned off right now.' };
const PGNICE = { '42501': 'You do not have permission to do that.', '23505': 'That already exists.', '23514': 'One of the values is not allowed.', '22023': null, '28000': 'Please sign in first.' };
async function parse(res) {
  const text = await res.text(); let body = null; try { body = text ? JSON.parse(text) : null; } catch (e) { body = { message: text }; }
  if (res.ok) return body;
  const code = body && (body.error_code || body.code); const raw = body && (body.msg || body.message || body.error_description || body.error) || ('Request failed (' + res.status + ')');
  const msg = NICE[code] || (code in PGNICE && PGNICE[code]) || raw;
  throw new SBError(String(msg).slice(0, 300), res.status, code);
}
async function http(path, { method = 'GET', body, headers = {}, auth = true, raw = false } = {}) {
  const h = Object.assign({ apikey: SB.key }, headers);
  if (auth) { const t = await SB.token(); h.Authorization = 'Bearer ' + (t || SB.key); } else h.Authorization = 'Bearer ' + SB.key;
  if (body !== undefined && !raw && !h['Content-Type']) h['Content-Type'] = 'application/json';
  const res = await F(SB.url + path, { method, headers: h, body: body === undefined ? undefined : (raw ? body : JSON.stringify(body)) });
  return parse(res);
}
// returns a valid access token, refreshing a minute before expiry
let refreshing = null;
SB.token = async () => {
  const s = load(); if (!s) return null;
  if (s.expires_at - 60 > now()) return s.access_token;
  if (!refreshing) refreshing = SB.refresh().finally(() => { refreshing = null; });
  try { await refreshing; } catch (e) { return null; }
  return session ? session.access_token : null;
};
function adopt(r) { if (!r || !r.access_token) return null; const s = { access_token: r.access_token, refresh_token: r.refresh_token, expires_at: r.expires_at || (now() + (r.expires_in || 3600)), user: r.user }; save(s); return s.user; }
SB.refresh = async () => {
  const s = load(); if (!s) throw new SBError('Not signed in', 401, 'no_session');
  try { const r = await http('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: s.refresh_token }, auth: false }); adopt(r); return r; }
  catch (e) { if (e.status === 400 || e.status === 401 || e.status === 403) save(null); throw e; }
};

/* ---- auth ---- */
const okEmail = e => /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(String(e || '').trim());
SB.signUp = async ({ email, password, fullName, phone, accountType }) => {
  if (!okEmail(email)) throw new SBError('Enter a valid email address.', 400, 'bad_email');
  if (String(password || '').length < 8) throw new SBError(NICE.weak_password, 400, 'weak_password');
  const at = accountType === 'rugmaker' ? 'rugmaker' : 'customer'; // the database also ignores anything else
  const r = await http('/auth/v1/signup', { method: 'POST', auth: false, body: { email: email.trim(), password, data: { full_name: String(fullName || '').slice(0, 120), phone: String(phone || '').slice(0, 30), account_type: at }, gotrue_meta_security: {} } });
  const user = adopt(r); // a session exists only when email confirmation is switched off
  return { user: user || r.user || r, needsConfirmation: !r.access_token };
};
/** confirms a new account with the 6-digit code from the sign-up email (the link in the same email also works) and signs the person in */
SB.verifyEmailCode = async (email, code) => {
  if (!okEmail(email)) throw new SBError('Enter a valid email address.', 400, 'bad_email'); const t = String(code || '').replace(/\s/g, '');
  if (!/^\d{6,8}$/.test(t)) throw new SBError('Enter the 6-digit code from the email.', 400, 'bad_code');
  const r = await http('/auth/v1/verify', { method: 'POST', auth: false, body: { type: 'signup', email: email.trim(), token: t } }); const u = adopt(r); if (!u) throw new SBError('That code did not work. Check it and try again.', 400, 'bad_code'); return u; };
SB.resendCode = email => { if (!okEmail(email)) throw new SBError('Enter a valid email address.', 400, 'bad_email'); return http('/auth/v1/resend', { method: 'POST', auth: false, body: { type: 'signup', email: email.trim() } }); };
SB.signIn = async (email, password) => {
  if (!okEmail(email)) throw new SBError('Enter a valid email address.', 400, 'bad_email');
  const r = await http('/auth/v1/token?grant_type=password', { method: 'POST', auth: false, body: { email: email.trim(), password } });
  return adopt(r);
};
SB.signOut = async () => { const s = load(); try { if (s) await http('/auth/v1/logout', { method: 'POST' }); } catch (e) { } save(null); };
SB.resetPassword = (email, redirectTo) => { if (!okEmail(email)) throw new SBError('Enter a valid email address.', 400, 'bad_email'); return http('/auth/v1/recover' + (redirectTo ? '?redirect_to=' + encodeURIComponent(redirectTo) : ''), { method: 'POST', auth: false, body: { email: email.trim() } }); };
SB.updatePassword = async pw => { if (String(pw || '').length < 8) throw new SBError(NICE.weak_password, 400, 'weak_password'); const u = await http('/auth/v1/user', { method: 'PUT', body: { password: pw } }); return u; };
// after clicking an email link Supabase returns tokens in the URL fragment; pick them up once and clear the address bar
SB.consumeUrlSession = () => {
  try {
    const h = root.location && root.location.hash || ''; if (h.indexOf('access_token=') < 0) return false;
    const p = new URLSearchParams(h.replace(/^#/, '')); const at = p.get('access_token'), rt = p.get('refresh_token'); if (!at || !rt) return false;
    const payload = JSON.parse(atob(at.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    save({ access_token: at, refresh_token: rt, expires_at: Number(p.get('expires_at')) || payload.exp, user: { id: payload.sub, email: payload.email } });
    root.history.replaceState(null, '', root.location.pathname + root.location.search); return true;
  } catch (e) { return false; }
};

/* ---- database (PostgREST). Table and column names come from code, never from user text. ---- */
const ID = /^[a-z_][a-z0-9_]*$/;
const enc = v => encodeURIComponent(String(v));
function qs(o) {
  const p = [];
  if (o.select) p.push('select=' + enc(o.select).replace(/%2C/g, ',').replace(/%28/g, '(').replace(/%29/g, ')').replace(/%2A/g, '*'));
  for (const [k, v] of Object.entries(o.eq || {})) { if (!ID.test(k)) throw new Error('bad column'); p.push(k + '=eq.' + enc(v)); }
  for (const [k, v] of Object.entries(o.is || {})) { if (!ID.test(k)) throw new Error('bad column'); p.push(k + '=is.' + (v === null ? 'null' : enc(v))); }
  for (const [k, v] of Object.entries(o.ilike || {})) { if (!ID.test(k)) throw new Error('bad column'); p.push(k + '=ilike.' + enc('*' + String(v).replace(/[*%,()]/g, ' ') + '*')); }
  for (const [k, v] of Object.entries(o.inList || {})) { if (!ID.test(k)) throw new Error('bad column'); p.push(k + '=in.(' + v.map(x => enc(x)).join(',') + ')'); }
  if (o.order) { const [c, d] = String(o.order).split('.'); if (!ID.test(c)) throw new Error('bad column'); p.push('order=' + c + '.' + (d === 'asc' ? 'asc' : 'desc')); }
  if (o.limit) p.push('limit=' + (Math.min(1000, Math.max(1, o.limit | 0))));
  return p.length ? '?' + p.join('&') : '';
}
function tbl(t) { if (!ID.test(t)) throw new Error('bad table'); return '/rest/v1/' + t; }
SB.select = (t, o = {}) => http(tbl(t) + qs(o));
SB.single = async (t, o = {}) => { const r = await http(tbl(t) + qs(Object.assign({}, o, { limit: 1 }))); return r && r[0] || null; };
SB.insert = (t, row, o = {}) => http(tbl(t) + (o.select ? '?select=' + enc(o.select) : ''), { method: 'POST', body: row, headers: { Prefer: 'return=' + (o.select ? 'representation' : 'minimal') } });
SB.update = (t, patch, o) => { if (!o || !o.eq || !Object.keys(o.eq).length) throw new Error('update needs a filter'); return http(tbl(t) + qs({ eq: o.eq, select: o.select }), { method: 'PATCH', body: patch, headers: { Prefer: 'return=' + (o.select ? 'representation' : 'minimal') } }); };
SB.remove = (t, o) => { if (!o || !o.eq || !Object.keys(o.eq).length) throw new Error('delete needs a filter'); return http(tbl(t) + qs({ eq: o.eq }), { method: 'DELETE', headers: { Prefer: 'return=minimal' } }); };
SB.rpc = (name, args) => { if (!ID.test(name)) throw new Error('bad function'); return http('/rest/v1/rpc/' + name, { method: 'POST', body: args || {} }); };

/* ---- private storage: upload, then read through short-lived signed links ---- */
const MIME = { 'design-originals': ['image/png', 'image/jpeg', 'image/webp'], 'design-exports': ['image/png', 'image/jpeg', 'application/pdf'], 'business-assets': ['image/png', 'image/jpeg', 'image/webp'] };
const LIMIT = { 'design-originals': 8 << 20, 'design-exports': 20 << 20, 'business-assets': 2 << 20 };
SB.safeName = n => String(n || 'file').normalize('NFKD').replace(/[^\w.\-]+/g, '_').replace(/^\.+/, '').slice(-80) || 'file';
SB.upload = async (bucket, path, blob, type) => {
  if (!MIME[bucket]) throw new SBError('Unknown storage area.', 400, 'bad_bucket');
  const ct = type || blob.type; if (MIME[bucket].indexOf(ct) < 0) throw new SBError('That file type is not allowed here.', 400, 'bad_type');
  const size = blob.size != null ? blob.size : blob.byteLength; if (size > LIMIT[bucket]) throw new SBError('File is too large (limit ' + (LIMIT[bucket] >> 20) + ' MB).', 400, 'too_big');
  if (/(^|\/)\.\.(\/|$)/.test(path) || path.charAt(0) === '/') throw new SBError('Bad file path.', 400, 'bad_path');
  const segs = path.split('/').map(encodeURIComponent).join('/');
  await http('/storage/v1/object/' + bucket + '/' + segs, { method: 'POST', body: blob, raw: true, headers: { 'Content-Type': ct, 'x-upsert': 'true' } });
  return path;
};
SB.signedUrl = async (bucket, path, seconds = 300) => {
  const r = await http('/storage/v1/object/sign/' + bucket + '/' + path.split('/').map(encodeURIComponent).join('/'), { method: 'POST', body: { expiresIn: Math.min(3600, seconds) } });
  return SB.url + '/storage/v1' + r.signedURL;
};
SB.fn = (name, body) => http('/functions/v1/' + name, { method: 'POST', body });   // edge function, called with the signed-in user's token
SB.removeFile = (bucket, paths) => http('/storage/v1/object/' + bucket, { method: 'DELETE', body: { prefixes: paths } });
SB.personalPath = (file) => { const u = SB.user(); if (!u) throw new SBError('Please sign in first.', 401, 'no_session'); return u.id + '/' + Date.now().toString(36) + '-' + SB.safeName(file); };
SB.businessPath = (bid, file) => 'b/' + bid + '/' + Date.now().toString(36) + '-' + SB.safeName(file);

/* ---- app-level helpers (what the Studio calls) ---- */
SB.profile = async () => { const u = SB.user(); if (!u) return null; return SB.single('profiles', { select: 'id,email,full_name,phone,role,account_type,country,currency', eq: { id: u.id } }); };
SB.myBusiness = async () => { const u = SB.user(); if (!u) return null; const m = await SB.single('business_members', { select: 'role,businesses(id,name,owner_name,email,phone,country,currency,address,logo_path,settings)', eq: { user_id: u.id } }); return m ? Object.assign({ memberRole: m.role }, m.businesses) : null; };
SB.createBusiness = f => SB.rpc('create_business', { p_name: f.name, p_owner_name: f.ownerName, p_phone: f.phone || '', p_country: f.country || '', p_currency: f.currency || '', p_address: f.address || {} });
SB.becomeRugmaker = () => SB.rpc('become_rugmaker');
SB.addMember = (bid, email, role) => SB.rpc('add_business_member', { p_business: bid, p_email: email, p_role: role });

if (typeof module !== 'undefined' && module.exports) module.exports = SB; else root.XSB = SB;
})(typeof window !== 'undefined' ? window : globalThis);
