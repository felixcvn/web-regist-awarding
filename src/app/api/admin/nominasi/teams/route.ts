import { NextResponse } from 'next/server';
import {
  getNominasiTeams,
  createNominasiTeam,
} from '@/lib/db';
import { rateLimit, getClientIp, rateLimitResponse } from '@/lib/ratelimit';
import { verifyAdminAuth } from '@/lib/auth';
import { validateCsrf, validateOrigin, forbiddenResponse } from '@/lib/csrf';
import { nominasiTeamSchema } from '@/lib/validation';
import { readJsonBody } from '@/lib/requestBody';
import { apiErrorResponse } from '@/lib/apiErrors';
import { writeAuditLog } from '@/lib/db';

export async function GET(request: Request) {
  const ip = getClientIp(request);

  const limit = await rateLimit(`nominasi:teams:${ip}`, 60, 60_000);
  if (!limit.allowed) return rateLimitResponse(limit);

  try {
    const isAuthed = await verifyAdminAuth();
    if (!isAuthed) {
      return NextResponse.json({ error: 'Akses ditolak. Silakan login PIN panitia.' }, { status: 401 });
    }

    if (!validateOrigin(request) || !validateCsrf(request)) {
      return forbiddenResponse();
    }

    const teams = await getNominasiTeams();
    return NextResponse.json({ teams });
  } catch (error) {
    return apiErrorResponse(error, 'Gagal mengambil daftar tim nominasi.');
  }
}

export async function POST(request: Request) {
  const ip = getClientIp(request);

  const limit = await rateLimit(`nominasi:create:${ip}`, 30, 60_000);
  if (!limit.allowed) return rateLimitResponse(limit);

  try {
    const isAuthed = await verifyAdminAuth();
    if (!isAuthed) {
      return NextResponse.json({ error: 'Akses ditolak. Silakan login PIN panitia.' }, { status: 401 });
    }

    if (!validateOrigin(request) || !validateCsrf(request)) {
      return forbiddenResponse();
    }

    const parsed = nominasiTeamSchema.safeParse(await readJsonBody(request, 4096));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Data tim tidak valid.' }, { status: 400 });
    }

    const team = await createNominasiTeam(parsed.data);
    await writeAuditLog('nominasi_team_created', ip, team.id, team.namaTeam);

    return NextResponse.json({ team }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, 'Gagal membuat tim nominasi.');
  }
}
