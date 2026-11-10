// MOCK tests for send-quotation logic. Nothing here talks to Resend or Supabase.
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBody, buildEmail, sendViaResend, MailError, cleanLine, MAX_PDF_BYTES } from '../supabase/functions/_shared/quote_mail.mjs';
const id = '3f2b8c1e-1a2b-4c3d-8e9f-0a1b2c3d4e5f', pdf = Buffer.from('%PDF-1.4 ' + 'x'.repeat(200)).toString('base64');
const base = { business: { name: 'XARO Industries', email: 'hello@xaro.test', phone: '+94 78 483 0704' }, customer: { name: 'Ann <b>Perera</b>', email: 'ann@example.com' }, quote: { ref: 'Q-2026-0001', valid_until: '2026-11-25' }, totalText: 'LKR 12,946.50', message: 'See you soon', pdfBase64: pdf, fromEmail: 'quotes@xaro.test' };
test('validateBody accepts a good body and rejects bad ids, pdf and size', () => {
  assert.equal(validateBody({ quotationId: id, pdfBase64: pdf }).quotationId, id);
  for (const b of [null, [], {}, { quotationId: 'x', pdfBase64: pdf }, { quotationId: id, pdfBase64: 'not base64!' }, { quotationId: id, pdfBase64: '' }]) assert.throws(() => validateBody(b), MailError);
  assert.throws(() => validateBody({ quotationId: id, pdfBase64: 'A'.repeat(Math.ceil(MAX_PDF_BYTES * 4 / 3) + 8) }), e => e.status === 413); });
test('buildEmail: customer is the only recipient, reply goes to the business, PDF attached, HTML escaped', () => {
  const m = buildEmail(base); assert.deepEqual(m.to, ['ann@example.com']); assert.equal(m.reply_to, 'hello@xaro.test'); assert.equal(m.subject, 'Quotation Q-2026-0001 from XARO Industries'); assert.equal(m.attachments[0].filename, 'Quotation-Q-2026-0001.pdf'); assert.equal(m.attachments[0].content, pdf);
  assert.ok(m.from.includes('<quotes@xaro.test>')); assert.ok(m.html.includes('LKR 12,946.50') && m.html.includes('25')); assert.ok(!m.html.includes('<b>Perera</b>') && m.html.includes('&lt;b&gt;Perera')); assert.ok(m.text.includes('Q-2026-0001')); });
test('buildEmail: no valid customer email or no sender configured is a clear error; header injection is stripped', () => {
  assert.throws(() => buildEmail({ ...base, customer: { name: 'A', email: 'nope' } }), e => e.code === 'no_customer_email');
  assert.throws(() => buildEmail({ ...base, fromEmail: '' }), e => e.code === 'not_configured');
  const m = buildEmail({ ...base, business: { name: 'Evil\r\nBcc: x@y.z', email: 'bad' } }); assert.ok(!/[\r\n]/.test(m.subject) && !/[\r\n]/.test(m.from) && m.reply_to === undefined);
  assert.equal(cleanLine('a\r\nb'), 'a  b'); });
test('sendViaResend: key check, success and provider errors never leak the key', async () => {
  await assert.rejects(() => sendViaResend('', {}), e => e.code === 'not_configured');
  let seen; const ok = async (u, o) => { seen = { u, o }; return { ok: true, json: async () => ({ id: 'em_1' }) }; };
  assert.deepEqual(await sendViaResend('re_abcdefghijk12345', { a: 1 }, ok), { id: 'em_1' }); assert.equal(seen.u, 'https://api.resend.com/emails'); assert.equal(seen.o.headers.Authorization, 'Bearer re_abcdefghijk12345');
  const bad = async () => ({ ok: false, status: 403, json: async () => ({ message: 'domain not verified' }) }); await assert.rejects(() => sendViaResend('re_abcdefghijk12345', {}, bad), e => e.status === 502 && /domain not verified/.test(e.message) && !/re_abc/.test(e.message)); });
