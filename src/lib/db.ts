import { Pool } from 'pg';
import { Participant, RegistrationInput } from './types';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

function normalizeNim(nim: string): string {
  return nim.trim().toLowerCase();
}

// In production the filesystem is ephemeral/read-only (serverless), so the JSON
// fallback is disabled — a failed DB connection must surface, not silently lose data.
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const fallbackFilePath = path.join(process.cwd(), '.participants_data.json');

// Lazy production guard: failure surfaces after runtime, not at module load.
if (IS_PRODUCTION && !process.env.DATABASE_URL) {
  console.error('[DB] DATABASE_URL is not set in production.');
}

function loadFallbackData(): Participant[] {
  try {
    if (fs.existsSync(fallbackFilePath)) {
      const raw = fs.readFileSync(fallbackFilePath, 'utf8');
      return JSON.parse(raw);
    }
  } catch {
    // ignore read error
  }
  
  // Dev-only seed with obviously fake data (no real PII).
  const seed: Participant[] = [
    {
      id: 'TKT-DEMO01',
      nimNip: '000000000001',
      name: 'Peserta Demo Satu',
      role: 'Mahasiswa',
      category: 'HIMASIF',
      batch: '2023',
      prodi: 'Informatika',
      email: 'demo1@example.test',
      phone: '080000000001',
      qrToken: 'FAN26-DEMO-VIP-001',
      isCheckedIn: false,
      checkedInAt: null,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'TKT-DEMO02',
      nimNip: '000000000002',
      name: 'Peserta Demo Dua',
      role: 'Mahasiswa',
      category: 'Mahasiswa Fasilkom',
      batch: '-',
      prodi: 'Sistem Informasi',
      email: 'demo2@example.test',
      phone: '080000000002',
      qrToken: 'FAN26-DEMO-VIP-002',
      isCheckedIn: true,
      checkedInAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
      createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    }
  ];
  saveFallbackData(seed);
  return seed;
}

function saveFallbackData(data: Participant[]): void {
  if (IS_PRODUCTION) return; // never persist to local FS in production
  try {
    fs.writeFileSync(fallbackFilePath, JSON.stringify(data, null, 2), 'utf8');
  } catch {
    // ignore write error
  }
}

let pool: Pool | null = null;

function getPool(): Pool | null {
  if (!process.env.DATABASE_URL) {
    if (IS_PRODUCTION) console.error('[DB] DATABASE_URL is not set in production.');
    return null;
  }
  if (!pool) {
    const url = process.env.DATABASE_URL;
    // Managed providers (Neon/Supabase/Railway) require TLS. Enable when explicitly
    // requested via sslmode, or when the host is not localhost.
    const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
    const needsSsl = url.includes('sslmode=require') || url.includes('sslmode=verify-full') || !isLocal;
    pool = new Pool({
      connectionString: url,
      ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
    });
  }
  return pool;
}

let isTableInitialized = false;

