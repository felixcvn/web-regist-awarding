import { NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/auth';
import { rateLimit, getClientIp, tooManyResponse } from '@/lib/ratelimit';
import { rollbackToPreviousBatch } from '@/lib/db';
import { validateCsrf } from '@/lib/csrf';

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = rateLimit(`student-import:rollback:${ip}`, 3, 60_000);
  if (!limit.allowed) return tooManyResponse(limit.retryAfter);

  try {
    const isAuthed = await verifyAdminAuth();
    if (!isAuthed) {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 401 });
    }

    const csrfValid = validateCsrf(request);
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
    console.error('[API] Student import rollback error:', err);
    return NextResponse.json(
      { error: `Gagal melakukan rollback: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
