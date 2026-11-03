import { NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/auth';
import { rateLimit, getClientIp, tooManyResponse } from '@/lib/ratelimit';
import { previewStudentImport, type StudentImportResult } from '@/lib/db';
import { validateCsrf } from '@/lib/csrf';

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = rateLimit(`student-import:preview:${ip}`, 10, 60_000);
  if (!limit.allowed) return tooManyResponse(limit.retryAfter);

  try {
    const isAuthed = await verifyAdminAuth();
    if (!isAuthed) {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 401 });
    }

    const csrfValid = validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Permintaan ditolak (CSRF).' }, { status: 403 });
    }

    const formData = await request.formData();
    const sistemInformasi = formData.get('sistemInformasi') as File | null;
    const informatika = formData.get('informatika') as File | null;
    const teknologiInformasi = formData.get('teknologiInformasi') as File | null;

    if (!sistemInformasi || !informatika || !teknologiInformasi) {
      return NextResponse.json(
        { error: 'Harap unggah ketiga file Excel.' },
        { status: 400 }
      );
    }

    if (sistemInformasi.size > 5 * 1024 * 1024 || informatika.size > 5 * 1024 * 1024 || teknologiInformasi.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Maksimal ukuran file adalah 5 MB.' },
        { status: 400 }
      );
    }

    const files = [sistemInformasi, informatika, teknologiInformasi];
    if (files.some((file) => !file.name.toLocaleLowerCase('id-ID').endsWith('.xlsx'))) {
      return NextResponse.json({ error: 'Format file harus .xlsx.' }, { status: 400 });
    }

    const result: StudentImportResult = await previewStudentImport({
      sistemInformasi,
      informatika,
      teknologiInformasi,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('[API] Student import preview error:', err);
    return NextResponse.json(
      { error: `Gagal memproses file: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
