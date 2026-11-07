/* ============ Studio extra templates: 64 more starter designs on top of the 36 built-ins (100 in total) ============
   Classic script. Must load AFTER studio_lib.js. It only appends to window.XSTUDIO_LIB.TEMPLATES (never edits the built-ins),
   is idempotent (ids are stable: x-<category>-NN), validates every template and skips a bad one with a console.warn.
   Layers are the library's own types (rect, ellipse, poly, text, wave, pix), so everything stays selectable and editable.
   Geometry is authored in "width units" (1 = rug width) so circles stay round on tall and wide rugs alike. */
(() => {
'use strict';
const L = window.XSTUDIO_LIB;
const warn = m => { try { console.warn('[templates_extra] ' + m); } catch (e) {} };
if (!L || !Array.isArray(L.TEMPLATES) || typeof L.layer !== 'function' || typeof L.snapHex !== 'function') { warn('studio library not ready; extra templates skipped'); return; }

/* ---------------------------------------------------------------- basics */
const SHAPES = ['rect', 'square', 'circle', 'oval'], TYPES = ['rect', 'ellipse', 'poly', 'text', 'wave', 'pix'];
const cache = {}, Y = hex => cache[hex] || (cache[hex] = L.snapHex(hex));
const r4 = v => Math.round(v * 10000) / 10000, rad = d => d * Math.PI / 180, rnd = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
// yarn palette (hex of the 26 stock yarns; snapped to the live yarn list on load)
const K = '#0B0B0B', CH = '#2A2D2A', GR = '#5A5F5A', SV = '#A5ABA5', OW = '#EDEDE6', WH = '#FFFFFF', NE = '#39FF14', LI = '#A4D62B', FG = '#1F6B35', MI = '#7DE3B0', TE = '#0FA3A3', SK = '#4DA3FF', RB = '#2547D0', NV = '#101C4A', VI = '#7A3CFF', MG = '#E0359A', HP = '#FF5D8F', RD = '#E02B2B', BU = '#6E1530', OR = '#FF7A1A', AM = '#FFB020', YE = '#FFE53B', BE = '#D9C3A0', BR = '#6B4423', GO = '#C9A227', BL = '#F4C6C6';

/* ---------------------------------------------------------------- polygon presets (unit box 0..1) */
const arcPts = (a0, a1, ro, ri) => { const p = [], k = Math.max(2, Math.ceil(Math.abs(a1 - a0) / 6)); for (let i = 0; i <= k; i++) { const a = rad(a0 + (a1 - a0) * i / k); p.push([.5 + Math.sin(a) * ro, .5 - Math.cos(a) * ro]); } if (ri > 0) for (let i = k; i >= 0; i--) { const a = rad(a0 + (a1 - a0) * i / k); p.push([.5 + Math.sin(a) * ri, .5 - Math.cos(a) * ri]); } else p.push([.5, .5]); return p; };
const starPts = (n, inner) => { const p = []; for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + i * Math.PI / n, r = i % 2 ? inner : .5; p.push([.5 + Math.cos(a) * r, .5 + Math.sin(a) * r]); } return p; };
const lensPts = () => { const t = [], b = []; for (let i = 0; i <= 12; i++) { const u = i / 12, s = Math.sin(Math.PI * u) * .5; t.push([u, .5 - s]); b.unshift([u, .5 + s]); } return t.concat(b.slice(1, -1)); };
const PT = {
  shield: [[0, .06], [.5, 0], [1, .06], [1, .5], [.9, .72], [.5, 1], [.1, .72], [0, .5]],
  bolt: [[.55, 0], [.1, .56], [.46, .56], [.3, 1], [.9, .4], [.54, .4], [.8, 0]],
  leaf: lensPts(),
  cross: [[.35, 0], [.65, 0], [.65, .35], [1, .35], [1, .65], [.65, .65], [.65, 1], [.35, 1], [.35, .65], [0, .65], [0, .35], [.35, .35]],
  chevron: [[0, .5], [.5, 0], [1, .5], [1, 1], [.5, .5], [0, 1]],
  spark4: starPts(4, .11), spark6: starPts(6, .2), star8: starPts(8, .36), star12: starPts(12, .4), star16: starPts(16, .42),
  cubeTop: [[.5, 0], [1, .25], [.5, .5], [0, .25]], cubeLeft: [[0, .25], [.5, .5], [.5, 1], [0, .75]], cubeRight: [[.5, .5], [1, .25], [1, .75], [.5, 1]],
  bat: [[.5, .3], [.58, .14], [.62, .3], [.8, .1], [1, .26], [.9, .56], [.78, .4], [.7, .62], [.5, .78], [.3, .62], [.22, .4], [.1, .56], [0, .26], [.2, .1], [.38, .3], [.42, .14]],
  zig: [[0, .35], [.12, 0], [.25, .35], [.37, 0], [.5, .35], [.62, 0], [.75, .35], [.87, 0], [1, .35], [1, 1], [0, 1]],
  tower: [[.5, 0], [1, 1], [.8, 1], [.5, .45], [.2, 1], [0, 1]],
  half: arcPts(-90, 90, .5, 0), tooth: [[0, 0], [1, 0], [.5, 1]],
  teardrop: (() => { const p = [[.5, 0]]; for (let i = 0; i <= 24; i++) { const a = rad(-48 + i * (276 / 24)); p.push([.5 + Math.sin(a) * .36, .64 - Math.cos(a) * .36]); } return p; })(),
  wing: [[0, .6], [.35, .1], [1, 0], [.8, .35], [.95, .45], [.7, .6], [.8, .8], [.45, .75], [.2, 1]]
};
const ptsOf = s => (Array.isArray(s) ? s : L.POLY[s] || PT[s] || L.POLY.triangle).map(q => [r4(q[0]), r4(q[1])]);
PT.sector = (a0, a1, ro, ri) => arcPts(a0, a1, ro, ri);

/* ---------------------------------------------------------------- scene builder (all sizes in width units) */
function scene(wcm, hcm) {
  const ar = wcm / hcm, U = 1 / ar, layers = [], seq = {};
  const nm = (type, o) => { const b = (o && o.name) || L.TYPE_NAMES[type] || type; seq[b] = (seq[b] || 0) + 1; return b + ' ' + seq[b]; };
  const fx = o => { const q = Object.assign({}, o); delete q.name; if (typeof q.stroke === 'string' && q.stroke) q.stroke = Y(q.stroke); if (q.sw) q.sw = r4(q.sw * Math.max(1, ar)); if (q.rot != null) q.rot = r4(q.rot); return q; };
  const add = (type, x, y, w, h, c, o, ex) => { const l = L.layer(type, Object.assign({ name: nm(type, o), cx: r4(x), cy: r4(y * ar), w: r4(w), h: r4(h * ar), fill: Y(c) }, ex, fx(o))); layers.push(l); return l; };
  const S = {
    ar, U, layers,
    rect: (x, y, w, h, c, o) => add('rect', x, y, w, h, c, o),
    ell: (x, y, w, h, c, o) => add('ellipse', x, y, w, h, c, o),
    disc: (x, y, d, c, o) => add('ellipse', x, y, d, d, c, o),
    ring: (x, y, d, t, c, o) => add('ellipse', x, y, d, d, c, Object.assign({ hollow: true, sw: t }, o)),
    ringE: (x, y, w, h, t, c, o) => add('ellipse', x, y, w, h, c, Object.assign({ hollow: true, sw: t }, o)),
    poly: (s, x, y, w, h, c, o) => add('poly', x, y, w, h, c, o, { pts: ptsOf(s) }),
    text: (t, x, y, w, h, c, o) => add('text', x, y, w, h, c, o, { text: t, font: 'Anton', bold: false }),
    wave: (top, amp, c, o) => { o = o || {}; const bot = o.bottom == null ? U + .06 : o.bottom, h = bot - top, q = Object.assign({}, o); delete q.bottom; return add('wave', .5, top + h / 2, 1.2, h, c, q, { amp: r4(Math.min(1, amp / h)), freq: q.freq || 1.5, phase: q.phase || 0 }); },
    pix: (rows, pal, x, y, w, o) => { const cn = Math.max(...rows.map(r => r.length)), p = {}; Object.keys(pal).forEach(k => { p[k] = Y(pal[k]); }); return add('pix', x, y, w, w * rows.length / cn, Object.values(pal)[0], o, { rows: rows.slice(), pal: p }); }
  };
  S.group = (x0, y0, rot0, k) => {
    rot0 = rot0 || 0; k = k == null ? 1 : k; const th = rad(rot0), co = Math.cos(th), si = Math.sin(th), m = (x, y) => [x0 + k * (x * co - y * si), y0 + k * (x * si + y * co)];
    const ro = o => { const q = Object.assign({}, o); q.rot = (q.rot || 0) + rot0; if (q.sw) q.sw *= k; return q; };
    return {
      rect: (x, y, w, h, c, o) => { const p = m(x, y); return S.rect(p[0], p[1], w * k, h * k, c, ro(o)); },
      ell: (x, y, w, h, c, o) => { const p = m(x, y); return S.ell(p[0], p[1], w * k, h * k, c, ro(o)); },
      disc: (x, y, d, c, o) => { const p = m(x, y); return S.disc(p[0], p[1], d * k, c, ro(o)); },
      ring: (x, y, d, t, c, o) => { const p = m(x, y); return S.ring(p[0], p[1], d * k, t * k, c, ro(o)); },
      poly: (s, x, y, w, h, c, o) => { const p = m(x, y); return S.poly(s, p[0], p[1], w * k, h * k, c, ro(o)); },
      text: (t, x, y, w, h, c, o) => { const p = m(x, y); return S.text(t, p[0], p[1], w * k, h * k, c, ro(o)); }
    };
  };
  return S;
}
/** spikes / petals around a centre. o: shape (poly name | 'ellipse'), r0 start radius, len, wid, c (colour list), rot0 */
const radial = (g, n, x, y, o) => {
  o = Object.assign({ shape: 'triangle', r0: .1, len: .3, wid: .1, c: [K], rot0: 0 }, o);
  for (let i = 0; i < n; i++) { const a = o.rot0 + i * 360 / n, d = o.r0 + o.len / 2, px = x + Math.sin(rad(a)) * d, py = y - Math.cos(rad(a)) * d, col = o.c[i % o.c.length];
    if (o.shape === 'ellipse') g.ell(px, py, o.wid, o.len, col, { rot: a }); else g.poly(o.shape, px, py, o.wid, o.len, col, { rot: a }); }
};
/** a leaf / fan blade lying along direction a (deg clockwise from +x) starting at (x0,y0) */
const ray = (g, shape, x0, y0, a, len, wid, c) => g.poly(shape, x0 + Math.cos(rad(a)) * len / 2, y0 + Math.sin(rad(a)) * len / 2, len, wid, c, { rot: a });
/** pixel-grid builder for pixel art maps */
const grid = (w, h) => { const g = Array.from({ length: h }, () => Array(w).fill('.')); const api = { g, set: (x, y, c) => { if (x >= 0 && y >= 0 && x < w && y < h) g[y][x] = c; return api; }, box: (x, y, bw, bh, c) => { for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) api.set(x + i, y + j, c); return api; }, blob: (cx, cy, rx, ry, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (((i - cx) / rx) ** 2 + ((j - cy) / ry) ** 2 <= 1) g[j][i] = c; return api; }, outline: (c) => { const o = g.map(r => r.slice()); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (g[j][i] === '.') { for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const q = (g[j + dy] || [])[i + dx]; if (q && q !== '.' && q !== c) { o[j][i] = c; break; } } } for (let j = 0; j < h; j++) g[j] = o[j]; return api; }, rows: () => g.map(r => r.join('')) }; return api; };

