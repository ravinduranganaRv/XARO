const test = require('node:test'), assert = require('node:assert/strict');
const C = require('../src/mod/costing.js');
const base = { widthCm: 44, heightCm: 16, colours: 3, pile: 'standard', backing: 'felt', border: 'none', dest: 'export' };
test('rejects tiny and huge sizes', () => {
  assert.equal(C.estimate({ ...base, widthCm: 2 }).ok, false);
  assert.equal(C.estimate({ ...base, heightCm: 700 }).ok, false);
});
test('area and perimeter for rectangle and circle', () => {
  const r = C.estimate({ ...base, widthCm: 100, heightCm: 100 });
  assert.equal(r.areaM2, 1); assert.equal(r.perimeterM, 4);
  const c = C.estimate({ ...base, widthCm: 100, heightCm: 100, shape: 'circle' });
  assert.ok(Math.abs(c.areaM2 - Math.PI / 4) < 1e-3);
});
test('calibrated to the project model: 44x16 keyboard rug takes about 4 labour hours', () => {
  const r = C.estimate(base); assert.ok(Math.abs(r.hours - 4.0) < 0.05, 'hours ' + r.hours);
});
test('price covers cost and hits the target margin', () => {
  const r = C.estimate(base); assert.ok(r.usd.sell > r.usd.cost);
  assert.ok(Math.abs(r.marginPct - 30) < 0.2, 'margin ' + r.marginPct);
  const r2 = C.estimate({ ...base, marginPct: 0.5 }); assert.ok(Math.abs(r2.marginPct - 50) < 0.2);
});
test('more colours, higher pile, frame and rush all raise the price', () => {
  const p0 = C.estimate(base).usd.sell;
  assert.ok(C.estimate({ ...base, colours: 9 }).usd.sell > p0);
  assert.ok(C.estimate({ ...base, pile: 'carved' }).usd.sell > p0);
  assert.ok(C.estimate({ ...base, frame: true }).usd.sell > p0);
  assert.ok(C.estimate({ ...base, rush: true }).usd.sell > p0);
});
test('local delivery is cheaper than export (no duty, no courier)', () => {
  assert.ok(C.estimate({ ...base, dest: 'local' }).usd.sell < C.estimate(base).usd.sell);
});
test('currency conversion uses the editable rates', () => {
  const r = C.estimate({ ...base, currency: 'LKR' }); assert.ok(Math.abs(r.local.sell / r.usd.sell - 333) < 0.5);
  const R = C.mergeRates(C.DEFAULT_RATES, { fx: { LKR: 400 } }); const r2 = C.estimate({ ...base, currency: 'LKR' }, R);
  assert.ok(Math.abs(r2.local.sell / r2.usd.sell - 400) < 0.5);
});
test('yarn weight uses editable defaults; blank hides it', () => {
  assert.ok(C.estimate(base).yarnKg > 0);
  const blank = C.mergeRates(C.DEFAULT_RATES, { yarnKgPerM2: { standard: null } }); assert.equal(C.estimate(base, blank).yarnKg, null);
  const R = C.mergeRates(C.DEFAULT_RATES, { yarnKgPerM2: { standard: 1.2 } }); const r = C.estimate({ ...base, widthCm: 100, heightCm: 100 }, R);
  assert.equal(r.yarnKg, 1.2);
});
test('mergeRates does not mutate defaults', () => {
  const before = JSON.stringify(C.DEFAULT_RATES); C.mergeRates(C.DEFAULT_RATES, { labourRateUSD: 9 }); assert.equal(JSON.stringify(C.DEFAULT_RATES), before);
});
test('friendly rounding', () => { assert.equal(C.friendly(9504.8, 'LKR'), 9600); assert.equal(C.friendly(97.17, 'USD'), 98); assert.equal(C.friendly(371.2, 'AED'), 375); });
test('estimate is labelled as an estimate', () => { const r = C.estimate(base); assert.equal(r.estimate, true); assert.match(r.notes[0], /Estimate only/); });
test('custom outline uses its own area share and edge length', () => {
  const C = require('../src/mod/costing.js'), base = { widthCm: 100, heightCm: 100, colours: 3, pile: 'standard', backing: 'standard', border: 'bound', currency: 'USD' };
  const rect = C.estimate(Object.assign({ shape: 'rect' }, base)), half = C.estimate(Object.assign({ shape: 'custom', areaFraction: 0.5, perimeterM: 3 }, base)), bad = C.estimate(Object.assign({ shape: 'custom', areaFraction: 7 }, base));
  assert.strictEqual(half.areaM2, 0.5); assert.strictEqual(half.perimeterM, 3); assert.ok(half.usd.material < rect.usd.material); assert.strictEqual(bad.areaM2, 1, 'an impossible share falls back to the full box');
});
