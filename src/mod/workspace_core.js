/* ============ Rug-maker workspace: pure logic (CSV, yarn import, rug calculator, quotations, reports) ============
   No DOM, no network. Everything here is unit tested in node. The calculator NEVER invents a number: a rate the business has not
   entered stays empty and the lines that depend on it are reported as "missing". */
(function (root) {
'use strict';
const W = {};
const HEX = /^#[0-9a-fA-F]{6}$/;
const round = (n, d) => { const k = Math.pow(10, d == null ? 2 : d); return Math.round((+n + Number.EPSILON) * k) / k; };
const isNum = v => v !== null && v !== undefined && v !== '' && isFinite(+v);
const clampStr = (s, n) => String(s == null ? '' : s).trim().slice(0, n);

/* ---------------------------------------------------------------- CSV (RFC 4180) */
W.csvParse = text => {
  text = String(text || '').replace(/^﻿/, ''); const rows = []; let row = [], f = '', q = false, i = 0;
  for (; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"' && f === '') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); f = ''; if (row.length > 1 || row[0] !== '') rows.push(row); row = []; }
    else f += c;
  }
  if (q) throw new Error('The file has an unclosed quote.');
  if (f !== '' || row.length) { row.push(f); if (row.length > 1 || row[0] !== '') rows.push(row); }
  return rows;
};
/** cells that a spreadsheet could read as a formula are prefixed with an apostrophe (CSV injection guard) */
W.csvCell = v => { if (v == null) return ''; if (typeof v === 'number') return String(v); let s = String(v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
W.csvStringify = rows => rows.map(r => r.map(W.csvCell).join(',')).join('\r\n') + '\r\n';

/* ---------------------------------------------------------------- yarn import / export */
const YCOLS = { code: ['code', 'yarn code', 'sku', 'id', 'colour code', 'color code'], name: ['name', 'colour name', 'color name', 'shade'], hex: ['hex', 'colour', 'color', 'hex colour', 'hex color', 'rgb hex'], manufacturer: ['manufacturer', 'brand', 'make'], material: ['material', 'fibre', 'fiber'], price_per_kg: ['price per kg', 'price_per_kg', 'price', 'cost per kg'], stock_kg: ['stock kg', 'stock_kg', 'stock', 'in stock', 'quantity kg', 'kg'], reorder_kg: ['reorder kg', 'reorder_kg', 'reorder level', 'reorder', 'minimum kg'], supplier: ['supplier', 'vendor'] };
W.normHex = h => { h = String(h == null ? '' : h).trim(); if (!h) return ''; if (h[0] !== '#') h = '#' + h; if (/^#[0-9a-fA-F]{3}$/.test(h)) h = '#' + h.slice(1).replace(/./g, '$&$&'); return HEX.test(h) ? h.toUpperCase() : ''; };
W.YARN_MAX_ROWS = 2000;
W.parseYarnCsv = text => {
  let rows; try { rows = W.csvParse(text); } catch (e) { return { rows: [], errors: [{ line: 0, msg: e.message }] }; }
  if (rows.length < 2) return { rows: [], errors: [{ line: 0, msg: 'The file needs a header row and at least one yarn.' }] };
  const head = rows[0].map(h => String(h).trim().toLowerCase()), idx = {};
  for (const [k, al] of Object.entries(YCOLS)) { const j = head.findIndex(h => al.includes(h)); if (j >= 0) idx[k] = j; }
  const errors = [], out = [], seen = new Set();
  if (idx.code === undefined || idx.hex === undefined) return { rows: [], errors: [{ line: 1, msg: 'The header must include a code column and a hex colour column.' }] };
  if (rows.length - 1 > W.YARN_MAX_ROWS) return { rows: [], errors: [{ line: 0, msg: 'Import at most ' + W.YARN_MAX_ROWS + ' yarns at a time.' }] };
  rows.slice(1).forEach((r, n) => {
    const line = n + 2, g = k => (idx[k] === undefined ? '' : String(r[idx[k]] == null ? '' : r[idx[k]]).trim());
    const code = clampStr(g('code'), 40), hex = W.normHex(g('hex')), name = clampStr(g('name'), 80) || code;
    if (!code) return errors.push({ line, msg: 'Missing yarn code.' });
    if (!hex) return errors.push({ line, msg: 'Row ' + code + ': "' + g('hex').slice(0, 12) + '" is not a valid #RRGGBB colour.' });
    if (seen.has(code.toLowerCase())) return errors.push({ line, msg: 'Row ' + code + ': duplicate code in the file.' });
    const nums = {}; for (const k of ['price_per_kg', 'stock_kg', 'reorder_kg']) { const v = g(k); if (v === '') { nums[k] = null; continue; } if (!isNum(v) || +v < 0) return errors.push({ line, msg: 'Row ' + code + ': ' + k.replace(/_/g, ' ') + ' must be a number of 0 or more.' }); nums[k] = round(+v, 3); }
    seen.add(code.toLowerCase());
    out.push({ code, name, hex, manufacturer: clampStr(g('manufacturer'), 80) || null, material: clampStr(g('material'), 80) || null, price_per_kg: nums.price_per_kg, stock_kg: nums.stock_kg == null ? 0 : nums.stock_kg, reorder_kg: nums.reorder_kg, supplier: clampStr(g('supplier'), 120) || null });
  });
  return { rows: out, errors };
};
W.yarnsToCsv = ys => W.csvStringify([['code', 'name', 'hex', 'manufacturer', 'material', 'price_per_kg', 'stock_kg', 'reorder_kg', 'supplier', 'availability']].concat(ys.map(y => [y.code, y.name, y.hex, y.manufacturer || '', y.material || '', y.price_per_kg == null ? '' : y.price_per_kg, y.stock_kg == null ? 0 : y.stock_kg, y.reorder_kg == null ? '' : y.reorder_kg, y.supplier || '', y.availability || ''])));

/* ---------------------------------------------------------------- stock */
W.MOVEMENT_KINDS = { purchase: 'Purchase (adds to stock)', actual_use: 'Actual use (removes from stock)', estimated_use: 'Estimated use (does not change stock)', adjustment: 'Adjustment (+ or -, e.g. stock count)' };
/** validates a movement before it is sent; the database applies the same rules */
W.checkMovement = m => {
  if (!m.yarn_id) return 'Choose a yarn.'; if (!W.MOVEMENT_KINDS[m.kind]) return 'Choose a movement type.'; if (!isNum(m.kg) || +m.kg === 0) return 'Enter the weight in kg.';
  if (m.kind !== 'adjustment' && +m.kg <= 0) return 'Weight must be more than 0 (use Adjustment for a correction).'; if (Math.abs(+m.kg) > 100000) return 'That weight looks wrong.'; return '';
};
W.stockAfter = (stock, m) => round(+stock + (m.kind === 'purchase' || m.kind === 'adjustment' ? +m.kg : m.kind === 'actual_use' ? -m.kg : 0), 3);
W.lowStock = ys => ys.filter(y => y.reorder_kg != null && +y.stock_kg <= +y.reorder_kg && y.active !== false);

/* ---------------------------------------------------------------- calculator */
W.RATE_FIELDS = [
  ['currency', 'Currency (3 letters)', 'text'], ['pileKgPerM2.low', 'Yarn kg per m2, low pile', 'num'], ['pileKgPerM2.standard', 'Yarn kg per m2, standard pile', 'num'], ['pileKgPerM2.high', 'Yarn kg per m2, high pile', 'num'],
  ['wastePct', 'Yarn waste %', 'num'], ['labour.hoursPerM2', 'Tufting hours per m2', 'num'], ['labour.setupHours', 'Set-up hours per rug', 'num'], ['labour.hourlyRate', 'Labour rate per hour', 'num'],
  ['backingPerM2', 'Backing cloth + latex per m2', 'num'], ['bindingPerM', 'Binding / edging per metre', 'num'], ['finishingFlat', 'Finishing per rug (flat)', 'num'], ['packagingFlat', 'Packaging per rug (flat)', 'num'],
  ['overheadPct', 'Overhead %', 'num'], ['marginPct', 'Profit margin % of selling price', 'num'], ['taxPct', 'Tax %', 'num']
];
const getP = (o, p) => p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
const setP = (o, p, v) => { const ks = p.split('.'); let a = o; ks.slice(0, -1).forEach(k => { a[k] = a[k] && typeof a[k] === 'object' ? a[k] : {}; a = a[k]; }); a[ks[ks.length - 1]] = v; };
W.getRate = getP;
/** form values -> rates object. Empty fields stay absent (never defaulted to a number). */
W.ratesFromForm = vals => {
  const r = {}, errors = [];
  W.RATE_FIELDS.forEach(([p, label, t]) => { let v = vals[p]; if (v == null || String(v).trim() === '') return; v = String(v).trim();
    if (t === 'text') { if (!/^[A-Za-z]{3}$/.test(v)) errors.push(label + ' must be 3 letters.'); else setP(r, p, v.toUpperCase()); return; }
    if (!isNum(v) || +v < 0) { errors.push(label + ' must be a number of 0 or more.'); return; } if (/Pct$/.test(p) && +v > 100) { errors.push(label + ' cannot be above 100.'); return; } setP(r, p, +v); });
  if (r.marginPct != null && r.marginPct >= 100) errors.push('Profit margin must be below 100%.');
  return { rates: r, errors };
};
W.areaM2 = (widthCm, heightCm, shape, radiusPct, areaFraction) => {
  const w = widthCm / 100, h = heightCm / 100; if (isNum(areaFraction) && areaFraction > 0 && areaFraction <= 1) return round(w * h * areaFraction, 4);
  if (shape === 'circle' || shape === 'oval') return round(Math.PI / 4 * w * h, 4);
  const r = Math.min(50, Math.max(0, radiusPct || 0)) / 100 * Math.min(w, h); return round(w * h - (4 - Math.PI) * r * r, 4);
};
/** area share and edge length of a custom outline (unit-square points, y down); {} for ordinary shapes */
W.shapeFacts = doc => {
  if (!doc || doc.shape !== 'custom' || !Array.isArray(doc.outline) || doc.outline.length < 3) return {};
  const P = doc.outline; let a = 0, per = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; a += p[0] * q[1] - q[0] * p[1]; per += Math.hypot((q[0] - p[0]) * doc.widthCm, (q[1] - p[1]) * doc.heightCm); }
  return { areaFraction: round(Math.min(1, Math.abs(a) / 2), 5), perimeterM: round(per / 100, 4) };
};
W.perimeterM = (widthCm, heightCm, shape) => { const w = widthCm / 100, h = heightCm / 100; return round(shape === 'circle' || shape === 'oval' ? Math.PI * (3 * (w / 2 + h / 2) - Math.sqrt((3 * w / 2 + h / 2) * (w / 2 + 3 * h / 2))) : 2 * (w + h), 4); };
/**
 * input: {widthCm,heightCm,shape,radius,areaFraction,pile,binding(bool), colours:[{yarnId,pct}]}  rates: from ratesFromForm / biz_rates.rates  yarns: biz_yarns rows
 * Every line is {key,label,amount|null,note}. `missing` lists the rates still to be entered. total is only a number when nothing is missing.
 */
W.calc = (input, rates, yarns) => {
  rates = rates || {}; yarns = yarns || []; const errs = [];
  const w = +input.widthCm, h = +input.heightCm; if (!(w >= 5 && h >= 5)) errs.push('Width and height must be at least 5 cm.'); if (w > 2000 || h > 2000) errs.push('Maximum size is 2000 cm.');
  if (errs.length) return { ok: false, errors: errs };
  const area = W.areaM2(w, h, input.shape, input.radius, input.areaFraction), perim = isNum(input.perimeterM) && input.perimeterM > 0 ? +input.perimeterM : W.perimeterM(w, h, input.shape), pile = input.pile || 'standard', ym = {}; yarns.forEach(y => { ym[y.id] = y; });
  const missing = [], lines = [], need = (key, label) => { if (!missing.some(m => m.key === key)) missing.push({ key, label }); };
  const kgM2 = getP(rates, 'pileKgPerM2.' + pile), waste = isNum(rates.wastePct) ? +rates.wastePct : null;
  // yarn
  const cols = (input.colours || []).filter(c => c && isNum(c.pct) && +c.pct > 0), shareTotal = cols.reduce((s, c) => s + +c.pct, 0) || 1, yarnRows = [];
  let yarnKgTotal = null, yarnCost = 0, yarnCostKnown = true;
  if (!isNum(kgM2)) need('pileKgPerM2.' + pile, 'Yarn kg per m2, ' + pile + ' pile'); if (waste === null) need('wastePct', 'Yarn waste %');
  if (isNum(kgM2) && waste !== null) {
    yarnKgTotal = 0;
    cols.forEach(c => { const y = ym[c.yarnId], kg = round(area * +kgM2 * (+c.pct / shareTotal) * (1 + waste / 100), 3); yarnKgTotal += kg; const cost = y && isNum(y.price_per_kg) ? round(kg * y.price_per_kg, 2) : null; if (cost == null) yarnCostKnown = false; else yarnCost += cost; yarnRows.push({ yarnId: c.yarnId, code: y ? y.code : '(unmapped)', name: y ? y.name : '', hex: y ? y.hex : null, pct: round(+c.pct / shareTotal * 100, 1), kg, cost, stockKg: y ? +y.stock_kg : null, enough: y ? +y.stock_kg >= kg : null }); });
    yarnKgTotal = round(yarnKgTotal, 3);
  }
  const unpriced = yarnRows.filter(r => r.cost == null).map(r => r.code);
  lines.push({ key: 'yarn', label: 'Yarn', amount: yarnKgTotal != null && yarnCostKnown && cols.length ? round(yarnCost, 2) : null, note: yarnKgTotal == null ? 'needs yarn kg per m2 and waste %' : !cols.length ? 'no colours mapped yet' : unpriced.length ? 'no price per kg for ' + unpriced.join(', ') : yarnKgTotal + ' kg' });
  const L = rates.labour || {};
  const hours = isNum(L.hoursPerM2) ? round(area * +L.hoursPerM2 + (isNum(L.setupHours) ? +L.setupHours : 0), 2) : null;
  if (!isNum(L.hoursPerM2)) need('labour.hoursPerM2', 'Tufting hours per m2'); if (!isNum(L.hourlyRate)) need('labour.hourlyRate', 'Labour rate per hour');
  lines.push({ key: 'labour', label: 'Labour', amount: hours != null && isNum(L.hourlyRate) ? round(hours * L.hourlyRate, 2) : null, note: hours != null ? hours + ' h' : 'needs hours per m2 and a labour rate' });
  const per = (key, label, rate, qty, unit) => { if (!isNum(rate)) { need(key, label); lines.push({ key, label: label.replace(/ per .*| \(flat\)/, ''), amount: null, note: 'rate not entered' }); } else lines.push({ key, label: label.replace(/ per .*| \(flat\)/, ''), amount: round(+rate * qty, 2), note: unit }); };
  per('backingPerM2', 'Backing cloth + latex per m2', rates.backingPerM2, area, area + ' m2');
  if (input.binding) per('bindingPerM', 'Binding / edging per metre', rates.bindingPerM, perim, perim + ' m');
  per('finishingFlat', 'Finishing per rug (flat)', rates.finishingFlat, 1, 'per rug'); per('packagingFlat', 'Packaging per rug (flat)', rates.packagingFlat, 1, 'per rug');
  const complete = missing.length === 0 && lines.every(l => l.amount != null), costs = round(lines.reduce((s, l) => s + (l.amount || 0), 0), 2);
  const out = { ok: true, areaM2: area, perimeterM: perim, pile, hours, yarnKg: yarnKgTotal, yarn: yarnRows, lines, missing, complete, knownCost: costs, currency: rates.currency || null };
  if (complete) {
    const over = isNum(rates.overheadPct) ? round(costs * rates.overheadPct / 100, 2) : 0, cost = round(costs + over, 2), m = isNum(rates.marginPct) ? +rates.marginPct : null;
    out.overhead = over; out.cost = cost;
    if (m === null) { need('marginPct', 'Profit margin % of selling price'); out.complete = false; out.missing = missing; } else { const sell = round(cost / (1 - m / 100), 2); out.price = sell; out.margin = round(sell - cost, 2); const t = isNum(rates.taxPct) ? round(sell * rates.taxPct / 100, 2) : 0; out.tax = t; out.total = round(sell + t, 2); if (!isNum(rates.taxPct)) out.taxNote = 'Tax rate not entered, so no tax is added.'; }
  }
  return out;
};

/* ---------------------------------------------------------------- quotations and orders */
W.QUOTE_STATUS = ['draft', 'sent', 'accepted', 'rejected', 'expired'];
W.ORDER_STATUS = ['open', 'in_production', 'ready', 'delivered', 'cancelled'];
W.PROJECT_STATUS = ['enquiry', 'quoted', 'confirmed', 'in_production', 'finished', 'delivered', 'cancelled'];
W.cleanLines = lines => { const out = [], errors = []; (lines || []).forEach((l, i) => { const desc = clampStr(l.desc, 200), blank = !desc && !isNum(l.qty) && !isNum(l.unit); if (blank) return; if (!desc) return errors.push('Line ' + (i + 1) + ' needs a description.'); if (!isNum(l.qty) || +l.qty <= 0 || +l.qty > 100000) return errors.push('Line ' + (i + 1) + ': quantity must be more than 0.'); if (!isNum(l.unit) || +l.unit < 0 || +l.unit > 1e9) return errors.push('Line ' + (i + 1) + ': unit price must be 0 or more.'); out.push({ desc, qty: round(+l.qty, 3), unit: round(+l.unit, 2) }); }); if (!out.length && !errors.length) errors.push('Add at least one line.'); if (out.length > 100) errors.push('At most 100 lines.'); return { lines: out, errors }; };
W.quoteTotals = (lines, o) => { o = o || {}; const sub = round(lines.reduce((s, l) => s + l.qty * l.unit, 0), 2), d = isNum(o.discountPct) ? Math.min(100, Math.max(0, +o.discountPct)) : 0, disc = round(sub * d / 100, 2), after = round(sub - disc, 2), t = isNum(o.taxPct) ? Math.min(100, Math.max(0, +o.taxPct)) : 0, tax = round(after * t / 100, 2); return { subtotal: sub, discount: disc, tax, total: round(after + tax, 2) }; };
/** next reference such as Q-2026-0007 from the refs already used */
W.nextRef = (prefix, refs, year) => { const re = new RegExp('^' + prefix + '-' + year + '-(\\d+)$'); let max = 0; (refs || []).forEach(r => { const m = re.exec(r); if (m) max = Math.max(max, +m[1]); }); return prefix + '-' + year + '-' + String(max + 1).padStart(4, '0'); };
W.orderFromQuote = (q, year, refs) => ({ ref: W.nextRef('O', refs, year), quotation_id: q.id, project_id: q.project_id || null, customer_id: q.customer_id || null, currency: q.currency, total: q.total != null ? q.total : q.subtotal, paid: 0, status: 'open' });
W.balance = o => round(Math.max(0, (+o.total || 0) - (+o.paid || 0)), 2);

/* ---------------------------------------------------------------- reports */
W.report = ({ orders = [], quotes = [], projects = [], stock = [], customers = [] }) => {
  const by = (arr, f) => arr.reduce((m, x) => { const k = f(x); m[k] = (m[k] || 0) + 1; return m; }, {});
  const live = orders.filter(o => o.status !== 'cancelled'), cur = [...new Set(live.map(o => o.currency))];
  const money = cur.map(c => { const os = live.filter(o => o.currency === c); return { currency: c, orders: os.length, total: round(os.reduce((s, o) => s + +o.total, 0), 2), paid: round(os.reduce((s, o) => s + +o.paid, 0), 2), outstanding: round(os.reduce((s, o) => s + W.balance(o), 0), 2) }; });
  const sentOrDone = quotes.filter(q => q.status === 'accepted' || q.status === 'rejected'), accepted = quotes.filter(q => q.status === 'accepted').length;
  const cust = {}; live.forEach(o => { if (o.customer_id) cust[o.customer_id] = (cust[o.customer_id] || 0) + 1; });
  const top = Object.entries(cust).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, n]) => ({ id, name: (customers.find(c => c.id === id) || {}).name || '(deleted)', orders: n }));
  return { ordersByStatus: by(orders, o => o.status), quotesByStatus: by(quotes, q => q.status), projectsByStatus: by(projects, p => p.status), money, acceptRate: sentOrDone.length ? round(accepted / sentOrDone.length * 100, 1) : null,
    yarn: stock.map(s => ({ code: s.code, name: s.name, stock_kg: +s.stock_kg, estimated_use_kg: +s.estimated_use_kg, actual_use_kg: +s.actual_use_kg, difference_kg: round(+s.actual_use_kg - +s.estimated_use_kg, 3), low: !!s.low_stock })), lowStock: stock.filter(s => s.low_stock).length, topCustomers: top };
};
W.reportCsv = r => W.csvStringify([['section', 'item', 'value']].concat(
  Object.entries(r.ordersByStatus).map(([k, v]) => ['orders by status', k, v]), Object.entries(r.quotesByStatus).map(([k, v]) => ['quotations by status', k, v]), Object.entries(r.projectsByStatus).map(([k, v]) => ['projects by status', k, v]),
  r.money.map(m => ['money ' + m.currency, 'total / paid / outstanding', m.total + ' / ' + m.paid + ' / ' + m.outstanding]),
  r.yarn.map(y => ['yarn ' + y.code, 'stock kg / estimated use kg / actual use kg', y.stock_kg + ' / ' + y.estimated_use_kg + ' / ' + y.actual_use_kg])));

if (typeof module !== 'undefined' && module.exports) module.exports = W; else root.XWORK = W;
})(typeof window !== 'undefined' ? window : globalThis);
