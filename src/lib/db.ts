import { Pool } from 'pg';
import { Participant, RegistrationInput } from './types';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

function normalizeNim(nim: string): string {
  return nim.trim().toLowerCase();
}

// ponytail: fallback file storage when PostgreSQL server is unreachable in local dev. Switch fully to PG connection in production.
const fallbackFilePath = path.join(process.cwd(), '.participants_data.json');

function loadFallbackData(): Participant[] {
  try {
    if (fs.existsSync(fallbackFilePath)) {
      const raw = fs.readFileSync(fallbackFilePath, 'utf8');
      return JSON.parse(raw);
    }
  } catch {
    // ignore read error
  }
  
  // Seed sample initial mock participants for immediate evaluation
  const seed: Participant[] = [
    {
      id: 'TKT-A819',
      nimNip: '232410101001',
      name: 'Raden Arjuna Dewantara',
      role: 'Mahasiswa',
      category: 'HIMASIF',
      batch: '2023',
      prodi: 'Informatika',
      email: 'arjuna@mail.unej.ac.id',
      phone: '081234567891',
      qrToken: 'FAN26-DEMO-VIP-001',
      isCheckedIn: false,
      checkedInAt: null,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'TKT-B244',
      nimNip: '198205142008121001',
      name: 'Dr. Ir. Dian Kusuma Wardani, M.Kom.',
      role: 'Dosen',
      category: 'Mahasiswa Fasilkom',
      batch: '-',
      prodi: 'Sistem Informasi',
      email: 'dian.kusuma@unej.ac.id',
      phone: '081987654321',
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
  try {
    fs.writeFileSync(fallbackFilePath, JSON.stringify(data, null, 2), 'utf8');
  } catch {
    // ignore write error
  }
}

let pool: Pool | null = null;

function getPool(): Pool | null {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
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

  // Fallback store
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