/* ---------------------------------------------------------------- template registry */
const defs = [];
/** def(category, name, [widthCm, heightCm, shape?, radius?], bgHex, build(S), {borderCm, borderYarn}?) */
const def = (cat, name, size, bg, build, o) => defs.push({ cat, name, size, bg, build, o });
const lerpN = (a, b, t) => a + (b - a) * t;

/* ================================================================ EMBLEMS */
def('Emblems', 'Shield Crest', [60, 90], NV, S => {
  S.poly('crown', .5, .13, .36, .14, GO, { name: 'Crown' });
  S.poly('shield', .5, .74, .8, 1.1, GO, { name: 'Shield rim' });
  S.poly('shield', .5, .74, .72, 1.02, RD, { name: 'Shield' });
  S.poly('shield', .5, .86, .56, .66, NV, { name: 'Shield inner' });
  S.poly('star', .5, .5, .24, .23, GO, { name: 'Star' });
  S.poly('star', .3, .6, .1, .095, OW, { name: 'Star left' }); S.poly('star', .7, .6, .1, .095, OW, { name: 'Star right' });
  S.text('YOUR TEAM', .5, .8, .48, .14, OW, { name: 'Team name' });
  S.rect(.5, .92, .36, .014, GO); S.text('EST. 2026', .5, 1.0, .3, .06, GO, { font: 'Mono', name: 'Year' });
});
def('Emblems', 'Round Badge', [80, 80, 'circle'], CH, S => {
  S.disc(.5, .5, .96, GO, { name: 'Outer rim' }); S.disc(.5, .5, .9, K, { name: 'Badge' });
  S.ring(.5, .5, .78, .02, GO, { name: 'Inner ring' });
  for (let i = 0; i < 24; i++) { const a = i * 15; S.rect(.5 + Math.sin(rad(a)) * .43, .5 - Math.cos(rad(a)) * .43, .012, .04, OW, { rot: a, name: 'Tick' }); }
  S.rect(.5, .5, .92, .21, RD, { name: 'Banner' }); S.rect(.5, .395, .92, .012, GO); S.rect(.5, .605, .92, .012, GO);
  S.text('BRAND NAME', .5, .5, .76, .13, OW, { name: 'Brand name' });
  S.text('SINCE 2026', .5, .27, .3, .055, GO, { font: 'Mono', name: 'Tagline' });
  S.poly('star', .5, .17, .1, .095, GO); S.poly('star', .38, .2, .06, .057, OW); S.poly('star', .62, .2, .06, .057, OW);
  S.poly('crown', .5, .74, .22, .09, GO, { name: 'Crown' });
});
def('Emblems', 'Wing Emblem', [90, 40], K, S => {
  for (let i = 0; i < 6; i++) { const len = .36 - i * .045, y = .085 + i * .042, c = i % 2 ? OW : GO;
    S.poly('slash', .41 - len / 2, y, len, .034, c, { name: 'Left feather' }); S.poly('slash', .59 + len / 2, y, len, .034, c, { flip: true, name: 'Right feather' }); }
  S.poly('diamond', .5, .19, .17, .3, GO, { name: 'Centre gem' }); S.poly('diamond', .5, .19, .1, .18, K, { name: 'Gem core' });
  S.text('A', .5, .19, .045, .12, GO, { name: 'Monogram' });
  S.text('YOUR BRAND', .5, .375, .46, .07, OW, { name: 'Brand name' }); S.rect(.5, .425, .2, .006, GO);
});
def('Emblems', 'Hex Monogram', [90, 90], NV, S => {
  S.poly('hexagon', .5, .5, .86, .86, GO, { name: 'Hex outer' }); S.poly('hexagon', .5, .5, .79, .79, NV, { name: 'Hex gap' });
  S.poly('hexagon', .5, .5, .72, .72, RB, { name: 'Hex field' }); S.poly('hexagon', .5, .5, .56, .56, NV, { name: 'Hex core' });
  S.text('A', .5, .49, .36, .44, OW, { bold: true, name: 'Monogram' });
  for (let i = 0; i < 6; i++) { const a = i * 60; S.disc(.5 + Math.sin(rad(a)) * .43, .5 - Math.cos(rad(a)) * .43, .06, GO, { name: 'Corner stud' }); }
  S.rect(.5, .7, .22, .012, GO); S.text('ESTD 2026', .5, .745, .24, .04, GO, { font: 'Mono' });
});
def('Emblems', 'Bolt Seal', [90, 90], BU, S => {
  S.disc(.5, .5, .86, K, { name: 'Seal' }); S.ring(.5, .5, .8, .022, GO, { name: 'Seal ring' }); S.ring(.5, .5, .62, .01, OW, { name: 'Inner ring' });
  for (let i = 0; i < 16; i++) { const a = i * 22.5; S.poly('triangle', .5 + Math.sin(rad(a)) * .355, .5 - Math.cos(rad(a)) * .355, .035, .05, i % 2 ? OW : GO, { rot: a, name: 'Spike' }); }
  S.poly('bolt', .5, .44, .3, .44, YE, { name: 'Bolt' });
  S.text('POWER CO', .5, .69, .34, .07, OW, { name: 'Company' });
  S.poly('star', .5, .78, .05, .048, GO);
});

/* ================================================================ GAMING */
(() => {
  const SW = ['...........KKK', '..........KWS.', '.........KWSK.', '........KWSK..', '.......KWSK...', '......KWSK....', '..KYKKWSK.....', '..KYYWSK......', '...KYYK.......', '..KBBYYK......', '.KBBKKYK......', '.RRK..........', '..K...........', '..............'];
  def('Gaming', 'Pixel Sword', [90, 90], NV, S => {
    S.rect(.5, .5, .96, .96, '#101C4A', { stroke: GO, sw: .01, name: 'Frame' });
    S.pix(SW, { K: K, W: WH, S: SV, Y: GO, B: BR, R: RD }, .5, .5, .66, { name: 'Sword' });
    [[.14, .16], [.84, .2], [.2, .82], [.86, .76], [.5, .1]].forEach(p => S.poly('spark4', p[0], p[1], .06, .06, GO, { name: 'Sparkle' }));
    S.text('LV 99', .5, .88, .24, .07, WH, { font: 'Mono', name: 'Level' });
  });
  const gp = grid(22, 13); gp.box(1, 1, 20, 8, 'G').box(1, 9, 5, 3, 'G').box(16, 9, 5, 3, 'G').box(3, 0, 16, 1, 'G'); gp.set(0, 1, '.').set(21, 1, '.'); gp.box(8, 3, 6, 3, 'g');
  gp.box(4, 3, 3, 1, 'D').box(4, 5, 3, 1, 'D').box(3, 4, 5, 1, 'D').box(5, 3, 1, 3, 'D'); gp.set(16, 3, 'R').set(18, 4, 'Y').set(16, 5, 'N').set(14, 4, 'B'); gp.set(9, 4, 'S').set(12, 4, 'S');
  gp.outline('K');
  def('Gaming', 'Pixel Gamepad', [90, 60], TE, S => {
    S.rect(.5, .333, .94, .56, '#0FA3A3', { stroke: NV, sw: .012, name: 'Frame' });
    S.pix(gp.rows(), { K: K, G: SV, g: GR, D: K, R: RD, Y: YE, N: RD, B: YE, S: OW }, .5, .34, .8, { name: 'Gamepad' });
    S.text('PLAYER 1', .5, .09, .3, .06, NV, { font: 'Mono' }); S.text('PRESS START', .5, .56, .4, .045, NV, { font: 'Mono' });
  });
  def('Gaming', 'Game Over', [60, 90], K, S => {
    for (let i = 0; i < 3; i++) S.pix(HEART, { X: i < 1 ? RD : GR }, .3 + i * .2, .1, .14, { name: 'Life' });
    S.text('GAME', .5, .42, .84, .3, NE, { bold: true, name: 'Game' }); S.text('OVER', .5, .76, .84, .3, RD, { bold: true, name: 'Over' });
    S.rect(.5, .6, .84, .012, OW);
    S.disc(.34, 1.3, .12, YE, { name: 'Coin' }); S.ring(.34, 1.3, .085, .012, GO); S.text('1', .34, 1.3, .03, .06, GO, { font: 'Mono' });
    S.text('INSERT COIN', .6, 1.3, .38, .06, YE, { font: 'Mono', name: 'Prompt' });
    S.rect(.5, 1.41, .84, .01, CH);
  });
  const HEART = ['..XX..XX..', '.XXXXXXXXX', 'XXXXXXXXXX', 'XXXXXXXXXX', '.XXXXXXXX.', '..XXXXXX..', '...XXXX...', '....XX....'];
  const sk = grid(16, 17); sk.blob(7.5, 6.5, 6.6, 6, 'W').box(4, 11, 8, 4, 'W'); sk.blob(4.7, 7, 1.9, 2.1, 'K').blob(10.3, 7, 1.9, 2.1, 'K'); sk.box(7, 9, 2, 2, 'K'); sk.box(5, 13, 1, 3, 'K').box(7, 13, 1, 3, 'K').box(9, 13, 1, 3, 'K').box(11, 13, 1, 2, 'K'); sk.outline('N');
  def('Gaming', 'Pixel Skull', [90, 90], BU, S => {
    S.rect(.5, .5, .96, .96, BU, { stroke: RD, sw: .012, name: 'Frame' });
    S.pix(sk.rows(), { N: K, W: OW, K: K }, .5, .5, .66, { name: 'Skull' });
    [[.14, .2], [.86, .16], [.12, .8], [.88, .84]].forEach((p, i) => S.pix(['.X.', 'XXX', '.X.'], { X: i % 2 ? GO : RD }, p[0], p[1], .09, { name: 'Spark' }));
  });
  def('Gaming', 'Level Up HUD', [90, 40], CH, S => {
    S.rect(.5, .222, .96, .4, K, { stroke: NE, sw: .008, name: 'Panel' });
    S.text('LEVEL UP!', .27, .13, .38, .1, NE, { name: 'Title' }); S.poly('star', .53, .13, .07, .067, YE); S.poly('star', .61, .13, .045, .043, OW);
    [['HP', .22, RD, .9], ['MP', .29, SK, .65], ['XP', .36, YE, .4]].forEach(b => { S.text(b[0], .1, b[1] - .0, .06, .04, OW, { font: 'Mono', name: b[0] + ' label' }); S.rect(.55, b[1], .72, .036, CH, { stroke: OW, sw: .004, name: b[0] + ' frame' });
      const n = 18; for (let i = 0; i < n; i++) if (i / n < b[3]) S.rect(.19 + (i + .5) * .72 / n * .98, b[1], .72 / n * .8, .026, b[2], { name: b[0] + ' cell' }); });
    S.text('x3', .9, .13, .08, .06, OW, { font: 'Mono' });
  });
})();

