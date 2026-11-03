import { NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/auth';
import { rateLimit, getClientIp, tooManyResponse } from '@/lib/ratelimit';
import { getActiveStudentImportBatch } from '@/lib/db';

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const limit = rateLimit(`student-import:active:${ip}`, 30, 60_000);
  if (!limit.allowed) return tooManyResponse(limit.retryAfter);

  try {
    const isAuthed = await verifyAdminAuth();
    if (!isAuthed) {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 401 });
    }

    const batch = await getActiveStudentImportBatch();

    return NextResponse.json({
      active: !!batch,
      batchId: batch?.batchId || null,
      createdAt: batch?.createdAt || null,
      count: batch?.count || 0,
      canRollback: batch?.canRollback || false,
    });
  } catch (err) {
    console.error('[API] Student import active batch error:', err);
    return NextResponse.json(
      { error: `Gagal mengambil data: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
