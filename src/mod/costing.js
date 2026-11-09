/* ============ XARO costing engine (pure functions; also used by the node tests) ============
   Everything here is an ESTIMATE. All rates live in `DEFAULT_RATES` and are editable in Admin > Costing.
   Defaults are fitted to the cost assumptions in the project plan (materials, labour at US$2.50/h, assumed DHL rates);
   they are placeholders to be replaced by your real, measured numbers. Yarn consumption is left empty on purpose. */
(function (root) {
'use strict';
const DEFAULT_RATES = {
  v: 1,
  pileTypes: { low: { label: 'Low pile', matPerM2: 45, hoursMul: 0.85 }, standard: { label: 'Standard pile', matPerM2: 58, hoursMul: 1 }, high: { label: 'High pile', matPerM2: 80, hoursMul: 1.2 }, carved: { label: 'Carved pile', matPerM2: 90, hoursMul: 1.5 } },
  yarnKgPerM2: { low: null, standard: null, high: null, carved: null },   // set from your own measurements; never guessed
  backing: { standard: { label: 'Standard primary + latex', perM2: 0 }, felt: { label: 'Non-slip felt back', perM2: 6 }, premium: { label: 'Premium cotton + latex', perM2: 12 } },
  border: { none: { label: 'No border', perM: 0 }, bound: { label: 'Twill binding', perM: 2.5 }, carved: { label: 'Carved border', perM: 1.5, hoursPerM: 0.6 } },
  finishing: { frame: { label: 'Black wood frame', flat: 25, perM2: 40 }, rush: { label: 'Rush production', pct: 0.15 } },
  hoursFixed: 2.5, hoursPerM2: 21.2, colourFreeCount: 3, hoursPerExtraColourPct: 0.04,
  labourRateUSD: 2.5,
  packagingFixed: 3, packagingPerM2: 6,
  shipping: { local: { label: 'Within Sri Lanka', bands: [[0.1, 4], [0.7, 8], [99, 14]] }, export: { label: 'Export (courier)', bands: [[0.1, 32], [0.7, 60], [1.2, 140], [99, 190]] } },
  dutyPct: { local: 0, export: 0.15 }, gatewayPct: { local: 0.02, export: 0.039 }, gatewayFixed: { local: 0, export: 0.3 }, platformPct: { local: 0, export: 0.02 },
  targetMarginPct: 0.30, fx: { USD: 1, LKR: 333, AED: 3.6725, GBP: 0.78, AUD: 1.52, EUR: 0.92 }
};
const clone = o => JSON.parse(JSON.stringify(o));
const mergeRates = (base, over) => { if (!over) return clone(base); const o = clone(base); (function m(a, b) { Object.keys(b || {}).forEach(k => { if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object') m(a[k], b[k]); else if (b[k] !== undefined) a[k] = b[k]; }); })(o, over); return o; };
const num = (v, d) => (isFinite(+v) ? +v : d);
const round2 = n => Math.round(n * 100) / 100;
const band = (bands, area) => { for (const [lim, cost] of bands) if (area <= lim) return cost; return bands[bands.length - 1][1]; };

/** estimate({widthCm,heightCm,shape,colours,pile,backing,border,frame,rush,dest,currency}, rates) */
function estimate(inp, rates) {
  const R = rates || DEFAULT_RATES, errs = [];
  const w = num(inp.widthCm, 0), h = num(inp.heightCm, 0);
  if (!(w >= 5 && h >= 5)) errs.push('Width and height must be at least 5 cm.');
  if (w > 600 || h > 600) errs.push('Maximum size is 600 cm.');
  const pile = R.pileTypes[inp.pile] ? inp.pile : 'standard', backing = R.backing[inp.backing] ? inp.backing : 'standard', border = R.border[inp.border] ? inp.border : 'none';
  const colours = Math.max(1, Math.round(num(inp.colours, 3)));
  const dest = inp.dest === 'local' ? 'local' : 'export';
  if (errs.length) return { ok: false, errors: errs };
  const shape = inp.shape || 'rect';
  const custom = shape === 'custom', fr = num(inp.areaFraction, 0);   // a custom outline brings its own measured area share and edge length
  const areaFactor = custom ? (fr > 0 && fr <= 1 ? fr : 1) : shape === 'circle' || shape === 'oval' ? Math.PI / 4 : 1;
  const area = (w / 100) * (h / 100) * areaFactor, perim = custom && num(inp.perimeterM, 0) > 0 ? num(inp.perimeterM, 0) : shape === 'circle' || shape === 'oval' ? Math.PI * ((w + h) / 2) / 100 : 2 * (w + h) / 100;
  const P = R.pileTypes[pile];
  const material = area * P.matPerM2 + area * R.backing[backing].perM2 + perim * R.border[border].perM;
  const extra = Math.max(0, colours - R.colourFreeCount);
  let hours = (R.hoursFixed + R.hoursPerM2 * area) * P.hoursMul * (1 + extra * R.hoursPerExtraColourPct) + perim * (R.border[border].hoursPerM || 0);
  const labour = hours * R.labourRateUSD;
  const packaging = R.packagingFixed + R.packagingPerM2 * area;
  const frame = inp.frame ? R.finishing.frame.flat + R.finishing.frame.perM2 * area : 0;
  const shipping = band(R.shipping[dest].bands, area);
  const production = material + labour + frame;
  const base = production + packaging + shipping;
  const rushPct = inp.rush ? R.finishing.rush.pct : 0;
  const feeP = R.dutyPct[dest] + R.gatewayPct[dest] + R.platformPct[dest], margin = Math.min(0.8, Math.max(0, num(inp.marginPct, R.targetMarginPct)));
  const denom = 1 - feeP - margin;
  const sellUSD = (base + R.gatewayFixed[dest]) / denom * (1 + rushPct);
  const fees = sellUSD * feeP + R.gatewayFixed[dest];
  const gross = sellUSD - base - fees;
  const cur = R.fx[inp.currency] ? inp.currency : 'USD', k = R.fx[cur];
  const conv = v => v * k, out = {
    ok: true, estimate: true, areaM2: round2(area * 10000) / 10000, perimeterM: round2(perim), hours: round2(hours), colours, pile, dest, currency: cur,
    yarnKg: R.yarnKgPerM2[pile] == null ? null : round2(area * R.yarnKgPerM2[pile]),
    usd: { material: round2(material), labour: round2(labour), frame: round2(frame), production: round2(production), packaging: round2(packaging), shipping: round2(shipping), fees: round2(fees), gross: round2(gross), sell: round2(sellUSD), cost: round2(base) },
    marginPct: round2(gross / sellUSD * 100), notes: ['Estimate only. A confirmed quotation comes from the XARO team after artwork review.']
  };
  out.local = { material: round2(conv(material)), labour: round2(conv(labour)), production: round2(conv(production)), packaging: round2(conv(packaging)), shipping: round2(conv(shipping)), fees: round2(conv(fees)), gross: round2(conv(gross)), sell: round2(conv(sellUSD)) };
  if (out.yarnKg == null) out.notes.push('Yarn weight is not shown until you enter your measured kg per m2 in Admin > Costing.');
  return out;
}
/** nicer customer price: round up to a friendly step in the display currency */
function friendly(amount, cur) { const step = cur === 'LKR' ? 100 : cur === 'USD' || cur === 'GBP' || cur === 'EUR' || cur === 'AUD' ? 1 : 5; return Math.ceil(amount / step) * step; }
const api = { DEFAULT_RATES, estimate, mergeRates, friendly };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.XCOST = api;
})(typeof window !== 'undefined' ? window : globalThis);