/* ================================================================ SPORTS */
def('Sports', 'Football Pitch', [60, 90], FG, S => {
  S.rect(.5, .75, .88, 1.36, FG, { stroke: OW, sw: .012, name: 'Touchline' });
  S.rect(.5, .75, .88, .012, OW, { name: 'Halfway line' });
  S.ring(.5, .75, .3, .012, OW, { name: 'Centre circle' }); S.disc(.5, .75, .03, OW, { name: 'Centre spot' });
  S.rect(.5, .26, .5, .38, FG, { stroke: OW, sw: .012, name: 'Penalty area' }); S.rect(.5, 1.24, .5, .38, FG, { stroke: OW, sw: .012, name: 'Penalty area' });
  S.rect(.5, .17, .24, .16, FG, { stroke: OW, sw: .012, name: 'Goal area' }); S.rect(.5, 1.33, .24, .16, FG, { stroke: OW, sw: .012, name: 'Goal area' });
  S.disc(.5, .34, .026, OW, { name: 'Penalty spot' }); S.disc(.5, 1.16, .026, OW, { name: 'Penalty spot' });
  S.rect(.5, .09, .14, .02, OW, { name: 'Goal' }); S.rect(.5, 1.41, .14, .02, OW, { name: 'Goal' });
  [[.08, .08], [.92, .08], [.08, 1.42], [.92, 1.42]].forEach(p => S.disc(p[0], p[1], .045, RD, { name: 'Corner flag' }));
});
def('Sports', 'Basketball Court', [90, 60], BE, S => {
  const ym = .333;
  S.rect(.5, ym, .92, .56, BE, { stroke: BR, sw: .012, name: 'Court' });
  S.rect(.13, ym, .26, .2, RB, { stroke: OW, sw: .008, name: 'Key left' }); S.rect(.87, ym, .26, .2, RB, { stroke: OW, sw: .008, name: 'Key right' });
  S.ring(.26, ym, .2, .008, OW, { name: 'Free-throw circle' }); S.ring(.74, ym, .2, .008, OW, { name: 'Free-throw circle' });
  S.ring(.04, ym, .86, .008, OW, { name: 'Three-point arc' }); S.ring(.96, ym, .86, .008, OW, { name: 'Three-point arc' });
  S.rect(-.1, ym, .2, .7, BR, { name: 'Margin' }); S.rect(1.1, ym, .2, .7, BR, { name: 'Margin' });
  S.rect(.5, .02, 1, .04, BR); S.rect(.5, ym * 2 - .02, 1, .04, BR);
  S.rect(.5, ym, .008, .56, OW, { name: 'Centre line' }); S.ring(.5, ym, .18, .008, OW, { name: 'Centre circle' }); S.disc(.5, ym, .08, OR, { name: 'Ball emblem' });
  S.disc(.07, ym, .03, OR, { name: 'Hoop' }); S.disc(.93, ym, .03, OR, { name: 'Hoop' });
});
def('Sports', 'Racing Checker', [60, 90], K, S => {
  for (let r = 0; r < 2; r++) for (let c = 0; c < 8; c++) { S.rect(c / 8 + 1 / 16, r * .0625 + .031, 1 / 8, .0625, (c + r) % 2 ? K : OW, { name: 'Checker top' }); S.rect(c / 8 + 1 / 16, 1.5 - (r * .0625 + .031), 1 / 8, .0625, (c + r) % 2 ? K : OW, { name: 'Checker bottom' }); }
  S.rect(.4, .75, .08, 1.26, RD, { name: 'Stripe red' }); S.rect(.6, .75, .08, 1.26, OW, { name: 'Stripe white' });
  S.rect(.33, .75, .014, 1.26, YE); S.rect(.67, .75, .014, 1.26, YE);
  S.disc(.5, .75, .5, K, { stroke: OW, sw: .014, name: 'Roundel' }); S.disc(.5, .75, .42, OW, { name: 'Roundel face' });
  S.text('07', .5, .75, .34, .26, K, { bold: true, name: 'Race number' });
  S.rect(.5, .3, .5, .1, K, { name: 'Top panel' }); S.rect(.5, 1.2, .5, .1, K, { name: 'Bottom panel' });
  S.text('SPEED', .5, .3, .4, .075, OW, { name: 'Top word' }); S.text('CLUB', .5, 1.2, .3, .075, OW, { name: 'Bottom word' });
});
def('Sports', 'Cricket Oval', [100, 60, 'oval'], FG, S => {
  S.ell(.5, .3, .94, .56, FG, { name: 'Outfield' }); S.ringE(.5, .3, .86, .5, .012, OW, { name: 'Boundary rope' });
  S.ell(.5, .3, .64, .34, LI, { name: 'Inner field' }); S.ringE(.5, .3, .64, .34, .008, OW, { name: 'Fielding circle' });
  S.rect(.5, .3, .26, .07, BE, { name: 'Pitch' });
  [.37, .63].forEach(x => { S.rect(x, .3, .006, .09, OW, { name: 'Crease' }); S.rect(x + (x < .5 ? -.02 : .02), .3, .004, .05, OW, { name: 'Stumps' }); });
  S.disc(.5, .3, .02, RD, { name: 'Ball' });
  S.poly('triangle', .15, .3, .05, .06, OW, { rot: 90, name: 'Marker' }); S.poly('triangle', .85, .3, .05, .06, OW, { rot: -90, name: 'Marker' });
});
def('Sports', 'Jersey Number', [60, 90], RB, S => {
  for (let i = 0; i < 6; i++) S.rect(.5, .125 + i * .25, 1.1, .125, i % 2 ? RB : NV, { name: 'Jersey stripe' });
  S.rect(.5, .75, .86, .66, RB, { stroke: OW, sw: .014, name: 'Number plate' });
  S.text('10', .5, .75, .72, .54, OW, { bold: true, name: 'Number' });
  S.text('YOUR NAME', .5, .27, .64, .13, OW, { name: 'Player name' });
  S.poly('star', .3, 1.31, .08, .076, YE); S.poly('star', .5, 1.31, .1, .095, YE); S.poly('star', .7, 1.31, .08, .076, YE);
  S.rect(.5, .4, .64, .01, OW);
});

/* ================================================================ ANIME-INSPIRED ORIGINAL */
def('Anime-inspired original', 'Neon Slash', [90, 60], NV, S => {
  S.disc(.66, .3, .5, RD, { name: 'Red sun' });
  for (let i = 0; i < 9; i++) S.rect(.5, .02 + i * .07, 1.3, .006 + (i % 3) * .004, RB, { rot: -18, name: 'Speed line' });
  S.poly('slash', .3, .33, .17, .9, OW, { rot: 24, name: 'Slash white' }); S.poly('slash', .43, .33, .07, .9, MG, { rot: 24, name: 'Slash pink' });
  S.poly('slash', .55, .33, .12, .9, VI, { rot: 24, name: 'Slash violet' }); S.poly('slash', .83, .36, .05, .9, OW, { rot: 24, name: 'Slash thin' });
  S.poly('spark4', .14, .14, .09, .09, YE, { name: 'Sparkle' }); S.poly('spark4', .9, .1, .05, .05, OW); S.poly('spark4', .08, .5, .05, .05, OW);
});
def('Anime-inspired original', 'Mecha Eye', [90, 60], NV, S => {
  radial(S, 28, .5, .333, { shape: 'triangle', r0: .0, len: .62, wid: .09, c: [RB, NV], rot0: 0 });
  S.poly('leaf', .5, .333, .86, .4, K, { name: 'Eye lid' }); S.poly('leaf', .5, .333, .8, .34, OW, { name: 'Eye white' });
  S.disc(.5, .333, .3, K, { name: 'Iris rim' }); S.disc(.5, .333, .27, SK, { name: 'Iris' }); S.disc(.5, .35, .2, RB, { name: 'Iris shade' }); S.disc(.5, .35, .12, K, { name: 'Pupil' });
  S.disc(.44, .27, .07, WH, { name: 'Highlight' }); S.disc(.56, .4, .035, WH, { name: 'Highlight small' }); S.poly('spark4', .6, .26, .05, .05, WH, { name: 'Glint' });
  [-12, 6, 24].forEach((r, i) => S.poly('triangle', .1 - i * .01, .27 + i * .04, .035, .12, K, { rot: -70 + r, name: 'Lash' }));
});
def('Anime-inspired original', 'Speed Burst', [60, 90], YE, S => {
  radial(S, 32, .5, .8, { shape: 'triangle', r0: .0, len: 1.7, wid: .12, c: [OR, YE], rot0: 0 });
  for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) { const d = .05 - r * .01; S.disc(.08 + c * .084, .08 + r * .06, Math.max(.012, d), MG, { name: 'Halftone' }); S.disc(.92 - c * .084, 1.42 - r * .06, Math.max(.012, d), MG, { name: 'Halftone' }); }
  S.poly('star12', .5, .8, .74, .74, K, { name: 'Burst shadow' }); S.poly('star12', .5, .8, .68, .68, OW, { name: 'Burst star' });
  S.text('ZAP', .5, .8, .4, .2, RD, { bold: true, name: 'Sound word' });
});
def('Anime-inspired original', 'Moonlit Torii', [60, 90], NV, S => {
  S.disc(.5, .52, .74, OW, { name: 'Moon' }); S.disc(.62, .46, .14, SV, { name: 'Crater' }); S.disc(.4, .62, .09, SV, { name: 'Crater' });
  [[.1, .1], [.8, .15], [.2, .35], [.9, .4], [.07, .65], [.5, .08]].forEach(p => S.poly('spark4', p[0], p[1], .04, .04, YE, { name: 'Star' }));
  S.rect(.5, .5, .84, .035, RD, { name: 'Torii top beam' }); S.poly('slash', .09, .5, .08, .035, RD, { flip: true, name: 'Beam tip' });
  S.rect(.5, .57, .66, .03, RD, { name: 'Torii lower beam' }); S.rect(.5, .54, .05, .09, RD, { name: 'Torii strut' });
  S.rect(.3, .8, .045, .62, RD, { name: 'Pillar left' }); S.rect(.7, .8, .045, .62, RD, { name: 'Pillar right' });
  S.poly('triangle', .15, 1.2, .6, .55, K, { name: 'Hill' }); S.poly('triangle', .8, 1.22, .7, .5, K, { name: 'Hill' }); S.rect(.5, 1.4, 1, .2, K, { name: 'Ground' });
  S.wave(1.3, .03, TE, { freq: 3, bottom: 1.36, name: 'Water glint' });
});

