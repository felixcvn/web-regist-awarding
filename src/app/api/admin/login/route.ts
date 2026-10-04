import { NextResponse } from 'next/server';
import { validatePin, createSession } from '@/lib/auth';
import { rateLimit, getClientIp, tooManyResponse } from '@/lib/ratelimit';
import { writeAuditLog } from '@/lib/db';

export async function POST(request: Request) {
  const ip = getClientIp(request);

  const limit = rateLimit(`login:${ip}`, 5, 60_000);
  if (!limit.allowed) {
    await writeAuditLog('login_rate_limited', ip);
    return tooManyResponse(limit.retryAfter);
  }

  try {
    const { pin } = await request.json();

    if (!pin || typeof pin !== 'string' || !validatePin(pin)) {
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
