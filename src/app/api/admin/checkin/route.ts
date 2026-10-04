import { NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/auth';
import { checkInParticipant } from '@/lib/db';
import { rateLimit, getClientIp, tooManyResponse } from '@/lib/ratelimit';
import { writeAuditLog } from '@/lib/db';
import { validateCsrf, validateOrigin, forbiddenResponse } from '@/lib/csrf';

export async function POST(request: Request) {
  const ip = getClientIp(request);

  const limit = rateLimit(`checkin:${ip}`, 120, 60_000);
  if (!limit.allowed) return tooManyResponse(limit.retryAfter);

  try {
    const isAuthed = await verifyAdminAuth();
    if (!isAuthed) {
      return NextResponse.json({ error: 'Akses ditolak. Silakan login PIN panitia.' }, { status: 401 });
    }

    if (!validateOrigin(request) || !validateCsrf(request)) {
      return forbiddenResponse();
    }

    const { qrToken } = await request.json();

    if (!qrToken || typeof qrToken !== 'string') {
      return NextResponse.json({ error: 'QR Code / Token tidak boleh kosong!' }, { status: 400 });
    }

    const result = await checkInParticipant(qrToken.trim());
    if (result.success && result.participant) {
      await writeAuditLog('checkin', ip, result.participant.id);
    }
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Gagal memproses check-in' }, { status: 500 });
  }
}