/* ================================================================ ANIMALS */
def('Animals', 'Bold Cat Face', [60, 90], NV, S => {
  const g = S.group(.5, .75, 0, 1);
  g.poly('triangle', -.22, -.3, .2, .24, OR, { rot: -18, name: 'Ear left' }); g.poly('triangle', .22, -.3, .2, .24, OR, { rot: 18, name: 'Ear right' });
  g.poly('triangle', -.22, -.28, .1, .13, BL, { rot: -18, name: 'Inner ear' }); g.poly('triangle', .22, -.28, .1, .13, BL, { rot: 18, name: 'Inner ear' });
  g.ell(0, 0, .72, .62, OR, { name: 'Head' }); g.ell(0, .12, .34, .24, OW, { name: 'Muzzle' });
  [-1, 1].forEach(s => { g.ell(s * .17, -.06, .15, .11, YE, { name: 'Eye' }); g.ell(s * .17, -.06, .04, .1, K, { name: 'Pupil' });
    g.rect(s * .15, -.19, .02, .08, BR, { rot: s * 10, name: 'Brow stripe' });
    for (let i = 0; i < 3; i++) g.rect(s * .44, .08 + i * .045, .2, .01, OW, { rot: s * (-14 + i * 14), name: 'Whisker' }); });
  g.poly('triangle', 0, .06, .08, .06, HP, { rot: 180, name: 'Nose' }); g.rect(0, .13, .008, .06, K); g.ring(-.03, .17, .06, .008, K, { name: 'Mouth' }); g.ring(.03, .17, .06, .008, K, { name: 'Mouth' });
  S.ell(.5, 1.26, .5, .12, BR, { name: 'Shadow' });
});
(() => {
  const paw = (g, x, y, rot, k, c) => { const q = S0 => 0; const gg = g.group(x, y, rot, k); gg.ell(0, .035, .1, .085, c, { name: 'Paw pad' }); [[-.075, -.03], [-.025, -.075], [.025, -.075], [.075, -.03]].forEach(p => gg.ell(p[0], p[1], .042, .056, c, { name: 'Toe' })); };
  def('Animals', 'Paw Prints', [60, 90], BE, S => {
    S.rect(.5, .75, 1, 1.5, BE, { name: 'Ground' });
    const pts = [[.3, 1.32], [.62, 1.16], [.3, .98], [.66, .8], [.32, .62], [.62, .44], [.36, .26]];
    pts.forEach((p, i) => paw(S, p[0], p[1], -8 + (i % 2 ? 18 : -14), 1.5 - i * .06, i % 3 === 0 ? BR : i % 3 === 1 ? OR : BU));
    S.disc(.86, .1, .09, BR, { name: 'Mud' }); S.disc(.12, 1.4, .07, BR, { name: 'Mud' });
  });
})();
def('Animals', 'Tusker Elephant', [90, 60], TE, S => {
  S.disc(.84, .13, .12, YE, { name: 'Sun' }); S.ell(.5, .52, .9, .1, FG, { name: 'Ground' });
  S.ell(.5, .31, .46, .27, SV, { name: 'Body' }); [.35, .48, .6, .7].forEach((x, i) => S.rect(x, .46, .07, .13, i % 2 ? SV : GR, { name: 'Leg' }));
  S.ell(.28, .26, .24, .22, SV, { name: 'Head' }); S.ell(.37, .26, .15, .24, GR, { rot: 12, name: 'Ear' });
  [[.2, .38, .075, .1, 8], [.18, .45, .06, .09, 20], [.14, .5, .05, .07, 36]].forEach(p => S.ell(p[0], p[1], p[2], p[3], SV, { rot: p[4], name: 'Trunk' }));
  S.poly('leaf', .21, .4, .18, .035, OW, { rot: 70, name: 'Tusk' }); S.disc(.24, .22, .02, K, { name: 'Eye' }); S.poly('triangle', .77, .27, .06, .09, SV, { rot: 90, name: 'Tail' });
  S.rect(.55, .185, .3, .016, GO, { name: 'Saddle band' }); S.poly('half', .55, .17, .1, .05, GO, { name: 'Saddle' });
});
def('Animals', 'Koi Pair', [100, 60, 'oval'], TE, S => {
  const koi = (x, y, rot, c, c2) => { const g = S.group(x, y, rot, 1);
    g.poly('triangle', -.2, 0, .1, .17, c2, { rot: 90, name: 'Tail' }); g.poly('leaf', 0, 0, .36, .12, c, { name: 'Body' }); g.poly('leaf', .02, -.05, .12, .06, c2, { rot: -35, name: 'Fin' }); g.poly('leaf', .02, .05, .12, .06, c2, { rot: 35, name: 'Fin' });
    g.disc(.07, 0, .06, c2, { name: 'Patch' }); g.disc(.13, -.02, .018, K, { name: 'Eye' }); };
  [[.15, .1], [.85, .5], [.12, .5], [.88, .1]].forEach(p => S.disc(p[0], p[1], .09, FG, { name: 'Lily pad' }));
  S.ring(.5, .3, .54, .008, SK, { name: 'Ripple' }); S.ring(.5, .3, .42, .008, SK, { name: 'Ripple' });
  koi(.41, .21, 18, OR, OW); koi(.59, .39, 198, OW, RD);
  S.disc(.78, .12, .045, BL, { name: 'Blossom' }); S.disc(.22, .48, .045, BL, { name: 'Blossom' });
});
def('Animals', 'Owl Eyes', [60, 90], OR, S => {
  S.rect(.5, 1.42, 1, .16, BR, { name: 'Branch' });
  S.poly('triangle', .26, .22, .2, .22, BR, { rot: -14, name: 'Ear tuft' }); S.poly('triangle', .74, .22, .2, .22, BR, { rot: 14, name: 'Ear tuft' });
  S.ell(.5, .86, .8, 1.06, BR, { name: 'Body' }); S.ell(.5, .98, .5, .66, BE, { name: 'Belly' });
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) S.poly('chevron', .36 + c * .14 + (r % 2) * 0, .8 + r * .12, .1, .05, BR, { rot: 180, name: 'Feather' });
  [.3, .7].forEach(x => { S.disc(x, .5, .34, OW, { stroke: K, sw: .014, name: 'Eye white' }); S.disc(x, .5, .22, GO, { name: 'Iris' }); S.disc(x, .5, .11, K, { name: 'Pupil' }); S.disc(x - .03, .47, .035, WH, { name: 'Highlight' }); });
  S.poly('diamond', .5, .64, .1, .14, GO, { rot: 180, name: 'Beak' });
  S.poly('wing', .14, 1.0, .15, .5, BU, { rot: 0, name: 'Wing left' }); S.poly('wing', .86, 1.0, .15, .5, BU, { flip: true, name: 'Wing right' });
});
def('Animals', 'Butterfly', [90, 90], NV, S => {
  [-1, 1].forEach(s => {
    S.ell(.5 + s * .2, .34, .3, .5, MG, { rot: s * 35, name: 'Upper wing' }); S.ell(.5 + s * .24, .34, .17, .3, VI, { rot: s * 35, name: 'Wing pattern' }); S.disc(.5 + s * .3, .3, .06, OW, { name: 'Wing spot' });
    S.ell(.5 + s * .17, .65, .22, .32, OR, { rot: s * -30, name: 'Lower wing' }); S.disc(.5 + s * .2, .68, .08, YE, { name: 'Wing spot' }); S.disc(.5 + s * .2, .68, .035, K, { name: 'Wing eye' });
    S.rect(.5 + s * .08, .12, .008, .22, SV, { rot: s * 28, name: 'Antenna' }); S.disc(.5 + s * .132, .015, .02, SV, { name: 'Antenna tip' });
    [.12, .8].forEach((y, i) => S.disc(i ? .5 + s * .38 : .5 + s * .38, y, .018, OW, { name: 'Dust' }));
  });
  S.ell(.5, .5, .06, .5, K, { name: 'Body' }); S.disc(.5, .26, .07, K, { name: 'Head' });
});

/* ================================================================ FLORALS */
def('Florals', 'Daisy Burst', [90, 90], HP, S => {
  S.poly('leaf', .24, .8, .32, .12, FG, { rot: -35, name: 'Leaf' }); S.poly('leaf', .76, .8, .32, .12, FG, { rot: 35, name: 'Leaf' });
  radial(S, 18, .5, .48, { shape: 'ellipse', r0: .12, len: .3, wid: .1, c: [OW], rot0: 0 }); S.disc(.5, .48, .27, AM, { name: 'Centre ring' }); S.disc(.5, .48, .22, YE, { name: 'Centre' });
  [[.4, .44], [.5, .4], [.6, .45], [.45, .54], [.56, .54]].forEach(p => S.disc(p[0], p[1], .025, BR, { name: 'Seed' }));
  [[.1, .1], [.9, .9], [.9, .1], [.1, .9]].forEach(p => { radial(S, 8, p[0], p[1], { shape: 'ellipse', r0: .01, len: .08, wid: .04, c: [OW] }); S.disc(p[0], p[1], .045, YE, { name: 'Mini centre' }); });
});
def('Florals', 'Tulip Row', [60, 90], BL, S => {
  [[.2, .5, RD, .26], [.5, .38, MG, .3], [.8, .52, OR, .26]].forEach(([x, y, c, w]) => {
    S.rect(x, (y + 1.5) / 2 + .05, .02, 1.5 - y, FG, { name: 'Stem' }); S.poly('leaf', x + (x < .5 ? .09 : -.09), 1.1, .26, .07, FG, { rot: x < .5 ? -50 : 50, name: 'Leaf' });
    S.ell(x - w * .2, y, w * .52, w * .78, c, { rot: -12, name: 'Petal left' }); S.ell(x + w * .2, y, w * .52, w * .78, c, { rot: 12, name: 'Petal right' }); S.ell(x, y - w * .04, w * .48, w * .85, c, { name: 'Petal centre' });
    S.poly('triangle', x, y - w * .45, w * .36, w * .2, BL, { name: 'Cut' }); });
  S.wave(1.3, .05, FG, { freq: 2.2, name: 'Grass' }); S.wave(1.38, .04, BR, { freq: 1.6, phase: .4, name: 'Soil' });
  [[.5, .1], [.18, .2], [.86, .16]].forEach(p => S.poly('spark4', p[0], p[1], .06, .06, WH, { name: 'Sparkle' }));
});
def('Florals', 'Lotus Bloom', [60, 90], NV, S => {
  S.wave(1.05, .05, TE, { freq: 2, name: 'Water' }); S.wave(1.18, .05, NV, { freq: 2, phase: .4, name: 'Water' }); S.wave(1.32, .05, TE, { freq: 2, phase: .8, name: 'Water' });
  S.ell(.18, 1.1, .3, .09, FG, { name: 'Lily pad' }); S.ell(.82, 1.2, .3, .09, FG, { name: 'Lily pad' });
  const fan = (n, spread, len, wid, c, y) => { for (let i = 0; i < n; i++) { const a = -spread / 2 + i * spread / (n - 1); S.poly('leaf', .5 + Math.sin(rad(a)) * len / 2, y - Math.cos(rad(a)) * len / 2, len, wid, c, { rot: a - 90, name: 'Petal' }); } };
  fan(5, 110, .5, .17, MG, 1.0); fan(5, 80, .5, .17, HP, 1.0); fan(3, 40, .46, .16, BL, 1.0); S.disc(.5, 1.0, .06, YE, { name: 'Lotus heart' });
  [[.12, .14], [.84, .1], [.7, .3], [.2, .4]].forEach(p => S.poly('spark4', p[0], p[1], .05, .05, OW, { name: 'Star' }));
  S.disc(.5, .3, .22, NV, { stroke: OW, sw: .008, name: 'Moon halo' }); S.disc(.5, .3, .18, OW, { name: 'Moon' });
});
def('Florals', 'Ditsy Flowers', [60, 90], BU, S => {
  const r = rnd(5), cs = [BL, YE, OR, HP], pts = [];
  for (let gy = 0; gy < 6; gy++) for (let gx = 0; gx < 4; gx++) { if ((gx + gy) % 2 === 0 || pts.length > 15) continue; pts.push([.14 + gx * .24 + (gy % 2) * .04 + (r() - .5) * .05, .12 + gy * .25 + (r() - .5) * .05]); }
  pts.forEach((p, i) => { S.poly('leaf', p[0] + .08, p[1] + .08, .09, .04, FG, { rot: 40, name: 'Leaf' }); radial(S, 5, p[0], p[1], { shape: 'ellipse', r0: .0, len: .1, wid: .07, c: [cs[i % 4]], rot0: i * 13 }); S.disc(p[0], p[1], .035, i % 4 === 1 ? OR : YE, { name: 'Flower centre' }); });
  [[.5, .5], [.04, .5], [.96, .02]].forEach(p => S.disc(p[0], p[1], .02, GO, { name: 'Dot' }));
});

