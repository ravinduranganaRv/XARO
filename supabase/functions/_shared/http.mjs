// Small response helpers shared by all functions (no Deno APIs).
import { corsHeaders } from './cors.mjs';

/** JSON response with CORS headers for the caller's origin. */
export function json(body, status, origin, allowed, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...corsHeaders(origin, allowed), ...extraHeaders },
  });
}

/** Read a request body as text with a hard byte cap. Throws {status:413} if larger. Never buffers more than max+1 bytes' worth of chunks. */
export async function readTextCapped(req, maxBytes) {
  const declared = Number(req.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) throw Object.assign(new Error('payload too large'), { status: 413 });
  if (!req.body) return '';
  const reader = req.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) { try { await reader.cancel(); } catch { /* ignore */ } throw Object.assign(new Error('payload too large'), { status: 413 }); }
    chunks.push(value);
  }
  const buf = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { buf.set(c, off); off += c.byteLength; }
  return new TextDecoder('utf-8').decode(buf);
}

/** Best-effort client IP behind Supabase's proxy (used only for the soft in-memory rate limit). */
export function clientIp(req) {
  const xf = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || '';
  return xf.split(',')[0].trim().slice(0, 64) || 'unknown';
}
