// Pure logic for send-quotation (no Deno APIs, unit tested in Node): validation, the professional HTML email, and the Resend request.
export const MAX_PDF_BYTES = 4 * 1024 * 1024;
const EMAIL = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export class MailError extends Error { constructor(msg, status = 400, code = 'bad_request') { super(msg); this.status = status; this.code = code; } }

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const cleanLine = (s, n = 200) => String(s ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, n);   // headers/subjects: no line breaks, ever

/** body: { quotationId, pdfBase64, message? } -> validated values */
export function validateBody(b) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) throw new MailError('Send a JSON object.');
  if (!UUID.test(String(b.quotationId || ''))) throw new MailError('Unknown quotation.', 400, 'bad_quotation');
  const pdf = String(b.pdfBase64 || ''); if (!/^[A-Za-z0-9+/]+={0,2}$/.test(pdf) || pdf.length < 100) throw new MailError('The quotation PDF is missing.', 400, 'bad_pdf');
  if (Math.floor(pdf.length * 3 / 4) > MAX_PDF_BYTES) throw new MailError('The quotation PDF is too large to email.', 413, 'pdf_too_large');
  return { quotationId: String(b.quotationId), pdfBase64: pdf, message: cleanLine(b.message ?? '', 600) };
}

/** sender: the verified address configured by the owner (secret QUOTE_FROM_EMAIL). Returns the Resend payload. */
export function buildEmail({ business, customer, quote, totalText, message, pdfBase64, fromEmail }) {
  if (!EMAIL.test(String(customer?.email || ''))) throw new MailError('This customer has no valid email address.', 422, 'no_customer_email');
  const biz = cleanLine(business?.name || 'Our team', 80), cust = cleanLine(customer?.name || 'Customer', 80), ref = cleanLine(quote?.ref || '', 40);
  const reply = EMAIL.test(String(business?.email || '')) ? String(business.email) : undefined, contact = [business?.phone, business?.email].filter(Boolean).map(x => esc(cleanLine(x, 80))).join(' &nbsp;|&nbsp; ');
  const valid = quote?.valid_until ? `<p style="margin:0 0 14px">This quotation is valid until <b>${esc(cleanLine(quote.valid_until, 30))}</b>.</p>` : '';
  const note = message ? `<p style="margin:0 0 14px">${esc(message)}</p>` : '';
  const html = `<!doctype html><html><body style="margin:0;background:#f3f5f3;font-family:Arial,Helvetica,sans-serif;color:#1a1f1a"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:10px;overflow:hidden">
<tr><td style="background:#111;color:#fff;padding:22px 28px;font-size:20px;font-weight:bold;letter-spacing:.5px">${esc(biz)}</td></tr><tr><td style="padding:28px;font-size:15px;line-height:1.55">
<p style="margin:0 0 14px">Dear ${esc(cust)},</p><p style="margin:0 0 14px">Thank you for choosing ${esc(biz)}. Your quotation <b>${esc(ref)}</b> is attached to this email as a PDF.</p>
${totalText ? `<p style="margin:0 0 14px;padding:12px 16px;background:#eef8e8;border-left:4px solid #6bd000">Quotation total: <b>${esc(cleanLine(totalText, 60))}</b></p>` : ''}${valid}${note}
<p style="margin:0 0 14px">If anything needs changing, or you are happy to go ahead, simply reply to this email.</p><p style="margin:0">Kind regards,<br><b>${esc(biz)}</b></p></td></tr>
<tr><td style="background:#f3f5f3;padding:14px 28px;font-size:12px;color:#5c665c">${contact}</td></tr></table></td></tr></table></body></html>`;
  const text = `Dear ${cust},\n\nThank you for choosing ${biz}. Your quotation ${ref} is attached as a PDF.\n${totalText ? 'Total: ' + cleanLine(totalText, 60) + '\n' : ''}${quote?.valid_until ? 'Valid until ' + cleanLine(quote.valid_until, 30) + '\n' : ''}${message ? '\n' + message + '\n' : ''}\nIf anything needs changing, or you are happy to go ahead, simply reply to this email.\n\nKind regards,\n${biz}\n`;
  if (!EMAIL.test(String(fromEmail || ''))) throw new MailError('Email sending is not set up yet.', 503, 'not_configured');
  return { from: `${biz.replace(/[<>"]/g, '')} <${fromEmail}>`, to: [customer.email], ...(reply ? { reply_to: reply } : {}), subject: `Quotation ${ref} from ${biz}`, html, text, attachments: [{ filename: `Quotation-${ref.replace(/[^A-Za-z0-9_-]/g, '') || 'quote'}.pdf`, content: pdfBase64 }] };
}

/** POST to Resend. `fetchImpl` is injectable for tests. */
export async function sendViaResend(apiKey, payload, fetchImpl = fetch) {
  if (!/^re_[A-Za-z0-9_]{10,}$/.test(String(apiKey || ''))) throw new MailError('Email sending is not set up yet.', 503, 'not_configured');
  const r = await fetchImpl('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new MailError(r.status === 403 || r.status === 422 ? 'The email service refused this message: ' + cleanLine(j.message || 'check the sender domain', 160) : 'The email service is not available right now.', 502, 'provider_error');
  return { id: j.id || null };
}
