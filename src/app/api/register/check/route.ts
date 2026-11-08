import { NextResponse } from 'next/server';
import { isNimRegistered } from '@/lib/db';
import { rateLimit, getClientIp, rateLimitResponse } from '@/lib/ratelimit';
import { studentNimSchema } from '@/lib/validation';
import { apiErrorResponse } from '@/lib/apiErrors';

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const limit = await rateLimit(`nimcheck:${ip}`, 20, 60_000);
  if (!limit.allowed) return rateLimitResponse(limit);

  try {
    const { searchParams } = new URL(request.url);
    const nim = studentNimSchema.safeParse(searchParams.get('nim'));
    if (!nim.success) {
      return NextResponse.json({ error: 'Parameter NIM tidak valid.' }, { status: 400 });
    }

    const registered = await isNimRegistered(nim.data);
    return NextResponse.json({ available: !registered });
  } catch (error) {
    return apiErrorResponse(error, 'Gagal memeriksa NIM.');
  }
}
