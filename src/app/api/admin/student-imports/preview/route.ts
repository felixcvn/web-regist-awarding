import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { rateLimit, getClientIp, rateLimitResponse } from '@/lib/ratelimit';
import { previewStudentImport, type StudentImportResult } from '@/lib/db';
import { validateCsrf, validateOrigin } from '@/lib/csrf';
import { apiErrorResponse } from '@/lib/apiErrors';
import { readImportForm } from '@/lib/requestBody';
import { studentFilesFromForm } from '@/lib/studentImportFiles';

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = await rateLimit(`student-import:preview:${ip}`, 10, 60_000);
  if (!limit.allowed) return rateLimitResponse(limit);

  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 401 });
    }

    const csrfValid = validateOrigin(request) && validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Permintaan ditolak (CSRF).' }, { status: 403 });
    }

    const files = studentFilesFromForm(await readImportForm(request));
    const result: StudentImportResult = await previewStudentImport(files, session.tokenHash);

    return NextResponse.json(result);
  } catch (err) {
    return apiErrorResponse(err, 'Gagal memproses file Excel. Silakan coba lagi.');
  }
}
