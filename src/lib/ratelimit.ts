// In-memory sliding-window rate limiter. Sufficient for a single-instance
// self-hosted deployment (~700 participants). Swap the Map for Redis if you
// ever run multiple instances behind a load balancer.
type Entry = number[];

const buckets = new Map<string, Entry>();
let lastSweep = Date.now();

const MAX_KEYS = 10_000;

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, times] of buckets) {
    const live = times.filter((t) => now - t < 10 * 60_000);
    if (live.length === 0) buckets.delete(key);
    else buckets.set(key, live);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfter: number; // seconds
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  if (buckets.size > MAX_KEYS) buckets.clear();

  const times = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (times.length >= limit) {
    const retryAfter = Math.ceil((windowMs - (now - times[0])) / 1000);
    buckets.set(key, times);
    return { allowed: false, retryAfter: Math.max(retryAfter, 1) };
  }

  times.push(now);
  buckets.set(key, times);
  return { allowed: true, retryAfter: 0 };
}

export function getClientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const real = request.headers.get('x-real-ip');
  if (real) return real.trim();
  return 'unknown';
}

export function tooManyResponse(retryAfter: number): Response {
  return new Response(JSON.stringify({ error: 'Terlalu banyak permintaan. Silakan coba lagi nanti.' }), {
    status: 429,
    headers: { 'Content-Type': 'application/json', 'Retry-After': String(retryAfter) },
  });
}
