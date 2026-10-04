import { cookies } from 'next/headers';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import {
  createSessionRecord,
  getSessionRecord,
  deleteSessionRecord,
  purgeExpiredSessions,
} from './db';

const SESSION_COOKIE = 'fan26_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 8; // 8 hours

const ADMIN_PIN_HASH = process.env.ADMIN_PIN_HASH || '';
const ADMIN_PIN = process.env.ADMIN_PIN || '';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// In-memory session fallback for local dev / when PostgreSQL is unavailable.
// Not used in production (state there must live in the DB).
const memorySessions = new Map<string, number>(); // tokenHash -> expiresAt(ms)

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function validatePin(pin: string): boolean {
  const candidate = (pin || '').trim();
  if (!candidate) return false;

  // Production must use a bcrypt hash. Plaintext ADMIN_PIN is a dev-only fallback.
  if (ADMIN_PIN_HASH) {
    return bcrypt.compareSync(candidate, ADMIN_PIN_HASH);
  }
  if (IS_PRODUCTION) {
    console.error('[Auth] ADMIN_PIN_HASH is not set in production. Refusing plaintext PIN auth.');
    return false;
  }
  if (!ADMIN_PIN) return false;
  // Constant-time compare for the dev fallback.
  const a = Buffer.from(candidate);
  const b = Buffer.from(ADMIN_PIN);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function createSession(ip: string, userAgent: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const tokenHash = hashToken(token);

  const stored = await createSessionRecord(tokenHash, expiresAt, ip, userAgent);
  if (!stored) {
    if (IS_PRODUCTION) {
      // Do not silently degrade auth in production.
      throw new Error('Session store unavailable');
    }
    console.warn('[Auth] DB session store unavailable — using in-memory session (dev only).');
    memorySessions.set(tokenHash, expiresAt.getTime());
  }
  await purgeExpiredSessions();

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  });

  return token;
}

export async function verifyAdminAuth(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return false;

  const tokenHash = hashToken(token);

  const record = await getSessionRecord(tokenHash);
  if (record) {
    return new Date(record.expiresAt).getTime() >= Date.now();
  }

  // Fallback to in-memory sessions (dev / DB down).
  const memExpiry = memorySessions.get(tokenHash);
  if (memExpiry) {
    if (memExpiry < Date.now()) {
      memorySessions.delete(tokenHash);
      return false;
    }
    return true;
  }

  return false;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    const tokenHash = hashToken(token);
    memorySessions.delete(tokenHash);
    await deleteSessionRecord(tokenHash);
  }
  cookieStore.delete(SESSION_COOKIE);
}
