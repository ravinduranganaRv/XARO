const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), crypto = require('crypto');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8'), data = fs.readFileSync(__dirname + '/../src/mod/data.js', 'utf8');
const csp = (html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1] || '';
const dir = name => ((csp.split(';').map(s => s.trim()).find(s => s.startsWith(name + ' ')) || '').split(/\s+/).slice(1));
test('CSP: every inline script is pinned by its SHA-256 and nothing else may run', () => {
  assert.ok(csp, 'a CSP meta tag exists');
  const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*application\/ld\+json)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  assert.ok(scripts.length >= 3);
  const pinned = dir('script-src'); scripts.forEach(s => assert.ok(pinned.includes("'sha256-" + crypto.createHash('sha256').update(s, 'utf8').digest('base64') + "'"), 'script hash missing from the policy'));
  assert.ok(!pinned.includes("'unsafe-inline'") && !pinned.includes("'unsafe-eval'") && !pinned.includes('*') && !pinned.some(x => /^https?:/.test(x)), 'script-src stays closed');
  assert.deepStrictEqual(dir('object-src'), ["'none'"]); assert.deepStrictEqual(dir('base-uri'), ["'self'"]);
  assert.ok(html.indexOf('Content-Security-Policy') < html.indexOf('<script'), 'the policy comes before the first script');
  assert.ok(html.indexOf('<meta charset') < html.indexOf('Content-Security-Policy'), 'charset stays inside the first 1024 bytes');
});
test('CSP: the page can only connect to the hosts it uses', () => {
  const c = dir('connect-src'); assert.ok(c.includes('https://mlrydpclqokizsqmigen.supabase.co') && c.includes('https://script.google.com')); assert.ok(!c.includes('*') && !c.includes('https:'));
  assert.ok(/<meta name="referrer" content="strict-origin-when-cross-origin">/.test(html));
  const hosts = new Set([...html.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)].map(m => m[1].toLowerCase()));
  const known = ['www.w3.org', 'fonts.googleapis.com', 'fonts.gstatic.com', 'mlrydpclqokizsqmigen.supabase.co', 'script.google.com', 'ravinduranganarv.github.io', 'wa.me', 'schema.org', 'github.com', 'api.whatsapp.com', 'xaro.example', 'script.googleusercontent.com'];
  hosts.forEach(h => assert.ok(known.includes(h) || /\.(w3|schema)\.org$/.test(h), 'unexpected external host in the page: ' + h));
});
test('customer details can only be sent to a Google Apps Script web app', () => {
  const syncOK = eval(data.match(/const syncOK = (.*);\n/)[1]);
  ['https://script.google.com/macros/s/AKfycbx_abc-123/exec', 'https://script.google.com/a/macros/xaro.lk/s/AKfy123/exec'].forEach(u => assert.ok(syncOK(u), u));
  ['http://script.google.com/macros/s/A/exec', 'https://evil.com/macros/s/A/exec', 'https://script.google.com.evil.com/macros/s/A/exec', 'https://script.google.com/macros/s/A/exec?x=1', 'javascript:alert(1)', '', null].forEach(u => assert.ok(!syncOK(u), String(u)));
});
test('no secrets are shipped: only the publishable key is present', () => {
  assert.ok(!/service_role|sk_live_|sk_test_[0-9A-Za-z]{10}|whsec_[0-9A-Za-z]{10}|sk-ant-/.test(html)); assert.ok(/sb_publishable_/.test(html));
  assert.ok(!/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/.test(html), 'no JWTs in the page');
});
