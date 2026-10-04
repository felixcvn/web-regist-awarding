import crypto from 'crypto';

export const CSRF_COOKIE = 'fan26_csrf';
export const CSRF_HEADER = 'x-csrf-token';

export function generateCsrfToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

// Double-submit check: header value must match the cookie value (constant-time).
export function validateCsrf(request: Request): boolean {
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${CSRF_COOKIE}=([^;]+)`));
  const cookieValue = match ? decodeURIComponent(match[1]) : '';
  const headerValue = request.headers.get(CSRF_HEADER) || '';
  if (!cookieValue || !headerValue) return false;

  const a = Buffer.from(cookieValue);
  const b = Buffer.from(headerValue);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// Verify the request Origin matches the host (defense against cross-site requests).
export function validateOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true; // same-origin fetches may omit Origin; CSRF token still required
  try {
    const originHost = new URL(origin).host;
    const host = request.headers.get('host');
    return !!host && originHost === host;
  } catch {
    return false;
  }
}

export function forbiddenResponse(): Response {
  return new Response(JSON.stringify({ error: 'Permintaan ditolak (CSRF).' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });
}
