/* ============ Zaro: cute animated assistant + rule-based marketing chat ============ */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s), esc = XD.esc;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const pick = a => a[Math.floor(Math.random() * a.length)];
const NS = 'http://www.w3.org/2000/svg';

/* ---------------------------------------------------------------- avatar markup */
const NEON = '#39FF14', BODY = '#1a211a', LIMB = '#222b20';
const heart = (dx, dy) => `<path transform="translate(${dx} ${dy})" d="M46 60 C37 54 37 44.5 43.4 44.5 C45 44.5 46 45.6 46 47 C46 45.6 47 44.5 48.6 44.5 C55 44.5 55 54 46 60Z" fill="#ff5d8f"/>`;
const SVG = `<svg viewBox="0 0 120 140" aria-hidden="true" focusable="false">
<ellipse class="zsh" cx="60" cy="134" rx="26" ry="5" fill="#000" opacity=".45"/>
<g class="zbody">
 <g class="zant"><line x1="60" y1="26" x2="60" y2="13" stroke="${NEON}" stroke-width="3" stroke-linecap="round"/><circle class="zbulb" cx="60" cy="9" r="5.5" fill="${NEON}"/></g>
 <ellipse cx="47" cy="128" rx="10" ry="5.5" fill="${LIMB}" stroke="${NEON}" stroke-width="2"/><ellipse cx="73" cy="128" rx="10" ry="5.5" fill="${LIMB}" stroke="${NEON}" stroke-width="2"/>
 <rect x="35" y="86" width="50" height="42" rx="19" fill="${BODY}" stroke="${NEON}" stroke-width="2.5"/>
 <circle cx="60" cy="107" r="8" fill="#050805" stroke="${NEON}" stroke-width="1.6"/><text x="60" y="111.5" text-anchor="middle" font-size="11" font-weight="900" fill="${NEON}" font-family="Anton,Impact,sans-serif">X</text>
 <g class="zhead">
  <rect x="13" y="47" width="9" height="18" rx="4.5" fill="${LIMB}" stroke="${NEON}" stroke-width="2"/><rect x="98" y="47" width="9" height="18" rx="4.5" fill="${LIMB}" stroke="${NEON}" stroke-width="2"/>
  <rect x="20" y="24" width="80" height="64" rx="29" fill="${BODY}" stroke="${NEON}" stroke-width="3"/>
  <rect x="28" y="33" width="64" height="45" rx="21" fill="#040704"/>
  <ellipse cx="44" cy="39" rx="9" ry="2.6" fill="#fff" opacity=".12" transform="rotate(-12 44 39)"/>
  <g class="ck"><circle cx="37" cy="64" r="5" fill="#ff7aa8" opacity=".55"/><circle cx="83" cy="64" r="5" fill="#ff7aa8" opacity=".55"/></g>
  <g class="zlook">
   <g class="e e-n"><g class="eb"><ellipse cx="46" cy="52" rx="6" ry="8.2" fill="${NEON}"/><ellipse cx="74" cy="52" rx="6" ry="8.2" fill="${NEON}"/><circle cx="44" cy="49" r="2" fill="#fff" opacity=".85"/><circle cx="72" cy="49" r="2" fill="#fff" opacity=".85"/></g></g>
   <g class="e e-h" fill="none" stroke="${NEON}" stroke-width="4.2" stroke-linecap="round"><path d="M39 57 Q46 44 53 57"/><path d="M67 57 Q74 44 81 57"/></g>
   <g class="e e-l">${heart(0, 0)}${heart(28, 0)}</g>
   <g class="e e-s"><ellipse cx="46" cy="53" rx="5.6" ry="7" fill="${NEON}"/><ellipse cx="74" cy="53" rx="5.6" ry="7" fill="${NEON}"/><path d="M38 46 L53 41.5 M67 41.5 L82 46" stroke="${NEON}" stroke-width="3" stroke-linecap="round" fill="none"/><circle class="tear" cx="40" cy="60" r="2.6" fill="#7fd6ff"/></g>
   <g class="e e-o"><circle cx="46" cy="52" r="8.5" fill="#040704" stroke="${NEON}" stroke-width="3.2"/><circle cx="74" cy="52" r="8.5" fill="#040704" stroke="${NEON}" stroke-width="3.2"/><circle cx="46" cy="52" r="3.2" fill="${NEON}"/><circle cx="74" cy="52" r="3.2" fill="${NEON}"/></g>
   <g class="e e-w"><ellipse cx="46" cy="52" rx="6" ry="8.2" fill="${NEON}"/><circle cx="44" cy="49" r="2" fill="#fff" opacity=".85"/><path d="M67 56 Q74 45 81 56" fill="none" stroke="${NEON}" stroke-width="4.2" stroke-linecap="round"/></g>
   <g class="e e-z" fill="none" stroke="${NEON}" stroke-width="3.4" stroke-linecap="round"><path d="M39 53 Q46 59 53 53"/><path d="M67 53 Q74 59 81 53"/></g>
  </g>
  <path class="m m-smile" d="M52 65 Q60 72 68 65" fill="none" stroke="${NEON}" stroke-width="3.2" stroke-linecap="round"/>
  <path class="m m-big" d="M50 63 Q60 79 70 63 Z" fill="${NEON}" stroke="${NEON}" stroke-width="2" stroke-linejoin="round"/>
  <ellipse class="m m-o" cx="60" cy="68" rx="4" ry="5" fill="${NEON}"/>
  <path class="m m-sad" d="M52 70 Q60 62 68 70" fill="none" stroke="${NEON}" stroke-width="3.2" stroke-linecap="round"/>
  <ellipse class="m m-talk" cx="60" cy="67" rx="5.5" ry="4.5" fill="${NEON}"/>
  <path class="m m-flat" d="M54 67 H66" stroke="${NEON}" stroke-width="3.2" stroke-linecap="round"/>
  <g class="zz"><text x="92" y="30" font-size="12">Z</text><text x="100" y="20" font-size="10">z</text><text x="106" y="11" font-size="8">z</text></g>
  <g class="dots" fill="#9fe"><circle cx="96" cy="26" r="2.6"/><circle cx="104" cy="19" r="3.2"/><circle cx="113" cy="10" r="3.8"/></g>
 </g>
 <g transform="translate(36,97)"><g class="zarm zaL"><rect x="-10" y="-3" width="12" height="27" rx="6" fill="${LIMB}" stroke="${NEON}" stroke-width="2"/></g></g>
 <g transform="translate(84,97)"><g class="zarm zaR"><rect x="-2" y="-3" width="12" height="27" rx="6" fill="${LIMB}" stroke="${NEON}" stroke-width="2"/></g></g>
</g></svg>`;

