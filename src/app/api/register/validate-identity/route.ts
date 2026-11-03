import { NextResponse } from 'next/server';
import { getClientIp, rateLimit, tooManyResponse } from '@/lib/ratelimit';
import { validateStudentIdentity } from '@/lib/db';

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = rateLimit(`student-identity:${ip}`, 12, 60_000);
  if (!limit.allowed) return tooManyResponse(limit.retryAfter);

  try {
    const body = await request.json();
    const nim = typeof body?.nim === 'string' ? body.nim.trim() : '';
    const name = typeof body?.name === 'string' ? body.name.trim() : '';

    if (!nim || nim.length > 30 || !name || name.length > 120) {
      return NextResponse.json({ error: 'Nama dan NIM wajib diisi dengan benar.' }, { status: 400 });
    }

    const result = await validateStudentIdentity(nim, name);
    if (result === 'unavailable') {
      return NextResponse.json(
        { valid: false, unavailable: true, message: 'Pemeriksaan data sedang tidak tersedia. Coba lagi sebentar.' },
        { status: 503 }
      );
    }

    return NextResponse.json({
      valid: result === 'valid',
      message: result === 'valid'
        ? 'Nama dan NIM cocok dengan data mahasiswa aktif.'
        : 'NIM atau nama tidak sesuai data mahasiswa aktif.',
    });
  } catch {
    return NextResponse.json({ error: 'Gagal memeriksa nama dan NIM.' }, { status: 400 });
  }
}
