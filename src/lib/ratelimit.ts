import { isIP } from 'node:net';
import { consumeRateLimit } from './db';

type Entry = { times: number[]; expiresAt: number };
const buckets = new Map<string, Entry>();
const MAX_KEYS = 10_000;
let lastSweep = 0;

export interface RateLimitResult {
  allowed: boolean;
  retryAfter: number; // seconds
  unavailable?: boolean;
}

function memoryRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  if (now - lastSweep >= 60_000) {
    lastSweep = now;
    for (const [bucketKey, entry] of buckets) if (entry.expiresAt <= now) buckets.delete(bucketKey);
  }
  // Keep existing limits intact under a flood of distinct keys (development only).
  if (!buckets.has(key) && buckets.size >= MAX_KEYS) {
    return { allowed: false, retryAfter: 60 };
  }

  const times = (buckets.get(key)?.times || []).filter((time) => now - time < windowMs);
  if (times.length >= limit) {
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((times[0] + windowMs - now) / 1000)) };
  }
  times.push(now);
  buckets.set(key, { times, expiresAt: now + windowMs });
  return { allowed: true, retryAfter: 0 };
}

export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const stored = await consumeRateLimit(key, limit, windowMs);
  if (stored) return stored;
  if (process.env.NODE_ENV === 'production') {
    return { allowed: false, retryAfter: 60, unavailable: true };
  }
  return memoryRateLimit(key, limit, windowMs);
}

export function getClientIp(request: Request): string {
  // Trust only the ingress selected by server configuration. Self-hosted ingress
  // must overwrite its selected header and prevent clients reaching the origin.
  const proxy = process.env.TRUSTED_PROXY || (process.env.VERCEL === '1' ? 'vercel' : 'none');
  let ip = '';
  if (proxy === 'vercel') ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  if (proxy === 'cloudflare') ip = (request.headers.get('cf-connecting-ip') || '').trim();
  if (proxy === 'reverse-proxy') ip = (request.headers.get('x-real-ip') || '').trim();
  if (!isIP(ip)) return 'unknown';
  if (ip.toLowerCase().startsWith('::ffff:') && isIP(ip.slice(7)) === 4) return ip.slice(7);
  if (isIP(ip) === 6) {
    try { return new URL(`http://[${ip}]`).hostname.slice(1, -1); }
    catch { return 'unknown'; }
  }
  return ip.toLowerCase();
}

export function tooManyResponse(retryAfter: number): Response {
  return new Response(JSON.stringify({ error: 'Terlalu banyak permintaan. Silakan coba lagi nanti.' }), {
    status: 429,
    headers: { 'Content-Type': 'application/json', 'Retry-After': String(retryAfter), 'Cache-Control': 'private, no-store' },
  });
}

export function rateLimitResponse(result: RateLimitResult): Response {
  if (!result.unavailable) return tooManyResponse(result.retryAfter);
  return Response.json({ error: 'Layanan sedang tidak tersedia. Silakan coba lagi.' }, {
    status: 503,
    headers: { 'Retry-After': String(result.retryAfter), 'Cache-Control': 'private, no-store' },
  });
}