/* ================================================================ GEOMETRIC */
def('Geometric', 'Chevron Rise', [60, 90], OW, S => {
  const cs = [K, OR, TE, YE, RD, NV];
  for (let i = 0; i < 9; i++) S.poly('chevron', .5, 1.48 - i * .17, 1.3, .36, cs[i % cs.length], { name: 'Chevron' });
});
def('Geometric', 'Tunnel Squares', [90, 90], NV, S => {
  const cs = [MG, NV, VI, K, HP, RB];
  for (let i = 0; i < 12; i++) S.rect(.5, .5, 1.1 - i * .088, 1.1 - i * .088, cs[i % cs.length], { rot: i * 7, name: 'Square' });
});
def('Geometric', 'Iso Cubes', [60, 90], K, S => {
  const s = .3, set = [[OW, SK, RB], [YE, OR, RD]];
  for (let r = -1; r < 8; r++) for (let c = -1; c < 4; c++) { const x = .15 + c * s + (r % 2 ? s / 2 : 0), y = .14 + r * s * .866, t = set[(r + c + 4) % 2 === 0 ? 0 : 1], g = S.group(x, y, 0, 1);
    if (x < -.2 || x > 1.2) continue; const h = s * 1.1547;
    g.poly('cubeTop', 0, 0, s, h, t[0], { name: 'Cube top' }); g.poly('cubeLeft', 0, 0, s, h, t[1], { name: 'Cube left' }); g.poly('cubeRight', 0, 0, s, h, t[2], { name: 'Cube right' }); }
});

/* ================================================================ MANDALA */
def('Mandala', 'Mandala Bloom', [80, 80, 'circle'], NV, S => {
  radial(S, 24, .5, .5, { shape: 'leaf', r0: .34, len: .14, wid: .07, c: [OR], rot0: 0 }); S.ring(.5, .5, .68, .01, GO, { name: 'Ring' });
  radial(S, 16, .5, .5, { shape: 'ellipse', r0: .22, len: .16, wid: .1, c: [VI, MG] }); S.ring(.5, .5, .44, .01, OW, { name: 'Ring' });
  radial(S, 12, .5, .5, { shape: 'leaf', r0: .1, len: .18, wid: .1, c: [MG, HP], rot0: 15 }); radial(S, 8, .5, .5, { shape: 'ellipse', r0: .03, len: .11, wid: .07, c: [YE] });
  S.disc(.5, .5, .08, OW, { name: 'Centre' }); S.disc(.5, .5, .035, GO, { name: 'Centre dot' });
  for (let i = 0; i < 24; i++) S.disc(.5 + Math.sin(rad(i * 15)) * .475, .5 - Math.cos(rad(i * 15)) * .475, .016, GO, { name: 'Edge dot' });
});
def('Mandala', 'Sun Wheel', [80, 80, 'circle'], K, S => {
  const ringSeg = (n, ro, ri, cs, off, gap) => { for (let i = 0; i < n; i++) { const a0 = off + i * 360 / n + gap, a1 = off + (i + 1) * 360 / n - gap; S.poly(arcPts(a0, a1, .5, ri / ro * .5), .5, .5, ro * 2, ro * 2, cs[i % cs.length], { name: 'Segment' }); } };
  ringSeg(24, .48, .38, [GO, RD], 0, 1.2); ringSeg(16, .36, .27, [OW, TE], 11, 1.5); ringSeg(12, .25, .17, [VI, MG], 0, 2); ringSeg(8, .15, .08, [YE, RD], 22, 3);
  S.disc(.5, .5, .1, YE, { name: 'Core' }); S.disc(.5, .5, .04, RD, { name: 'Core dot' });
});
def('Mandala', 'Star Mandala', [90, 90], BU, S => {
  S.poly('star16', .5, .5, .98, .98, GO, { name: 'Star 16' }); S.poly('star12', .5, .5, .84, .84, BU, { rot: 7.5, name: 'Star 12' });
  S.poly('star8', .5, .5, .76, .76, RD, { name: 'Star 8' }); S.poly('star8', .5, .5, .62, .62, OW, { rot: 22.5, name: 'Star 8 inner' });
  S.ring(.5, .5, .42, .012, BU, { name: 'Ring' }); for (let i = 0; i < 16; i++) S.disc(.5 + Math.sin(rad(i * 22.5)) * .3, .5 - Math.cos(rad(i * 22.5)) * .3, .026, i % 2 ? RD : TE, { name: 'Bead' });
  S.poly('star8', .5, .5, .26, .26, TE, { name: 'Star core' }); S.disc(.5, .5, .1, GO, { name: 'Core' }); S.disc(.5, .5, .04, BU, { name: 'Core dot' });
});

/* ================================================================ RETRO */
def('Retro', 'Sunset Grid', [80, 50], NV, S => {
  const hz = .3, U = S.U;
  S.disc(.5, .17, .36, OR, { name: 'Sun' }); S.disc(.5, .2, .27, AM, { name: 'Sun core' }); S.disc(.5, .23, .17, YE, { name: 'Sun glow' });
  [.2, .235, .265, .29].forEach((y, i) => S.rect(.5, y, .5, .006 + i * .004, NV, { name: 'Sun cut' }));
  S.poly('triangle', .15, hz - .05, .3, .1, VI, { name: 'Hill' }); S.poly('triangle', .86, hz - .04, .26, .08, VI, { name: 'Hill' });
  S.rect(.5, (hz + U) / 2 + .01, 1.1, U - hz + .02, K, { name: 'Ground' }); S.rect(.5, hz, 1.1, .01, MG, { name: 'Horizon' });
  for (let i = 1; i <= 6; i++) S.rect(.5, hz + (U - hz) * Math.pow(i / 6, 2), 1.1, .006 + i * .0015, MG, { name: 'Grid row' });
  for (let i = -8; i <= 8; i++) { const xb = .5 + i * .16, dy = U - hz, th = Math.atan((xb - .5) / dy) * 180 / Math.PI, len = Math.sqrt(dy * dy + (xb - .5) ** 2);
    S.rect((.5 + xb) / 2, (hz + U) / 2, .005, len, MG, { rot: -th, name: 'Grid line' }); }
  S.rect(.5, hz + (U - hz) + .02, 1.2, .08, K, { name: 'Edge' });
});
def('Retro', 'Atomic Starburst', [60, 90], OW, S => {
  S.rect(.5, .75, .02, 1.3, K, { rot: 20, name: 'Strut' }); S.rect(.5, .75, .02, 1.3, K, { rot: -35, name: 'Strut' });
  [[.28, .26, .34, TE], [.74, .46, .26, OR], [.3, .78, .3, RD], [.7, 1.12, .34, TE], [.34, 1.34, .22, OR]].forEach((p, i) => { S.poly('spark4', p[0], p[1], p[2], p[2], p[3], { name: 'Atom star' }); S.disc(p[0], p[1], p[2] * .2, i % 2 ? K : YE, { name: 'Atom core' }); });
  [[.12, .1], [.88, .2], [.14, .5], [.86, .88], [.12, 1.1], [.88, 1.4], [.5, .08], [.5, 1.46]].forEach((p, i) => S.disc(p[0], p[1], .03 + (i % 3) * .01, i % 2 ? K : MG, { name: 'Atom dot' }));
  S.poly('half', .5, .6, .24, .12, YE, { rot: 180, name: 'Boomerang' }); S.poly('half', .5, .6, .14, .07, OW, { rot: 180, name: 'Boomerang cut' });
});
def('Retro', 'Cassette Tape', [90, 60], TE, S => {
  S.rect(.5, .333, .8, .5, OW, { stroke: K, sw: .01, name: 'Cassette' }); S.rect(.5, .26, .7, .24, OR, { name: 'Label' }); S.rect(.5, .2, .7, .06, RD, { name: 'Label stripe' });
  S.text('MIX TAPE 01', .5, .26, .5, .06, K, { font: 'Mono', bold: true, name: 'Label text' });
  S.rect(.5, .4, .5, .13, K, { name: 'Tape window' }); [.37, .63].forEach(x => { S.disc(x, .4, .1, OW, { name: 'Reel' }); S.ring(x, .4, .06, .01, K, { name: 'Reel ring' }); radial(S, 6, x, .4, { shape: 'triangle', r0: .0, len: .03, wid: .015, c: [K] }); });
  S.poly('slash', .5, .5, .38, .07, CH, { name: 'Base' }); [.2, .8].forEach(x => S.disc(x, .56, .02, SV, { name: 'Screw' })); [.2, .8].forEach(x => S.disc(x, .1, .02, SV, { name: 'Screw' }));
  S.rect(.5, .1, .1, .018, K); S.rect(.5, .56, .22, .016, K);
});
def('Retro', 'Vinyl Record', [80, 80, 'circle'], MG, S => {
  S.disc(.5, .5, .94, K, { name: 'Record' }); [.84, .76, .68, .6, .52].forEach(d => S.ring(.5, .5, d, .008, CH, { name: 'Groove' }));
  S.poly(arcPts(-60, -20, .5, 0), .5, .5, .9, .9, CH, { name: 'Shine' }); S.poly(arcPts(120, 160, .5, 0), .5, .5, .9, .9, CH, { name: 'Shine' });
  S.disc(.5, .5, .34, YE, { name: 'Label' }); S.ring(.5, .5, .28, .014, RD, { name: 'Label ring' }); S.disc(.5, .5, .035, MG, { name: 'Spindle' });
  S.text('SIDE A', .5, .4, .2, .05, K, { font: 'Mono', bold: true, name: 'Side' }); S.text('33 RPM', .5, .61, .16, .04, RD, { font: 'Mono', name: 'Speed' });
});

