import { Pool } from 'pg';
import { Participant, PublicTicket, RegistrationInput } from './types';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { ApiError, DatabaseUnavailableError } from './apiErrors';
import { isTicketRevoked } from './revokedTickets';
import { MAX_STUDENT_FILE_BYTES, MAX_STUDENT_IMPORT_ROWS, type StudentImportFiles } from './studentImportFiles';
import { validateXlsxArchive } from './xlsxArchive';
import { toPublicTicket } from './publicTicket';

// --- Student import tables ---

const STUDENT_IMPORT_BATCHES_TABLE = 'student_import_batches';
const STUDENT_MASTER_TABLE = 'student_master';

async function initStudentImportTables(p: Pool): Promise<boolean> {
  try {
    const statements = [
      `CREATE TABLE IF NOT EXISTS ${STUDENT_IMPORT_BATCHES_TABLE} (
        id SERIAL PRIMARY KEY,
        batch_id VARCHAR(64) UNIQUE NOT NULL,
        prodi VARCHAR(80) NOT NULL,
        total_rows INT NOT NULL,
        valid_rows INT NOT NULL,
        invalid_rows INT NOT NULL,
        duplicate_nims INT NOT NULL,
        empty_names INT NOT NULL,
        invalid_nims INT NOT NULL,
        status VARCHAR(20) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        committed_at TIMESTAMP,
        previous_batch_id VARCHAR(64),
        committed_by_ip VARCHAR(64)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_student_batches_id ON ${STUDENT_IMPORT_BATCHES_TABLE}(batch_id)`,
      `CREATE INDEX IF NOT EXISTS idx_student_batches_status ON ${STUDENT_IMPORT_BATCHES_TABLE}(status)`,
      `CREATE TABLE IF NOT EXISTS ${STUDENT_MASTER_TABLE} (
        nim VARCHAR(50) PRIMARY KEY,
        official_name VARCHAR(120) NOT NULL,
        normalized_name VARCHAR(120) NOT NULL,
        prodi VARCHAR(80) NOT NULL,
        batch_year VARCHAR(4) NOT NULL,
        is_active BOOLEAN DEFAULT FALSE,
        import_batch_id VARCHAR(64),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE INDEX IF NOT EXISTS idx_student_master_prodi ON ${STUDENT_MASTER_TABLE}(prodi)`,
      `CREATE INDEX IF NOT EXISTS idx_student_master_batch_year ON ${STUDENT_MASTER_TABLE}(batch_year)`,
      `CREATE INDEX IF NOT EXISTS idx_student_master_active ON ${STUDENT_MASTER_TABLE}(is_active)`,
      `CREATE TABLE IF NOT EXISTS student_import_records (
        batch_id VARCHAR(64) NOT NULL,
        nim VARCHAR(50) NOT NULL,
        official_name VARCHAR(120) NOT NULL,
        normalized_name VARCHAR(120) NOT NULL,
        prodi VARCHAR(80) NOT NULL,
        batch_year VARCHAR(4) NOT NULL,
        PRIMARY KEY (batch_id, nim)
      )`,
      `CREATE TABLE IF NOT EXISTS student_import_previews (
        batch_id VARCHAR(64) PRIMARY KEY,
        session_hash VARCHAR(64) NOT NULL,
        students JSONB NOT NULL,
        result JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        consumed_at TIMESTAMPTZ
      )`,
      `CREATE INDEX IF NOT EXISTS idx_student_previews_expiry ON student_import_previews(expires_at)`,
    ];
    for (const statement of statements) await p.query(statement);
    return true;
  } catch (err) {
    console.warn('[DB] Student import tables init error:', (err as Error).message);
    return false;
  }
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').normalize('NFKC').toLocaleLowerCase('id-ID');
}

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
  if (IS_PRODUCTION) throw new DatabaseUnavailableError();
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
      // Always verify the server certificate (Neon uses a public CA). Setting
      // rejectUnauthorized:false silently disables MITM protection.
      ssl: needsSsl ? { rejectUnauthorized: true } : undefined,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      // Bound every query so a stuck/locked table cannot hang a request forever.
      statement_timeout: 15_000,
      query_timeout: 15_000,
    });
  }
  return pool;
}

