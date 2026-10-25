import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { generateCsrfToken, CSRF_COOKIE } from '@/lib/csrf';

const SESSION_COOKIE = 'fan26_session';

function buildCsp(): string {
  const isProd = process.env.NODE_ENV === 'production';
  const turnstile =
    !!process.env.TURNSTILE_SECRET_KEY || !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const cloudflare = turnstile ? ' https://challenges.cloudflare.com' : '';

  return [
    "default-src 'self'",
    "img-src 'self' data: blob:",
    // Next.js injects inline bootstrap scripts; nonce-based CSP is the next step.
    `script-src 'self' 'unsafe-inline'${isProd ? '' : " 'unsafe-eval'"}${cloudflare}`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data: https://fonts.gstatic.com",
    `connect-src 'self'${cloudflare}`,
    `frame-src ${turnstile ? 'https://challenges.cloudflare.com' : "'none'"}`,
    "object-src 'none'",
    "worker-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    'upgrade-insecure-requests',
  ].join('; ');
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdminRoute = pathname.startsWith('/admin');
  const isAdminLogin = pathname.startsWith('/admin/login');
  const isSensitivePage = isAdminRoute || pathname.startsWith('/ticket');

  let response = NextResponse.next();

  // Defense in depth: never render admin UI without a session cookie. The real
  // authority remains verifyAdminAuth() in every admin API route.
  if (isAdminRoute && !isAdminLogin && !request.cookies.get(SESSION_COOKIE)) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin/login';
    url.search = '';
    response = NextResponse.redirect(url);
  }

  // Security headers (defense-in-depth).
  response.headers.set('Content-Security-Policy', buildCsp());
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  response.headers.set('X-DNS-Prefetch-Control', 'off');
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');

  // Keep admin and ticket pages (bearer links) out of search indexes.
  if (isSensitivePage) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }

  // Issue a CSRF token cookie for admin pages if missing (readable by JS for double-submit).
  if (isAdminRoute && !request.cookies.get(CSRF_COOKIE)) {
    response.cookies.set(CSRF_COOKIE, generateCsrfToken(), {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 8,
    });
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)).*)'],
};
