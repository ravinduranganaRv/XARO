const test = require('node:test'), assert = require('node:assert'); const W = require('../src/mod/workspace_core.js');
test('csv: quotes, embedded newlines, CRLF, BOM round-trip', () => {
  const rows = [['a', 'b,c', 'd"e'], ['line1\nline2', '', 'x']]; const t = W.csvStringify(rows); assert.deepStrictEqual(W.csvParse('﻿' + t), rows);
  assert.deepStrictEqual(W.csvParse('a,b\r\n1,2\r\n\r\n3,4'), [['a', 'b'], ['1', '2'], ['3', '4']]); assert.throws(() => W.csvParse('a,"b'), /unclosed/);
});
test('csv: formula injection is neutralised on export, numbers untouched', () => {
  assert.strictEqual(W.csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"'); assert.strictEqual(W.csvCell('+1'), "'+1"); assert.strictEqual(W.csvCell('@a'), "'@a"); assert.strictEqual(W.csvCell(-5), '-5'); assert.strictEqual(W.csvCell(null), '');
});
test('yarn import: aliases, hex normalisation, numeric checks, duplicates, bad rows reported with line numbers', () => {
  const r = W.parseYarnCsv('Code,Colour Name,Colour,Brand,Price,Stock,Reorder\nA1,Red,ff0000,Acme,12.5,3,1\nA2,Blue,#00f,,,,\nA1,Dup,#000000,,,,\nA3,Bad,zzz,,,,\nA4,Neg,#111111,,-3,,\n,NoCode,#111111,,,,');
  assert.deepStrictEqual(r.rows.map(y => [y.code, y.hex, y.price_per_kg, y.stock_kg, y.reorder_kg, y.manufacturer]), [['A1', '#FF0000', 12.5, 3, 1, 'Acme'], ['A2', '#0000FF', null, 0, null, null]]);
  assert.deepStrictEqual(r.errors.map(e => e.line), [4, 5, 6, 7]); assert.match(r.errors[0].msg, /duplicate/);
  assert.match(W.parseYarnCsv('name\nx').errors[0].msg, /code column and a hex/); assert.match(W.parseYarnCsv('').errors[0].msg, /header/);
});
test('yarn export then import is lossless', () => {
  const ys = [{ code: 'R1', name: 'Red, bright', hex: '#FF0000', manufacturer: 'M', material: 'Acrylic', price_per_kg: 9.5, stock_kg: 4.25, reorder_kg: 2, supplier: 'S', availability: 'in-stock' }, { code: 'B1', name: '=evil', hex: '#0000FF', stock_kg: 0 }];
  const back = W.parseYarnCsv(W.yarnsToCsv(ys)); assert.strictEqual(back.errors.length, 0); assert.strictEqual(back.rows[0].name, 'Red, bright'); assert.strictEqual(back.rows[1].name, "'=evil", 'formula guarded');
});
test('stock: movement rules, stock effect, low-stock', () => {
  assert.match(W.checkMovement({ kind: 'purchase', kg: 0, yarn_id: 'y' }), /weight/); assert.match(W.checkMovement({ kind: 'purchase', kg: -2, yarn_id: 'y' }), /Adjustment/); assert.strictEqual(W.checkMovement({ kind: 'adjustment', kg: -2, yarn_id: 'y' }), ''); assert.match(W.checkMovement({ kind: 'bogus', kg: 1, yarn_id: 'y' }), /type/);
  assert.strictEqual(W.stockAfter(10, { kind: 'purchase', kg: 2.5 }), 12.5); assert.strictEqual(W.stockAfter(10, { kind: 'actual_use', kg: 3 }), 7); assert.strictEqual(W.stockAfter(10, { kind: 'estimated_use', kg: 3 }), 10, 'estimated use never changes stock'); assert.strictEqual(W.stockAfter(10, { kind: 'adjustment', kg: -1.5 }), 8.5);
  assert.deepStrictEqual(W.lowStock([{ code: 'a', stock_kg: 1, reorder_kg: 2 }, { code: 'b', stock_kg: 5, reorder_kg: 2 }, { code: 'c', stock_kg: 0, reorder_kg: null }, { code: 'd', stock_kg: 1, reorder_kg: 1, active: false }]).map(y => y.code), ['a']);
});
test('rates form: empty stays empty, validation, nothing defaulted', () => {
  const r = W.ratesFromForm({ currency: 'usd', 'pileKgPerM2.standard': '2.4', wastePct: '', 'labour.hourlyRate': '3.5', marginPct: '30' }); assert.deepStrictEqual(r.rates, { currency: 'USD', pileKgPerM2: { standard: 2.4 }, labour: { hourlyRate: 3.5 }, marginPct: 30 }); assert.strictEqual(r.errors.length, 0);
  const bad = W.ratesFromForm({ currency: 'dollars', wastePct: '120', marginPct: '100', bindingPerM: '-1', backingPerM2: 'x' }); assert.strictEqual(bad.errors.length, 5);
  assert.deepStrictEqual(W.ratesFromForm({}).rates, {});
});
test('areas and perimeters', () => {
  assert.strictEqual(W.areaM2(200, 100, 'rect'), 2); assert.strictEqual(W.areaM2(100, 100, 'circle'), 0.7854); assert.strictEqual(W.areaM2(100, 100, 'rect', 50), 0.7854, 'fully rounded rect = circle'); assert.strictEqual(W.areaM2(100, 100, 'rect', 0, 0.5), 0.5);
  assert.strictEqual(W.perimeterM(200, 100, 'rect'), 6); assert.ok(Math.abs(W.perimeterM(100, 100, 'circle') - Math.PI) < 1e-3);
});
const yarns = [{ id: 'y1', code: 'R', name: 'Red', hex: '#FF0000', price_per_kg: 10, stock_kg: 5 }, { id: 'y2', code: 'B', name: 'Blue', hex: '#0000FF', price_per_kg: 20, stock_kg: 0.5 }];
const full = { currency: 'USD', pileKgPerM2: { standard: 2 }, wastePct: 10, labour: { hoursPerM2: 4, setupHours: 1, hourlyRate: 5 }, backingPerM2: 3, bindingPerM: 2, finishingFlat: 4, packagingFlat: 1, overheadPct: 10, marginPct: 20, taxPct: 5 };
test('calculator with no rates: nothing invented', () => {
  const c = W.calc({ widthCm: 100, heightCm: 100, shape: 'rect', colours: [{ yarnId: 'y1', pct: 100 }] }, {}, yarns);
  assert.strictEqual(c.ok, true); assert.strictEqual(c.complete, false); assert.strictEqual(c.total, undefined); assert.strictEqual(c.yarnKg, null); assert.ok(c.lines.every(l => l.amount === null)); assert.ok(c.missing.length === 7); assert.strictEqual(c.knownCost, 0);
});
test('calculator: exact arithmetic with every rate entered', () => {
  const c = W.calc({ widthCm: 200, heightCm: 100, shape: 'rect', binding: true, colours: [{ yarnId: 'y1', pct: 75 }, { yarnId: 'y2', pct: 25 }] }, full, yarns);
  // area 2 m2; yarn kg = 2*2*1.1 = 4.4 -> R 3.3 kg, B 1.1 kg
  assert.strictEqual(c.areaM2, 2); assert.strictEqual(c.yarnKg, 4.4); assert.deepStrictEqual(c.yarn.map(y => [y.kg, y.cost, y.enough]), [[3.3, 33, true], [1.1, 22, false]]);
  const L = Object.fromEntries(c.lines.map(l => [l.key, l.amount])); assert.deepStrictEqual(L, { yarn: 55, labour: 45, backingPerM2: 6, bindingPerM: 12, finishingFlat: 4, packagingFlat: 1 });
  assert.strictEqual(c.hours, 9); assert.strictEqual(c.complete, true); assert.strictEqual(c.overhead, 12.3); assert.strictEqual(c.cost, 135.3); assert.strictEqual(c.price, 169.13); assert.strictEqual(c.tax, 8.46); assert.strictEqual(c.total, 177.59);
});
test('calculator: partial config reports exactly what is missing; unpriced yarn flagged', () => {
  const c = W.calc({ widthCm: 100, heightCm: 100, shape: 'rect', colours: [{ yarnId: 'y1', pct: 50 }, { yarnId: 'zz', pct: 50 }] }, { pileKgPerM2: { standard: 1 }, wastePct: 0 }, yarns);
  assert.strictEqual(c.yarnKg, 1); assert.strictEqual(c.lines[0].amount, null); assert.match(c.lines[0].note, /no price per kg for \(unmapped\)/); assert.ok(c.missing.some(m => m.key === 'labour.hourlyRate')); assert.strictEqual(c.complete, false);
  const noMargin = W.calc({ widthCm: 100, heightCm: 100, shape: 'rect', colours: [{ yarnId: 'y1', pct: 100 }] }, Object.assign({}, full, { marginPct: undefined }), yarns); assert.strictEqual(noMargin.complete, false); assert.ok(noMargin.missing.some(m => m.key === 'marginPct')); assert.strictEqual(noMargin.total, undefined); assert.ok(noMargin.cost > 0);
});
test('calculator: size validation; no tax when no tax rate', () => {
  assert.strictEqual(W.calc({ widthCm: 2, heightCm: 50 }, full, yarns).ok, false); assert.strictEqual(W.calc({ widthCm: 5000, heightCm: 50 }, full, yarns).ok, false);
  const c = W.calc({ widthCm: 100, heightCm: 100, shape: 'rect', colours: [{ yarnId: 'y1', pct: 100 }] }, Object.assign({}, full, { taxPct: undefined }), yarns); assert.strictEqual(c.tax, 0); assert.match(c.taxNote, /no tax/); assert.strictEqual(c.total, c.price);
});
test('quotation lines, totals, references, order from quote', () => {
  assert.deepStrictEqual(W.cleanLines([{ desc: 'Rug', qty: '2', unit: '50' }, { desc: '', qty: '', unit: '' }]).lines, [{ desc: 'Rug', qty: 2, unit: 50 }]);
  assert.strictEqual(W.cleanLines([{ desc: 'x', qty: '0', unit: '1' }]).errors.length, 1); assert.strictEqual(W.cleanLines([{ desc: '', qty: '1', unit: '1' }]).errors.length, 1); assert.deepStrictEqual(W.cleanLines([]).errors, ['Add at least one line.']);
  assert.deepStrictEqual(W.quoteTotals([{ qty: 2, unit: 50 }, { qty: 1, unit: 19.99 }], { discountPct: 10, taxPct: 5 }), { subtotal: 119.99, discount: 12, tax: 5.4, total: 113.39 });
  assert.strictEqual(W.nextRef('Q', ['Q-2026-0003', 'Q-2025-0099', 'O-2026-0009'], 2026), 'Q-2026-0004'); assert.strictEqual(W.nextRef('Q', [], 2026), 'Q-2026-0001');
  const o = W.orderFromQuote({ id: 'q1', customer_id: 'c1', currency: 'USD', total: 100, subtotal: 100 }, 2026, ['O-2026-0001']); assert.deepStrictEqual([o.ref, o.total, o.paid, o.status, o.quotation_id], ['O-2026-0002', 100, 0, 'open', 'q1']); assert.strictEqual(W.balance({ total: 100, paid: 130 }), 0);
});
test('reports: money per currency, rates, yarn estimate vs actual, top customers', () => {
  const r = W.report({ orders: [{ status: 'open', currency: 'USD', total: 100, paid: 40, customer_id: 'c1' }, { status: 'delivered', currency: 'USD', total: 50, paid: 50, customer_id: 'c1' }, { status: 'cancelled', currency: 'USD', total: 999, paid: 0 }, { status: 'open', currency: 'LKR', total: 1000, paid: 0, customer_id: 'c2' }],
    quotes: [{ status: 'accepted' }, { status: 'rejected' }, { status: 'draft' }], projects: [{ status: 'enquiry' }], customers: [{ id: 'c1', name: 'Ann' }], stock: [{ code: 'R', name: 'Red', stock_kg: 1, estimated_use_kg: 3, actual_use_kg: 3.5, low_stock: true }] });
  assert.deepStrictEqual(r.money.find(m => m.currency === 'USD'), { currency: 'USD', orders: 2, total: 150, paid: 90, outstanding: 60 }); assert.strictEqual(r.acceptRate, 50); assert.strictEqual(r.yarn[0].difference_kg, 0.5); assert.strictEqual(r.lowStock, 1); assert.strictEqual(r.topCustomers[0].name, 'Ann');
  assert.match(W.reportCsv(r), /money USD/);
});
