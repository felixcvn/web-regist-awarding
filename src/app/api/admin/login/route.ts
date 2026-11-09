import { NextResponse } from 'next/server';
import { validatePin, createSession } from '@/lib/auth';
import { rateLimit, getClientIp, rateLimitResponse, tooManyResponse } from '@/lib/ratelimit';
import { writeAuditLog, countRecentLoginFailures } from '@/lib/db';
import { loginSchema } from '@/lib/validation';
import { readJsonBody } from '@/lib/requestBody';
import { apiErrorResponse } from '@/lib/apiErrors';

const LOCK_WINDOW_MS = 15 * 60_000;
const LOCK_MAX_FAILURES = 12;

export async function POST(request: Request) {
  const ip = getClientIp(request);

  const limit = await rateLimit(`login:${ip}`, 5, 60_000);
  if (!limit.allowed) {
    if (!limit.unavailable) await writeAuditLog('login_rate_limited', ip);
    return rateLimitResponse(limit);
  }

  try {
    // A failed lockout query must fail closed, even if the limiter just worked.
    const recentFailures = await countRecentLoginFailures(ip, LOCK_WINDOW_MS);
    if (recentFailures >= LOCK_MAX_FAILURES) {
      await writeAuditLog('login_locked', ip);
      return tooManyResponse(Math.ceil(LOCK_WINDOW_MS / 1000));
    }

    const parsed = loginSchema.safeParse(await readJsonBody(request, 1024));
    if (!parsed.success) return NextResponse.json({ error: 'Format PIN tidak valid.' }, { status: 400 });
    if (!(await validatePin(parsed.data.pin))) {
      await writeAuditLog('login_failed', ip);
      return NextResponse.json({ error: 'PIN Panitia salah!' }, { status: 401 });
    }

    await createSession(ip, request.headers.get('user-agent') || '');
    await writeAuditLog('login_success', ip);

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error, 'Gagal memproses login. Silakan coba lagi.');
  }
}