/* ---------------------------------------------------------------- mount */
const root = document.createElement('div'); root.id = 'zaro'; root.hidden = true;
root.innerHTML = `<div class="zbub" role="status" aria-live="polite"></div>
<section class="zpan" role="dialog" aria-label="Chat assistant" aria-modal="false">
 <div class="zhd"><i></i><div><b class="zname">Zaro</b><small>XARO assistant</small></div><button class="zx" type="button" aria-label="Close chat">&times;</button></div>
 <div class="zms" aria-live="polite"></div><div class="zch"></div>
 <form class="zft" autocomplete="off"><input type="text" maxlength="240" placeholder="Ask about prices, shipping, custom rugs..." aria-label="Type your message"><button type="submit">SEND</button></form>
 <div class="zno">Automated assistant. The team confirms orders and payments by email or phone.</div>
</section>
<button class="zr" type="button" aria-label="Chat with the XARO assistant" data-mood="idle" data-e="n" data-m="smile" data-ck="0"><span class="zfloat">${SVG}</span><span class="zdot" aria-hidden="true"></span></button>`;
document.body.appendChild(root);
const av = $('.zr', root), bub = $('.zbub', root), pan = $('.zpan', root), msgs = $('.zms', root), chips = $('.zch', root), form = $('.zft', root), inp = $('input', form), look = $('.zlook', root), dot = $('.zdot', root);

