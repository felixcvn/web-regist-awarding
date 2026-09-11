import { NextResponse } from 'next/server';
import { validatePin } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { pin } = await request.json();

    if (!pin || !validatePin(pin)) {
      return NextResponse.json({ error: 'PIN Panitia salah!' }, { status: 401 });
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set('fan26_admin_token', pin.trim(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
