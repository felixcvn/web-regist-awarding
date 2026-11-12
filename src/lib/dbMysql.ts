import crypto from 'crypto';
import { createPool, type Pool, type PoolConnection, type RowDataPacket, type ResultSetHeader, type QueryResult, type ExecuteValues } from 'mysql2/promise';
import type { CreateNominasiTeamInput, StudentMasterSearchResult } from './db';
import { getMysqlOptions, assertMysqlServer } from './mysqlConfig.cjs';
import { MYSQL_SCHEMA, MYSQL_TABLE_NAMES } from './mysqlSchema';
import { ApiError, DatabaseUnavailableError } from './apiErrors';
import { isTicketRevoked } from './revokedTickets';
import { toPublicTicket } from './publicTicket';
import { normalizeName, normalizeNim, parseStudentImportFiles, type ImportedStudent, type StudentImportResult } from './studentImportParser';
import { MAX_STUDENT_IMPORT_ROWS, type StudentImportFiles } from './studentImportFiles';
import type { Participant, PublicTicket, RegistrationInput } from './types';
import { isOrderingSettings, orderingAuditDetail, type OrderingSettings, type OrderingSettingsUpdate } from './orderingSettings';

const QUERY_TIMEOUT_MS = 15_000;
let pool: Pool | null = null;
let schemaReady: Promise<void> | null = null;
let lastRateLimitCleanup = 0;

// Do not log driver messages/SQL/values: duplicate-key and trigger errors can
// contain participant data. Codes are enough to identify connection failures.
function logFailure(operation: string, error: unknown): void {
  const code = (error as { code?: string } | null)?.code;
  console.error(`[DB/MySQL] ${operation} unavailable: ${typeof code === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(code) ? code : 'MYSQL_ERROR'}`);
}

function getPool(): Pool {
  if (!pool) {
    pool = createPool(getMysqlOptions(process.env));
    pool.on('connection', (connection) => {
      connection.on('error', (error: unknown) => logFailure('Connection pool', error));
    });
  }
  return pool;
}

