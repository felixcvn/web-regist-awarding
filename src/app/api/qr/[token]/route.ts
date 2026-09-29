import { NextResponse } from 'next/server';
import QRCode from 'qrcode';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const buffer = await QRCode.toBuffer(token, { margin: 5, width: 600, errorCorrectionLevel: 'H', color: { dark: '#000000', light: '#ffffff' } });
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