import { NextResponse } from 'next/server';
import { checkInNominasiTeam } from '@/lib/db';
import { rateLimit, getClientIp, rateLimitResponse } from '@/lib/ratelimit';
import { verifyAdminAuth } from '@/lib/auth';
import { validateCsrf, validateOrigin, forbiddenResponse } from '@/lib/csrf';
import { nominasiCheckinSchema } from '@/lib/validation';
import { readJsonBody } from '@/lib/requestBody';
import { apiErrorResponse } from '@/lib/apiErrors';
import { writeAuditLog } from '@/lib/db';

export async function POST(request: Request) {
  const ip = getClientIp(request);

  const limit = await rateLimit(`nominasi:checkin:${ip}`, 120, 60_000);
  if (!limit.allowed) return rateLimitResponse(limit);

  try {
    const isAuthed = await verifyAdminAuth();
    if (!isAuthed) {
      return NextResponse.json({ error: 'Akses ditolak. Silakan login PIN panitia.' }, { status: 401 });
    }

    if (!validateOrigin(request) || !validateCsrf(request)) {
      return forbiddenResponse();
    }

    const parsed = nominasiCheckinSchema.safeParse(await readJsonBody(request, 1024));
    if (!parsed.success) {
      return NextResponse.json({ error: 'QR Code / Token tidak valid!' }, { status: 400 });
    }

    const result = await checkInNominasiTeam(parsed.data.qrToken);
    if (result.success && result.team) {
      await writeAuditLog('nominasi_team_checkin', ip, result.team.id, result.team.namaTeam);
    }

    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error, 'Gagal memproses check-in tim nominasi.');
  }
}
