import { NextResponse } from 'next/server';
import { isNimRegistered } from '@/lib/db';
import { rateLimit, getClientIp, tooManyResponse } from '@/lib/ratelimit';

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const limit = rateLimit(`nimcheck:${ip}`, 20, 60_000);
  if (!limit.allowed) return tooManyResponse(limit.retryAfter);

  try {
    const { searchParams } = new URL(request.url);
    const nim = searchParams.get('nim');

    if (!nim || !nim.trim() || nim.length > 30) {
      return NextResponse.json({ error: 'Parameter NIM wajib diisi.' }, { status: 400 });
    }

    const registered = await isNimRegistered(nim);
    return NextResponse.json({ available: !registered });
  } catch {
    return NextResponse.json({ error: 'Gagal memeriksa NIM.' }, { status: 500 });
  }
}
