import { NextResponse } from 'next/server';
import { getClientIp, rateLimit, rateLimitResponse } from '@/lib/ratelimit';
import { validateStudentIdentity } from '@/lib/db';
import { studentIdentitySchema } from '@/lib/validation';
import { readJsonBody } from '@/lib/requestBody';
import { apiErrorResponse } from '@/lib/apiErrors';

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = await rateLimit(`student-identity:${ip}`, 12, 60_000);
  if (!limit.allowed) return rateLimitResponse(limit);

  try {
    const parsed = studentIdentitySchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Nama dan NIM wajib diisi dengan benar.' }, { status: 400 });
    }

    const result = await validateStudentIdentity(parsed.data.nim, parsed.data.name);
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
  } catch (error) {
    return apiErrorResponse(error, 'Gagal memeriksa nama dan NIM.');
  }
}