/* ================================================================ MINIMAL */
def('Minimal', 'Soft Serif Hello', [90, 40], BE, S => {
  S.text('hello', .5, .2, .56, .26, BR, { font: 'Serif', name: 'Greeting' }); S.rect(.5, .335, .3, .008, BR, { name: 'Rule' });
  S.disc(.17, .2, .05, OR, { name: 'Dot' }); S.disc(.83, .2, .05, OR, { name: 'Dot' }); S.text('welcome home', .5, .385, .2, .04, BR, { font: 'Mono', name: 'Caption' });
});
def('Minimal', 'Horizon Line', [60, 90], OW, S => {
  S.disc(.5, .74, .4, OR, { name: 'Sun' }); S.rect(.5, 1.05, 1.1, .6, OW, { name: 'Sky mask' });
  S.rect(.5, .94, .86, .012, K, { name: 'Horizon' }); [[.7, 1.0], [.5, 1.06], [.3, 1.12]].forEach((p, i) => S.rect(.5, p[1], p[0], .008, K, { name: 'Water line' }));
  S.text('GOOD MORNING', .5, 1.3, .5, .045, K, { font: 'Mono', name: 'Caption' });
});
def('Minimal', 'Arch Window', [60, 90], BL, S => {
  S.poly('arch', .5, .7, .62, .96, BR, { name: 'Arch frame' }); S.poly('arch', .5, .74, .5, .88, BL, { name: 'Arch opening' });
  S.disc(.5, .62, .2, OR, { name: 'Sun' }); S.rect(.5, 1.08, .5, .012, BR, { name: 'Sill' }); S.text('home', .5, 1.28, .3, .1, BR, { font: 'Serif', name: 'Word' });
});

/* ================================================================ KIDS */
def('Kids', 'Friendly Dino', [90, 60], SK, S => {
  S.disc(.84, .11, .12, YE, { name: 'Sun' }); S.ell(.22, .1, .2, .07, WH, { name: 'Cloud' }); S.ell(.32, .12, .16, .06, WH, { name: 'Cloud' });
  S.ell(.2, .6, .7, .24, FG, { name: 'Hill' }); S.ell(.8, .62, .7, .22, LI, { name: 'Hill' });
  S.poly('triangle', .15, .39, .22, .06, LI, { rot: -78, name: 'Tail' }); S.ell(.45, .38, .4, .24, LI, { name: 'Body' });
  S.ell(.6, .26, .09, .26, LI, { rot: 28, name: 'Neck' }); S.ell(.7, .17, .16, .12, LI, { name: 'Head' }); S.disc(.74, .15, .026, OW, { name: 'Eye' }); S.disc(.745, .15, .012, K, { name: 'Pupil' });
  [.3, .39, .47, .55].forEach((x, i) => S.poly('triangle', x, .26 + (i === 3 ? .02 : 0) - Math.abs(i - 1.5) * -.01, .05, .07, YE, { rot: -10 + i * 8, name: 'Back spike' }));
  [.35, .55].forEach(x => S.ell(x, .54, .09, .13, LI, { name: 'Leg' })); [.35, .55].forEach(x => S.ell(x, .6, .1, .04, FG, { name: 'Foot' }));
  S.ring(.76, .2, .06, .008, K, { name: 'Smile' }); S.rect(.77, .17, .006, .01, K);
});
def('Kids', 'Alphabet Blocks', [60, 90], BL, S => {
  [[.32, .98, RD, 'A', -6], [.68, .98, SK, 'B', 5], [.5, .66, LI, 'C', -3]].forEach(([x, y, c, t, r]) => { S.rect(x, y, .34, .34, c, { stroke: K, sw: .012, rot: r, name: 'Block ' + t }); S.text(t, x, y + .01, .2, .24, OW, { bold: true, rot: r, name: 'Letter ' + t }); });
  S.rect(.5, 1.36, 1.1, .3, BE, { name: 'Floor' }); S.rect(.5, 1.21, 1.1, .018, K);
  [[.15, .2, YE], [.82, .3, RD], [.3, .38, SK], [.72, .5, YE]].forEach(p => S.poly('star', p[0], p[1], .1, .095, p[2], { rot: p[0] * 80, name: 'Star' }));
  S.text('ABC 123', .5, .12, .5, .08, RD, { name: 'Title' });
});
def('Kids', 'Space Rocket', [60, 90], NV, S => {
  const r = rnd(9); for (let i = 0; i < 14; i++) S.poly('spark4', .06 + r() * .88, .05 + r() * 1.4, .03 + r() * .03, .03 + r() * .03, i % 3 ? OW : YE, { name: 'Star' });
  S.disc(.78, .3, .17, MG, { name: 'Planet' }); S.ringE(.78, .3, .3, .08, .014, YE, { rot: -20, name: 'Planet ring' });
  S.poly('triangle', .5, 1.28, .12, .34, YE, { rot: 180, name: 'Flame' }); S.poly('triangle', .5, 1.24, .07, .24, OR, { rot: 180, name: 'Flame core' });
  S.poly('triangle', .32, 1.06, .18, .3, RD, { rot: -28, name: 'Fin' }); S.poly('triangle', .68, 1.06, .18, .3, RD, { rot: 28, name: 'Fin' });
  S.ell(.5, .86, .26, .62, OW, { name: 'Body' }); S.poly('triangle', .5, .5, .2, .26, RD, { name: 'Nose' }); S.disc(.5, .76, .13, YE, { name: 'Window rim' }); S.disc(.5, .76, .1, SK, { name: 'Window' }); S.rect(.5, 1.0, .26, .03, RD, { name: 'Band' });
  S.disc(.18, 1.28, .12, SV, { name: 'Moon' }); S.disc(.16, 1.26, .03, NV, { name: 'Crater' });
});

/* ================================================================ NATURE */
def('Nature', 'Pine Forest', [60, 90], NV, S => {
  S.disc(.7, .22, .26, OW, { name: 'Moon' }); S.disc(.76, .19, .06, SV, { name: 'Crater' });
  const pine = (x, y, k, c) => { for (let i = 0; i < 3; i++) S.poly('triangle', x, y - i * .1 * k, (.3 - i * .06) * k, .2 * k, c, { name: 'Pine' }); S.rect(x, y + .13 * k, .03 * k, .08 * k, c, { name: 'Trunk' }); };
  [[.08, .92], [.3, .86], [.52, .94], [.74, .88], [.94, .93]].forEach(p => pine(p[0], p[1], 1.3, GR));
  S.rect(.5, 1.06, 1.1, .12, GR, { name: 'Far ground' });
  [[.04, 1.12], [.26, 1.06], [.5, 1.14], [.74, 1.07], [.96, 1.12]].forEach(p => pine(p[0], p[1], 1.7, FG));
  S.rect(.5, 1.36, 1.1, .3, FG, { name: 'Mid ground' });
  [[.1, 1.3], [.38, 1.24], [.66, 1.3], [.92, 1.26]].forEach(p => pine(p[0], p[1], 2.1, K));
  S.rect(.5, 1.5, 1.1, .08, K, { name: 'Foreground' });
});
def('Nature', 'Desert Dunes', [90, 60], AM, S => {
  S.disc(.7, .2, .3, OR, { name: 'Sun halo' }); S.disc(.7, .2, .22, YE, { name: 'Sun' });
  S.wave(.28, .06, BE, { freq: 1.2, name: 'Far dune' }); S.wave(.36, .07, OR, { freq: 1.6, phase: .3, name: 'Mid dune' }); S.wave(.46, .06, BR, { freq: 1.1, phase: .7, name: 'Near dune' }); S.wave(.54, .05, BU, { freq: 2, phase: .2, name: 'Front dune' });
  S.rect(.22, .44, .03, .13, FG, { name: 'Cactus stem' }); S.rect(.17, .43, .02, .06, FG, { name: 'Cactus arm' }); S.rect(.185, .46, .03, .02, FG); S.rect(.27, .41, .02, .07, FG, { name: 'Cactus arm' }); S.rect(.255, .445, .03, .02, FG);
  [[.5, .1], [.55, .13], [.45, .14]].forEach(p => S.poly('chevron', p[0], p[1], .03, .015, K, { name: 'Bird' }));
});
def('Nature', 'Tropical Fronds', [60, 90], K, S => {
  const cs = [FG, LI, TE, MI];
  for (let i = 0; i < 9; i++) ray(S, 'leaf', -.02, 1.52, -85 + i * 11, 1.0 - Math.abs(i - 4) * .08, .22, cs[i % 4]);
  for (let i = 0; i < 7; i++) ray(S, 'leaf', 1.02, -.02, 95 + i * 12, .8 - Math.abs(i - 3) * .06, .2, cs[(i + 1) % 4]);
  S.disc(.7, 1.2, .1, HP, { name: 'Flower' }); S.disc(.7, 1.2, .045, YE, { name: 'Flower centre' });
  [[.1, .2], [.5, .5], [.2, .62]].forEach(p => S.poly('spark4', p[0], p[1], .04, .04, MI, { name: 'Glint' }));
});
def('Nature', 'Palm Sunset', [90, 60], VI, S => {
  [[0, .12, VI], [.12, .12, MG], [.2, .1, HP], [.28, .1, OR], [.36, .1, OR]].forEach(b => S.rect(.5, b[0] + b[1] / 2, 1.1, b[1] + .005, b[2], { name: 'Sky band' }));
  S.disc(.5, .4, .3, YE, { name: 'Sun' }); S.rect(.5, .5, 1.1, .34, NV, { name: 'Sea' });
  [.44, .47, .5, .53].forEach((y, i) => S.rect(.5, y, .24 - i * .04, .012, YE, { name: 'Sun reflection' })); S.rect(.5, .545, 1.1, .02, TE, { name: 'Shore' });
  const palm = (x, lean, k) => { S.rect(x + lean * .06 * k, .33, .016 * k, .5 * k, K, { rot: lean * 10, name: 'Palm trunk' }); const tx = x + lean * .17 * k, ty = .09 + .1 * (1 - k);
    [-60, -30, 0, 30, 60].forEach(a => S.poly('leaf', tx + Math.sin(rad(a)) * .09 * k, ty + .03 - Math.cos(rad(a)) * .02, .2 * k, .045 * k, K, { rot: a - 90 + (a < 0 ? 0 : 0) + 0, name: 'Palm frond' })); [-1, 1].forEach(s => S.poly('leaf', tx + s * .09 * k, ty + .09 * k, .2 * k, .04 * k, K, { rot: s * 35, name: 'Palm frond' })); };
  palm(.2, -1, 1.05); palm(.8, 1, .9);
  S.poly('chevron', .42, .12, .03, .015, K, { name: 'Bird' }); S.poly('chevron', .5, .08, .03, .015, K, { name: 'Bird' });
});

