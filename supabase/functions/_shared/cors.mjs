// Pure CORS logic (no Deno APIs) so it can be unit tested in Node. Used by every function through the handlers.
// The allow-list comes from ALLOWED_ORIGINS (comma separated origins). It is never "*": these functions take personal data.

export const DEFAULT_ORIGIN = 'https://ravinduranganarv.github.io';

/** Normalise one origin string: scheme + host (+ port) only, lower-case, no trailing slash, no path. Returns '' if invalid. */
export function normaliseOrigin(value) {
  const s = String(value ?? '').trim();
  if (!s || s === '*' || s === 'null') return '';
  try {
    const u = new URL(s);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return '';
    // http is only acceptable for local development
    if (u.protocol === 'http:' && !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(u.hostname)) return '';
    return u.origin;
  } catch {
    return '';
  }
}

/** ALLOWED_ORIGINS -> array of valid origins. Empty / missing / all-invalid falls back to the GitHub Pages site. */
export function parseAllowedOrigins(raw) {
  const list = String(raw ?? '').split(',').map(normaliseOrigin).filter(Boolean);
  const uniq = [...new Set(list)];
  return uniq.length ? uniq : [DEFAULT_ORIGIN];
}

/** True only for an exact (case-insensitive) match of an allowed origin. */
export function isOriginAllowed(origin, allowed) {
  if (!origin) return false;
  const o = normaliseOrigin(origin);
  return !!o && allowed.includes(o);
}

/** Response headers for a request from `origin`. A disallowed origin gets NO Access-Control-Allow-Origin (the browser then blocks it). */
export function corsHeaders(origin, allowed) {
  const h = {
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '600',
    'Vary': 'Origin',
  };
  if (isOriginAllowed(origin, allowed)) h['Access-Control-Allow-Origin'] = normaliseOrigin(origin);
  return h;
}

/** Answer an OPTIONS preflight: 204 with CORS headers for an allowed origin, 403 for anything else. */
export function preflightResponse(origin, allowed) {
  if (!isOriginAllowed(origin, allowed)) return new Response(null, { status: 403, headers: corsHeaders(origin, allowed) });
  return new Response(null, { status: 204, headers: corsHeaders(origin, allowed) });
}

/** Return a copy of `res` with CORS headers added. */
export function withCors(res, origin, allowed) {
  const h = new Headers(res.headers);
  for (const [k, v] of Object.entries(corsHeaders(origin, allowed))) h.set(k, v);
  return new Response(res.body, { status: res.status, headers: h });
}
