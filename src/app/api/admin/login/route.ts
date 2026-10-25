import { NextResponse } from 'next/server';
import { validatePin, createSession } from '@/lib/auth';
import { rateLimit, getClientIp, tooManyResponse } from '@/lib/ratelimit';
import { writeAuditLog, countRecentLoginFailures } from '@/lib/db';

const LOCK_WINDOW_MS = 15 * 60_000;
const LOCK_MAX_FAILURES = 12;

export async function POST(request: Request) {
  const ip = getClientIp(request);

  const limit = rateLimit(`login:${ip}`, 5, 60_000);
  if (!limit.allowed) {
    await writeAuditLog('login_rate_limited', ip);
    return tooManyResponse(limit.retryAfter);
  }

  // Per-IP lockout persisted in the audit log (independent of instance memory).
  const recentFailures = await countRecentLoginFailures(ip, LOCK_WINDOW_MS);
  if (recentFailures >= LOCK_MAX_FAILURES) {
    await writeAuditLog('login_locked', ip);
    return tooManyResponse(Math.ceil(LOCK_WINDOW_MS / 1000));
  }

  try {
    const { pin } = await request.json();

    if (!pin || typeof pin !== 'string' || !(await validatePin(pin))) {
      await writeAuditLog('login_failed', ip);
      return NextResponse.json({ error: 'PIN Panitia salah!' }, { status: 401 });
    }

    await createSession(ip, request.headers.get('user-agent') || '');
    await writeAuditLog('login_success', ip);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
