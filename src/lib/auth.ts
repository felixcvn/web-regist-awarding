import { cookies } from 'next/headers';

const ADMIN_PIN = process.env.ADMIN_PIN || '2026';

export async function verifyAdminAuth(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get('fan26_admin_token')?.value;
  return token === ADMIN_PIN;
}

export function validatePin(pin: string): boolean {
  return pin.trim() === ADMIN_PIN.trim();
}
