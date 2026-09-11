import { NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/auth';
import { checkInParticipant } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const isAuthed = await verifyAdminAuth();
    if (!isAuthed) {
      return NextResponse.json({ error: 'Akses ditolak. Silakan login PIN panitia.' }, { status: 401 });
    }

    const { qrToken } = await request.json();

    if (!qrToken) {
      return NextResponse.json({ error: 'QR Code / Token tidak boleh kosong!' }, { status: 400 });
    }

    const result = await checkInParticipant(qrToken.trim());
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: 'Gagal memproses check-in' }, { status: 500 });
  }
}
