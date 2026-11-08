import { NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/auth';
import { rateLimit, getClientIp, rateLimitResponse } from '@/lib/ratelimit';
import { rollbackToPreviousBatch } from '@/lib/db';
import { validateCsrf, validateOrigin } from '@/lib/csrf';
import { apiErrorResponse } from '@/lib/apiErrors';

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = await rateLimit(`student-import:rollback:${ip}`, 3, 60_000);
  if (!limit.allowed) return rateLimitResponse(limit);

  try {
    const isAuthed = await verifyAdminAuth();
    if (!isAuthed) {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 401 });
    }

    const csrfValid = validateOrigin(request) && validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Permintaan ditolak (CSRF).' }, { status: 403 });
    }

    const result = await rollbackToPreviousBatch();

    return NextResponse.json({
      success: true,
      previousBatchId: result.batchId,
      count: result.count,
    });
  } catch (err) {
    return apiErrorResponse(err, 'Gagal memulihkan batch sebelumnya. Silakan coba lagi.');
  }
}