async function initPostgresTable(p: Pool): Promise<boolean> {
  if (isTableInitialized) return true;
  try {
    await p.query(`
      CREATE TABLE IF NOT EXISTS participants (
        id VARCHAR(64) PRIMARY KEY,
        nim_nip VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(120) NOT NULL,
        role VARCHAR(40) NOT NULL,
        category VARCHAR(40),
        batch VARCHAR(4) DEFAULT '-',
        prodi VARCHAR(80),
        email VARCHAR(120) NOT NULL,
        phone VARCHAR(30),
        qr_token VARCHAR(64) UNIQUE NOT NULL,
        is_checked_in BOOLEAN DEFAULT FALSE,
        checked_in_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE participants ADD COLUMN IF NOT EXISTS category VARCHAR(40);
      ALTER TABLE participants ADD COLUMN IF NOT EXISTS batch VARCHAR(4) DEFAULT '-';
      CREATE INDEX IF NOT EXISTS idx_qr_token ON participants(qr_token);
      CREATE INDEX IF NOT EXISTS idx_nim_nip ON participants(nim_nip);
      CREATE TABLE IF NOT EXISTS admin_sessions (
        id VARCHAR(64) PRIMARY KEY,
        token_hash VARCHAR(128) UNIQUE NOT NULL,
        ip VARCHAR(64),
        user_agent VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(token_hash);
      CREATE TABLE IF NOT EXISTS audit_log (
        id SERIAL PRIMARY KEY,
        action VARCHAR(40) NOT NULL,
        actor_ip VARCHAR(64),
        target_id VARCHAR(64),
        detail VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    isTableInitialized = true;
    return true;
  } catch (err) {
    console.warn('[DB] PostgreSQL init table error, falling back to local store:', (err as Error).message);
    return false;
  }
}

export async function createParticipant(input: RegistrationInput): Promise<{ participant?: Participant; error?: string }> {
  const p = getPool();
  const id = 'TKT-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  const qrToken = 'FAN26-' + crypto.randomUUID();
  const createdAt = new Date().toISOString();

  // Try PostgreSQL
  if (p) {
    try {
      const ready = await initPostgresTable(p);
      if (ready) {
        const existing = await p.query('SELECT nim_nip FROM participants WHERE LOWER(nim_nip) = $1 LIMIT 1', [normalizeNim(input.nimNip)]);
        if (existing.rows.length > 0) {
          return { error: 'NIM / NIP ini sudah terdaftar sebelumnya!' };
        }

        const res = await p.query(
          `INSERT INTO participants (id, nim_nip, name, role, category, batch, prodi, email, phone, qr_token, is_checked_in, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, FALSE, NOW())
           RETURNING id, nim_nip AS "nimNip", name, role, category, batch, prodi, email, phone, qr_token AS "qrToken", is_checked_in AS "isCheckedIn", checked_in_at AS "checkedInAt", created_at AS "createdAt"`,
          [id, normalizeNim(input.nimNip), input.name.trim(), input.role, input.category, input.batch, input.prodi.trim(), input.email.trim(), input.phone.trim(), qrToken]
        );

        return { participant: res.rows[0] };
      }
    } catch (err: any) {
      if (err.code === '23505') {
        return { error: 'NIM / NIP atau token sudah terdaftar!' };
      }
      console.warn('[DB] PG Insert failed, trying fallback store:', err.message);
    }
  }

  // Fallback store (local dev only — disabled in production to avoid silent data loss)
  if (IS_PRODUCTION) {
    console.error('[DB] PostgreSQL unavailable in production. Check DATABASE_URL / SSL settings.');
    return { error: 'Layanan database sedang tidak tersedia. Silakan coba beberapa saat lagi.' };
  }

  const list = loadFallbackData();
  if (list.some((item) => normalizeNim(item.nimNip) === normalizeNim(input.nimNip))) {
    return { error: 'NIM / NIP ini sudah terdaftar sebelumnya!' };
  }

  const newRecord: Participant = {
    id,
    nimNip: normalizeNim(input.nimNip),
    name: input.name.trim(),
    role: input.role,
    category: input.category,
    batch: input.batch,
    prodi: input.prodi.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    qrToken,
    isCheckedIn: false,
    checkedInAt: null,
    createdAt,
  };

  list.push(newRecord);
  saveFallbackData(list);
  return { participant: newRecord };
}

export async function getParticipantByToken(qrToken: string): Promise<Participant | null> {
  const p = getPool();
  if (p) {
    try {
      const ready = await initPostgresTable(p);
      if (ready) {
        const res = await p.query(
          `SELECT id, nim_nip AS "nimNip", name, role, category, batch, prodi, email, phone, qr_token AS "qrToken", is_checked_in AS "isCheckedIn", checked_in_at AS "checkedInAt", created_at AS "createdAt"
           FROM participants WHERE qr_token = $1 LIMIT 1`,
          [qrToken.trim()]
        );
        if (res.rows.length > 0) return res.rows[0];
      }
    } catch {
      // fallback
    }
  }

  const list = loadFallbackData();
  return list.find((item) => item.qrToken === qrToken.trim()) || null;
}

export async function checkInParticipant(qrToken: string): Promise<{ success: boolean; message: string; participant?: Participant }> {
  const p = getPool();
  const now = new Date().toISOString();

  if (p) {
    try {
      const ready = await initPostgresTable(p);
      if (ready) {
        const queryRes = await p.query(
          `SELECT id, nim_nip AS "nimNip", name, role, category, batch, prodi, email, phone, qr_token AS "qrToken", is_checked_in AS "isCheckedIn", checked_in_at AS "checkedInAt", created_at AS "createdAt"
           FROM participants WHERE qr_token = $1 LIMIT 1`,
          [qrToken.trim()]
        );

        if (queryRes.rows.length === 0) {
          return { success: false, message: 'Tiket tidak ditemukan atau QR Code tidak valid!' };
        }

        const current = queryRes.rows[0];
        if (current.isCheckedIn) {
          return {
            success: false,
            message: `Tiket sudah pernah check-in pada ${new Date(current.checkedInAt).toLocaleTimeString('id-ID')}!`,
            participant: current,
          };
        }

        // ponytail: atomic guard so concurrent scans can't both flip the flag.
        const updateRes = await p.query(
          `UPDATE participants 
           SET is_checked_in = TRUE, checked_in_at = NOW() 
           WHERE qr_token = $1 AND is_checked_in = FALSE
           RETURNING id, nim_nip AS "nimNip", name, role, category, batch, prodi, email, phone, qr_token AS "qrToken", is_checked_in AS "isCheckedIn", checked_in_at AS "checkedInAt", created_at AS "createdAt"`,
          [qrToken.trim()]
        );

        if (updateRes.rows.length === 0) {
          const refetch = await p.query(
            `SELECT id, nim_nip AS "nimNip", name, role, category, batch, prodi, email, phone, qr_token AS "qrToken", is_checked_in AS "isCheckedIn", checked_in_at AS "checkedInAt", created_at AS "createdAt"
             FROM participants WHERE qr_token = $1 LIMIT 1`,
            [qrToken.trim()]
          );
          const dup = refetch.rows[0];
          return {
            success: false,
            message: dup?.checkedInAt
              ? `Tiket sudah pernah check-in pada ${new Date(dup.checkedInAt).toLocaleTimeString('id-ID')}!`
              : 'Tiket sudah pernah check-in!',
            participant: dup,
          };
        }

        return { success: true, message: 'Check-in berhasil! Selamat datang.', participant: updateRes.rows[0] };
      }
    } catch {
      // fallback
    }
  }

  const list = loadFallbackData();
  const idx = list.findIndex((item) => item.qrToken === qrToken.trim());
  if (idx === -1) {
    return { success: false, message: 'Tiket tidak ditemukan atau QR Code tidak valid!' };
  }

  if (list[idx].isCheckedIn) {
    return {
      success: false,
      message: `Tiket sudah pernah check-in pada ${new Date(list[idx].checkedInAt || '').toLocaleTimeString('id-ID')}!`,
      participant: list[idx],
    };
  }

  list[idx].isCheckedIn = true;
  list[idx].checkedInAt = now;
  saveFallbackData(list);

  return { success: true, message: 'Check-in berhasil! Selamat datang.', participant: list[idx] };
}

export async function getAllParticipants(): Promise<Participant[]> {
  const p = getPool();
  if (p) {
    try {
      const ready = await initPostgresTable(p);
      if (ready) {
        const res = await p.query(
          `SELECT id, nim_nip AS "nimNip", name, role, category, batch, prodi, email, phone, qr_token AS "qrToken", is_checked_in AS "isCheckedIn", checked_in_at AS "checkedInAt", created_at AS "createdAt"
           FROM participants ORDER BY created_at DESC`
        );
        return res.rows;
      }
    } catch {
      // fallback
    }
  }

  return loadFallbackData().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function isNimRegistered(nimNip: string): Promise<boolean> {
  const normalized = normalizeNim(nimNip);
  if (!normalized) return false;

  const p = getPool();
  if (p) {
    try {
      const ready = await initPostgresTable(p);
      if (ready) {
        const res = await p.query('SELECT nim_nip FROM participants WHERE LOWER(nim_nip) = $1 LIMIT 1', [normalized]);
        return res.rows.length > 0;
      }
    } catch {
      // fallback
    }
  }

  return loadFallbackData().some((item) => normalizeNim(item.nimNip) === normalized);
}

export async function deleteParticipant(id: string): Promise<boolean> {
  const p = getPool();
  if (p) {
    try {
      const ready = await initPostgresTable(p);
      if (ready) {
        const res = await p.query('DELETE FROM participants WHERE id = $1 RETURNING id', [id.trim()]);
        return res.rows.length > 0;
      }
    } catch {
      // fallback
    }
  }

  const list = loadFallbackData();
  const next = list.filter((item) => item.id !== id.trim());
  if (next.length === list.length) return false;
  saveFallbackData(next);
  return true;
}

// --- Admin sessions (at-rest, hashed tokens) ---

export async function createSessionRecord(
  tokenHash: string,
  expiresAt: Date,
  ip: string,
  userAgent: string
): Promise<boolean> {
  const p = getPool();
  if (!p) return false;
  try {
    const ready = await initPostgresTable(p);
    if (!ready) return false;
    const id = 'SES-' + crypto.randomBytes(6).toString('hex');
    await p.query(
      `INSERT INTO admin_sessions (id, token_hash, ip, user_agent, created_at, expires_at)
       VALUES ($1, $2, $3, $4, NOW(), $5)`,
      [id, tokenHash, ip.slice(0, 64), userAgent.slice(0, 255), expiresAt.toISOString()]
    );
    return true;
  } catch (err) {
    console.error('[DB] createSessionRecord failed:', (err as Error).message);
    return false;
  }
}

export async function getSessionRecord(tokenHash: string): Promise<{ expiresAt: string } | null> {
  const p = getPool();
  if (!p) return null;
  try {
    const ready = await initPostgresTable(p);
    if (!ready) return null;
    const res = await p.query('SELECT expires_at AS "expiresAt" FROM admin_sessions WHERE token_hash = $1 LIMIT 1', [tokenHash]);
    if (res.rows.length === 0) return null;
    return res.rows[0];
  } catch {
    return null;
  }
}

export async function deleteSessionRecord(tokenHash: string): Promise<void> {
  const p = getPool();
  if (!p) return;
  try {
    const ready = await initPostgresTable(p);
    if (ready) await p.query('DELETE FROM admin_sessions WHERE token_hash = $1', [tokenHash]);
  } catch {
    // ignore
  }
}

export async function purgeExpiredSessions(): Promise<void> {
  const p = getPool();
  if (!p) return;
  try {
    const ready = await initPostgresTable(p);
    if (ready) await p.query('DELETE FROM admin_sessions WHERE expires_at < NOW()');
  } catch {
    // ignore
  }
}

// --- Audit log ---

export async function writeAuditLog(action: string, actorIp: string, targetId?: string, detail?: string): Promise<void> {
  const p = getPool();
  if (!p) return;
  try {
    const ready = await initPostgresTable(p);
    if (!ready) return;
    await p.query(
      `INSERT INTO audit_log (action, actor_ip, target_id, detail) VALUES ($1, $2, $3, $4)`,
      [action.slice(0, 40), actorIp.slice(0, 64), (targetId || '').slice(0, 64) || null, (detail || '').slice(0, 255) || null]
    );
  } catch {
    // audit failures must never break the request
  }
}
