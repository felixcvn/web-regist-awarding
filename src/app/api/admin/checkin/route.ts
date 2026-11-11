import { NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/auth';
import { checkInParticipant, checkInNominasiTeam } from '@/lib/db';
import { rateLimit, getClientIp, rateLimitResponse } from '@/lib/ratelimit';
import { writeAuditLog } from '@/lib/db';
import { validateCsrf, validateOrigin, forbiddenResponse } from '@/lib/csrf';
import { checkinSchema } from '@/lib/validation';
import { readJsonBody } from '@/lib/requestBody';
import { apiErrorResponse } from '@/lib/apiErrors';

export async function POST(request: Request) {
  const ip = getClientIp(request);

  const limit = await rateLimit(`checkin:${ip}`, 120, 60_000);
  if (!limit.allowed) return rateLimitResponse(limit);

  try {
    const isAuthed = await verifyAdminAuth();
    if (!isAuthed) {
      return NextResponse.json({ error: 'Akses ditolak. Silakan login PIN panitia.' }, { status: 401 });
    }

    if (!validateOrigin(request) || !validateCsrf(request)) {
      return forbiddenResponse();
    }

    const parsed = checkinSchema.safeParse(await readJsonBody(request, 1024));
    if (!parsed.success) {
      return NextResponse.json({ error: 'QR Code / Token tidak valid!' }, { status: 400 });
    }

    const token = parsed.data.qrToken.trim();

    // One door scanner serves both tickets and nominasi teams. Team tokens carry
    // the FAN26-NOM- prefix and are absent from participants.
    if (token.startsWith('FAN26-NOM-')) {
      const team = await checkInNominasiTeam(token);
      if (team.success && team.team) {
        await writeAuditLog('nominasi_team_checkin', ip, team.team.id, team.team.namaTeam);
      }
      return NextResponse.json({
        success: team.success,
        message: team.message,
        participant: team.team ? {
          name: team.team.namaTeam,
          nimNip: team.team.members.map((m) => m.nimNip).join(', '),
          role: 'Tim Nominasi',
          prodi: `${team.team.members.length} anggota`,
        } : undefined,
      });
    }

    const result = await checkInParticipant(token);
    if (result.success && result.participant) {
      await writeAuditLog('checkin', ip, result.participant.id);
    }
    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error, 'Gagal memproses check-in.');
  }
}