/* ---------------------------------------------------------------- moods and actions */
const MOODS = {
  idle: { e: 'n', m: 'smile', ck: 0 }, happy: { e: 'h', m: 'big', ck: 1 }, excited: { e: 'n', m: 'big', ck: 1 }, love: { e: 'l', m: 'smile', ck: 1 },
  sad: { e: 's', m: 'sad', ck: 0 }, surprised: { e: 'o', m: 'o', ck: 0 }, wink: { e: 'w', m: 'smile', ck: 1 }, sleep: { e: 'z', m: 'flat', ck: 0 },
  think: { e: 'n', m: 'flat', ck: 0 }, talk: { e: 'n', m: 'talk', ck: 0 }
};
let asleep = false, moodT, actT, base = 'idle';
function setMood(name, ms) {
  const m = MOODS[name] || MOODS.idle; av.dataset.mood = name; av.dataset.e = m.e; av.dataset.m = m.m; av.dataset.ck = m.ck;
  clearTimeout(moodT); if (ms) moodT = setTimeout(() => setMood(asleep ? 'sleep' : base), ms);
}
function act(name, ms) { if (reduce && name !== 'wave') { return; } av.dataset.act = name; clearTimeout(actT); actT = setTimeout(() => { delete av.dataset.act; }, ms || 1200); }
function particles(kind, n) {
  if (reduce) return; const cols = ['#39FF14', '#ffffff', '#FFB020', '#ff5d8f', '#7fd6ff'];
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span'); s.className = 'zp ' + (kind === 'heart' ? 'h' : 'c');
    if (kind === 'heart') s.textContent = '♥'; else s.style.background = pick(cols);
    s.style.setProperty('--dx', (Math.random() * 120 - 60) + 'px'); s.style.setProperty('--dy', (kind === 'heart' ? -(50 + Math.random() * 60) : -(40 + Math.random() * 90) + 'px')); s.style.setProperty('--rot', (Math.random() * 540 - 270) + 'deg');
    if (kind === 'heart') s.style.setProperty('--dy', -(50 + Math.random() * 60) + 'px'); s.style.animationDelay = (Math.random() * .25) + 's'; s.style.left = (35 + Math.random() * 30) + '%';
    av.appendChild(s); setTimeout(() => s.remove(), 1900);
  }
}
let bubT;
const gateOpen = () => { const g = document.getElementById('gate'); return !!g && getComputedStyle(g).display !== 'none'; };
const modalOpen = () => !!document.querySelector('.modal.on, #cart.on');
function say(html, ms) {
  if (pan.classList.contains('on') || gateOpen()) return;
  bub.innerHTML = html; bub.classList.add('on'); clearTimeout(bubT); bubT = setTimeout(() => bub.classList.remove('on'), ms || 5200);
}
bub.onclick = () => openChat();

/* ---------------------------------------------------------------- eyes follow the pointer, sleep when idle */
let lastAct = Date.now(), sleepT;
function wake(quiet) {
  lastAct = Date.now(); if (!asleep) return; asleep = false; setMood('surprised', 700); act('jump', 600); setTimeout(() => { if (!asleep) setMood(base); }, 750);
  if (!quiet && !pan.classList.contains('on')) say('Oh! You are back. Need a hand?', 3600);
}
addEventListener('pointermove', e => {
  if (root.hidden) return; lastAct = Date.now(); if (asleep) wake(false);
  if (reduce || av.dataset.mood === 'sleep' || av.dataset.mood === 'think') return;
  const r = av.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height * .4, dx = e.clientX - cx, dy = e.clientY - cy, d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 260);
  look.style.transform = `translate(${(dx / d * 3.6 * k).toFixed(2)}px,${(dy / d * 2.6 * k).toFixed(2)}px)`;
}, { passive: true });
['keydown', 'pointerdown', 'scroll', 'touchstart'].forEach(ev => addEventListener(ev, () => { lastAct = Date.now(); if (asleep) wake(false); }, { passive: true }));
setInterval(() => { if (root.hidden || asleep || pan.classList.contains('on')) return; if (Date.now() - lastAct > 70000) { asleep = true; setMood('sleep'); bub.classList.remove('on'); look.style.transform = ''; } }, 5000);
// small random life: a quick look-around or a hop while idle
setInterval(() => { if (root.hidden || asleep || reduce || av.dataset.mood !== 'idle' || pan.classList.contains('on')) return; if (Math.random() < .35) act('hop', 1100); }, 14000);
av.addEventListener('pointerenter', () => { if (asleep || pan.classList.contains('on') || av.dataset.mood !== 'idle') return; setMood('happy', 1200); act('wave', 1100); });

