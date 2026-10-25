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

  if (buckets.size > MAX_KEYS) {
    // Evict the oldest entries instead of clearing everything: a flood of unique
    // keys (e.g. spoofed IPs) must not reset every active rate limit.
    const overflow = Math.max(1, Math.floor(MAX_KEYS * 0.1));
    let removed = 0;
    for (const key of buckets.keys()) {
      buckets.delete(key);
      if (++removed >= overflow) break;
    }
  }

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
  // Platform-injected headers cannot be spoofed by the client on Vercel /
  // Cloudflare and must be preferred over the user-controlled X-Forwarded-For.
  const platformIp =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    request.headers.get('x-vercel-forwarded-for');
  if (platformIp) return platformIp.split(',')[0].trim();

  // Fallback for self-hosted proxies: the right-most entry is appended by the
  // nearest trusted proxy, so it is the safest value in the chain.
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const chain = xff.split(',').map((part) => part.trim()).filter(Boolean);
    if (chain.length > 0) return chain[chain.length - 1];
  }

  return 'unknown';
}

export function tooManyResponse(retryAfter: number): Response {
  return new Response(JSON.stringify({ error: 'Terlalu banyak permintaan. Silakan coba lagi nanti.' }), {
    status: 429,
    headers: { 'Content-Type': 'application/json', 'Retry-After': String(retryAfter) },
  });
}
