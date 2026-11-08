import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { rateLimit, getClientIp, rateLimitResponse } from '@/lib/ratelimit';
import { commitStudentImport } from '@/lib/db';
import { validateCsrf, validateOrigin } from '@/lib/csrf';
import { apiErrorResponse } from '@/lib/apiErrors';
import { readJsonBody } from '@/lib/requestBody';
import { studentImportCommitSchema } from '@/lib/validation';

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = await rateLimit(`student-import:commit:${ip}`, 5, 60_000);
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

    const parsed = studentImportCommitSchema.safeParse(await readJsonBody(request, 1024));
    if (!parsed.success) return NextResponse.json({ error: 'ID preview tidak valid. Silakan preview ulang.' }, { status: 400 });
    await commitStudentImport(parsed.data.batchId, session.tokenHash, ip);

    return NextResponse.json({ success: true });
  } catch (err) {
    return apiErrorResponse(err, 'Gagal menyimpan data mahasiswa. Silakan coba lagi.');
  }
}