/* ---------------------------------------------------------------- reacting to what the visitor does */
const seen = new Set(); let lastTip = 0;
const pname = () => (XD.me() && XD.me().name ? XD.me().name.split(' ')[0] : '');
const R = () => XARO.region(), C = () => XD.country(R().country);
const TIPS = {
  craft: () => 'Every piece is hand-tufted and bevel-carved, made to order in Sri Lanka.',
  wall: () => 'These 3D contour pieces catch the light. Drag one to look from the side.',
  shop: () => `Prices are in <b>${esc(R().cur)}</b> for ${esc(C().name)}. Tap any piece to spin it in 3D.`,
  custom: () => 'Upload your own art and see it as a real tufted rug before you order.',
  lookbook: () => 'Which setup is your favourite? I like the neon ones.',
  track: () => 'Placed an order? Pop your order number in here.'
};
function react(d) {
  if (root.hidden || !d) return; wake(true);
  switch (d.type) {
    case 'login': setMood('happy', 3200); act('wave', 2600); say(d.returning ? `Welcome back${d.name ? ', ' + esc(d.name) : ''}! Good to see you again.` : `Hi${d.name ? ' ' + esc(d.name) : ''}! I'm <b>${esc(botName())}</b>. Ask me anything about XARO.`, 6000); dot.classList.add('on'); break;
    case 'add': setMood('love', 2600); act('hop', 1100); particles('heart', 6);
      say(pick(['Great pick! Want a matching mouse coaster?', 'Ooh, nice taste!', 'Added! Your desk is about to look so good.', 'Yes! That one is a favourite.']), 3600); break;
    case 'remove': setMood('sad', 2600); act('slump', 2400); say(pick(['Aww... changed your mind?', 'Okay, removed. Need help choosing?']), 3600); break;
    case 'view': if (!modalOpen()) break; setMood('excited', 2000); act('hop', 1000); break;
    case 'checkout': setMood('think', 3200); act('tilt', 3000); break;
    case 'order': setMood('excited', 5200); act('dance', 4200); particles('confetti', 26); setTimeout(() => particles('heart', 5), 500);
      say(`Order placed${pname() ? ', ' + esc(pname()) : ''}! Thank you so much. The team will confirm it shortly.`, 7000); break;
    case 'oops': setMood('surprised', 1800); act('shake', 1200);
      say({ soldout: 'Oh no, that one is sold out. Want to see something similar?', form: 'Oops! One of the fields needs a quick fix.', file: 'Hmm, I can only read PNG, JPG or WebP images.', track: "I couldn't find that order. Check the number and email?" }[d.why] || 'Oops! Something needs a fix.', 4200); break;
    case 'upload': setMood('excited', 2400); act('cheer', 1600); particles('confetti', 10); say('Ooh, I love that artwork!', 3600); break;
    case 'region': setMood('wink', 2200); act('hop', 900); say(`Prices now in <b>${esc(d.cur)}</b> for ${esc(C().name)}.`, 3800); break;
    case 'lead': setMood('love', 2600); particles('heart', 5); break;
    case 'section': if (seen.has(d.id) || !TIPS[d.id] || pan.classList.contains('on') || modalOpen() || Date.now() - lastTip < 14000) break; seen.add(d.id); lastTip = Date.now(); setMood('happy', 2000); say(TIPS[d.id](), 5200); break;
  }
}
addEventListener('xaro', e => react(e.detail));

