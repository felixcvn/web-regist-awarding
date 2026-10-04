import { NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/auth';
import { getAllParticipants, writeAuditLog } from '@/lib/db';
import { rateLimit, getClientIp, tooManyResponse } from '@/lib/ratelimit';
import { csvSafe } from '@/lib/validation';

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const limit = rateLimit(`participants:${ip}`, 60, 60_000);
  if (!limit.allowed) return tooManyResponse(limit.retryAfter);

  try {
    const isAuthed = await verifyAdminAuth();
    if (!isAuthed) {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format');
    const participants = await getAllParticipants();

    if (format === 'csv') {
      await writeAuditLog('export_csv', ip);
      const headers = ['ID Tiket', 'NIM/NIP', 'Nama Lengkap', 'Peran', 'Kategori', 'Angkatan', 'Program Studi', 'Email', 'No. WA', 'Status Kehadiran', 'Waktu Check-In', 'Waktu Daftar'];
      const rows = participants.map((p) => [
        `"${csvSafe(p.id)}"`,
        `"${csvSafe(p.nimNip)}"`,
        `"${csvSafe(p.name)}"`,
        `"${csvSafe(p.role)}"`,
        `"${csvSafe(p.category || '-')}"`,
        `"${csvSafe(p.batch || '-')}"`,
        `"${csvSafe(p.prodi || '-')}"`,
        `"${csvSafe(p.email)}"`,
        `"${csvSafe(p.phone || '-')}"`,
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