/* ================================================================ STREETWEAR */
def('Streetwear', 'Wild Style Tag', [90, 40], K, S => {
  S.poly('crown', .5, .045, .09, .05, GO, { name: 'Crown' });
  S.text('Wild Style', .515, .245, .8, .3, MG, { font: 'Script', bold: true, name: 'Tag shadow' }); S.text('Wild Style', .505, .235, .8, .3, YE, { font: 'Script', bold: true, name: 'Tag mid' }); S.text('Wild Style', .5, .225, .8, .3, OW, { font: 'Script', bold: true, name: 'Tag' });
  S.wave(.36, .015, NE, { freq: 3, bottom: .385, name: 'Underline' });
  [[.08, .1], [.93, .32], [.1, .36], [.9, .08], [.96, .2]].forEach((p, i) => S.disc(p[0], p[1], .02 + (i % 2) * .012, i % 2 ? MG : NE, { name: 'Spray dot' }));
});
def('Streetwear', 'Sticker Bomb', [60, 90], CH, S => {
  S.disc(.28, .24, .36, MG, { stroke: OW, sw: .016, name: 'Sticker disc' }); S.poly('star', .28, .24, .24, .23, YE, { rot: 10, name: 'Sticker star' });
  S.rect(.7, .2, .4, .2, RD, { stroke: OW, sw: .016, rot: -8, name: 'Sticker tag' }); S.text('HYPE', .7, .2, .32, .12, OW, { rot: -8, name: 'Sticker word' });
  S.rect(.7, .56, .34, .4, YE, { stroke: K, sw: .016, rot: 7, name: 'Sticker card' }); S.poly('bolt', .7, .56, .22, .3, K, { rot: 7, name: 'Sticker bolt' });
  S.ell(.28, .62, .46, .22, SK, { stroke: OW, sw: .016, rot: 6, name: 'Sticker pill' }); S.text('FRESH', .28, .62, .34, .1, K, { rot: 6, name: 'Sticker word' });
  S.poly('heart', .26, 1.0, .3, .28, MG, { stroke: OW, sw: .016, rot: -10, name: 'Sticker heart' });
  S.disc(.7, .98, .3, NE, { stroke: K, sw: .016, name: 'Sticker badge' }); S.text('NO.1', .7, .98, .22, .1, K, { name: 'Badge text' });
  S.poly('crown', .5, 1.32, .34, .16, YE, { stroke: K, sw: .012, rot: 4, name: 'Sticker crown' }); S.rect(.17, 1.35, .22, .12, RD, { stroke: OW, sw: .014, rot: -12, name: 'Sticker patch' }); S.rect(.84, 1.34, .2, .16, SK, { stroke: OW, sw: .014, rot: 10, name: 'Sticker patch' });
});

/* ================================================================ TYPOGRAPHY */
def('Typography', 'Outline Block Word', [60, 90], NV, S => {
  [.18, .5, .82, 1.14, 1.46].forEach((y, i) => S.rect(.5, y, 1.1, .03, i % 2 ? RB : NV, { name: 'Pin stripe' }));
  S.text('GOOD', .5, .3, .84, .3, NV, { stroke: NE, sw: .012, bold: true, name: 'Word outline' });
  S.text('VIBES', .5, .66, .84, .3, YE, { bold: true, name: 'Word solid' });
  S.text('ONLY', .5, 1.02, .84, .3, NV, { stroke: MG, sw: .012, bold: true, name: 'Word outline' });
  S.rect(.5, 1.3, .6, .014, OW); S.text('EST. 2026', .5, 1.37, .3, .06, OW, { font: 'Mono', name: 'Year' });
});
def('Typography', 'Script Hello', [60, 90], BL, S => {
  S.disc(.5, .72, 1.0, BL, { name: 'Glow' }); S.text('Hello', .5, .62, .96, .5, RD, { font: 'Script', bold: true, rot: -8, name: 'Script word' });
  S.wave(.9, .03, RD, { freq: 2, bottom: .94, name: 'Swoosh' }); S.text('WELCOME HOME', .5, 1.12, .6, .06, K, { font: 'Mono', name: 'Caption' });
  [[.15, .2, HP], [.85, .3, RD], [.2, 1.3, RD], [.82, 1.28, HP], [.5, .24, HP]].forEach(p => S.poly('heart', p[0], p[1], .09, .085, p[2], { name: 'Heart' }));
});
def('Typography', 'Highlight Words', [60, 90], OW, S => {
  S.rect(.5, .3, .84, .26, YE, { rot: -3, name: 'Highlight bar' }); S.text('STAY', .5, .3, .7, .2, K, { rot: -3, bold: true, name: 'Word' });
  S.rect(.5, .66, .84, .26, K, { rot: 2, name: 'Dark bar' }); S.text('WILD', .5, .66, .7, .2, OW, { rot: 2, bold: true, name: 'Word' });
  S.rect(.5, 1.0, .84, .26, RD, { rot: -2, name: 'Red bar' }); S.text('ALWAYS', .5, 1.0, .74, .2, OW, { rot: -2, name: 'Word' });
  S.rect(.5, 1.3, .5, .014, K); S.text('NO RULES', .5, 1.37, .3, .06, K, { font: 'Mono', name: 'Caption' });
});

/* ================================================================ SEASONAL */
def('Seasonal', 'Snowflake Crystal', [80, 80, 'circle'], NV, S => {
  S.disc(.5, .5, .96, RB, { name: 'Sky' }); S.disc(.5, .5, .9, NV, { name: 'Night' });
  [0, 60, 120].forEach(a => S.rect(.5, .5, .018, .8, OW, { rot: a, name: 'Arm' }));
  for (let i = 0; i < 6; i++) { const a = i * 60;[.3, .2, .12].forEach((d, j) => { const px = .5 + Math.sin(rad(a)) * d, py = .5 - Math.cos(rad(a)) * d; S.rect(px, py, .012, .14 - j * .03, SK, { rot: a + 50, name: 'Branch' }); S.rect(px, py, .012, .14 - j * .03, SK, { rot: a - 50, name: 'Branch' }); }); S.disc(.5 + Math.sin(rad(a)) * .4, .5 - Math.cos(rad(a)) * .4, .03, WH, { name: 'Tip' }); }
  S.poly('hexagon', .5, .5, .14, .14, SK, { name: 'Core' }); S.poly('hexagon', .5, .5, .07, .07, NV, { name: 'Core hole' });
  [[.14, .3], [.86, .7], [.3, .88], [.7, .12], [.12, .65]].forEach(p => S.disc(p[0], p[1], .02, OW, { name: 'Snow' }));
});
def('Seasonal', 'Night Pumpkin', [60, 90], K, S => {
  S.disc(.72, .22, .26, YE, { name: 'Moon' }); [[.3, .18, .13], [.5, .3, .09], [.14, .4, .1]].forEach(p => S.poly('bat', p[0], p[1], p[2], p[2] * .8, VI, { name: 'Bat' }));
  S.wave(1.22, .05, VI, { freq: 1.6, name: 'Ground' });
  S.ell(.28, .88, .38, .44, OR, { name: 'Pumpkin lobe' }); S.ell(.72, .88, .38, .44, OR, { name: 'Pumpkin lobe' }); S.ell(.5, .88, .46, .52, OR, { stroke: BR, sw: .008, name: 'Pumpkin' });
  S.rect(.5, .6, .06, .1, FG, { rot: 10, name: 'Stem' });
  S.poly('triangle', .38, .82, .1, .12, YE, { rot: -8, name: 'Eye' }); S.poly('triangle', .62, .82, .1, .12, YE, { rot: 8, name: 'Eye' });
  S.poly('zig', .5, 1.02, .3, .13, YE, { rot: 0, name: 'Grin' }); S.poly('tooth', .5, .93, .06, .05, YE, { rot: 180, name: 'Nose' });
  S.rect(.5, 1.18, 1.1, .01, K);
});
def('Seasonal', 'Festive Tree', [60, 90], RD, S => {
  S.poly('star', .5, .14, .16, .152, YE, { name: 'Tree star' });
  [[.34, .3, .5], [.46, .4, .66], [.58, .48, .8]].forEach((t, i) => S.poly('triangle', .5, .1 + t[0] * 1.5 * .5 + .1 + i * .15, t[2], .4, FG, { name: 'Tree tier' }));
  S.rect(.5, 1.12, .1, .14, BR, { name: 'Trunk' });
  [[.5, .4, YE], [.4, .62, OW], [.62, .66, YE], [.3, .86, OW], [.52, .84, YE], [.72, .88, OW], [.22, 1.02, YE], [.46, 1.02, OW], [.66, 1.02, YE], [.82, 1.02, OW]].forEach(p => S.disc(p[0], p[1], .045, p[2], { name: 'Ornament' }));
  S.rect(.3, 1.34, .24, .16, GO, { name: 'Gift' }); S.rect(.3, 1.34, .03, .16, RD); S.rect(.3, 1.34, .24, .03, RD); S.rect(.68, 1.37, .2, .12, OW, { name: 'Gift' }); S.rect(.68, 1.37, .03, .12, FG); S.rect(.68, 1.37, .2, .03, FG);
  [[.12, .2], [.86, .3], [.14, .6], [.88, .7], [.08, .95], [.9, 1.15]].forEach(p => S.disc(p[0], p[1], .02, OW, { name: 'Snow' }));
});
def('Seasonal', 'Paper Lanterns', [90, 60], NV, S => {
  S.rect(.5, .04, 1.1, .01, GO, { name: 'String' });
  [[.14, .16, RD], [.34, .22, YE], [.54, .14, MG], [.74, .24, OR], [.9, .15, YE]].forEach(([x, h, c], i) => { const w = .16, y = .04 + h + .08;
    S.rect(x, (.04 + y) / 2, .004, h, GO, { name: 'Cord' }); S.rect(x, y - .075, .06, .012, GO, { name: 'Lantern cap' }); S.ell(x, y, w, .15, c, { name: 'Lantern' });
    S.ringE(x, y, w * .5, .15, .006, NV, { name: 'Lantern rib' }); S.rect(x, y + .075, .06, .012, GO, { name: 'Lantern base' }); S.rect(x, y + .13, .006, .08, c, { name: 'Tassel' }); });
  [[.1, .5], [.3, .56], [.5, .5], [.7, .58], [.9, .52], [.2, .36], [.62, .42]].forEach(p => S.poly('spark4', p[0], p[1], .035, .035, OW, { name: 'Star' }));
});

