import { NextResponse } from 'next/server';
import { searchStudentMaster } from '@/lib/db';
import { rateLimit, getClientIp, rateLimitResponse } from '@/lib/ratelimit';
import { verifyAdminAuth } from '@/lib/auth';
import { validateCsrf, validateOrigin, forbiddenResponse } from '@/lib/csrf';

export async function GET(request: Request) {
  const ip = getClientIp(request);

  const limit = await rateLimit(`student-master:search:${ip}`, 60, 60_000);
  if (!limit.allowed) return rateLimitResponse(limit);

  try {
    const isAuthed = await verifyAdminAuth();
    if (!isAuthed) {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 401 });
    }

    if (!validateOrigin(request) || !validateCsrf(request)) {
      return forbiddenResponse();
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const l = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10), 1), 50);

    if (!q.trim()) {
      return NextResponse.json({ results: [] });
    }

    const results = await searchStudentMaster(q, l);
    return NextResponse.json({ results });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Gagal mencari data mahasiswa.' }, { status: 500 });
  }
}