let rateLimitTableReady: Promise<void> | null = null;
let lastRateLimitCleanup = 0;

// Atomic per-key sliding window shared by every application instance. Keys are
// hashed so recipient addresses and client IPs are not stored in this table.
export async function consumeRateLimit(key: string, limit: number, windowMs: number): Promise<{ allowed: boolean; retryAfter: number } | null> {
  const p = getPool();
  if (!p) return null;
  try {
    if (!rateLimitTableReady) {
      rateLimitTableReady = p.query(`
        CREATE TABLE IF NOT EXISTS request_rate_limits (
          bucket_key VARCHAR(64) PRIMARY KEY,
          hits BIGINT[] NOT NULL,
          last_allowed BOOLEAN NOT NULL,
          expires_at TIMESTAMPTZ NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_request_rate_limits_expiry ON request_rate_limits(expires_at);
      `).then(() => {}).catch((error) => { rateLimitTableReady = null; throw error; });
    }
    await rateLimitTableReady;
    if (Date.now() - lastRateLimitCleanup >= 60_000) {
      lastRateLimitCleanup = Date.now();
      await p.query('DELETE FROM request_rate_limits WHERE expires_at <= NOW() AND bucket_key IN (SELECT bucket_key FROM request_rate_limits WHERE expires_at <= NOW() LIMIT 1000)');
    }
    const result = await p.query<{ last_allowed: boolean; retry_after: number }>(`
      INSERT INTO request_rate_limits AS bucket (bucket_key, hits, last_allowed, expires_at)
      VALUES ($1, ARRAY[(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT], TRUE, NOW() + ($3::BIGINT * INTERVAL '1 millisecond'))
      ON CONFLICT (bucket_key) DO UPDATE SET
        hits = (
          SELECT COALESCE(array_agg(hit ORDER BY hit), ARRAY[]::BIGINT[]) ||
            CASE WHEN COUNT(*) < $2 THEN ARRAY[(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT] ELSE ARRAY[]::BIGINT[] END
          FROM unnest(bucket.hits) AS hit
          WHERE hit > (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT - $3
        ),
        last_allowed = (
          SELECT COUNT(*) < $2 FROM unnest(bucket.hits) AS hit
          WHERE hit > (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT - $3
        ),
        expires_at = NOW() + ($3::BIGINT * INTERVAL '1 millisecond')
      RETURNING last_allowed,
        GREATEST(1, CEIL((hits[1] + $3 - EXTRACT(EPOCH FROM NOW()) * 1000) / 1000))::INT AS retry_after
    `, [crypto.createHash('sha256').update(key).digest('hex'), limit, windowMs]);
    return { allowed: result.rows[0].last_allowed, retryAfter: result.rows[0].last_allowed ? 0 : result.rows[0].retry_after };
  } catch (error) {
    console.error('[DB] Rate limit store unavailable:', (error as Error).message);
    return null;
  }
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

export async function createParticipant(input: RegistrationInput): Promise<{ participant?: Participant; error?: string; status?: number }> {
  const p = getPool();
  const id = 'TKT-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  const qrToken = 'FAN26-' + crypto.randomUUID();
  const createdAt = new Date().toISOString();

  if (!p && input.role === 'Mahasiswa') {
    return { error: 'Validasi mahasiswa tidak tersedia. Silakan coba lagi.', status: 503 };
  }

  // Try PostgreSQL
  if (p) {
    try {
      const ready = await initPostgresTable(p);
      if (!ready) {
        if (input.role === 'Mahasiswa') {
          return { error: 'Validasi mahasiswa tidak tersedia. Silakan coba lagi.', status: 503 };
        }
      } else {
        const existing = await p.query(
          'SELECT nim_nip FROM participants WHERE LOWER(nim_nip) = $1 LIMIT 1',
          [normalizeNim(input.nimNip)]
        );
        if (existing.rows.length > 0) {
          return { error: 'NIM / NIP ini sudah terdaftar sebelumnya!', status: 409 };
        }

        let participantName = input.name.trim();
        let participantBatch = input.batch;
        let participantProdi = input.prodi.trim();

        if (input.role === 'Mahasiswa') {
          const studentRes = await p.query(
            `SELECT official_name, prodi, batch_year FROM ${STUDENT_MASTER_TABLE}
             WHERE LOWER(nim) = $1 AND is_active = TRUE LIMIT 1`,
            [normalizeNim(input.nimNip)]
          );
          const student = studentRes.rows[0];

          if (!student) {
            return { error: 'NIM tidak ditemukan dalam data mahasiswa aktif.', status: 403 };
          }
          if (normalizeName(input.name) !== normalizeName(student.official_name)) {
            return { error: 'NIM atau nama tidak sesuai data mahasiswa aktif.', status: 403 };
          }

          participantName = student.official_name;
          participantBatch = student.batch_year;
          participantProdi = student.prodi;
        }

        const res = await p.query(
          `INSERT INTO participants (id, nim_nip, name, role, category, batch, prodi, email, phone, qr_token, is_checked_in, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, FALSE, NOW())
           RETURNING id, nim_nip AS "nimNip", name, role, category, batch, prodi, email, phone, qr_token AS "qrToken", is_checked_in AS "isCheckedIn", checked_in_at AS "checkedInAt", created_at AS "createdAt"`,
          [id, normalizeNim(input.nimNip), participantName, input.role, input.category, participantBatch, participantProdi, input.email.trim(), input.phone.trim(), qrToken]
        );

        return { participant: res.rows[0] };
      }
    } catch (err: unknown) {
      const dbError = err as { code?: string; message?: string };
      if (dbError.code === '23505') {
        return { error: 'NIM / NIP atau token sudah terdaftar!', status: 409 };
      }
      console.warn('[DB] PG Insert failed, trying fallback store:', dbError.message || 'Unknown database error');
      if (input.role === 'Mahasiswa') {
        return { error: 'Validasi mahasiswa tidak tersedia. Silakan coba lagi.', status: 503 };
      }
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

export async function getParticipantByToken(qrToken: string): Promise<PublicTicket | null> {
  if (isTicketRevoked(qrToken)) return null;
  const p = getPool();
  if (p) {
    try {
      const ready = await initPostgresTable(p);
      if (ready) {
        const res = await p.query<PublicTicket>(
          `SELECT id, nim_nip AS "nimNip", name, role, category, batch, prodi, qr_token AS "qrToken", is_checked_in AS "isCheckedIn"
           FROM participants WHERE qr_token = $1 LIMIT 1`,
          [qrToken.trim()]
        );
        return res.rows[0] ? toPublicTicket(res.rows[0]) : null;
      }
    } catch {
      // fallback
    }
  }

  const list = loadFallbackData();
  const participant = list.find((item) => item.qrToken === qrToken.trim());
  return participant ? toPublicTicket(participant) : null;
}

export async function checkInParticipant(qrToken: string): Promise<{ success: boolean; message: string; participant?: Participant }> {
  if (isTicketRevoked(qrToken)) {
    return { success: false, message: 'Tiket tidak berlaku. Silakan hubungi panitia untuk penggantian.' };
  }
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

export async function validateStudentIdentity(nim: string, name: string): Promise<'valid' | 'invalid' | 'unavailable'> {
  const p = getPool();
  if (!p) return 'unavailable';

  try {
    const result = await p.query<{ official_name: string }>(
      `SELECT official_name FROM ${STUDENT_MASTER_TABLE}
       WHERE LOWER(nim) = $1 AND is_active = TRUE LIMIT 1`,
      [normalizeNim(nim)]
    );
    const student = result.rows[0];
    if (!student) return 'invalid';
    return normalizeName(name) === normalizeName(student.official_name) ? 'valid' : 'invalid';
  } catch (err) {
    console.error('[DB] Student identity validation failed:', (err as Error).message);
    return 'unavailable';
  }
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

// Count recent audit rows for a given action (e.g. failed logins). Used for
// cross-instance lockouts where an in-memory counter would reset on cold start.
export async function countRecentAudit(action: string, windowMs: number): Promise<number> {
  const p = getPool();
  if (!p) return 0;
  try {
    const ready = await initPostgresTable(p);
    if (!ready) return 0;
    const res = await p.query(
      `SELECT COUNT(*)::int AS count FROM audit_log
       WHERE action = $1 AND created_at > NOW() - ($2::int * INTERVAL '1 millisecond')`,
      [action.slice(0, 40), Math.max(1, Math.floor(windowMs))]
    );
    return res.rows[0]?.count || 0;
  } catch {
    return 0;
  }
}

// Count recent failed logins for one IP. DB-backed so the lockout survives
// serverless cold starts and multiple instances.
export async function countRecentLoginFailures(ip: string, windowMs: number): Promise<number> {
  const p = getPool();
  if (!p) return 0;
  try {
    const ready = await initPostgresTable(p);
    if (!ready) return 0;
    const res = await p.query(
      `SELECT COUNT(*)::int AS count FROM audit_log
       WHERE action = 'login_failed' AND actor_ip = $1
         AND created_at > NOW() - ($2::int * INTERVAL '1 millisecond')`,
      [ip.slice(0, 64), Math.max(1, Math.floor(windowMs))]
    );
    return res.rows[0]?.count || 0;
  } catch {
    return 0;
  }
}

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

export interface StudentImportResult {
  batchId: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateNims: number;
  emptyNames: number;
  invalidNims: number;
  errors: string[];
}

interface ImportedStudent {
  nim: string;
  name: string;
  normalizedName: string;
  prodi: string;
  batchYear: string;
}

interface ParsedStudentImport {
  students: ImportedStudent[];
  result: StudentImportResult;
}

const STUDENT_PRODI_CODES: Record<string, string> = {
  '10': 'Sistem Informasi',
  '11': 'Sistem Informasi',
  '20': 'Teknologi Informasi',
  '21': 'Teknologi Informasi',
  '30': 'Informatika',
  '31': 'Informatika',
};

const MAX_IMPORT_ERRORS = 100;

async function parseStudentImportFiles(files: StudentImportFiles): Promise<ParsedStudentImport> {
  const students: ImportedStudent[] = [];
  const seenNims = new Set<string>();
  const errors: string[] = [];
  let totalRows = 0;
  let duplicateNims = 0;
  let emptyNames = 0;
  let invalidNims = 0;
  let errorsTruncated = false;

  const addError = (message: string) => {
    if (errors.length < MAX_IMPORT_ERRORS - 1) errors.push(message);
    else errorsTruncated = true;
  };

  const processFile = async (
    file: File | undefined,
    label: string,
    expectedProdi: string
  ): Promise<void> => {
    if (!file) {
      addError(`File ${label} belum diunggah.`);
      return;
    }
    if (file.size === 0 || file.size > MAX_STUDENT_FILE_BYTES) {
      addError(`File ${label}: ukuran file harus antara 1 byte dan 5 MB.`);
      return;
    }

    let rows: unknown[][];
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      await validateXlsxArchive(buffer);
      const workbook = XLSX.read(buffer, { type: 'buffer', sheets: 0, sheetRows: MAX_STUDENT_IMPORT_ROWS + 1 });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        addError(`File ${label} tidak memiliki worksheet.`);
        return;
      }
      const sheet = workbook.Sheets[sheetName];
      const range = XLSX.utils.decode_range(sheet['!fullref'] || sheet['!ref'] || 'A1');
      if (range.e.r > MAX_STUDENT_IMPORT_ROWS || range.e.c > 127) {
        addError(`File ${label}: maksimal ${MAX_STUDENT_IMPORT_ROWS} baris data dan 128 kolom.`);
        return;
      }
      rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        defval: '',
        raw: true,
      });
    } catch (error) {
      addError(`File ${label}: ${error instanceof ApiError ? error.message : 'tidak dapat dibaca sebagai Excel .xlsx.'}`);
      return;
    }

    const headerIndex = rows.findIndex((row) =>
      row.some((cell) => String(cell).trim().toLocaleUpperCase('id-ID') === 'NIM')
    );
    if (headerIndex < 0) {
      addError(`File ${label}: header kolom NIM tidak ditemukan.`);
      return;
    }

    const header = rows[headerIndex].map((cell) => String(cell).trim().toLocaleUpperCase('id-ID'));
    const nimColumn = header.indexOf('NIM');
    const nameColumn = header.findIndex((value) => value === 'NAMA' || value === 'NAMA LENGKAP');
    if (nameColumn < 0) {
      addError(`File ${label}: kolom NAMA atau NAMA LENGKAP tidak ditemukan.`);
      return;
    }

    const validBeforeFile = students.length;
    for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      if (!row || row.every((cell) => String(cell).trim() === '')) continue;

      totalRows++;
      if (totalRows > MAX_STUDENT_IMPORT_ROWS) {
        throw new ApiError(`Maksimal total impor adalah ${MAX_STUDENT_IMPORT_ROWS} baris mahasiswa.`, 400);
      }
      const rowLabel = `Baris ${rowIndex + 1} (${label})`;
      const nim = String(row[nimColumn] ?? '').trim();
      const name = String(row[nameColumn] ?? '').trim().replace(/\s+/g, ' ');

      if (!name) {
        emptyNames++;
        addError(`${rowLabel}: nama kosong.`);
        continue;
      }
      if (name.length > 120 || normalizeName(name).length > 120) {
        addError(`${rowLabel}: nama maksimal 120 karakter.`);
        continue;
      }

      if (!/^\d{12}$/.test(nim)) {
        invalidNims++;
        addError(`${rowLabel}: NIM wajib terdiri dari tepat 12 digit.`);
        continue;
      }

      const yearDigit = nim.slice(0, 2);
      if (!['23', '24', '25', '26'].includes(yearDigit)) {
        invalidNims++;
        addError(`${rowLabel}: NIM tidak memiliki angkatan valid (2023–2026).`);
        continue;
      }

      const prodi = STUDENT_PRODI_CODES[nim.slice(8, 10)];
      if (!prodi) {
        invalidNims++;
        addError(`${rowLabel}: kode program studi pada NIM tidak dikenali.`);
        continue;
      }

      if (prodi !== expectedProdi) {
        invalidNims++;
        addError(`${rowLabel}: NIM menunjukkan prodi ${prodi}, bukan ${expectedProdi}.`);
        continue;
      }

      const normalizedNim = normalizeNim(nim);
      if (seenNims.has(normalizedNim)) {
        duplicateNims++;
        addError(`${rowLabel}: NIM duplikat ditemukan pada file yang diunggah.`);
        continue;
      }

      seenNims.add(normalizedNim);
      students.push({
        nim: normalizedNim,
        name,
        normalizedName: normalizeName(name),
        prodi,
        batchYear: `20${yearDigit}`,
      });
    }
    if (students.length === validBeforeFile) addError(`File ${label} tidak memiliki baris mahasiswa valid.`);
  };

  await processFile(files.sistemInformasi, 'Sistem Informasi', 'Sistem Informasi');
  await processFile(files.informatika, 'Informatika', 'Informatika');
  await processFile(files.teknologiInformasi, 'Teknologi Informasi', 'Teknologi Informasi');

  if (errorsTruncated) errors.push('Kesalahan lainnya tidak ditampilkan. Periksa semua baris pada file yang diunggah.');

  const result: StudentImportResult = {
    batchId: `STU-${crypto.randomUUID()}`,
    totalRows,
    validRows: students.length,
    invalidRows: totalRows - students.length,
    duplicateNims,
    emptyNames,
    invalidNims,
    errors,
  };

  return { students, result };
}

export async function previewStudentImport(files: StudentImportFiles, sessionHash: string): Promise<StudentImportResult> {
  const p = getPool();
  if (!p) throw new DatabaseUnavailableError();
  if (!/^[a-f0-9]{64}$/.test(sessionHash)) throw new ApiError('Sesi impor tidak valid.', 401);

  const ready = await initStudentImportTables(p);
  if (!ready) throw new DatabaseUnavailableError();

  const parsed = await parseStudentImportFiles(files);
  if (parsed.result.validRows > 0 && parsed.result.invalidRows === 0 && parsed.result.errors.length === 0) {
    await p.query('DELETE FROM student_import_previews WHERE expires_at <= NOW()');
    await p.query(`
      INSERT INTO student_import_previews (batch_id, session_hash, students, result, expires_at)
      VALUES ($1, $2, $3::JSONB, $4::JSONB, NOW() + INTERVAL '15 minutes')
    `, [parsed.result.batchId, sessionHash, JSON.stringify(parsed.students), JSON.stringify(parsed.result)]);
  }
  return parsed.result;
}

export async function commitStudentImport(
  batchId: string,
  sessionHash: string,
  committedByIp: string
): Promise<void> {
  const p = getPool();
  if (!p) throw new DatabaseUnavailableError();

  if (!/^STU-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(batchId)) {
    throw new ApiError('ID preview impor tidak valid. Silakan lakukan preview ulang.', 400);
  }

  try {
    const ready = await initStudentImportTables(p);
    if (!ready) throw new DatabaseUnavailableError();

    const client = await p.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT pg_advisory_xact_lock(hashtext('student-import'))");

      const previewRes = await client.query<{
        session_hash: string; students: ImportedStudent[]; result: StudentImportResult;
        valid: boolean; consumed_at: string | null;
      }>(`SELECT session_hash, students, result, expires_at > clock_timestamp() AS valid, consumed_at
          FROM student_import_previews WHERE batch_id = $1 FOR UPDATE`, [batchId]);
      const preview = previewRes.rows[0];
      if (!preview || preview.session_hash !== sessionHash || !preview.valid || preview.consumed_at) {
        throw new ApiError('Preview tidak tersedia, kedaluwarsa, atau sudah digunakan. Silakan preview ulang.', 409);
      }
      const parsed = { students: preview.students, result: preview.result };
      if (!Array.isArray(parsed.students) || parsed.students.length === 0 || parsed.result.errors.length > 0 || parsed.result.invalidRows > 0) {
        throw new ApiError('Preview tidak valid. Silakan preview ulang.', 409);
      }

      const activeBatch = await client.query(
        `SELECT batch_id FROM ${STUDENT_IMPORT_BATCHES_TABLE}
         WHERE status = 'ACTIVE' ORDER BY created_at DESC LIMIT 1 FOR UPDATE`
      );
      const previousBatchId = activeBatch.rows[0]?.batch_id || null;

      await client.query(
        `INSERT INTO ${STUDENT_IMPORT_BATCHES_TABLE}
         (batch_id, prodi, total_rows, valid_rows, invalid_rows, duplicate_nims, empty_names, invalid_nims, status, committed_by_ip)
         VALUES ($1, 'ALL_PRODI', $2, $3, $4, $5, $6, $7, 'PENDING', $8)`,
        [
          batchId,
          parsed.result.totalRows,
          parsed.result.validRows,
          parsed.result.invalidRows,
          parsed.result.duplicateNims,
          parsed.result.emptyNames,
          parsed.result.invalidNims,
          committedByIp.slice(0, 64),
        ]
      );

      const batchIds = parsed.students.map(() => batchId);
      const nims = parsed.students.map((student) => student.nim);
      const names = parsed.students.map((student) => student.name);
      const normalizedNames = parsed.students.map((student) => student.normalizedName);
      const prodis = parsed.students.map((student) => student.prodi);
      const batchYears = parsed.students.map((student) => student.batchYear);

      await client.query(
        `INSERT INTO student_import_records (batch_id, nim, official_name, normalized_name, prodi, batch_year)
         SELECT * FROM UNNEST(
           $1::VARCHAR[], $2::VARCHAR[], $3::VARCHAR[], $4::VARCHAR[], $5::VARCHAR[], $6::VARCHAR[]
         )`,
        [batchIds, nims, names, normalizedNames, prodis, batchYears]
      );

      if (previousBatchId) {
        await client.query(
          `UPDATE ${STUDENT_IMPORT_BATCHES_TABLE} SET status = 'ARCHIVED' WHERE batch_id = $1`,
          [previousBatchId]
        );
      }

      await client.query(`DELETE FROM ${STUDENT_MASTER_TABLE}`);
      await client.query(
        `INSERT INTO ${STUDENT_MASTER_TABLE}
         (nim, official_name, normalized_name, prodi, batch_year, is_active, import_batch_id, updated_at)
         SELECT nim, official_name, normalized_name, prodi, batch_year, TRUE, batch_id, NOW()
         FROM student_import_records WHERE batch_id = $1`,
        [batchId]
      );
      await client.query(
        `UPDATE ${STUDENT_IMPORT_BATCHES_TABLE}
         SET status = 'ACTIVE', committed_at = NOW(), previous_batch_id = $2
         WHERE batch_id = $1`,
        [batchId, previousBatchId]
      );
      await client.query("UPDATE student_import_previews SET consumed_at = NOW(), students = '[]'::JSONB WHERE batch_id = $1", [batchId]);

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[DB] Student import commit error:', err);
    throw err;
  }
}

export async function rollbackToPreviousBatch(): Promise<{ batchId: string; count: number }> {
  const p = getPool();
  if (!p) {
    throw new DatabaseUnavailableError();
  }

  try {
    const ready = await initStudentImportTables(p);
    if (!ready) {
      throw new DatabaseUnavailableError();
    }

    const client = await p.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT pg_advisory_xact_lock(hashtext('student-import'))");

      const activeBatch = await client.query(
        `SELECT batch_id, previous_batch_id FROM ${STUDENT_IMPORT_BATCHES_TABLE}
         WHERE status = 'ACTIVE' ORDER BY created_at DESC LIMIT 1 FOR UPDATE`
      );

      if (activeBatch.rows.length === 0) {
        throw new ApiError('Tidak ada data mahasiswa aktif untuk di-rollback.', 409);
      }

      const currentBatchId = activeBatch.rows[0].batch_id;
      const previousBatchId = activeBatch.rows[0].previous_batch_id;
      if (!previousBatchId) {
        throw new ApiError('Belum ada batch impor sebelumnya untuk dipulihkan.', 409);
      }

      const previousRows = await client.query(
        `SELECT COUNT(*)::int AS count FROM student_import_records WHERE batch_id = $1`,
        [previousBatchId]
      );
      const count = Number(previousRows.rows[0]?.count || 0);
      if (!count) throw new ApiError('Snapshot batch sebelumnya tidak ditemukan.', 409);

      await client.query(`DELETE FROM ${STUDENT_MASTER_TABLE}`);
      await client.query(
        `INSERT INTO ${STUDENT_MASTER_TABLE}
         (nim, official_name, normalized_name, prodi, batch_year, is_active, import_batch_id, updated_at)
         SELECT nim, official_name, normalized_name, prodi, batch_year, TRUE, batch_id, NOW()
         FROM student_import_records WHERE batch_id = $1`,
        [previousBatchId]
      );
      await client.query(
        `UPDATE ${STUDENT_IMPORT_BATCHES_TABLE} SET status = 'ROLLED_BACK' WHERE batch_id = $1`,
        [currentBatchId]
      );
      await client.query(
        `UPDATE ${STUDENT_IMPORT_BATCHES_TABLE} SET status = 'ACTIVE' WHERE batch_id = $1`,
        [previousBatchId]
      );

      await client.query('COMMIT');
      return { batchId: previousBatchId, count };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[DB] Student import rollback error:', err);
    throw err;
  }
}

export async function getActiveStudentImportBatch(): Promise<{
  batchId: string;
  createdAt: string;
  count: number;
  canRollback: boolean;
} | null> {
  const p = getPool();
  if (!p) throw new DatabaseUnavailableError();

  try {
    const ready = await initStudentImportTables(p);
    if (!ready) throw new DatabaseUnavailableError();

    const res = await p.query(
      `SELECT b.batch_id, b.created_at, b.previous_batch_id,
              COUNT(s.nim)::int AS count,
              EXISTS (
                SELECT 1 FROM student_import_records previous
                WHERE previous.batch_id = b.previous_batch_id
              ) AS can_rollback
       FROM ${STUDENT_IMPORT_BATCHES_TABLE} b
       JOIN ${STUDENT_MASTER_TABLE} s ON s.import_batch_id = b.batch_id AND s.is_active = TRUE
       WHERE b.status = 'ACTIVE'
       GROUP BY b.batch_id, b.created_at, b.previous_batch_id
       ORDER BY b.created_at DESC LIMIT 1`
    );

    if (res.rows.length === 0) return null;

    return {
      batchId: res.rows[0].batch_id,
      createdAt: res.rows[0].created_at,
      count: res.rows[0].count,
      canRollback: Boolean(res.rows[0].previous_batch_id && res.rows[0].can_rollback),
    };
  } catch (error) {
    console.error('[DB] Active student batch unavailable:', (error as Error).message);
    throw new DatabaseUnavailableError();
  }
}
