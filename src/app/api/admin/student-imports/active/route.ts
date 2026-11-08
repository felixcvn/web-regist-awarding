import { NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/auth';
import { rateLimit, getClientIp, rateLimitResponse } from '@/lib/ratelimit';
import { getActiveStudentImportBatch } from '@/lib/db';
import { apiErrorResponse } from '@/lib/apiErrors';

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const limit = await rateLimit(`student-import:active:${ip}`, 30, 60_000);
  if (!limit.allowed) return rateLimitResponse(limit);

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
    return apiErrorResponse(err, 'Gagal mengambil informasi batch aktif.');
  }
}