/* ---------------------------------------------------------------- chat engine (rule based, honest) */
const botName = () => XD.settings().botName || 'Zaro';
const cur = () => R().cur;
const shown = p => XD.convert(XARO.priceOf(p), C().cur, cur());
const live = () => XARO.products().filter(p => p.active !== false);
const STOP = new Set(['rug', 'rugs', 'art', 'the', 'and', 'for', 'with', 'add', 'on', 'of', 'a', 'my', 'me', 'do', 'you', 'have', 'price', 'much', 'how', 'is', 'are', 'what', 'cost', 'about', 'in', 'to', 'i', 'can', 'get', 'buy', 'want', 'one', 'custom', 'logo', 'design', 'make']);
const tok = s => String(s).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
function findProducts(text) {
  const t = tok(text).filter(w => !STOP.has(w)), set = new Set(t); if (!t.length) return [];
  return live().map(p => { const nt = tok(p.name).filter(w => !STOP.has(w)); let s = nt.filter(w => set.has(w) || set.has(w.replace(/s$/, '')) || set.has(w + 's')).length; if (set.has(String(p.sku).toLowerCase())) s += 3; if (s > 0 && p.kind === 'custom' && /custom/.test(text.toLowerCase())) s += 1; return { p, s }; }).filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 3).map(x => x.p);
}
const bySku = l => l.map(s => live().find(p => p.sku === s)).filter(Boolean);
const cat = c => live().filter(p => p.cat === c);
const fill = a => {
  const c = C(), s = XD.settings(), en = XD.countries().filter(x => x.enabled && x.code !== 'OT').map(x => x.name);
  return a.replace(/\{shipping\}/g, c.enabled ? `Delivery to ${c.name}: ${c.eta}. ${+c.ship ? 'Shipping is ' + XARO.fmt(+c.ship) + '.' : 'Shipping is included in the price.'} Everything is made to order, so add the production time shown on each piece.` : `We are not shipping to ${c.name} yet. We currently ship to ${en.join(', ') || 'a few countries'}. Join the waitlist and we will tell you when ${c.name} opens.`)
    .replace(/\{payment\}/g, c.enabled ? `Paying from ${c.name}: ${c.pay || 'the team will confirm the options when they contact you'}. Custom pieces: 50% to start, the rest before dispatch.` : 'Payments open when your country opens. Join the waitlist.')
    .replace(/\{contact\}/g, (s.whatsapp || s.email) ? `You can reach the team${s.whatsapp ? ' on WhatsApp ' + s.whatsapp : ''}${s.whatsapp && s.email ? ' or' : ''}${s.email ? ' by email at ' + s.email : ''}. Or tap "Request a callback" and I will pass your details on.` : 'Tap "Request a callback" and I will pass your details to the team. They reply by email or phone.');
};
const lastSeen = { q: '' };
function scoreKb(text) {
  const t = ' ' + text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ') + ' ', raw = text.toLowerCase(); let best = null, bs = 0;
  XD.kb().forEach(k => { let s = 0; (k.keys || []).forEach(w => { w = String(w).toLowerCase().trim(); if (!w) return; if (w.length <= 3 ? t.includes(' ' + w + ' ') : raw.includes(w)) s += w.length; }); if (s > bs) { bs = s; best = k; } });
  return bs >= 3 ? best : null;
}
const CUR_WORDS = { usd: 'USD', dollar: 'USD', dollars: 'USD', lkr: 'LKR', rupee: 'LKR', rupees: 'LKR', rs: 'LKR', aed: 'AED', dirham: 'AED', dirhams: 'AED', gbp: 'GBP', pound: 'GBP', pounds: 'GBP', aud: 'AUD', eur: 'EUR', euro: 'EUR', euros: 'EUR' };
const priceNote = () => { const c = C(); return cur() === c.cur ? '' : ` Amounts are indicative in ${cur()}; you are charged in ${c.cur}.`; };
const CHIP = { products: 'Show me products', ship: 'Shipping and delivery', custom: 'Make my own rug', pay: 'How do I pay?', gift: 'Gift ideas', human: 'Talk to the team', price: 'How much?', drop: 'What is Drop 001?' };
function answer(text) {
  const raw = text.trim(), low = raw.toLowerCase(), words = tok(raw), set = new Set(words), me = XD.me();
  const has = (...a) => a.some(x => x.includes(' ') || x.length > 3 ? low.includes(x) : set.has(x));
  // greetings / thanks
  if (words.length <= 4 && has('hi', 'hello', 'hey', 'hola', 'ayubowan', 'yo', 'good morning', 'good evening')) return { t: `Hi${pname() ? ' ' + pname() : ''}! I'm ${botName()}, the XARO assistant. I can show you pieces, prices in ${cur()}, shipping to ${C().name}, or help you design a custom rug. What do you fancy?`, mood: 'happy', act: 'wave', chips: ['products', 'price', 'custom', 'ship'] };
  if (has('thanks', 'thank you', 'thx', 'ty', 'cheers', 'great', 'awesome', 'cool')) if (words.length <= 6) return { t: pick(['You are so welcome! Anything else I can help with?', 'Happy to help! Shout if you need anything.']), mood: 'love', chips: ['products', 'ship', 'human'] };
  if (has('bye', 'goodbye', 'see you', 'cya')) return { t: 'Bye for now! Come back any time.', mood: 'wink', act: 'wave', chips: [] };
  // switch display currency
  const cw = words.map(w => CUR_WORDS[w]).filter(Boolean)[0];
  if (cw && has('show', 'switch', 'change', 'convert', 'in ', 'price', 'prices', 'currency', 'display') && cw !== cur()) { XARO.applyRegion({ cur: cw }, true); return { t: `Done, prices are now shown in ${cw}.${priceNote()}`, mood: 'wink', chips: ['products', 'ship'] }; }
  // budget
  const bm = low.match(/(?:under|below|less than|within|max(?:imum)?|budget(?: is| of)?|up to|only have|around|about|<=?)\s*(?:rs\.?|lkr|usd|aed|gbp|aud|eur|\$|£|€|aed)?\s*(\d[\d,]*(?:\.\d+)?)\s*(k)?/);
  if (bm && has('budget', 'under', 'below', 'less', 'within', 'max', 'up to', 'only', 'cheap', 'afford')) {
    let b = parseFloat(bm[1].replace(/,/g, '')) * (bm[2] ? 1000 : 1); const ok = live().filter(p => shown(p) <= b).sort((a, c) => shown(c) - shown(a)).slice(0, 3);
    if (ok.length) return { t: `Within ${XD.money(b, cur())} these fit:${priceNote()}`, cards: ok, mood: 'excited', act: 'hop', chips: ['gift', 'custom', 'ship'] };
    const cheapest = live().sort((a, c) => shown(a) - shown(c))[0];
    return { t: `Our most affordable piece starts at ${cheapest ? XARO.fmt(XARO.priceOf(cheapest)) : 'a bit more'}, so that budget is a little too low right now. Here it is:`, cards: cheapest ? [cheapest] : [], mood: 'think', chips: ['human', 'products'] };
  }
  // callback / human
  if (has('human', 'person', 'agent', 'callback', 'call me', 'phone', 'whatsapp', 'wholesale', 'bulk', 'studio', 'team', 'owner', 'speak to', 'contact')) return { t: fill('{contact}'), mood: 'happy', callback: true, chips: ['products', 'ship'] };
  // product questions
  const priceQ = has('price', 'prices', 'how much', 'cost', 'costs', 'rate', 'pricing', 'kiyada', 'much');
  const matches = findProducts(raw);
  if (matches.length && (priceQ || has('show', 'see', 'buy', 'order', 'want', 'get', 'have', 'sell', 'available', 'details', 'tell me about', 'looking for') || matches[0] && words.length <= 4)) {
    return { t: priceQ ? `Here ${matches.length > 1 ? 'are the closest matches' : 'is the piece'}. Prices are for ${C().name} in ${cur()}.${priceNote()}` : `These look like what you mean:`, cards: matches, mood: 'excited', act: 'hop', chips: ['custom', 'ship', 'pay'] };
  }
  if (priceQ) {
    const l = live().sort((a, b) => shown(a) - shown(b)), lo = l[0], hi = l[l.length - 1];
    return lo ? { t: `Prices in ${cur()} for ${C().name}: from ${XARO.fmt(XARO.priceOf(lo))} (${lo.name}) up to ${XARO.fmt(XARO.priceOf(hi))} (${hi.name}). Keyboard rugs sit at the friendly end. Which one would you like to see?${priceNote()}`, cards: bySku(['XK-S', 'XM', 'XW-M']).length ? bySku(['XK-S', 'XM', 'XW-M']) : l.slice(0, 3), mood: 'excited', chips: ['gift', 'custom', 'ship'] } : { t: 'The catalogue is being updated. Please check back soon.', mood: 'sad', chips: ['human'] };
  }
  // recommend
  if (has('gift', 'present', 'birthday', 'anniversary')) { const c = bySku(['XS', 'XM', 'XW-M']); return { t: 'For gifts I like these: the keyboard + mouse set is the crowd-pleaser, the coaster is a small surprise, and the mini frame is a wall piece that fits anywhere. Each is handmade, so allow the production time shown.', cards: c.length ? c : live().slice(0, 3), mood: 'love', chips: ['ship', 'pay', 'custom'] }; }
  if (has('recommend', 'suggest', 'best', 'popular', 'bestseller', 'favourite', 'favorite', 'which', 'gaming', 'gamer', 'desk', 'setup', 'office', 'streamer')) {
    const c = bySku(['XK-S', 'XS', 'XK-C']); return { t: 'Honest answer: Drop 001 is brand new, so I cannot quote bestsellers yet. For a desk or gaming setup I would start with the standard keyboard rug, or the set if you want the mouse to match.', cards: c.length ? c : cat('desk').slice(0, 3), mood: 'happy', chips: ['custom', 'price', 'ship'] };
  }
  if (has('wall', 'frame', 'decor', 'decoration', 'room', 'bedroom')) { const c = cat('wall').slice(0, 3); if (c.length) return { t: 'For walls: 3D contour art with carved colour edges that catch the light. The mini frame is the easy start.', cards: c, mood: 'excited', chips: ['price', 'ship', 'custom'] }; }
  if (has('floor', 'carpet', 'big rug')) { const c = cat('home').slice(0, 3); if (c.length) return { t: 'Floor rugs are hand-tufted at room-friendly sizes. Production takes 3 to 4 weeks.', cards: c, mood: 'excited', chips: ['price', 'custom', 'ship'] }; }
  if (has('show me products', 'products', 'catalog', 'catalogue', 'what do you sell', 'what do you make', 'collection', 'shop', 'browse', 'everything')) {
    const c = live().slice(0, 4); return { t: `We make hand-tufted keyboard rugs, floor rugs and 3D wall art, plus custom pieces from your own artwork. Here are a few. Open "Shop" for everything.`, cards: c, mood: 'excited', act: 'hop', chips: ['price', 'custom', 'ship'] };
  }
  // knowledge base
  const k = scoreKb(raw);
  if (k) return { t: fill(k.a), mood: k.id === 'k_custom' ? 'excited' : 'happy', chips: k.id === 'k_ship' ? ['pay', 'products'] : k.id === 'k_custom' ? ['price', 'ship'] : ['products', 'ship', 'human'], callback: ['k_discount', 'k_contact'].includes(k.id) };
  // fallback: log it so the owner can teach the assistant
  XD.addUnanswered(raw.slice(0, 200));
  return { t: "Hmm, I'm not sure about that one yet. I've passed your question to the team so I can learn it. Meanwhile, I can help with pieces, prices, shipping, payment or custom rugs.", mood: 'think', act: 'tilt', chips: ['products', 'ship', 'custom', 'human'], callback: true, miss: true };
}

