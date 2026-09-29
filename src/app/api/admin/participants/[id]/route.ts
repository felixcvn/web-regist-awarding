import { NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/auth';
import { deleteParticipant } from '@/lib/db';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const isAuthed = await verifyAdminAuth();
    if (!isAuthed) {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 401 });
    }

    const { id } = await params;
    if (!id || !id.trim()) {
      return NextResponse.json({ error: 'ID peserta tidak valid.' }, { status: 400 });
    }

    const deleted = await deleteParticipant(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Peserta tidak ditemukan.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Gagal menghapus peserta.' }, { status: 500 });
  }
}
