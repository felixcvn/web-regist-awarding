import { NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/auth';
import { deleteParticipant, writeAuditLog } from '@/lib/db';
import { validateCsrf, validateOrigin, forbiddenResponse } from '@/lib/csrf';
import { rateLimit, getClientIp, tooManyResponse } from '@/lib/ratelimit';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = getClientIp(request);
  const limit = rateLimit(`delete:${ip}`, 30, 60_000);
  if (!limit.allowed) return tooManyResponse(limit.retryAfter);

  try {
    const isAuthed = await verifyAdminAuth();
    if (!isAuthed) {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 401 });
    }

    if (!validateOrigin(request) || !validateCsrf(request)) {
      return forbiddenResponse();
    }

    const { id } = await params;
    if (!id || !id.trim() || id.length > 64) {
      return NextResponse.json({ error: 'ID peserta tidak valid.' }, { status: 400 });
    }

    const deleted = await deleteParticipant(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Peserta tidak ditemukan.' }, { status: 404 });
    }

    await writeAuditLog('delete_participant', ip, id.trim());
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Gagal menghapus peserta.' }, { status: 500 });
  }
}