/* ---------------------------------------------------------------- chat UI */
let opened = false, busy = false;
const scroll = () => { msgs.scrollTop = msgs.scrollHeight; };
function addMsg(who, html) { const d = document.createElement('div'); d.className = 'zm ' + who; d.innerHTML = html; msgs.appendChild(d); scroll(); return d; }
function addCards(list) {
  list.forEach(p => {
    const c = document.createElement('div'); c.className = 'zcard'; const so = XARO.soldOut(p);
    c.innerHTML = `<img src="${esc(XARO.pimg(p))}" alt=""><div><b>${esc(p.name)}</b><div class="zpr">${esc(XARO.fmt(XARO.priceOf(p)))}<small> | ${esc(p.lead || '')}</small></div><div class="zb"><button class="zbt pri" type="button" data-add="${esc(p.sku)}" ${so ? 'disabled' : ''}>${so ? 'Sold out' : 'Add to cart'}</button><button class="zbt" type="button" data-view="${esc(p.sku)}">View in 3D</button></div></div>`;
    msgs.appendChild(c);
  }); scroll();
}
function setChips(keys, callback) {
  chips.innerHTML = ''; const l = (keys || []).slice(); if (callback && !l.includes('cb')) l.unshift('cb');
  l.slice(0, 5).forEach(k => { const b = document.createElement('button'); b.type = 'button'; b.className = 'zbt' + (k === 'cb' ? ' pri' : ''); b.textContent = k === 'cb' ? 'Request a callback' : CHIP[k] || k; b.dataset.k = k; chips.appendChild(b); });
}
msgs.addEventListener('click', e => {
  const a = e.target.closest('[data-add]'), v = e.target.closest('[data-view]');
  if (a) { XARO.addToCart(a.dataset.add); }
  if (v) { XARO.openPv(v.dataset.view); }
});
chips.addEventListener('click', e => {
  const b = e.target.closest('[data-k]'); if (!b) return;
  if (b.dataset.k === 'cb') return callback();
  const q = { products: 'Show me products', ship: 'How does shipping work?', custom: 'Can I make a custom rug?', pay: 'How do I pay?', gift: 'Gift ideas', human: 'I would like to talk to the team', price: 'How much do things cost?', drop: 'What is Drop 001?' }[b.dataset.k] || b.textContent;
  send(q);
});
function callback() {
  const me = XD.me(); setChips([]);
  if (!me) { addMsg('b', 'Please sign in first so the team knows how to reach you.'); return; }
  const note = lastSeen.q ? lastSeen.q.slice(0, 160) : 'General enquiry';
  XD.addUnanswered('CALLBACK: ' + me.name + ' | ' + (me.phone || me.email) + ' | ' + note); XD.track('lead'); XD.sync('lead', { name: me.name, email: me.email, phone: me.phone, country: me.country, note });
  XARO.emit('lead', {}, false); setMood('love', 2800); act('cheer', 1500); particles('heart', 6);
  addMsg('b', `Done! I've passed your details to the team (${me.phone || me.email}). They will get back to you. Is there anything else I can help with?`); XD.logChat('bot', 'Callback requested'); setChips(['products', 'ship']);
}
function reply(text) {
  busy = true; const ty = document.createElement('div'); ty.className = 'zm b ty'; ty.innerHTML = '<span></span><span></span><span></span>'; msgs.appendChild(ty); scroll(); setMood('think'); act('tilt', 1200);
  const r = answer(text), wait = reduce ? 80 : 520 + Math.random() * 380;
  setTimeout(() => {
    ty.remove(); busy = false; addMsg('b', esc(r.t)); if (r.cards && r.cards.length) addCards(r.cards); setChips(r.chips, r.callback); XD.logChat('bot', r.t);
    setMood('talk'); const talk = Math.min(2600, 500 + r.t.length * 14);
    setTimeout(() => { setMood(r.mood || 'happy', 1800); if (r.act) act(r.act, 1400); }, talk);
  }, wait);
}
function send(text) {
  text = String(text || '').trim().slice(0, 240); if (!text || busy) return; lastSeen.q = text; addMsg('u', esc(text)); XD.logChat('user', text); reply(text);
}
form.addEventListener('submit', e => { e.preventDefault(); const v = inp.value; inp.value = ''; send(v); });
inp.addEventListener('input', () => { if (!busy && inp.value) { setMood('think'); act('tilt', 900); } else if (!busy) setMood('idle'); });
function openChat() {
  pan.classList.add('on'); bub.classList.remove('on'); dot.classList.remove('on'); av.setAttribute('aria-expanded', 'true'); wake(true);
  if (!opened) {
    opened = true; const n = pname();
    addMsg('b', `Hi${n ? ' ' + esc(n) : ''}! I'm ${esc(botName())}, the assistant for XARO Industries. We hand-tuft keyboard rugs, floor rugs and 3D wall art in Sri Lanka and ship worldwide. Prices are shown in ${esc(cur())} for ${esc(C().name)}. How can I help?`);
    setChips(['products', 'price', 'custom', 'ship', 'gift']); XD.logChat('bot', 'Opened chat'); XD.track('chat'); setMood('happy', 2200); act('wave', 1800);
  } else setMood('happy', 1200);
  setTimeout(() => inp.focus({ preventScroll: true }), 120);
}
function closeChat() { pan.classList.remove('on'); av.setAttribute('aria-expanded', 'false'); setMood('wink', 900); }
av.addEventListener('click', () => { if (pan.classList.contains('on')) closeChat(); else openChat(); });
$('.zx', root).onclick = () => { closeChat(); av.focus(); };
addEventListener('keydown', e => { if (e.key === 'Escape' && pan.classList.contains('on') && !modalOpen()) closeChat(); });
addEventListener('xaro', e => { if (e.detail && e.detail.type === 'region' && opened) { /* keep chat prices honest after a country switch */ addMsg('b', `Prices are now ${esc(e.detail.cur)} for ${esc(C().name)}.`); } });

/* ---------------------------------------------------------------- settings, first hello */
function apply() { const s = XD.settings(); root.hidden = !s.botOn; $('.zname', root).textContent = botName(); }
addEventListener('xaro-bot-settings', apply); apply();
setTimeout(() => {
  if (root.hidden || gateOpen() || seen.has('hello')) return; seen.add('hello'); const n = pname();
  if (!pan.classList.contains('on')) { dot.classList.add('on'); setMood('happy', 2600); act('wave', 2400); say(n ? `Hi ${esc(n)}! Need help finding something? Tap me.` : `Hi! I'm <b>${esc(botName())}</b>. Ask me anything about XARO.`, 5600); }
}, 3200);
window.XBOT = { say, setMood, act, open: openChat, close: closeChat, particles };
})();