/* ================================================================ ABSTRACT */
def('Abstract', 'Layered Tide', [60, 90], NV, S => {
  [VI, MG, HP, OR, AM, YE, OW].forEach((c, i) => S.wave(.14 + i * .18, .09, c, { freq: 1.4 + (i % 3) * .5, phase: i * .17, name: 'Tide ' + (i + 1) }));
  S.disc(.76, .12, .16, OW, { name: 'Moon' });
});
def('Abstract', 'Contour Rings', [90, 90], K, S => {
  const cs = [TE, K, NV, K, RB, K, SK, K];
  for (let i = 0; i < 9; i++) S.ell(.4 + i * .014, .52 - i * .01, 1.05 - i * .11, .9 - i * .095, cs[i % cs.length], { rot: -20 + i * 6, name: 'Contour ' + (i + 1) });
  S.disc(.78, .22, .06, YE, { name: 'Peak' }); S.disc(.28, .72, .04, MI, { name: 'Peak' });
});
def('Abstract', 'Memphis Pop', [60, 90], MI, S => {
  S.wave(.18, .04, K, { freq: 4, bottom: .24, name: 'Squiggle' }); S.wave(1.3, .04, K, { freq: 4, bottom: 1.36, phase: .3, name: 'Squiggle' });
  S.poly('triangle', .3, .42, .26, .24, HP, { rot: -15, name: 'Triangle' }); S.disc(.74, .38, .24, YE, { name: 'Circle' }); S.ring(.74, .38, .36, .014, K, { name: 'Circle outline' });
  S.poly('half', .3, .8, .3, .15, SK, { rot: 20, name: 'Half circle' }); S.poly('cross', .72, .76, .14, .14, K, { rot: 15, name: 'Plus' });
  S.rect(.5, 1.02, .5, .07, OW, { rot: -20, name: 'Bar' }); S.poly('triangle', .74, 1.14, .16, .15, MG, { rot: 20, name: 'Triangle' }); S.ring(.26, 1.12, .16, .02, HP, { name: 'Ring' });
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) S.disc(.1 + c * .05, .08 + r * .04 - .02 * 0 + 1.1 * 0 + 0, .016, K, { name: 'Dot' });
  S.poly('cross', .86, .12, .08, .08, OW, { name: 'Plus' });
});

/* ================================================================ CUSTOM SHAPES */
def('Custom Shapes', 'Round Compass', [80, 80, 'circle'], OW, S => {
  S.disc(.5, .5, .94, K, { name: 'Bezel' }); S.disc(.5, .5, .86, OW, { name: 'Dial' }); S.ring(.5, .5, .74, .01, K, { name: 'Ring' });
  for (let i = 0; i < 36; i++) S.rect(.5 + Math.sin(rad(i * 10)) * .39, .5 - Math.cos(rad(i * 10)) * .39, i % 9 ? .006 : .012, i % 3 ? .02 : .04, K, { rot: i * 10, name: 'Tick' });
  [45, 135].forEach(a => S.poly('diamond', .5, .5, .1, .56, GR, { rot: a, name: 'Minor point' }));
  S.poly('diamond', .5, .5, .13, .72, K, { rot: 90, name: 'Point E-W' }); S.poly('diamond', .5, .5, .13, .72, K, { name: 'Point S' }); S.poly('triangle', .5, .31, .13, .36, RD, { name: 'Point N' });
  S.disc(.5, .5, .08, OW, { stroke: K, sw: .012, name: 'Pivot' }); S.text('N', .5, .15, .08, .09, RD, { name: 'North' });
});
def('Custom Shapes', 'Oval Sunrise', [100, 60, 'oval'], SK, S => {
  S.disc(.5, .3, .36, OR, { name: 'Sun halo' }); S.disc(.5, .3, .28, AM, { name: 'Sun' }); S.disc(.5, .3, .18, YE, { name: 'Sun core' });
  S.ell(.2, .1, .16, .05, WH, { name: 'Cloud' }); S.ell(.8, .14, .2, .05, WH, { name: 'Cloud' });
  S.wave(.3, .03, TE, { freq: 4, name: 'Sea 1' }); S.wave(.38, .03, RB, { freq: 4, phase: .3, name: 'Sea 2' }); S.wave(.46, .03, NV, { freq: 4, phase: .6, name: 'Sea 3' });
});
def('Custom Shapes', 'Keycap Rows', [44, 16], K, S => {
  [['W', NE, .13], ['A', MG, .31], ['S', SK, .49], ['D', YE, .67]].forEach(([t, c, x]) => { S.rect(x + .1, .13, .15, .15, c, { stroke: CH, sw: .008, name: 'Keycap ' + t }); S.text(t, x + .1, .13, .08, .1, K, { name: 'Key ' + t }); });
  S.rect(.5, .3, .56, .06, OW, { stroke: CH, sw: .006, name: 'Space bar' }); S.text('SPACE', .5, .3, .14, .035, K, { font: 'Mono', name: 'Space label' });
  S.rect(.06, .17, .08, .26, GR, { name: 'Side rail' }); S.rect(.94, .17, .08, .26, GR, { name: 'Side rail' });
});

/* ---------------------------------------------------------------- validation + registration */
const SLUG = { 'Abstract': 'abstract', 'Geometric': 'geometric', 'Minimal': 'minimal', 'Streetwear': 'street', 'Gaming': 'gaming', 'Anime-inspired original': 'anime', 'Nature': 'nature', 'Typography': 'type', 'Luxury': 'luxury', 'Kids': 'kids', 'Home Decor': 'home', 'Custom Shapes': 'custom', 'Emblems': 'emblem', 'Sports': 'sports', 'Animals': 'animal', 'Florals': 'floral', 'Retro': 'retro', 'Mandala': 'mandala', 'Seasonal': 'season' };
const yarnIds = (() => { try { return new Set(L.yarnList().map(y => y.id)); } catch (e) { return null; } })();
const fin = (...v) => v.every(n => typeof n === 'number' && isFinite(n));
const okYarn = id => typeof id === 'string' && /^XY-\d+$/.test(id) && (!yarnIds || yarnIds.has(id));
/** returns '' when the template is sound, otherwise a short reason */
function validate(t) {
  if (!t || typeof t !== 'object') return 'not an object';
  if (typeof t.id !== 'string' || !t.id) return 'no id';
  if (typeof t.name !== 'string' || t.name.trim().length < 2 || t.name.length > 40) return 'bad name';
  if (typeof t.cat !== 'string' || !t.cat) return 'bad category';
  if (SHAPES.indexOf(t.shape) < 0) return 'bad shape';
  if (!fin(t.widthCm, t.heightCm) || t.widthCm < 5 || t.heightCm < 5 || t.widthCm > 300 || t.heightCm > 300) return 'bad size';
  if ((t.shape === 'circle' || t.shape === 'square') && t.widthCm !== t.heightCm) return 'circle/square must have equal sides';
  if (!okYarn(t.bg)) return 'bad background yarn';
  if (!Array.isArray(t.layers) || t.layers.length < 3 || t.layers.length > 200) return 'layer count out of range';
  const fonts = (L.FONTS || []).map(f => f[0]);
  for (let i = 0; i < t.layers.length; i++) {
    const l = t.layers[i], at = 'layer ' + (i + 1) + ': ';
    if (!l || TYPES.indexOf(l.type) < 0) return at + 'bad type';
    if (!fin(l.cx, l.cy, l.w, l.h, l.rot) || Math.abs(l.cx) > 2 || Math.abs(l.cy) > 2.5 || l.w <= 0 || l.h <= 0 || l.w > 3 || l.h > 3.5) return at + 'bad geometry';
    if (l.type !== 'pix' && !okYarn(l.fill)) return at + 'bad fill';
    if (l.stroke && !okYarn(l.stroke)) return at + 'bad stroke';
    if (l.sw != null && (!fin(l.sw) || l.sw < 0 || l.sw > .2)) return at + 'bad stroke width';
    if (l.type === 'text' && (typeof l.text !== 'string' || !l.text.trim() || fonts.indexOf(l.font) < 0)) return at + 'bad text';
    if (l.type === 'poly' && (!Array.isArray(l.pts) || l.pts.length < 3 || !l.pts.every(q => Array.isArray(q) && fin(q[0], q[1])))) return at + 'bad points';
    if (l.type === 'pix' && (!Array.isArray(l.rows) || !l.rows.length || !l.rows.every(r => typeof r === 'string') || !l.pal || !Object.values(l.pal).every(okYarn))) return at + 'bad pixel map';
    if (l.type === 'wave' && !fin(l.amp, l.freq, l.phase)) return at + 'bad wave';
  }
  return '';
}
L.validateTemplate = validate;
const known = new Set(L.TEMPLATES.map(t => t.id)), names = new Set(L.TEMPLATES.map(t => String(t.name).toLowerCase())), counters = {};
let added = 0;
defs.forEach(d => {
  const slug = SLUG[d.cat] || d.cat.toLowerCase().replace(/[^a-z0-9]+/g, '-'); counters[slug] = (counters[slug] || 0) + 1;
  const id = 'x-' + slug + '-' + String(counters[slug]).padStart(2, '0');
  if (known.has(id) || names.has(d.name.toLowerCase())) return;           // idempotent: already loaded
  try {
    const sz = d.size, S = scene(sz[0], sz[1]); d.build(S);
    const t = Object.assign({ id, cat: d.cat, name: d.name, shape: sz[2] || 'rect', widthCm: sz[0], heightCm: sz[1], bg: Y(d.bg) }, sz[3] != null ? { radius: sz[3] } : {}, d.o && d.o.borderCm ? { borderCm: d.o.borderCm, borderYarn: Y(d.o.borderYarn || K) } : {}, { layers: S.layers });
    const bad = validate(t); if (bad) { warn('skipped "' + d.name + '": ' + bad); return; }
    L.TEMPLATES.push(t); known.add(id); names.add(d.name.toLowerCase()); added++;
  } catch (e) { warn('skipped "' + d.name + '": ' + (e && e.message)); }
});
if (Array.isArray(L.CATEGORIES)) { L.TEMPLATES.forEach(t => { if (L.CATEGORIES.indexOf(t.cat) < 0) L.CATEGORIES.push(t.cat); }); }
L.EXTRA_TEMPLATES_ADDED = (L.EXTRA_TEMPLATES_ADDED || 0) + added;
})();
