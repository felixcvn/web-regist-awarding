import { NextResponse } from 'next/server';
import { isNimRegistered } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const nim = searchParams.get('nim');

    if (!nim || !nim.trim()) {
      return NextResponse.json({ error: 'Parameter NIM wajib diisi.' }, { status: 400 });
    }

    const registered = await isNimRegistered(nim);
    return NextResponse.json({ available: !registered });
  } catch {
    return NextResponse.json({ error: 'Gagal memeriksa NIM.' }, { status: 500 });
  }
}
