import { Pool } from 'pg';
import { Participant, RegistrationInput } from './types';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

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
        prodi VARCHAR(80),
        email VARCHAR(120) NOT NULL,
        phone VARCHAR(30),
        qr_token VARCHAR(64) UNIQUE NOT NULL,
        is_checked_in BOOLEAN DEFAULT FALSE,
        checked_in_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
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
        const existing = await p.query('SELECT nim_nip FROM participants WHERE nim_nip = $1 LIMIT 1', [input.nimNip.trim()]);
        if (existing.rows.length > 0) {
          return { error: 'NIM / NIP ini sudah terdaftar sebelumnya!' };
        }

        const res = await p.query(
          `INSERT INTO participants (id, nim_nip, name, role, prodi, email, phone, qr_token, is_checked_in, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE, NOW())
           RETURNING id, nim_nip AS "nimNip", name, role, prodi, email, phone, qr_token AS "qrToken", is_checked_in AS "isCheckedIn", checked_in_at AS "checkedInAt", created_at AS "createdAt"`,
          [id, input.nimNip.trim(), input.name.trim(), input.role, input.prodi.trim(), input.email.trim(), input.phone.trim(), qrToken]
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
  if (list.some((item) => item.nimNip.toLowerCase() === input.nimNip.trim().toLowerCase())) {
    return { error: 'NIM / NIP ini sudah terdaftar sebelumnya!' };
  }

  const newRecord: Participant = {
    id,
    nimNip: input.nimNip.trim(),
    name: input.name.trim(),
    role: input.role,
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
          `SELECT id, nim_nip AS "nimNip", name, role, prodi, email, phone, qr_token AS "qrToken", is_checked_in AS "isCheckedIn", checked_in_at AS "checkedInAt", created_at AS "createdAt"
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
          `SELECT id, nim_nip AS "nimNip", name, role, prodi, email, phone, qr_token AS "qrToken", is_checked_in AS "isCheckedIn", checked_in_at AS "checkedInAt", created_at AS "createdAt"
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

        const updateRes = await p.query(
          `UPDATE participants 
           SET is_checked_in = TRUE, checked_in_at = NOW() 
           WHERE qr_token = $1
           RETURNING id, nim_nip AS "nimNip", name, role, prodi, email, phone, qr_token AS "qrToken", is_checked_in AS "isCheckedIn", checked_in_at AS "checkedInAt", created_at AS "createdAt"`,
          [qrToken.trim()]
        );

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
          `SELECT id, nim_nip AS "nimNip", name, role, prodi, email, phone, qr_token AS "qrToken", is_checked_in AS "isCheckedIn", checked_in_at AS "checkedInAt", created_at AS "createdAt"
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
