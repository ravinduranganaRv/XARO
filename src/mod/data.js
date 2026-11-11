/* XARO data layer (demo mode: everything lives in this browser's localStorage).
   Swap the get/set pair below for a server adapter to go live; the rest of the app only talks to XD. */
const XD = (() => {
'use strict';
const K = 'xaro.v2.', mem = {};
const g = (k, d) => { try { const v = localStorage.getItem(K + k); if (v) return JSON.parse(v); } catch (e) {} return k in mem ? mem[k] : d; };
const s = (k, v) => { mem[k] = v; try { localStorage.setItem(K + k, JSON.stringify(v)); return true; } catch (e) { return false; } };
const uid = p => p + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
const esc = x => String(x == null ? '' : x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = o => JSON.parse(JSON.stringify(o));

/* ---------------------------------------------------------------- countries, currencies, FX */
const CURRENCIES = ['LKR', 'USD', 'AED', 'GBP', 'AUD', 'EUR'];
const FX_DEFAULT = { USD: 1, LKR: 333, AED: 3.6725, GBP: 0.78, AUD: 1.52, EUR: 0.92 }; // units per US$; editable in Admin > Settings
const COUNTRIES_DEFAULT = [
  { code: 'LK', name: 'Sri Lanka', cur: 'LKR', dial: '+94', enabled: true, ship: 0, eta: 'Island-wide courier, 2-4 business days after dispatch', pay: 'Cash on delivery or bank transfer' },
  { code: 'US', name: 'United States', cur: 'USD', dial: '+1', enabled: true, ship: 0, eta: 'Tracked express, about 4-8 business days after dispatch', pay: 'Card (live store)' },
  { code: 'AE', name: 'United Arab Emirates', cur: 'AED', dial: '+971', enabled: true, ship: 0, eta: 'Tracked express, about 3-6 business days after dispatch', pay: 'Card (live store)' },
  { code: 'GB', name: 'United Kingdom', cur: 'GBP', dial: '+44', enabled: false, ship: 0, eta: 'Opening soon', pay: 'Card (live store)' },
  { code: 'AU', name: 'Australia', cur: 'AUD', dial: '+61', enabled: false, ship: 0, eta: 'Opening soon', pay: 'Card (live store)' },
  { code: 'OT', name: 'Another country', cur: 'USD', dial: '', enabled: false, ship: 0, eta: 'Join the waitlist', pay: '' }
];
// starter local prices (editable in Admin): US$ / LKR / AED / GBP / AUD
const SEED_PRICES = {
  'XK-C': { LK: 3800, AE: 365, GB: 79, AU: 154 },
  'XK-S': { LK: 4500, AE: 400, GB: 89, AU: 169 },
  'XM': { LK: 1000, AE: 60, GB: 14, AU: 27 },
  'XS': { LK: 5200, AE: 435, GB: 94, AU: 184 },
  'XF': { LK: 12500, AE: 1025, GB: 224, AU: 434 },
  'XW-M': { LK: 7500, AE: 545, GB: 119, AU: 234 },
  'XW-S': { LK: 28000, AE: 2385, GB: 519, AU: 1014 },
  'XW-L': { LK: 38000, AE: 3300, GB: 719, AU: 1404 },
  'CK': { LK: 5000, AE: 510, GB: 109, AU: 219 },
  'CS': { LK: 6500, AE: 585, GB: 129, AU: 249 },
  'CF': { LK: 14500, AE: 1280, GB: 279, AU: 544 },
  'CL': { LK: 17500, AE: 1465, GB: 319, AU: 624 },
  'CW': { LK: 34000, AE: 2935, GB: 639, AU: 1249 }
};
const SETTINGS_DEFAULT = { requireLogin: true, storeName: 'XARO Industries (Pvt) Ltd', whatsapp: '', email: '', syncUrl: '', botOn: true, botName: 'Zaro', announce: '' };

const settings = () => Object.assign({}, SETTINGS_DEFAULT, g('settings', {}));
const setSettings = o => s('settings', Object.assign(settings(), o));
const fxTable = () => Object.assign({}, FX_DEFAULT, g('fx', {}));
const setFx = o => s('fx', Object.assign(fxTable(), o));
const countries = () => { const sv = g('countries', null); if (!sv) return clone(COUNTRIES_DEFAULT); return COUNTRIES_DEFAULT.map(d => Object.assign({}, d, sv.find(x => x.code === d.code) || {})); };
const setCountries = l => s('countries', l);
const country = code => countries().find(c => c.code === code) || countries()[1];

/* ---------------------------------------------------------------- money */
const nf = {};
function money(amount, cur) {
  const frac = (cur === 'USD' || cur === 'GBP' || cur === 'EUR' || cur === 'AUD') && Math.abs(amount % 1) > 0.001 ? 2 : 0;
  const key = cur + frac; try { nf[key] = nf[key] || new Intl.NumberFormat('en', { style: 'currency', currency: cur, minimumFractionDigits: frac, maximumFractionDigits: frac }); return nf[key].format(amount); } catch (e) { return cur + ' ' + Math.round(amount).toLocaleString('en'); }
}
const convert = (amount, from, to) => from === to ? amount : amount / (fxTable()[from] || 1) * (fxTable()[to] || 1);
function fmtMoney(amount, from, to) { to = to || from; if (from === to) return money(amount, to); const v = convert(amount, from, to); return '≈ ' + money(to === 'LKR' ? Math.round(v / 10) * 10 : Math.round(v), to); }

/* ---------------------------------------------------------------- region (country + display currency) */
function guessCountry() {
  let tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
  if (/Colombo/.test(tz)) return 'LK'; if (/Dubai|Muscat/.test(tz)) return 'AE'; if (/London|Belfast/.test(tz)) return 'GB'; if (/^Australia/.test(tz)) return 'AU'; if (/^America\//.test(tz)) return 'US';
  const l = (navigator.language || '').toLowerCase(); if (/-lk$|^si|^ta/.test(l)) return 'LK'; if (/-ae$/.test(l)) return 'AE'; if (/-gb$/.test(l)) return 'GB'; if (/-au$/.test(l)) return 'AU';
  return 'US';
}
function region() { const r = g('region', null); if (r && r.country) { const c = country(r.country); return { country: c.code, cur: CURRENCIES.includes(r.cur) ? r.cur : c.cur, chosen: true }; } const c = country(guessCountry()); return { country: c.code, cur: c.cur, chosen: false }; }
function setRegion(p) { const cur = region(); const nx = Object.assign({}, cur, p); if (p.country && !p.cur) nx.cur = country(p.country).cur; s('region', { country: nx.country, cur: nx.cur }); return region(); }

/* ---------------------------------------------------------------- products */
function seedProducts() {
  return CATALOG.products.map(p => ({
    sku: p.sku, name: p.name, cat: p.cat, kind: p.kind, size: p.size, desc: p.desc, lead: p.lead, designs: p.designs.slice(), deposit: !!p.deposit, weight: p.weight || '',
    active: true, img: '', stock: null, cost: null, shape: '', w: 0, h: 0, price: p.price,
    prices: Object.assign({ US: p.price }, SEED_PRICES[p.sku] || {})
  }));
}
let _prod = null;
const products = () => { if (!_prod) { const sv = g('products', null); _prod = sv && sv.length ? sv : seedProducts(); if (!sv) s('products', _prod); } return _prod; };
function applyStarterPrices() { const l = products(); let n = 0; seedProducts().forEach(sp => { const p = l.find(x => x.sku === sp.sku); if (p) { p.prices = Object.assign({}, p.prices, sp.prices); p.price = sp.price; n++; } }); saveProducts(l); return n; }
const saveProducts = l => { _prod = l; return s('products', l); };
const resetProducts = () => { _prod = null; try { localStorage.removeItem(K + 'products'); } catch (e) {} delete mem.products; return products(); };
function priceFor(p, code) {
  const c = country(code); const v = p.prices && p.prices[c.code];
  if (v != null && v !== '' && !isNaN(+v) && +v > 0) return { amount: +v, cur: c.cur, explicit: true };
  const usd = p.prices && +p.prices.US > 0 ? +p.prices.US : +p.price || 0; const a = convert(usd, 'USD', c.cur);
  return { amount: c.cur === 'LKR' ? Math.round(a / 50) * 50 : Math.round(a), cur: c.cur, explicit: false };
}

/* ---------------------------------------------------------------- customers, orders, events */
const customers = () => g('customers', []);
const saveCustomers = l => s('customers', l);
const digits = v => String(v || '').replace(/\D/g, '');
function upsertCustomer(d) {
  const l = customers(), em = (d.email || '').trim().toLowerCase(), ph = digits(d.phone);
  let c = l.find(x => (em && x.email === em) || (ph.length > 6 && digits(x.phone) === ph));
  const now = new Date().toISOString();
  if (c) { Object.assign(c, { name: d.name || c.name, phone: (c.phone && c.phone[0] === '+' && d.phone && d.phone[0] !== '+' && digits(c.phone).endsWith(digits(d.phone).replace(/^0+/, ''))) ? c.phone : (d.phone || c.phone), country: d.country || c.country, cur: d.cur || c.cur, last: now, visits: (c.visits || 1) + 1 }); if (em) c.email = em; }
  else { c = { id: uid('c_'), name: d.name || '', email: em, phone: d.phone || '', country: d.country || '', cur: d.cur || '', consent: d.consent !== false, source: d.source || 'signup', at: now, last: now, visits: 1, notes: '' }; l.push(c); }
  saveCustomers(l); return c;
}
const me = () => { const id = g('me', ''); return id ? customers().find(c => c.id === id) || null : null; };
const setMe = id => s('me', id);
const orders = () => g('orders', []);
const saveOrders = l => s('orders', l);
function newOrderId() { const ids = new Set(orders().map(o => o.id)); let id; do { id = 'XARO-' + (10000 + Math.floor(Math.random() * 89999)); } while (ids.has(id)); return id; }
function addOrder(o) {
  const l = orders(); o.id = o.id || newOrderId(); o.at = new Date().toISOString(); o.stage = 0; o.cancelled = false; o.tracking = ''; o.notes = ''; l.push(o); saveOrders(l);
  const pl = products(); let ch = false; o.items.forEach(i => { const p = pl.find(x => x.sku === i.sku); if (p && p.stock != null) { p.stock = Math.max(0, p.stock - i.qty); ch = true; } }); if (ch) saveProducts(pl);
  return o;
}
const sid = (() => { let v = ''; try { v = sessionStorage.getItem('xaro.sid') || ''; if (!v) { v = uid('s_'); sessionStorage.setItem('xaro.sid', v); } } catch (e) { v = v || uid('s_'); } return v; })();
const events = () => g('events', []);
function track(type, d) {
  const l = events(); l.push(Object.assign({ t: Date.now(), type, sid, c: region().country }, d || {})); if (l.length > 5000) l.splice(0, l.length - 5000); s('events', l);
}

/* ---------------------------------------------------------------- optional sync to a Google Apps Script web app (Admin > Settings) */
/** only a Google Apps Script web app address may receive customer details */
const syncOK = u => /^https:\/\/script\.google\.com\/(a\/macros\/[\w.-]+\/|macros\/)s\/[\w-]+\/exec$/.test(String(u || '').trim());
function sync(type, payload) {
  const url = settings().syncUrl; if (!url || !syncOK(url)) return;
  try { fetch(url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ type, at: new Date().toISOString(), payload }) }).catch(() => {}); } catch (e) {}
}

/* ---------------------------------------------------------------- admins (hashes only) */
const SEED_ADMIN = /*%SEED_ADMIN%*/;
const ALL_PERMS = [['dashboard', 'Dashboard and analytics'], ['customers', 'Customers'], ['orders', 'Orders'], ['products', 'Products'], ['pricing', 'Prices and currencies'], ['assistant', 'AI assistant'], ['settings', 'Settings and data'], ['admins', 'Admin users']];
function admins() {
  const sv = g('admins', null); if (sv && sv.length) return sv;
  const l = [{ username: 'Ravindu20007', name: 'Ravindu', role: 'owner', perms: ALL_PERMS.map(p => p[0]), active: false, salt: SEED_ADMIN.salt, hash: SEED_ADMIN.hash, iter: SEED_ADMIN.iter, at: new Date().toISOString(), last: '' }];
  s('admins', l); return l;
}
const saveAdmins = l => s('admins', l);


/* ---------------------------------------------------------------- yarn library, saved designs, quotes, costing rates */
const YARN_DEFAULT = [
  ['Jet Black', '#0B0B0B'], ['Charcoal', '#2A2D2A'], ['Graphite Grey', '#5A5F5A'], ['Silver Grey', '#A5ABA5'], ['Off White', '#EDEDE6'], ['Pure White', '#FFFFFF'],
  ['Neon Lime', '#39FF14'], ['Lime', '#A4D62B'], ['Forest Green', '#1F6B35'], ['Mint', '#7DE3B0'], ['Teal', '#0FA3A3'], ['Sky Blue', '#4DA3FF'], ['Royal Blue', '#2547D0'],
  ['Navy', '#101C4A'], ['Violet', '#7A3CFF'], ['Magenta', '#E0359A'], ['Hot Pink', '#FF5D8F'], ['Red', '#E02B2B'], ['Burgundy', '#6E1530'], ['Orange', '#FF7A1A'],
  ['Amber', '#FFB020'], ['Yellow', '#FFE53B'], ['Beige', '#D9C3A0'], ['Brown', '#6B4423'], ['Gold', '#C9A227'], ['Blush', '#F4C6C6']
].map((c, i) => ({ id: 'XY-' + String(i + 1).padStart(3, '0'), name: c[0], hex: c[1], material: 'Acrylic', supplier: '', availability: 'unknown', stock: null, cost: null, active: true }));
const hex2rgb = h => { h = String(h).replace('#', ''); if (h.length === 3) h = h.split('').map(x => x + x).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const yarns = () => { const v = g('yarns', null); return v && v.length ? v : clone(YARN_DEFAULT); };
const saveYarns = l => s('yarns', l);
const designs = () => g('designs', []);
const saveDesigns = l => s('designs', l);
const quotes = () => g('quotes', []);
const saveQuotes = l => s('quotes', l);
function addQuote(q) { const l = quotes(); const o = Object.assign({ id: 'Q-' + Math.floor(10000 + Math.random() * 89999), at: new Date().toISOString(), status: 'New', confirmed: null, notes: '' }, q); l.unshift(o); if (!saveQuotes(l)) { l.forEach(x => { if (x.thumb && x !== o) x.thumb = ''; }); saveQuotes(l); } return o; }
const costRates = () => g('costing', null);
const setCostRates = o => s('costing', o);

/* ---------------------------------------------------------------- assistant knowledge + logs */
const DEFAULT_KB = [
  { id: 'k_drop', name: 'Drop 001', keys: ['drop', '001', 'limited', 'launch', 'release', 'how many pieces', '25 pieces'], a: 'Drop 001 is our first limited run of hand-tufted keyboard rugs and 3D wall art, 25 pieces worldwide. Each one is made to order in Sri Lanka. Join the waitlist and you hear about the launch first.' },
  { id: 'k_made', name: 'How it is made', keys: ['made', 'handmade', 'hand made', 'tufted', 'tufting', 'material', 'acrylic', 'wool', 'quality', 'carved', 'carving'], a: 'Every piece is hand-tufted with a tufting gun, backed with latex, then sheared and bevel-carved so the colour edges stand off the pile. Keyboard rugs use 8-ply acrylic with a non-slip felt back. Because they are hand-made, small variations in pile and carving are part of each piece.' },
  { id: 'k_ship', name: 'Shipping', keys: ['ship', 'shipping', 'delivery', 'deliver', 'courier', 'how long', 'when will', 'arrive', 'dhl'], a: '{shipping}' },
  { id: 'k_lead', name: 'Lead times', keys: ['lead time', 'dispatch', 'how long does', 'production time', 'wait time', 'ready'], a: 'Keyboard rugs and sets dispatch in 10 to 14 business days, floor rugs in 3 to 4 weeks, wall art in 4 to 6 weeks. Custom pieces add 3 to 4 weeks including design approval. Courier time is extra.' },
  { id: 'k_custom', name: 'Custom orders', keys: ['custom', 'my design', 'my logo', 'my art', 'personalize', 'personalise', 'commission', 'own design', 'upload'], a: 'Yes, we make custom pieces. Open the Custom rug builder, upload your art and see it as a tufted pile in 3D. You pay 50% to start and the balance when you approve the design mockup. Please only send art you own or have rights to; we cannot make other companies’ characters or logos.' },
  { id: 'k_pay', name: 'Payments', keys: ['pay', 'payment', 'card', 'cash on delivery', 'cod', 'bank transfer', 'paypal', 'visa', 'mastercard', 'deposit'], a: '{payment}' },
  { id: 'k_return', name: 'Returns', keys: ['return', 'refund', 'exchange', 'damaged', 'broken', 'wrong item', 'defect'], a: 'Custom pieces cannot be returned for change of mind. If anything arrives damaged, defective or wrong, tell us within 14 days of delivery and we will repair or replace it. Standard pieces can be exchanged within 14 days of delivery.' },
  { id: 'k_care', name: 'Care', keys: ['care', 'clean', 'wash', 'vacuum', 'stain'], a: 'Vacuum gently on low suction, spot clean with a damp cloth and keep away from heat. Never machine wash.' },
  { id: 'k_track', name: 'Track order', keys: ['track', 'order status', 'where is my order', 'order number'], a: 'Open the Track order section, enter your order number and the email you used at checkout, and you will see the status timeline.' },
  { id: 'k_discount', name: 'Discounts', keys: ['discount', 'coupon', 'promo', 'code', 'sale', 'offer', 'cheaper', 'bulk', 'wholesale'], a: 'We keep prices fair and do not run random coupons. Join the waitlist to hear about drops first. For bulk or studio orders, leave your phone or email and the team will quote you personally.' },
  { id: 'k_about', name: 'About XARO', keys: ['who are you', 'about', 'xaro', 'company', 'brand', 'sri lanka'], a: 'XARO Industries (Pvt) Ltd is a Sri Lankan street-art brand. We hand-tuft keyboard rugs, floor rugs and 3D contour wall art, and ship worldwide. Apparel, headwear and laser pieces come in later phases.' },
  { id: 'k_contact', name: 'Contact a human', keys: ['human', 'person', 'agent', 'call', 'phone', 'whatsapp', 'email', 'contact', 'speak to'], a: '{contact}' }
];
const kb = () => g('kb', null) || clone(DEFAULT_KB);
const saveKb = l => s('kb', l);
const chatlog = () => g('chat', []);
function logChat(role, text, extra) { const l = chatlog(); l.push(Object.assign({ t: Date.now(), sid, role, text: String(text).slice(0, 500) }, extra || {})); if (l.length > 800) l.splice(0, l.length - 800); s('chat', l); }
const unanswered = () => g('unans', []);
function addUnanswered(q) { const l = unanswered(); if (!l.find(x => x.q === q)) { l.push({ q, t: Date.now(), country: region().country }); if (l.length > 200) l.shift(); s('unans', l); } }
const saveUnanswered = l => s('unans', l);

/* ---------------------------------------------------------------- backup */
const KEYS = ['settings', 'fx', 'countries', 'products', 'customers', 'orders', 'events', 'admins', 'kb', 'chat', 'unans', 'yarns', 'designs', 'quotes', 'costing'];
const exportAll = () => { const o = { app: 'xaro', v: 2, at: new Date().toISOString() }; KEYS.forEach(k => { o[k] = g(k, null); }); return o; };
function importAll(o) { if (!o || o.app !== 'xaro') throw new Error('This is not a XARO backup file.'); KEYS.forEach(k => { if (o[k] != null) s(k, o[k]); }); _prod = null; }
function resetAll() { KEYS.concat(['me', 'region']).forEach(k => { try { localStorage.removeItem(K + k); } catch (e) {} delete mem[k]; }); _prod = null; }

return { g, s, uid, esc, clone, CURRENCIES, FX_DEFAULT, ALL_PERMS, DEFAULT_KB, settings, setSettings, fxTable, setFx, countries, setCountries, country, money, convert, fmtMoney,
  region, setRegion, guessCountry, products, saveProducts, resetProducts, applyStarterPrices, priceFor, customers, saveCustomers, upsertCustomer, me, setMe, orders, saveOrders, addOrder, newOrderId,
  yarns, saveYarns, YARN_DEFAULT, hex2rgb, designs, saveDesigns, quotes, saveQuotes, addQuote, costRates, setCostRates, sid, events, track, sync, admins, saveAdmins, kb, saveKb, chatlog, logChat, unanswered, addUnanswered, saveUnanswered, exportAll, importAll, resetAll, syncOK };
})();
