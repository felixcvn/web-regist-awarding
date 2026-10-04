import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { qrTokenSchema } from '@/lib/validation';
import { rateLimit, getClientIp, tooManyResponse } from '@/lib/ratelimit';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const ip = getClientIp(request);
  const limit = rateLimit(`qr:${ip}`, 30, 60_000);
  if (!limit.allowed) return tooManyResponse(limit.retryAfter);

  try {
    const { token } = await params;
    const parsed = qrTokenSchema.safeParse(token);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Token tidak valid.' }, { status: 400 });
    }

    const buffer = await QRCode.toBuffer(parsed.data, { margin: 5, width: 600, errorCorrectionLevel: 'H', color: { dark: '#000000', light: '#ffffff' } });
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err) {
    console.error('QR endpoint error:', err);
    return NextResponse.json({ error: 'Gagal menghasilkan QR Code.' }, { status: 500 });
  }
}
