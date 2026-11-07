// Soft, per-instance sliding-window limiter. It lives in the memory of ONE edge-function isolate, so it is only a speed bump:
// a determined attacker is spread across instances. Real throttling is the platform's job; this just stops a single tab looping.
// (A hard limiter would need a table, which would be a database migration: not added.)
export function createLimiter({ windowMs, max, maxKeys = 5000 }) {
  const hits = new Map();
  return function hit(key, now = Date.now()) {
    const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (recent.length >= max) { hits.set(key, recent); return false; }
    recent.push(now);
    hits.delete(key); hits.set(key, recent); // keep Map insertion order = recency
    if (hits.size > maxKeys) { const first = hits.keys().next().value; hits.delete(first); }
    return true;
  };
}
