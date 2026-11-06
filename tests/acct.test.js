const test = require('node:test'), assert = require('node:assert/strict');
const A = require('../src/mod/studio_acct.js');
test('data URL helpers', () => {
  assert.equal(A.dataUrlMime('data:image/png;base64,AAAA'), 'image/png');
  const b = A.dataUrlToBlob('data:image/png;base64,iVBORw0KGgo='); assert.equal(b.type, 'image/png'); assert.equal(b.size, 8);
});
test('design document keeps image paths, not pixels; thumbnails are size-capped', () => {
  const d = A.buildDoc({ layers: [{ type: 'image', img: 'a' }] }, { a: { path: 'u/x.png' } }, 'data:image/jpeg;base64,AA');
  assert.deepEqual(d._images, { a: { path: 'u/x.png' } }); assert.equal(d._thumb, 'data:image/jpeg;base64,AA');
  assert.equal(A.buildDoc({}, {}, 'x'.repeat(70000))._thumb, undefined);
});
test('database row: name is trimmed and capped, tenancy ids only when given', () => {
  const r = A.buildRow({ name: '  ' + 'x'.repeat(200), doc: {}, ownerId: 'u1' }); assert.equal(r.name.length, 120); assert.equal(r.owner_id, 'u1'); assert.ok(!('business_id' in r));
  assert.equal(A.buildRow({ name: '', doc: {}, ownerId: 'u', businessId: 'b' }).business_id, 'b'); assert.equal(A.buildRow({ name: ' ', doc: {} }).name, 'My rug');
});
test('role label', () => {
  assert.equal(A.roleLabel({ role: 'owner', account_type: 'customer' }), 'Store owner'); assert.equal(A.roleLabel({ role: 'customer', account_type: 'rugmaker' }), 'Rug maker'); assert.equal(A.roleLabel({ role: 'customer', account_type: 'customer' }), 'Customer'); assert.equal(A.roleLabel(null), '');
});
test('password hint', () => { assert.equal(A.passwordHint('abc'), 'Too short'); assert.equal(A.passwordHint('abcdefgh'), 'Weak'); assert.ok(['Good', 'Strong'].includes(A.passwordHint('Abcdefgh1234!'))); });
test('save() sends tenancy through the injected client and updates in place when a cloud id exists', async () => {
  const calls = []; const SB = { user: () => ({ id: 'u1' }), signedIn: () => true, businessPath: () => 'b/x', personalPath: () => 'u1/x', upload: async () => 1, insert: async (t, r) => { calls.push(['insert', t, r]); return [{ id: 'new' }]; }, update: async (t, p, o) => { calls.push(['update', t, p, o]); } };
  A._inject(SB);
  assert.equal(await A.save({ name: 'n', doc: { layers: [] }, imgs: {}, thumb: '', cloudId: '' }), 'new'); assert.equal(calls[0][2].owner_id, 'u1');
  assert.equal(await A.save({ name: 'n', doc: { layers: [] }, imgs: {}, thumb: '', cloudId: 'abc' }), 'abc'); assert.deepEqual(calls[1][3], { eq: { id: 'abc' } });
});
