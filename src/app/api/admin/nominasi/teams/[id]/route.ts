import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  getNominasiTeamById,
  updateNominasiTeam,
  deleteNominasiTeam,
} from '@/lib/db';
import { rateLimit, getClientIp, rateLimitResponse } from '@/lib/ratelimit';
import { verifyAdminAuth } from '@/lib/auth';
import { validateCsrf, validateOrigin, forbiddenResponse } from '@/lib/csrf';
import { nominasiTeamUpdateSchema } from '@/lib/validation';
import { readJsonBody } from '@/lib/requestBody';
import { apiErrorResponse } from '@/lib/apiErrors';
import { writeAuditLog } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = getClientIp(request);

  const limit = await rateLimit(`nominasi:team:${ip}`, 60, 60_000);
  if (!limit.allowed) return rateLimitResponse(limit);

  try {
    const isAuthed = await verifyAdminAuth();
    if (!isAuthed) {
      return NextResponse.json({ error: 'Akses ditolak. Silakan login PIN panitia.' }, { status: 401 });
    }

    if (!validateOrigin(request)) {
      return forbiddenResponse();
    }

    const { id } = await params;
    const team = await getNominasiTeamById(id);
    if (!team) {
      return NextResponse.json({ error: 'Tim nominasi tidak ditemukan.' }, { status: 404 });
    }

    return NextResponse.json({ team });
  } catch (error) {
    return apiErrorResponse(error, 'Gagal mengambil detail tim nominasi.');
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = getClientIp(request);

  const limit = await rateLimit(`nominasi:update:${ip}`, 30, 60_000);
  if (!limit.allowed) return rateLimitResponse(limit);

  try {
    const isAuthed = await verifyAdminAuth();
    if (!isAuthed) {
      return NextResponse.json({ error: 'Akses ditolak. Silakan login PIN panitia.' }, { status: 401 });
    }

    if (!validateOrigin(request) || !validateCsrf(request)) {
      return forbiddenResponse();
    }

    const { id } = await params;
    const parsed = nominasiTeamUpdateSchema.safeParse(await readJsonBody(request, 4096));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Data pembaruan tidak valid.' }, { status: 400 });
    }

    const team = await updateNominasiTeam(id, parsed.data);
    await writeAuditLog('nominasi_team_updated', ip, team.id, team.namaTeam);

    return NextResponse.json({ team });
  } catch (error) {
    if ((error as { status?: number })?.status === 404) {
      return NextResponse.json({ error: 'Tim nominasi tidak ditemukan.' }, { status: 404 });
    }
    return apiErrorResponse(error, 'Gagal memperbarui tim nominasi.');
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = getClientIp(request);

  const limit = await rateLimit(`nominasi:delete:${ip}`, 30, 60_000);
  if (!limit.allowed) return rateLimitResponse(limit);

  try {
    const isAuthed = await verifyAdminAuth();
    if (!isAuthed) {
      return NextResponse.json({ error: 'Akses ditolak. Silakan login PIN panitia.' }, { status: 401 });
    }

    if (!validateOrigin(request) || !validateCsrf(request)) {
      return forbiddenResponse();
    }

    const { id } = await params;
    await deleteNominasiTeam(id);
    await writeAuditLog('nominasi_team_deleted', ip, id);

    return NextResponse.json({ message: 'Tim nominasi berhasil dihapus.' });
  } catch (error) {
    return apiErrorResponse(error, 'Gagal menghapus tim nominasi.');
  }
}
