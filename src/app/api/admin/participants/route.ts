import { NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/auth';
import { getAllParticipants } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const isAuthed = await verifyAdminAuth();
    if (!isAuthed) {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format');
    const participants = await getAllParticipants();

    if (format === 'csv') {
      const headers = ['ID Tiket', 'NIM/NIP', 'Nama Lengkap', 'Peran', 'Program Studi', 'Email', 'No. WA', 'Status Kehadiran', 'Waktu Check-In', 'Waktu Daftar'];
      const rows = participants.map((p) => [
        `"${p.id}"`,
        `"${p.nimNip}"`,
        `"${p.name.replace(/"/g, '""')}"`,
        `"${p.role}"`,
        `"${p.prodi || '-'}"`,
        `"${p.email}"`,
        `"${p.phone || '-'}"`,
        `"${p.isCheckedIn ? 'Hadir' : 'Belum Hadir'}"`,
        `"${p.checkedInAt ? new Date(p.checkedInAt).toLocaleString('id-ID') : '-'}"`,
        `"${new Date(p.createdAt).toLocaleString('id-ID')}"`,
      ]);

      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="FAN2026_Kehadiran_${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    return NextResponse.json({ participants });
  } catch {
    return NextResponse.json({ error: 'Gagal mengambil data peserta.' }, { status: 500 });
  }
}