async function execute<T extends QueryResult>(connection: PoolConnection, sql: string, values: ExecuteValues[] = []): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await new Promise<T>((resolve, reject) => {
      // mysql2's Execute timer starts AFTER Prepare, which has no timer of its
      // own. Bound the complete command, including preparation/queueing, and
      // discard the lease on expiry so an unfinished command is never reused.
      timer = setTimeout(() => {
        reject(Object.assign(new Error('Query deadline exceeded.'), { code: 'MYSQL_QUERY_TIMEOUT' }));
        connection.destroy();
      }, QUERY_TIMEOUT_MS);
      // Transaction control/DDL need the text protocol. Statements carrying
      // data always use prepared bindings; static commands carry no values.
      const operation = values.length ? connection.execute<T>(sql, values) : connection.query<T>(sql);
      // Handle late settlement too: a timed-out driver promise must not cause
      // an unhandled rejection or make the request succeed after its deadline.
      operation.then(([result]) => resolve(result), reject);
    });
  } catch (error) {
    if ((error as { code?: string }).code === 'PROTOCOL_SEQUENCE_TIMEOUT') connection.destroy();
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

// Bound pool acquisition as well as queries; a full pool must not leave a
// hosting request queued indefinitely. A late connection is returned safely.
async function acquire(): Promise<PoolConnection> {
  const p = getPool();
  const connection = await new Promise<PoolConnection>((resolve, reject) => {
    let expired = false;
    const timer = setTimeout(() => {
      expired = true;
      reject(Object.assign(new Error('Connection acquisition timed out.'), { code: 'MYSQL_POOL_TIMEOUT' }));
    }, 10_000);
    p.getConnection().then((value) => {
      clearTimeout(timer);
      if (expired) value.release();
      else resolve(value);
    }, (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
  try {
    await execute(connection, "SET SESSION time_zone = '+00:00', innodb_lock_wait_timeout = 10, sql_mode = 'STRICT_ALL_TABLES,NO_ENGINE_SUBSTITUTION'");
    await execute(connection, 'SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED');
    return connection;
  } catch (error) {
    connection.destroy();
    throw error;
  }
}

async function withConnection<T>(action: (connection: PoolConnection) => Promise<T>): Promise<T> {
  const connection = await acquire();
  try { return await action(connection); }
  finally { connection.release(); }
}

async function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = withConnection(async (connection) => {
      const servers = await execute<(RowDataPacket & { version: string; maxAllowedPacket: number })[]>(connection,
        'SELECT VERSION() AS version, @@max_allowed_packet AS maxAllowedPacket');
      assertMysqlServer(servers[0]);
      for (const sql of MYSQL_SCHEMA) await execute(connection, sql);
      const tables = await execute<(RowDataPacket & { tableName: string; engine: string })[]>(connection,
        `SELECT TABLE_NAME AS tableName, ENGINE AS engine FROM information_schema.tables
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${MYSQL_TABLE_NAMES.map(() => '?').join(',')})`, MYSQL_TABLE_NAMES);
      if (tables.length !== MYSQL_TABLE_NAMES.length || tables.some((table) => table.engine?.toLowerCase() !== 'innodb')) {
        throw Object.assign(new Error('Application tables must use InnoDB.'), { code: 'MYSQL_ENGINE_UNSAFE' });
      }
      await execute(connection, "INSERT INTO operation_locks (lock_key) VALUES ('student-import') ON DUPLICATE KEY UPDATE lock_key = lock_key");
      await execute(connection, 'INSERT INTO site_settings (id) VALUES (1) ON DUPLICATE KEY UPDATE id = id');
    }).catch((error) => { schemaReady = null; throw error; });
  }
  await schemaReady;
}

async function transaction<T>(action: (connection: PoolConnection) => Promise<T>): Promise<T> {
  return withConnection(async (connection) => {
    await execute(connection, 'START TRANSACTION');
    try {
      const result = await action(connection);
      await execute(connection, 'COMMIT');
      return result;
    } catch (error) {
      try { await execute(connection, 'ROLLBACK'); }
      catch { connection.destroy(); }
      throw error;
    }
  });
}

async function read<T>(operation: string, action: (connection: PoolConnection) => Promise<T>): Promise<T> {
  try {
    await ensureSchema();
    return await withConnection(action);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logFailure(operation, error);
    throw new DatabaseUnavailableError();
  }
}

type ParticipantRow = RowDataPacket & Omit<Participant, 'isCheckedIn' | 'checkedInAt' | 'createdAt'> & {
  isCheckedIn: number; checkedInAt: Date | null; createdAt: Date;
};
type TicketRow = RowDataPacket & Omit<PublicTicket, 'isCheckedIn'> & { isCheckedIn: number };
const PUBLIC_COLUMNS = 'id, nim_nip AS nimNip, name, role, category, batch, prodi, qr_token AS qrToken, is_checked_in AS isCheckedIn';
const PARTICIPANT_COLUMNS = `${PUBLIC_COLUMNS}, email, phone, checked_in_at AS checkedInAt, created_at AS createdAt`;

function toParticipant(row: ParticipantRow): Participant {
  return {
    id: row.id, nimNip: row.nimNip, name: row.name, role: row.role,
    category: row.category, batch: row.batch, prodi: row.prodi,
    email: row.email, phone: row.phone, qrToken: row.qrToken,
    isCheckedIn: Boolean(row.isCheckedIn),
    checkedInAt: row.checkedInAt ? row.checkedInAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

function parseJson(value: unknown): unknown {
  if (Buffer.isBuffer(value)) return JSON.parse(value.toString('utf8'));
  return typeof value === 'string' ? JSON.parse(value) : value;
}

async function readOrderingSettings(connection: PoolConnection): Promise<OrderingSettings> {
  const rows = await execute<(RowDataPacket & { visible: number; tallyUrl: string })[]>(connection,
    'SELECT ordering_visible AS visible, ordering_tally_url AS tallyUrl FROM site_settings WHERE id = 1');
  const row = rows[0];
  if (!row || (row.visible !== 0 && row.visible !== 1)) throw new DatabaseUnavailableError();
  const settings = { visible: row.visible === 1, tallyUrl: row.tallyUrl };
  if (!isOrderingSettings(settings)) throw new DatabaseUnavailableError();
  return settings;
}

export async function getOrderingSettings(): Promise<OrderingSettings> {
  return read('Ordering settings', readOrderingSettings);
}

export async function updateOrderingSettings(update: OrderingSettingsUpdate, actorIp: string): Promise<OrderingSettings> {
  try {
    await ensureSchema();
    return await transaction(async (connection) => {
      // Patch only supplied fields so a visibility change cannot overwrite a
      // Tally link saved by another admin. The row lock covers the audit too.
      await execute(connection,
        `UPDATE site_settings SET ordering_visible = COALESCE(?, ordering_visible),
         ordering_tally_url = COALESCE(?, ordering_tally_url), updated_at = UTC_TIMESTAMP(3) WHERE id = 1`,
        [update.visible ?? null, update.tallyUrl ?? null]);
      const settings = await readOrderingSettings(connection);
      await execute(connection,
        'INSERT INTO audit_log (action, actor_ip, target_id, detail) VALUES (?, ?, ?, ?)',
        ['ordering_settings_updated', actorIp.slice(0, 64), 'ordering', orderingAuditDetail(settings)]);
      return settings;
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logFailure('Ordering settings update', error);
    throw new DatabaseUnavailableError();
  }
}

export async function consumeRateLimit(key: string, limit: number, windowMs: number): Promise<{ allowed: boolean; retryAfter: number } | null> {
  if (!Number.isSafeInteger(limit) || limit < 1 || !Number.isSafeInteger(windowMs) || windowMs < 1) return null;
  try {
    await ensureSchema();
    if (Date.now() - lastRateLimitCleanup >= 60_000) {
      lastRateLimitCleanup = Date.now();
      await withConnection((connection) => execute(connection,
        'DELETE FROM request_rate_limits WHERE expires_at <= UTC_TIMESTAMP(3) ORDER BY expires_at LIMIT 1000'));
    }
    const bucketKey = crypto.createHash('sha256').update(key).digest('hex');
    return await transaction(async (connection) => {
      // The insert/upsert obtains an InnoDB exclusive row lock, including for
      // a previously missing key. Every process then reads the latest window.
      await execute(connection,
        `INSERT INTO request_rate_limits (bucket_key, hits, expires_at) VALUES (?, '[]', UTC_TIMESTAMP(3))
         ON DUPLICATE KEY UPDATE bucket_key = bucket_key`, [bucketKey]);
      const buckets = await execute<(RowDataPacket & { hits: unknown })[]>(connection,
        'SELECT hits FROM request_rate_limits WHERE bucket_key = ? FOR UPDATE', [bucketKey]);
      // Read the database clock after acquiring the lock, not before waiting.
      const clocks = await execute<(RowDataPacket & { nowMs: number })[]>(connection,
        'SELECT FLOOR(UNIX_TIMESTAMP(UTC_TIMESTAMP(3)) * 1000) AS nowMs');
      const now = Number(clocks[0].nowMs);
      const stored = parseJson(buckets[0].hits);
      if (!Array.isArray(stored) || stored.some((hit) => !Number.isSafeInteger(hit))) {
        throw Object.assign(new Error('Rate-limit state is invalid.'), { code: 'MYSQL_LIMIT_STATE_INVALID' });
      }
      const hits: number[] = stored.filter((hit: number) => hit > now - windowMs).sort((a, b) => a - b);
      const allowed = hits.length < limit;
      if (allowed) hits.push(now);
      await execute(connection,
        'UPDATE request_rate_limits SET hits = ?, expires_at = TIMESTAMPADD(MICROSECOND, ?, UTC_TIMESTAMP(3)) WHERE bucket_key = ?',
        [JSON.stringify(hits), windowMs * 1000, bucketKey]);
      return { allowed, retryAfter: allowed ? 0 : Math.max(1, Math.ceil((hits[0] + windowMs - now) / 1000)) };
    });
  } catch (error) {
    logFailure('Rate limit', error);
    return null;
  }
}

export async function createParticipant(input: RegistrationInput): Promise<{ participant?: Participant; error?: string; status?: number }> {
  try {
    await ensureSchema();
    return await transaction(async (connection) => {
      const nim = normalizeNim(input.nimNip);
      const existing = await execute<RowDataPacket[]>(connection, 'SELECT id FROM participants WHERE nim_nip = ? LIMIT 1', [nim]);
      if (existing.length) return { error: 'NIM / NIP ini sudah terdaftar sebelumnya!', status: 409 };
      let name = input.name.trim();
      let batch: string = input.batch;
      let prodi = input.prodi.trim();
      if (input.role === 'Mahasiswa') {
        // Hold a shared row lock through the insert so activation/rollback
        // cannot replace this student's identity mid-registration.
        const students = await execute<(RowDataPacket & { official_name: string; prodi: string; batch_year: string })[]>(connection,
          'SELECT official_name, prodi, batch_year FROM student_master WHERE nim = ? AND is_active = TRUE LOCK IN SHARE MODE', [nim]);
        const student = students[0];
        if (!student) return { error: 'NIM tidak ditemukan dalam data mahasiswa aktif.', status: 403 };
        if (normalizeName(input.name) !== normalizeName(student.official_name)) {
          return { error: 'NIM atau nama tidak sesuai data mahasiswa aktif.', status: 403 };
        }
        name = student.official_name;
        batch = student.batch_year;
        prodi = student.prodi;
      }
      const id = 'TKT-' + crypto.randomBytes(4).toString('hex').toUpperCase();
      const qrToken = 'FAN26-' + crypto.randomUUID();
      await execute(connection,
        `INSERT INTO participants (id, nim_nip, name, role, category, batch, prodi, email, phone, qr_token)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, nim, name, input.role, input.category, batch, prodi, input.email.trim(), input.phone.trim(), qrToken]);
      const rows = await execute<ParticipantRow[]>(connection, `SELECT ${PARTICIPANT_COLUMNS} FROM participants WHERE id = ?`, [id]);
      return { participant: toParticipant(rows[0]) };
    });
  } catch (error) {
    if ((error as { code?: string }).code === 'ER_DUP_ENTRY') return { error: 'NIM / NIP atau token sudah terdaftar!', status: 409 };
    logFailure('Registration', error);
    return { error: 'Layanan database sedang tidak tersedia. Silakan coba lagi.', status: 503 };
  }
}

export async function getParticipantByToken(qrToken: string): Promise<PublicTicket | null> {
  if (isTicketRevoked(qrToken)) return null;
  return read('Public ticket', async (connection) => {
    const rows = await execute<TicketRow[]>(connection, `SELECT ${PUBLIC_COLUMNS} FROM participants WHERE qr_token = ? LIMIT 1`, [qrToken.trim()]);
    return rows[0] ? toPublicTicket({ ...rows[0], isCheckedIn: Boolean(rows[0].isCheckedIn) }) : null;
  });
}

export async function checkInParticipant(qrToken: string): Promise<{ success: boolean; message: string; participant?: Participant }> {
  if (isTicketRevoked(qrToken)) return { success: false, message: 'Tiket tidak berlaku. Silakan hubungi panitia untuk penggantian.' };
  try {
    await ensureSchema();
    return await transaction(async (connection) => {
      const rows = await execute<ParticipantRow[]>(connection, `SELECT ${PARTICIPANT_COLUMNS} FROM participants WHERE qr_token = ? LIMIT 1 FOR UPDATE`, [qrToken.trim()]);
      if (!rows.length) return { success: false, message: 'Tiket tidak ditemukan atau QR Code tidak valid!' };
      const current = toParticipant(rows[0]);
      if (current.isCheckedIn) return {
        success: false,
        message: `Tiket sudah pernah check-in pada ${new Date(current.checkedInAt || '').toLocaleTimeString('id-ID')}!`,
        participant: current,
      };
      const updated = await execute<ResultSetHeader>(connection,
        'UPDATE participants SET is_checked_in = TRUE, checked_in_at = UTC_TIMESTAMP(3) WHERE qr_token = ? AND is_checked_in = FALSE', [qrToken.trim()]);
      if (updated.affectedRows !== 1) return { success: false, message: 'Tiket sudah pernah check-in!' };
      const checked = await execute<ParticipantRow[]>(connection, `SELECT ${PARTICIPANT_COLUMNS} FROM participants WHERE qr_token = ? LIMIT 1`, [qrToken.trim()]);
      return { success: true, message: 'Check-in berhasil! Selamat datang.', participant: toParticipant(checked[0]) };
    });
  } catch (error) {
    logFailure('Check-in', error);
    throw new DatabaseUnavailableError();
  }
}

export async function getAllParticipants(): Promise<Participant[]> {
  return read('Participants', async (connection) => {
    const rows = await execute<ParticipantRow[]>(connection, `SELECT ${PARTICIPANT_COLUMNS} FROM participants ORDER BY created_at DESC`);
    return rows.map(toParticipant);
  });
}

export async function isNimRegistered(nimNip: string): Promise<boolean> {
  const nim = normalizeNim(nimNip);
  if (!nim) return false;
  return read('Registration lookup', async (connection) =>
    (await execute<RowDataPacket[]>(connection, 'SELECT id FROM participants WHERE nim_nip = ? LIMIT 1', [nim])).length > 0);
}

export async function validateStudentIdentity(nim: string, name: string): Promise<'valid' | 'invalid' | 'unavailable'> {
  try {
    return await read('Student identity', async (connection) => {
      const rows = await execute<(RowDataPacket & { official_name: string })[]>(connection,
        'SELECT official_name FROM student_master WHERE nim = ? AND is_active = TRUE LIMIT 1', [normalizeNim(nim)]);
      return rows[0] && normalizeName(name) === normalizeName(rows[0].official_name) ? 'valid' : 'invalid';
    });
  } catch { return 'unavailable'; }
}

export async function searchStudentMaster(q: string, limit: number): Promise<StudentMasterSearchResult[]> {
  return read('Student master search', async (connection) => {
    const rows = await execute<(RowDataPacket & { nim: string; nama: string; prodi: string })[]>(connection,
      `SELECT nim, official_name AS nama, prodi
       FROM student_master
       WHERE is_active = TRUE AND (LOWER(nim) LIKE ? OR LOWER(official_name) LIKE ?)
       ORDER BY nim
       LIMIT ?`,
      [`%${q.toLowerCase().trim()}%`, `%${q.toLowerCase().trim()}%`, limit]);
    return rows.map((r) => ({ nim: r.nim, nama: r.nama, prodi: r.prodi }));
  });
}

export async function deleteParticipant(id: string): Promise<boolean> {
  return read('Participant deletion', async (connection) =>
    (await execute<ResultSetHeader>(connection, 'DELETE FROM participants WHERE id = ?', [id.trim()])).affectedRows > 0);
}

export async function createSessionRecord(tokenHash: string, expiresAt: Date, ip: string, userAgent: string): Promise<boolean> {
  try {
    await read('Session creation', (connection) => execute(connection,
      'INSERT INTO admin_sessions (id, token_hash, ip, user_agent, expires_at) VALUES (?, ?, ?, ?, ?)',
      ['SES-' + crypto.randomBytes(6).toString('hex'), tokenHash, ip.slice(0, 64), userAgent.slice(0, 255), expiresAt]));
    return true;
  } catch { return false; }
}

export async function getSessionRecord(tokenHash: string): Promise<{ expiresAt: string } | null> {
  try {
    return await read('Session lookup', async (connection) => {
      const rows = await execute<(RowDataPacket & { expiresAt: Date })[]>(connection,
        'SELECT expires_at AS expiresAt FROM admin_sessions WHERE token_hash = ? LIMIT 1', [tokenHash]);
      return rows[0] ? { expiresAt: rows[0].expiresAt.toISOString() } : null;
    });
  } catch { return null; }
}

export async function deleteSessionRecord(tokenHash: string): Promise<void> {
  await read('Session revocation', (connection) => execute(connection, 'DELETE FROM admin_sessions WHERE token_hash = ?', [tokenHash]));
}

export async function purgeExpiredSessions(): Promise<void> {
  try {
    await read('Expired session cleanup', (connection) => execute(connection,
      'DELETE FROM admin_sessions WHERE expires_at < UTC_TIMESTAMP(3) ORDER BY expires_at LIMIT 1000'));
  } catch { /* Cleanup is best-effort; expiry is checked during authentication. */ }
}

export async function countRecentAudit(action: string, windowMs: number): Promise<number> {
  return read('Audit count', async (connection) => {
    const rows = await execute<(RowDataPacket & { count: number })[]>(connection,
      'SELECT COUNT(*) AS count FROM audit_log WHERE action = ? AND created_at > TIMESTAMPADD(MICROSECOND, ?, UTC_TIMESTAMP(3))',
      [action.slice(0, 40), -Math.max(1, Math.floor(windowMs)) * 1000]);
    return Number(rows[0].count);
  });
}

export async function countRecentLoginFailures(ip: string, windowMs: number): Promise<number> {
  return read('Login lockout', async (connection) => {
    const rows = await execute<(RowDataPacket & { count: number })[]>(connection,
      "SELECT COUNT(*) AS count FROM audit_log WHERE action = 'login_failed' AND actor_ip = ? AND created_at > TIMESTAMPADD(MICROSECOND, ?, UTC_TIMESTAMP(3))",
      [ip.slice(0, 64), -Math.max(1, Math.floor(windowMs)) * 1000]);
    return Number(rows[0].count);
  });
}

export async function writeAuditLog(action: string, actorIp: string, targetId?: string, detail?: string): Promise<void> {
  try {
    await read('Audit write', (connection) => execute(connection,
      'INSERT INTO audit_log (action, actor_ip, target_id, detail) VALUES (?, ?, ?, ?)',
      [action.slice(0, 40), actorIp.slice(0, 64), (targetId || '').slice(0, 64) || null, (detail || '').slice(0, 255) || null]));
  } catch { /* Auditing must not expose driver errors or break other operations. */ }
}

export async function previewStudentImport(files: StudentImportFiles, sessionHash: string): Promise<StudentImportResult> {
  if (!/^[a-f0-9]{64}$/.test(sessionHash)) throw new ApiError('Sesi impor tidak valid.', 401);
  return read('Import preview', async (connection) => {
    const parsed = await parseStudentImportFiles(files);
    if (parsed.result.validRows > 0 && parsed.result.invalidRows === 0 && parsed.result.errors.length === 0) {
      await execute(connection, 'DELETE FROM student_import_previews WHERE expires_at <= UTC_TIMESTAMP(3) ORDER BY expires_at LIMIT 1000');
      await execute(connection,
        'INSERT INTO student_import_previews (batch_id, session_hash, students, result, expires_at) VALUES (?, ?, ?, ?, TIMESTAMPADD(MINUTE, 15, UTC_TIMESTAMP(3)))',
        [parsed.result.batchId, sessionHash, JSON.stringify(parsed.students), JSON.stringify(parsed.result)]);
    }
    return parsed.result;
  });
}

async function lockStudentImport(connection: PoolConnection): Promise<void> {
  const rows = await execute<RowDataPacket[]>(connection, "SELECT lock_key FROM operation_locks WHERE lock_key = 'student-import' FOR UPDATE");
  if (rows.length !== 1) throw Object.assign(new Error('Import lock is missing.'), { code: 'MYSQL_IMPORT_LOCK_MISSING' });
}

async function replaceStudentMaster(connection: PoolConnection, batchId: string): Promise<void> {
  // DELETE, not TRUNCATE: MySQL DDL would implicitly commit the transaction.
  await execute(connection, 'DELETE FROM student_master');
  await execute(connection,
    `INSERT INTO student_master (nim, official_name, normalized_name, prodi, batch_year, is_active, import_batch_id, updated_at)
     SELECT nim, official_name, normalized_name, prodi, batch_year, TRUE, batch_id, UTC_TIMESTAMP(3)
     FROM student_import_records WHERE batch_id = ?`, [batchId]);
}

export async function commitStudentImport(batchId: string, sessionHash: string, committedByIp: string): Promise<void> {
  if (!/^STU-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(batchId)) {
    throw new ApiError('ID preview impor tidak valid. Silakan lakukan preview ulang.', 400);
  }
  try {
    await ensureSchema();
    await transaction(async (connection) => {
      await lockStudentImport(connection);
      const previews = await execute<(RowDataPacket & { session_hash: string; students: unknown; result: unknown; valid: number; consumed_at: Date | null })[]>(connection,
        'SELECT session_hash, students, result, expires_at > UTC_TIMESTAMP(3) AS valid, consumed_at FROM student_import_previews WHERE batch_id = ? FOR UPDATE', [batchId]);
      const preview = previews[0];
      if (!preview || preview.session_hash !== sessionHash || !preview.valid || preview.consumed_at) {
        throw new ApiError('Preview tidak tersedia, kedaluwarsa, atau sudah digunakan. Silakan preview ulang.', 409);
      }
      const students = parseJson(preview.students) as ImportedStudent[];
      const result = parseJson(preview.result) as StudentImportResult;
      if (!Array.isArray(students) || !students.length || students.length > MAX_STUDENT_IMPORT_ROWS ||
          !result || result.batchId !== batchId || !Array.isArray(result.errors) || result.errors.length > 0 ||
          result.invalidRows !== 0 || result.validRows !== students.length) {
        throw new ApiError('Preview tidak valid. Silakan preview ulang.', 409);
      }
      const active = await execute<(RowDataPacket & { batch_id: string })[]>(connection,
        "SELECT batch_id FROM student_import_batches WHERE status = 'ACTIVE' ORDER BY created_at DESC LIMIT 1 FOR UPDATE");
      const previousBatchId = active[0]?.batch_id || null;
      await execute(connection,
        `INSERT INTO student_import_batches (batch_id, prodi, total_rows, valid_rows, invalid_rows, duplicate_nims, empty_names, invalid_nims, status, committed_by_ip)
         VALUES (?, 'ALL_PRODI', ?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
        [batchId, result.totalRows, result.validRows, result.invalidRows, result.duplicateNims, result.emptyNames, result.invalidNims, committedByIp.slice(0, 64)]);
      // Keep packets and prepared statements bounded while preserving one
      // interactive transaction for the complete approved snapshot.
      for (let offset = 0; offset < students.length; offset += 500) {
        const chunk = students.slice(offset, offset + 500);
        await execute(connection,
          `INSERT INTO student_import_records (batch_id, nim, official_name, normalized_name, prodi, batch_year) VALUES ${chunk.map(() => '(?, ?, ?, ?, ?, ?)').join(',')}`,
          chunk.flatMap((student) => [batchId, student.nim, student.name, student.normalizedName, student.prodi, student.batchYear]));
      }
      if (previousBatchId) await execute(connection, "UPDATE student_import_batches SET status = 'ARCHIVED' WHERE batch_id = ?", [previousBatchId]);
      await replaceStudentMaster(connection, batchId);
      await execute(connection,
        "UPDATE student_import_batches SET status = 'ACTIVE', committed_at = UTC_TIMESTAMP(3), previous_batch_id = ? WHERE batch_id = ?", [previousBatchId, batchId]);
      await execute(connection, "UPDATE student_import_previews SET consumed_at = UTC_TIMESTAMP(3), students = '[]' WHERE batch_id = ?", [batchId]);
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logFailure('Import commit', error);
    throw new DatabaseUnavailableError();
  }
}

export async function rollbackToPreviousBatch(): Promise<{ batchId: string; count: number }> {
  try {
    await ensureSchema();
    return await transaction(async (connection) => {
      await lockStudentImport(connection);
      const active = await execute<(RowDataPacket & { batch_id: string; previous_batch_id: string | null })[]>(connection,
        "SELECT batch_id, previous_batch_id FROM student_import_batches WHERE status = 'ACTIVE' ORDER BY created_at DESC LIMIT 1 FOR UPDATE");
      if (!active.length) throw new ApiError('Tidak ada data mahasiswa aktif untuk di-rollback.', 409);
      const previousBatchId = active[0].previous_batch_id;
      if (!previousBatchId) throw new ApiError('Belum ada batch impor sebelumnya untuk dipulihkan.', 409);
      const counts = await execute<(RowDataPacket & { count: number })[]>(connection,
        'SELECT COUNT(*) AS count FROM student_import_records WHERE batch_id = ?', [previousBatchId]);
      const count = Number(counts[0].count);
      if (!count) throw new ApiError('Snapshot batch sebelumnya tidak ditemukan.', 409);
      await replaceStudentMaster(connection, previousBatchId);
      await execute(connection, "UPDATE student_import_batches SET status = 'ROLLED_BACK' WHERE batch_id = ?", [active[0].batch_id]);
      await execute(connection, "UPDATE student_import_batches SET status = 'ACTIVE' WHERE batch_id = ?", [previousBatchId]);
      return { batchId: previousBatchId, count };
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logFailure('Import rollback', error);
    throw new DatabaseUnavailableError();
  }
}

export async function getActiveStudentImportBatch(): Promise<{ batchId: string; createdAt: string; count: number; canRollback: boolean } | null> {
  return read('Active student batch', async (connection) => {
    const rows = await execute<(RowDataPacket & { batch_id: string; created_at: Date; previous_batch_id: string | null; count: number; can_rollback: number })[]>(connection,
      `SELECT b.batch_id, b.created_at, b.previous_batch_id, COUNT(s.nim) AS count,
              EXISTS (SELECT 1 FROM student_import_records previous WHERE previous.batch_id = b.previous_batch_id) AS can_rollback
       FROM student_import_batches b JOIN student_master s ON s.import_batch_id = b.batch_id AND s.is_active = TRUE
       WHERE b.status = 'ACTIVE' GROUP BY b.batch_id, b.created_at, b.previous_batch_id ORDER BY b.created_at DESC LIMIT 1`);
    return rows[0] ? {
      batchId: rows[0].batch_id, createdAt: rows[0].created_at.toISOString(), count: Number(rows[0].count),
      canRollback: Boolean(rows[0].previous_batch_id && rows[0].can_rollback),
    } : null;
  });
}

// ============================================================================
// Nominasi Teams (MySQL implementation)
// ============================================================================

interface NominasiTeam {
  id: string;
  namaTeam: string;
  qrToken: string;
  isCheckedIn: boolean;
  checkedInAt: string | null;
  createdAt: string;
  members: NominasiTeamMember[];
}

interface NominasiTeamMember {
  id: string;
  nimNip: string;
  nama: string;
  isCheckedIn: boolean;
  checkedInAt: string | null;
}

type NominasiTeamRow = RowDataPacket & {
  id: string;
  nama_team: string;
  qr_token: string;
  is_checked_in: number;
  checked_in_at: Date | null;
  created_at: Date;
};

type NominasiMemberRow = RowDataPacket & {
  id: string;
  team_id: string;
  nim_nip: string;
  nama: string;
  is_checked_in: number;
  checked_in_at: Date | null;
  created_at: Date;
};

function toNominasiTeam(row: NominasiTeamRow, members: NominasiMemberRow[]): NominasiTeam {
  return {
    id: row.id,
    namaTeam: row.nama_team,
    qrToken: row.qr_token,
    isCheckedIn: Boolean(row.is_checked_in),
    checkedInAt: row.checked_in_at ? row.checked_in_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
    members: members.map((m) => ({
      id: m.id,
      nimNip: m.nim_nip,
      nama: m.nama,
      isCheckedIn: Boolean(m.is_checked_in),
      checkedInAt: m.checked_in_at ? m.checked_in_at.toISOString() : null,
    })),
  };
}

export async function getNominasiTeams(): Promise<NominasiTeam[]> {
  return read('Nominasi teams', async (connection) => {
    const teams = await execute<NominasiTeamRow[]>(connection,
      `SELECT * FROM nominasi_teams ORDER BY created_at DESC`);
    const result: NominasiTeam[] = [];
    for (const t of teams) {
      const members = await execute<NominasiMemberRow[]>(connection,
        `SELECT * FROM nominasi_team_members WHERE team_id = ? ORDER BY nama`, [t.id]);
      result.push(toNominasiTeam(t, members));
    }
    return result;
  });
}

// Reads through the caller's connection. Inside an open transaction a fresh
// pool connection cannot see uncommitted rows, so transaction code must use this.
async function loadNominasiTeam(connection: PoolConnection, id: string): Promise<NominasiTeam | null> {
  const teams = await execute<NominasiTeamRow[]>(connection,
    `SELECT * FROM nominasi_teams WHERE id = ? LIMIT 1`, [id.trim()]);
  if (!teams.length) return null;
  const members = await execute<NominasiMemberRow[]>(connection,
    `SELECT * FROM nominasi_team_members WHERE team_id = ? ORDER BY nama`, [teams[0].id]);
  return toNominasiTeam(teams[0], members);
}

export async function getNominasiTeamById(id: string): Promise<NominasiTeam | null> {
  return read('Nominasi team by id', (connection) => loadNominasiTeam(connection, id));
}

export async function getNominasiTeamByQrToken(qrToken: string): Promise<NominasiTeam | null> {
  return read('Nominasi team by qr', async (connection) => {
    const teams = await execute<NominasiTeamRow[]>(connection,
      `SELECT * FROM nominasi_teams WHERE qr_token = ? LIMIT 1`, [qrToken.trim()]);
    if (!teams.length) return null;
    const members = await execute<NominasiMemberRow[]>(connection,
      `SELECT * FROM nominasi_team_members WHERE team_id = ? ORDER BY nama`, [teams[0].id]);
    return toNominasiTeam(teams[0], members);
  });
}

// Team members are also registered attendees: create their participant row as
// "belum hadir" so the registration table lists them before the team is scanned.
// Existing registrations are left untouched.
async function ensureMemberParticipants(
  connection: PoolConnection,
  members: { nimNip: string; nama: string }[],
): Promise<void> {
  for (const m of members) {
    const nim = m.nimNip.trim();
    const students = await execute<(RowDataPacket & { prodi: string; batch_year: string })[]>(connection,
      `SELECT prodi, batch_year FROM student_master WHERE nim = ? LIMIT 1`, [nim]);
    const id = 'TKT-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    const qrToken = 'FAN26-' + crypto.randomUUID();
    await execute(connection,
      `INSERT INTO participants (id, nim_nip, name, role, category, batch, prodi, email, phone, qr_token)
       VALUES (?, ?, ?, 'Mahasiswa', 'Nominasi', ?, ?, ?, NULL, ?)
       ON DUPLICATE KEY UPDATE nim_nip = nim_nip`,
      [id, nim, m.nama, students[0]?.batch_year || '-', students[0]?.prodi || null, `${nim}@nominasi.local`, qrToken]);
  }
}

export async function createNominasiTeam(input: CreateNominasiTeamInput): Promise<NominasiTeam> {
  await ensureSchema();
  return transaction(async (connection) => {
    const id = 'NOM-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    const qrToken = 'FAN26-NOM-' + crypto.randomUUID();
    const now = new Date();

    await execute(connection,
      `INSERT INTO nominasi_teams (id, nama_team, qr_token, created_at)
       VALUES (?, ?, ?, ?)`,
      [id, input.namaTeam.trim(), qrToken, now]);

    for (const nim of input.memberNims) {
      const memberId = 'NOM-M-' + crypto.randomBytes(4).toString('hex').toUpperCase();
      const students = await execute<(RowDataPacket & { official_name: string })[]>(connection,
        `SELECT official_name FROM student_master WHERE nim = ? AND is_active = TRUE LIMIT 1`, [nim.trim()]);
      const nama = students[0]?.official_name || nim.trim();
      await execute(connection,
        `INSERT INTO nominasi_team_members (id, team_id, nim_nip, nama, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [memberId, id, nim.trim(), nama, now]);
    }

    const team = await loadNominasiTeam(connection, id);
    if (!team) throw new Error('Gagal memuat tim setelah dibuat. ID: ' + id);
    await ensureMemberParticipants(connection, team.members);
    return team;
  });
}

export async function updateNominasiTeam(
  id: string,
  input: { namaTeam?: string; memberNims?: string[] }
): Promise<NominasiTeam> {
  await ensureSchema();
  return transaction(async (connection) => {
    const existing = await execute<RowDataPacket[]>(connection,
      `SELECT id FROM nominasi_teams WHERE id = ? LIMIT 1`, [id.trim()]);
    if (!existing.length) throw new ApiError('Tim nominasi tidak ditemukan.', 404);

    if (input.namaTeam !== undefined) {
      await execute(connection,
        `UPDATE nominasi_teams SET nama_team = ? WHERE id = ?`,
        [input.namaTeam.trim(), id.trim()]);
    }

    if (input.memberNims !== undefined) {
      await execute(connection, `DELETE FROM nominasi_team_members WHERE team_id = ?`, [id.trim()]);
      const now = new Date();
      for (const nim of input.memberNims) {
        const memberId = 'NOM-M-' + crypto.randomBytes(4).toString('hex').toUpperCase();
        const students = await execute<(RowDataPacket & { official_name: string })[]>(connection,
          `SELECT official_name FROM student_master WHERE nim = ? AND is_active = TRUE LIMIT 1`, [nim.trim()]);
        const nama = students[0]?.official_name || nim.trim();
        await execute(connection,
          `INSERT INTO nominasi_team_members (id, team_id, nim_nip, nama, created_at)
           VALUES (?, ?, ?, ?, ?)`,
          [memberId, id, nim.trim(), nama, now]);
      }
    }

    const team = await loadNominasiTeam(connection, id);
    if (!team) throw new Error('Gagal memuat tim setelah diupdate.');
    await ensureMemberParticipants(connection, team.members);
    return team;
  });
}

export async function deleteNominasiTeam(id: string): Promise<void> {
  await read('Delete nominasi team', async (connection) => {
    await execute(connection, `DELETE FROM nominasi_teams WHERE id = ?`, [id.trim()]);
  });
}

// Team check-in also marks each member's own registration row as present so the
// participant table agrees. Idempotent: an existing individual check-in time wins.
async function syncMembersToParticipants(connection: PoolConnection, members: NominasiMemberRow[], at: Date): Promise<void> {
  for (const m of members) {
    await execute(connection,
      `UPDATE participants SET is_checked_in = TRUE, checked_in_at = ?
       WHERE nim_nip = ? AND is_checked_in = FALSE`,
      [at, m.nim_nip.trim()]);
  }
}

export async function checkInNominasiTeam(qrToken: string): Promise<{
  success: boolean;
  message: string;
  team?: NominasiTeam;
  newlyCheckedIn: NominasiTeamMember[];
}> {
  await ensureSchema();
  return transaction(async (connection) => {
    const teams = await execute<NominasiTeamRow[]>(connection,
      `SELECT * FROM nominasi_teams WHERE qr_token = ? LIMIT 1 FOR UPDATE`, [qrToken.trim()]);
    if (!teams.length) {
      return { success: false, message: 'QR Code tim nominasi tidak valid!', newlyCheckedIn: [] };
    }

    const team = teams[0];
    if (Boolean(team.is_checked_in)) {
      const members = await execute<NominasiMemberRow[]>(connection,
        `SELECT * FROM nominasi_team_members WHERE team_id = ? ORDER BY nama`, [team.id]);
      // Backfill teams checked in before this sync existed.
      await syncMembersToParticipants(connection, members, team.checked_in_at || new Date());
      return {
        success: false,
        message: `Tim "${team.nama_team}" sudah pernah check-in!`,
        team: toNominasiTeam(team, members),
        newlyCheckedIn: [],
      };
    }

    const now = new Date();
    await execute(connection,
      `UPDATE nominasi_teams SET is_checked_in = TRUE, checked_in_at = ? WHERE id = ?`,
      [now, team.id]);

    const members = await execute<NominasiMemberRow[]>(connection,
      `SELECT * FROM nominasi_team_members WHERE team_id = ? ORDER BY nama`, [team.id]);

    const newlyCheckedIn: NominasiTeamMember[] = [];
    for (const m of members) {
      if (!Boolean(m.is_checked_in)) {
        newlyCheckedIn.push({
          id: m.id,
          nimNip: m.nim_nip,
          nama: m.nama,
          isCheckedIn: true,
          checkedInAt: now.toISOString(),
        });
        await execute(connection,
          `UPDATE nominasi_team_members SET is_checked_in = TRUE, checked_in_at = ? WHERE id = ?`,
          [now, m.id]);
      }
    }
    // Team check-in also marks each member's own registration row as present,
    // so the participant table shows the same attendance.
    await syncMembersToParticipants(connection, members, now);

    const fullTeam = await loadNominasiTeam(connection, team.id);
    if (!fullTeam) throw new Error('Gagal memuat tim setelah check-in.');
    return {
      success: true,
      message: `Check-in tim "${team.nama_team}" berhasil! ${newlyCheckedIn.length} anggota terdeteksi hadir.`,
      team: fullTeam,
      newlyCheckedIn,
    };
  });
}
