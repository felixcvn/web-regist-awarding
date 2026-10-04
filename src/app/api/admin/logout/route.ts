import { NextResponse } from 'next/server';
import { destroySession, verifyAdminAuth } from '@/lib/auth';
import { getClientIp } from '@/lib/ratelimit';
import { writeAuditLog } from '@/lib/db';

export async function POST(request: Request) {
  const isAuthed = await verifyAdminAuth();
  if (isAuthed) {
    await writeAuditLog('logout', getClientIp(request));
  }
  await destroySession();
  return NextResponse.json({ success: true });
}
