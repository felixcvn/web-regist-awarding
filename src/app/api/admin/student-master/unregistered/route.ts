import { NextResponse } from 'next/server';
import { getUnregisteredStudents } from '@/lib/db';
import { rateLimit, getClientIp, rateLimitResponse } from '@/lib/ratelimit';
import { verifyAdminAuth } from '@/lib/auth';
import { validateOrigin, forbiddenResponse } from '@/lib/csrf';

export async function GET(request: Request) {
  const ip = getClientIp(request);

  const limit = await rateLimit(`student-master:unregistered:${ip}`, 60, 60_000);
  if (!limit.allowed) return rateLimitResponse(limit);

  try {
    const isAuthed = await verifyAdminAuth();
    if (!isAuthed) {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 401 });
    }

    if (!validateOrigin(request)) {
      return forbiddenResponse();
    }

    const students = await getUnregisteredStudents();
    return NextResponse.json({ students });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Gagal mengambil data mahasiswa belum registrasi.' }, { status: 500 });
  }
}
