const test = require('node:test'), assert = require('node:assert/strict');
const SB = require('../src/mod/sb.js');
const mem = {}; SB._setStore({ getItem: k => mem[k] || null, setItem: (k, v) => { mem[k] = v; }, removeItem: k => { delete mem[k]; } });
let calls = [];
const reply = (status, body) => ({ ok: status < 300, status, text: async () => body == null ? '' : JSON.stringify(body) });
let handler = () => reply(200, {});
SB._setFetch(async (url, init) => { calls.push({ url, init }); return handler(url, init); });
const jwt = (o) => 'x.' + Buffer.from(JSON.stringify(o)).toString('base64url') + '.y';
const sess = (extra = {}) => Object.assign({ access_token: 'AT1', refresh_token: 'RT1', expires_in: 3600, user: { id: 'u-1', email: 'a@b.co' } }, extra);
const reset = () => { calls = []; SB._setStore({ getItem: k => mem[k] || null, setItem: (k, v) => { mem[k] = v; }, removeItem: k => { delete mem[k]; } }); for (const k in mem) delete mem[k]; };

test('only the public key is in the client and the URL is the project', () => {
  assert.match(SB.key, /^sb_publishable_/); assert.ok(!/service_role|secret/i.test(SB.key)); assert.equal(SB.url, 'https://mlrydpclqokizsqmigen.supabase.co');
});
test('signUp sends account type, never a role, and reports confirmation needed', async () => {
  reset(); handler = () => reply(200, { id: 'u-9', email: 'n@x.co' });
  const r = await SB.signUp({ email: 'n@x.co', password: 'abcdefg1', fullName: 'N', accountType: 'rugmaker' });
  assert.equal(r.needsConfirmation, true);
  const b = JSON.parse(calls[0].init.body); assert.equal(b.data.account_type, 'rugmaker'); assert.ok(!('role' in b.data)); assert.equal(calls[0].init.headers.apikey, SB.key);
  assert.equal(SB.signedIn(), false);
});
test('signUp rejects owner/admin as an account type (falls back to customer)', async () => {
  reset(); handler = () => reply(200, { id: 'u', email: 'n@x.co' });
  await SB.signUp({ email: 'n@x.co', password: 'abcdefg1', accountType: 'owner' });
  assert.equal(JSON.parse(calls[0].init.body).data.account_type, 'customer');
});
test('signUp validates email and password before any request', async () => {
  reset(); await assert.rejects(SB.signUp({ email: 'nope', password: 'abcdefg1' }), /valid email/); await assert.rejects(SB.signUp({ email: 'a@b.co', password: 'short' }), /stronger/); assert.equal(calls.length, 0);
});
test('signIn stores the session and attaches the user token to later calls', async () => {
  reset(); handler = (u) => u.includes('grant_type=password') ? reply(200, sess()) : reply(200, [{ id: 1 }]);
  const u = await SB.signIn('a@b.co', 'pw123456'); assert.equal(u.id, 'u-1'); assert.ok(SB.signedIn());
  await SB.select('biz_yarns', { eq: { business_id: 'b1' } });
  assert.equal(calls[1].init.headers.Authorization, 'Bearer AT1');
  assert.match(calls[1].url, /\/rest\/v1\/biz_yarns\?business_id=eq\.b1$/);
});
test('wrong password gives a plain message', async () => {
  reset(); handler = () => reply(400, { error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
  await assert.rejects(SB.signIn('a@b.co', 'badbadbad'), /not correct/);
});
test('unconfirmed email gives a plain message', async () => {
  reset(); handler = () => reply(400, { error_code: 'email_not_confirmed', msg: 'x' });
  await assert.rejects(SB.signIn('a@b.co', 'goodgood1'), /confirm your email/);
});
test('expired token is refreshed once, in parallel calls', async () => {
  reset(); handler = (u) => u.includes('grant_type=password') ? reply(200, sess({ expires_in: 10 })) : u.includes('refresh_token') ? reply(200, sess({ access_token: 'AT2', refresh_token: 'RT2' })) : reply(200, []);
  await SB.signIn('a@b.co', 'pw123456'); calls = [];
  await Promise.all([SB.select('biz_yarns'), SB.select('biz_customers')]);
  assert.equal(calls.filter(c => c.url.includes('refresh_token')).length, 1);
  assert.ok(calls.filter(c => c.url.includes('/rest/')).every(c => c.init.headers.Authorization === 'Bearer AT2'));
});
test('a failed refresh signs the user out', async () => {
  reset(); handler = (u) => u.includes('grant_type=password') ? reply(200, sess({ expires_in: 10 })) : reply(400, { error_code: 'refresh_token_not_found', msg: 'bad' });
  await SB.signIn('a@b.co', 'pw123456'); await SB.select('biz_yarns').catch(() => { }); assert.equal(SB.signedIn(), false);
});
test('signOut clears the session even if the network call fails', async () => {
  reset(); handler = (u) => u.includes('grant_type=password') ? reply(200, sess()) : reply(500, { msg: 'down' });
  await SB.signIn('a@b.co', 'pw123456'); await SB.signOut(); assert.equal(SB.signedIn(), false); assert.equal(mem.xaro_sb_session, undefined);
});
test('table and column names are validated (no query injection)', async () => {
  reset(); handler = () => reply(200, []); assert.throws(() => SB.select('biz_yarns;drop', {}), /bad table/); assert.throws(() => SB.select('biz_yarns', { eq: { 'a=1&b': 1 } }), /bad column/);
  await SB.select('biz_yarns', { eq: { code: 'a&b=c' } }); assert.match(calls[0].url, /code=eq\.a%26b%3Dc$/);
});
test('update and delete refuse to run without a filter', () => {
  assert.throws(() => SB.update('biz_yarns', { name: 'x' }, {}), /filter/); assert.throws(() => SB.remove('biz_yarns', { eq: {} }), /filter/);
});
test('ilike search strips wildcard and list characters', async () => {
  reset(); handler = () => reply(200, []); await SB.select('custom_designs', { ilike: { name: 'a*b,c(d)' } }); assert.match(calls[0].url, /name=ilike\.\*a%20b%20c%20d%20\*$/);
});
test('rpc posts arguments; business creation maps field names', async () => {
  reset(); handler = () => reply(200, 'bid-1'); await SB.createBusiness({ name: 'A Rugs', ownerName: 'A', phone: '1', country: 'LK', currency: 'LKR' });
  assert.match(calls[0].url, /rpc\/create_business$/); const b = JSON.parse(calls[0].init.body); assert.equal(b.p_name, 'A Rugs'); assert.equal(b.p_currency, 'LKR');
});
test('permission errors from the database become friendly messages', async () => {
  reset(); handler = () => reply(403, { code: '42501', message: 'new row violates row-level security policy' });
  await assert.rejects(SB.select('biz_yarns'), /permission/);
});
test('storage: type, size and path checks happen before the network', async () => {
  reset(); await assert.rejects(SB.upload('design-originals', 'u/a.svg', { size: 10, type: 'image/svg+xml' }), /not allowed/);
  await assert.rejects(SB.upload('business-assets', 'b/x/a.png', { size: 3 << 20, type: 'image/png' }), /too large/);
  await assert.rejects(SB.upload('design-originals', '../x.png', { size: 10, type: 'image/png' }), /Bad file path/);
  await assert.rejects(SB.upload('public-bucket', 'a.png', { size: 1, type: 'image/png' }), /Unknown storage/); assert.equal(calls.length, 0);
});
test('storage upload and signed link', async () => {
  reset(); handler = (u) => u.includes('grant_type') ? reply(200, sess()) : u.includes('/object/sign/') ? reply(200, { signedURL: '/object/sign/design-originals/u-1/a.png?token=T' }) : reply(200, { Key: 'k' });
  await SB.signIn('a@b.co', 'pw123456'); calls = [];
  const p = SB.personalPath('My Logo (1).png'); assert.match(p, /^u-1\/[a-z0-9]+-My_Logo_1_.png$/);
  await SB.upload('design-originals', p, { size: 100, type: 'image/png' });
  assert.equal(calls[0].init.headers['Content-Type'], 'image/png'); assert.match(calls[0].url, /\/storage\/v1\/object\/design-originals\/u-1\//);
  const url = await SB.signedUrl('design-originals', p, 99999); assert.match(url, /^https:\/\/mlrydpclqokizsqmigen\.supabase\.co\/storage\/v1\/object\/sign\//); assert.ok(JSON.parse(calls[1].init.body).expiresIn <= 3600);
});
test('email-link tokens in the URL fragment are picked up and the address bar is cleaned', () => {
  reset(); const exp = Math.floor(Date.now() / 1000) + 3600;
  const at = jwt({ sub: 'u-5', email: 'z@z.co', exp });
  let replaced = null; globalThis.location = { hash: '#access_token=' + at + '&refresh_token=RT&expires_at=' + exp + '&type=signup', pathname: '/', search: '' }; globalThis.history = { replaceState: (a, b, u) => { replaced = u; } };
  assert.equal(SB.consumeUrlSession(), true); assert.equal(SB.user().id, 'u-5'); assert.equal(replaced, '/');
  delete globalThis.location; delete globalThis.history;
});
