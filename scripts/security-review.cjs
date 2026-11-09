/*
 * Isolated security-review runner. It creates its own PostgreSQL cluster and
 * production-build copy of the app under the OpenCode temporary directory.
 * Install embedded-postgres in SECURITY_REVIEW_TOOLS before running this file.
 * Use --database-only for focused PostgreSQL checks or --helpers-only for helpers.
 * Use --cpanel to exercise the production server.js entry point end to end.
 * Use --mysql with SECURITY_REVIEW_MYSQLD for a new isolated MySQL 8+ datadir
 * or a portable MariaDB Windows server. No operating-system service is created.
 * No project .env files or participant stores are copied into the test app.
 * Security regressions assert the remediated behavior. Deliberately deferred
 * identity/enumeration and Turnstile findings remain explicit observations.
 */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const vm = require('node:vm');
const { spawn, execFileSync } = require('node:child_process');
const { createRequire } = require('node:module');
const { finished } = require('node:stream/promises');
const { pathToFileURL } = require('node:url');
const ts = require('typescript');
const XLSX = require('xlsx');
const bcrypt = require('bcryptjs');
const { Client, Pool } = require('pg');
const mysql = require('mysql2/promise');
const { deflateRawSync } = require('node:zlib');
const { fromBuffer } = require('yauzl');

const source = path.resolve(__dirname, '..');
const tempBase = process.env.SECURITY_REVIEW_TEMP || path.join(process.env.LOCALAPPDATA, 'Temp', 'opencode');
const toolsDir = process.env.SECURITY_REVIEW_TOOLS || path.join(tempBase, 'web-regist-security-20261107');
const toolsRequire = createRequire(path.join(toolsDir, 'package.json'));
const runDir = fs.mkdtempSync(path.join(tempBase, 'fan26-review-'));
const appDir = path.join(runDir, 'app');
const observations = [];
const databaseOnly = process.argv.includes('--database-only');
const helpersOnly = process.argv.includes('--helpers-only');
const cpanel = process.argv.includes('--cpanel');
const useMysql = process.argv.includes('--mysql');
const artifacts = { runDir, databaseProvider: useMysql ? 'mysql' : 'postgres', mode: databaseOnly ? 'database-only' : helpersOnly ? 'helpers-only' : 'full', startup: cpanel ? 'server.js' : 'next start', sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8' }).trim(), workingTree: true, xlsxVersion: XLSX.version };
const logStreams = [];
let database;
let dbClient;
let server;
let baseUrl;
let appEnv;
let adminCookie;
let csrfToken;
let databaseEnv;

function record(id, title, evidence) {
  observations.push({ id, title, evidence });
  console.log(JSON.stringify({ id, title, evidence }));
}

async function check(id, title, action) {
  try {
    await action();
  } catch (error) {
    observations.push({ id, title, harnessError: error.message });
    console.error(`${id}: ${error.stack}`);
    process.exitCode = 1;
  }
}

async function freePort() {
  const listener = net.createServer();
  await new Promise((resolve, reject) => listener.listen(0, '127.0.0.1', resolve).once('error', reject));
  const port = listener.address().port;
  await new Promise((resolve) => listener.close(resolve));
  return port;
}

function transpiledModule(relativePath, overrides = {}, extraGlobals = {}) {
  const modules = new Map();
  const context = vm.createContext({
    Buffer, URL, Request, Response, Headers, AbortSignal, Blob, File, FormData,
    TextDecoder, TextEncoder, Uint8Array, ArrayBuffer, ReadableStream,
    setTimeout, clearTimeout, console,
    process: { env: { NODE_ENV: 'production' }, cwd: () => runDir },
    ...extraGlobals,
  });
  function load(filename) {
    if (modules.has(filename)) return modules.get(filename).exports;
    const module = { exports: {} };
    modules.set(filename, module);
    const localRequire = createRequire(filename);
    const requireModule = (id) => {
      if (Object.hasOwn(overrides, id)) return overrides[id];
      const local = id.startsWith('@/') ? path.join(source, 'src', id.slice(2)) : id.startsWith('.') ? path.resolve(path.dirname(filename), id) : null;
      if (local) {
        const typed = ['.ts', '.tsx'].map((extension) => local + extension).find((candidate) => fs.existsSync(candidate));
        if (typed) return load(typed);
      }
      return localRequire(id);
    };
    const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
      fileName: filename,
    }).outputText;
    const wrapper = vm.runInContext(`(function(exports, require, module) { ${compiled}\n})`, context, { filename });
    wrapper(module.exports, requireModule, module);
    return module.exports;
  }
  return load(path.join(source, relativePath));
}

function filesFor({ suffix = '01', names = {}, nimOverrides = {}, format = 'xlsx', numericNims = false } = {}) {
  return Object.entries({ sistemInformasi: '10', informatika: '30', teknologiInformasi: '20' }).map(([field, code]) => {
    const nim = nimOverrides[field] || `23241010${code}${suffix}`;
    const name = names[field] || `Mahasiswa Uji ${field} ${suffix}`;
    const sheet = XLSX.utils.aoa_to_sheet([['NO', 'NIM', 'NAMA'], [1, numericNims ? Number(nim) : nim, name]]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Mahasiswa');
    const data = format === 'csv'
      ? Buffer.from(XLSX.utils.sheet_to_csv(sheet))
      : XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx', compression: true });
    return { field, data, nim, name };
  });
}

function upload(files, batchId) {
  const form = new FormData();
  if (batchId !== undefined) form.append('batchId', batchId);
  for (const file of files) form.append(file.field, new Blob([file.data]), `${file.field}.xlsx`);
  return form;
}

// Small, deterministic ZIP fixtures; buffers are bounded and used only locally.
function zipFixture(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const { name, data, declaredSize = data.length } of entries) {
    const filename = Buffer.from(name);
    const compressed = deflateRawSync(data);
    let crc = 0xffffffff;
    for (const byte of data) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(declaredSize, 22);
    local.writeUInt16LE(filename.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(declaredSize, 24);
    central.writeUInt16LE(filename.length, 28);
    central.writeUInt32LE(offset, 42);
    localParts.push(local, filename, compressed);
    centralParts.push(central, filename);
    offset += local.length + filename.length + compressed.length;
  }
  const central = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, central, end]);
}

async function paddedWorkbook(buffer) {
  const entries = await new Promise((resolve, reject) => {
    fromBuffer(buffer, { lazyEntries: true }, (error, zip) => {
      if (error) { reject(error); return; }
      const entries = [];
      zip.on('error', reject);
      zip.on('end', () => { zip.close(); resolve(entries); });
      zip.on('entry', (entry) => zip.openReadStream(entry, (error, stream) => {
        if (error) { zip.close(); reject(error); return; }
        const chunks = [];
        stream.on('error', (error) => { zip.close(); reject(error); });
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', () => { entries.push({ name: entry.fileName, data: Buffer.concat(chunks) }); zip.readEntry(); });
      }));
      zip.readEntry();
    });
  });
  return zipFixture([...entries, { name: 'review-padding.bin', data: crypto.randomBytes(4 * 1024 * 1024) }]);
}

function assertNoPrivateFields(value) {
  for (const key of ['email', 'phone', 'createdAt', 'checkedInAt']) assert.equal(Object.hasOwn(value, key), false, `Public ticket contains ${key}`);
}

function assertNoStore(response) {
  assert.match(response.headers.get('cache-control') || '', /private/);
  assert.match(response.headers.get('cache-control') || '', /no-store/);
}

let ipSequence = 1;
async function request(route, { method = 'GET', body, cookie = '', csrf, origin, ip, headers: supplied = {} } = {}) {
  const headers = { 'x-real-ip': ip || `198.18.${Math.floor(ipSequence / 250)}.${ipSequence++ % 250 + 1}`, ...supplied };
  if (cookie) headers.cookie = cookie;
  if (csrf !== undefined) headers['x-csrf-token'] = csrf;
  if (origin !== undefined) headers.origin = origin;
  const isForm = body instanceof FormData;
  if (body !== undefined && !isForm && typeof body !== 'string') headers['Content-Type'] = 'application/json';
  const response = await fetch(`${baseUrl}${route}`, {
    method, headers, redirect: 'manual', signal: AbortSignal.timeout(45_000),
    body: body === undefined ? undefined : isForm || typeof body === 'string' ? body : JSON.stringify(body),
  });
  const text = await response.text();
  let json;
  try { json = JSON.parse(text); } catch { json = null; }
  return { status: response.status, headers: response.headers, text, json };
}

function adminRequest(route, options = {}) {
  return request(route, { cookie: adminCookie, csrf: csrfToken, origin: baseUrl, ...options });
}

async function runProcess(args, logName, env) {
  const log = fs.createWriteStream(path.join(runDir, logName));
  logStreams.push(log);
  const child = spawn(process.execPath, args, { cwd: appDir, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.pipe(log, { end: false });
  child.stderr.pipe(log, { end: false });
  const timer = setTimeout(() => child.kill(), 240_000);
  const result = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal }));
  });
  clearTimeout(timer);
  log.end();
  return result;
}

async function startApp(port) {
  const log = fs.createWriteStream(path.join(runDir, 'server.log'), { flags: 'a' });
  logStreams.push(log);
  const args = cpanel ? [path.join(appDir, 'server.js')] : [path.join(source, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(port)];
  server = spawn(process.execPath, args, {
    cwd: appDir, env: { ...appEnv, PORT: String(port), HOST: '127.0.0.1' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.pipe(log, { end: false });
  server.stderr.pipe(log, { end: false });
  server.once('close', () => log.end());
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Next server readiness deadline exceeded')), 45_000);
    server.once('error', (error) => { clearTimeout(timer); reject(error); });
    server.once('exit', (code) => { clearTimeout(timer); reject(new Error(`Next exited before readiness: ${code}`)); });
    server.stdout.on('data', (chunk) => {
      if (/Ready (?:in|on)/i.test(chunk.toString())) { clearTimeout(timer); resolve(); }
    });
  });
}

async function stopApp() {
  if (!server || server.exitCode !== null || server.signalCode !== null) return;
  const child = server;
  await new Promise((resolve) => {
    child.once('close', resolve);
    if (process.platform === 'win32') {
      execFileSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
    } else {
      child.kill();
    }
  });
  server = null;
}

async function startDatabase() {
  if (useMysql) {
    const result = await require('./review-mysql.cjs').startMysql({ runDir, port: await freePort(), logStreams });
    database = result.database;
    dbClient = result.dbClient;
    databaseEnv = result.dbEnv;
    artifacts.mysqlVersion = result.version;
    return { dbUrl: '', dbPassword: result.dbPassword };
  }
  const EmbeddedPostgres = (await import(pathToFileURL(toolsRequire.resolve('embedded-postgres')).href)).default;
  const dbPort = await freePort();
  const dbPassword = crypto.randomBytes(24).toString('hex');
  const dbLog = fs.createWriteStream(path.join(runDir, 'postgres.log'));
  logStreams.push(dbLog);
  database = new EmbeddedPostgres({
    databaseDir: path.join(runDir, 'pgdata'), user: 'reviewer', password: dbPassword, port: dbPort,
    persistent: false, authMethod: 'scram-sha-256', createPostgresUser: false, autoRehydrateSymlinks: true,
    initdbFlags: ['--encoding=UTF8', '--locale=C'], postgresFlags: ['-c', 'listen_addresses=localhost', '-c', 'max_connections=25'],
    onLog: (message) => dbLog.write(String(message) + '\n'), onError: (message) => dbLog.write(String(message) + '\n'),
  });
  await database.initialise();
  await database.start();
  await database.createDatabase('security_review');
  const dbUrl = `postgres://reviewer:${dbPassword}@127.0.0.1:${dbPort}/security_review`;
  dbClient = new Client({ connectionString: dbUrl });
  await dbClient.connect();
  artifacts.postgresVersion = (await dbClient.query('SHOW server_version')).rows[0].server_version;
  databaseEnv = { DATABASE_PROVIDER: 'postgres', DATABASE_URL: dbUrl };
  return { dbUrl, dbPassword };
}

async function stopDatabase() {
  if (!database) return;
  if (useMysql) { await database.stop(); return; }
  const child = database.process;
  if (process.platform !== 'win32' || !child) {
    await database.stop();
    return;
  }

  // The pinned embedded-postgres version uses taskkill on Windows. PostgreSQL
  // 18 io_worker children can survive that and retain the runner's stdio pipes.
  // pg_ctl lets PostgreSQL close its workers before the temporary cluster is removed.
  if (child.exitCode === null && child.signalCode === null) {
    const closed = new Promise((resolve) => child.once('close', resolve));
    const pgCtl = path.join(path.dirname(child.spawnfile), 'pg_ctl.exe');
    execFileSync(pgCtl, ['stop', '-D', path.join(runDir, 'pgdata'), '-m', 'fast', '-w', '-t', '15'], {
      windowsHide: true, timeout: 20_000, stdio: ['ignore', 'pipe', 'pipe'],
    });
    await closed;
  }
  // Mark the pinned library's process as stopped so its exit hook is idempotent.
  database.process = undefined;
  await fs.promises.rm(path.join(runDir, 'pgdata'), { recursive: true, force: true });
}

async function checkActiveBatchQuery(dbUrl) {
  const pools = [];
  const queryErrors = [];
  class ObservedPool extends Pool {
    constructor(options) { super(options); pools.push(this); }
    async query(...args) {
      try { return await super.query(...args); }
      catch (error) { queryErrors.push({ code: error.code, message: error.message }); throw error; }
    }
  }
  const db = transpiledModule('src/lib/db.ts', { pg: { Pool: ObservedPool }, 'mysql2/promise': { ...mysql, createPool(options) {
    const p = mysql.createPool(options); pools.push(p); return p;
  } } }, {
    process: { env: { NODE_ENV: 'production', ...databaseEnv, DATABASE_URL: dbUrl }, cwd: () => appDir },
  });
  try {
    const sessionHash = crypto.randomBytes(32).toString('hex');
    let latestBatch;
    for (const suffix of ['01', '02']) {
      const files = Object.fromEntries(filesFor({ suffix }).map((file) => [file.field, new File([file.data], `${file.field}.xlsx`)]));
      const preview = await db.previewStudentImport(files, sessionHash);
      assert.equal(preview.errors.length, 0);
      await db.commitStudentImport(preview.batchId, sessionHash, '198.18.203.1');
      latestBatch = preview.batchId;
    }
    const active = await db.getActiveStudentImportBatch();
    const stored = await dbClient.query("SELECT COUNT(*)::int AS count FROM student_import_batches WHERE status = 'ACTIVE'");
    const master = await dbClient.query('SELECT COUNT(*)::int AS count FROM student_master');
    assert.equal(stored.rows[0].count, 1);
    assert.equal(master.rows[0].count, 3);
    assert.equal(active.batchId, latestBatch);
    assert.equal(active.count, 3);
    assert.equal(active.canRollback, true);
    assert.equal(queryErrors.length, 0);
    record('IMPORT-11', `Active batch query against real ${useMysql ? 'MySQL' : 'PostgreSQL'}`, {
      storedActiveBatches: stored.rows[0].count, masterRows: master.rows[0].count,
      returnedActiveBatch: active, queryErrors,
      scope: `transpiled application helpers with real isolated ${useMysql ? 'MySQL' : 'PostgreSQL'}`,
    });
  } finally {
    await Promise.all(pools.map((pool) => pool.end()));
  }
}

async function checkPersistentLimits(dbUrl) {
  const pools = [];
  class TestPool extends Pool {
    constructor(options) { super(options); pools.push(this); }
  }
  const load = () => transpiledModule('src/lib/db.ts', { pg: { Pool: TestPool }, 'mysql2/promise': { ...mysql, createPool(options) {
    const p = mysql.createPool(options); pools.push(p); return p;
  } } }, {
    process: { env: { NODE_ENV: 'production', ...databaseEnv, DATABASE_URL: dbUrl }, cwd: () => appDir },
  });
  const first = load();
  const second = load();
  try {
    assert.ok((await first.consumeRateLimit('test:warm:first', 1, 60_000))?.allowed);
    assert.ok((await second.consumeRateLimit('test:warm:second', 1, 60_000))?.allowed);
    const key = `test:concurrent:${crypto.randomUUID()}`;
    const results = await Promise.all(Array.from({ length: 20 }, (_, index) => (index % 2 ? first : second).consumeRateLimit(key, 5, 3_600_000)));
    assert.equal(results.filter((value) => value?.allowed).length, 5);
    assert.ok(results.every((value) => value !== null));
    const hash = crypto.createHash('sha256').update(key).digest('hex');
    const stored = await dbClient.query('SELECT bucket_key, cardinality(hits)::int AS hits FROM request_rate_limits WHERE bucket_key = $1', [hash]);
    assert.equal(stored.rows[0].hits, 5);
    const freshModule = load();
    assert.equal((await freshModule.consumeRateLimit(key, 5, 3_600_000)).allowed, false);
    const elapsed = [];
    for (const minutes of [11, 59, 61]) {
      if (useMysql) {
        await dbClient.query("UPDATE request_rate_limits SET hits = $2, expires_at = NOW() + INTERVAL '1 hour' WHERE bucket_key = $1",
          [hash, JSON.stringify(Array(5).fill(Date.now() - minutes * 60_000))]);
      } else {
        await dbClient.query('UPDATE request_rate_limits SET hits = ARRAY(SELECT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT - $2::BIGINT FROM generate_series(1, 5)), expires_at = NOW() + INTERVAL \'1 hour\' WHERE bucket_key = $1', [hash, minutes * 60_000]);
      }
      const result = await freshModule.consumeRateLimit(key, 5, 3_600_000);
      assert.equal(result.allowed, minutes > 60);
      elapsed.push({ minutes, allowed: result.allowed });
    }
    record('RATE-01', 'Shared atomic quota, module restart, and one-hour expiry', { concurrentRequests: results.length, allowed: 5, denied: 15, rawKeyStored: stored.rows[0].bucket_key === key, freshModuleDenied: true, elapsed });
  } finally {
    await Promise.all(pools.map((pool) => pool.end()));
  }
}

function loadMysqlHelpers(pools, messages = [], fsOverrides = {}, environment = {}) {
  return transpiledModule('src/lib/db.ts', {
    pg: { Pool: class ForbiddenPostgresPool { constructor() { throw new Error('MySQL must not open a PostgreSQL pool'); } } },
    fs: { ...fs, ...fsOverrides },
    'mysql2/promise': { ...mysql, createPool(options) { const p = mysql.createPool(options); pools.push(p); return p; } },
  }, {
    process: { env: { NODE_ENV: 'production', ...databaseEnv, ...environment, DATABASE_URL: 'postgres://synthetic:unused@127.0.0.1:9/ignored' }, cwd: () => appDir },
    console: { ...console, error(...values) { messages.push(values.map(String).join(' ')); } },
  });
}

async function checkMysqlEngineGuard() {
  const pools = [];
  const messages = [];
  let fileReads = 0;
  try {
    // Initialization is validated on each fresh process, without modifying an
    // existing table's engine. All modifications below are to the isolated DB.
    await dbClient.query('ALTER TABLE participants ENGINE=MyISAM');
    const cold = loadMysqlHelpers(pools, messages, { existsSync() { fileReads++; throw new Error('Unexpected participant file access'); } });
    assert.equal(await cold.consumeRateLimit('test:unsafe-engine', 1, 60_000), null);
    await assert.rejects(cold.getAllParticipants(), (error) => error.status === 503);
    assert.equal(fileReads, 0);
    assert.ok(messages.every((message) => message.includes('MYSQL_ENGINE_UNSAFE')));
    record('MYSQL-01', 'Non-InnoDB initialization fails closed without fallback', { unsafeEngine: 'MyISAM', refusedFreshProcess: true, fileReads, postgresOpened: false });
  } finally {
    await dbClient.query('ALTER TABLE participants ENGINE=InnoDB');
    await Promise.all(pools.map((p) => p.end()));
  }
}

async function checkMysqlCorruptQuota() {
  const pools = [];
  const messages = [];
  const key = `test:invalid-limit:${crypto.randomUUID()}`;
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  try {
    const db = loadMysqlHelpers(pools, messages);
    assert.equal((await db.consumeRateLimit(key, 1, 60_000)).allowed, true);
    await dbClient.query('UPDATE request_rate_limits SET hits = $2 WHERE bucket_key = $1', [hash, '["invalid timestamp"]']);
    const limiter = transpiledModule('src/lib/ratelimit.ts', { './db': db });
    const result = await limiter.rateLimit(key, 1, 60_000);
    assert.equal(result.allowed, false);
    assert.equal(result.unavailable, true);
    assert.equal(limiter.rateLimitResponse(result).status, 503);
    assert.ok(messages.some((message) => message.includes('MYSQL_LIMIT_STATE_INVALID')));
    record('MYSQL-02', 'Malformed persisted quota does not reset or fall back', { allowed: false, unavailable: true, status: 503 });
  } finally {
    await dbClient.query('DELETE FROM request_rate_limits WHERE bucket_key = $1', [hash]);
    await Promise.all(pools.map((p) => p.end()));
  }
}

async function checkMysqlHelpersAndDiagnostic() {
  const pools = [];
  const messages = [];
  try {
    const db = loadMysqlHelpers(pools, messages);
    const fresh = loadMysqlHelpers(pools, messages);
    const input = { nimNip: `Guest-${crypto.randomUUID()}`, name: 'Peserta Uji ñ 🌷', role: 'Tamu Undangan', category: 'Mahasiswa Fasilkom',
      batch: '-', prodi: '-', email: 'synthetic-contact@example.test', phone: '080000000000' };
    const created = await db.createParticipant(input);
    assert.ok(created.participant);
    const participant = created.participant;
    assert.equal(participant.name, input.name);
    assert.equal(participant.nimNip, input.nimNip.toLowerCase());
    assert.equal(typeof participant.isCheckedIn, 'boolean');
    assert.ok(Math.abs(new Date(participant.createdAt).getTime() - Date.now()) < 60_000);
    assert.equal(await fresh.isNimRegistered(input.nimNip.toUpperCase()), true);
    assertNoPrivateFields(await fresh.getParticipantByToken(participant.qrToken));
    assert.equal(await fresh.getParticipantByToken(participant.qrToken.toLowerCase()), null);
    const scans = await Promise.all(Array.from({ length: 10 }, (_, index) => (index % 2 ? db : fresh).checkInParticipant(participant.qrToken)));
    assert.equal(scans.filter((scan) => scan.success).length, 1);
    assert.ok(scans.every((scan) => scan.participant?.isCheckedIn === true));
    assert.match(scans.find((scan) => scan.success).participant.checkedInAt, /Z$/);
    assert.equal((await fresh.getAllParticipants()).some((row) => row.id === participant.id && row.name === input.name), true);
    assert.equal((await db.createParticipant(input)).status, 409);
    const sessionHash = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 3600_000);
    assert.equal(await db.createSessionRecord(sessionHash, expiry, '198.18.205.1', 'Synthetic reviewer'), true);
    assert.equal((await fresh.getSessionRecord(sessionHash)).expiresAt, expiry.toISOString());
    await fresh.deleteSessionRecord(sessionHash);
    assert.equal(await db.getSessionRecord(sessionHash), null);
    for (let index = 0; index < 12; index++) await db.writeAuditLog('login_failed', '198.18.205.1');
    assert.equal(await fresh.countRecentLoginFailures('198.18.205.1', 15 * 60_000), 12);
    assert.ok(await fresh.countRecentAudit('login_failed', 15 * 60_000) >= 12);
    assert.equal(await db.deleteParticipant(participant.id), true);
    assert.equal(await db.deleteParticipant(participant.id), false);
    assert.equal(await fresh.getParticipantByToken(participant.qrToken), null);
    const diagEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
      /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|USERPROFILE|APPDATA|LOCALAPPDATA|TEMP|TMP|HOME)$/i.test(key)));
    const output = execFileSync(process.execPath, [path.join(source, 'scripts/check-mysql.cjs')], {
      cwd: source, env: { ...diagEnv, ...databaseEnv }, encoding: 'utf8', timeout: 30_000,
    });
    const diagnostic = JSON.parse(output);
    assert.equal(diagnostic.connected, true);
    assert.equal(diagnostic.readOnly, true);
    assert.equal(diagnostic.applicationTablesFound, 9);
    assert.equal(diagnostic.schemaWritesVerified, false);
    assert.equal(output.includes(databaseEnv.MYSQL_PASSWORD), false);
    assert.equal(messages.some((message) => [input.email, input.phone, input.name, databaseEnv.MYSQL_PASSWORD].some((privateValue) => message.includes(privateValue))), false);
    record('MYSQL-03', 'Native helpers: Unicode, UTC, exact tokens, sessions and diagnostic', {
      concurrentScans: 10, successfulScans: 1, utf8mb4Preserved: true, timestampsUtc: true, caseChangedTokenAccepted: false,
      sessionSharedAcrossModules: true, failuresPersisted: 12, duplicateStatus: 409, diagnosticReadOnly: true, passwordInOutput: false,
    });
  } finally { await Promise.all(pools.map((p) => p.end())); }
}

async function checkMysqlMaximumImport() {
  const pools = [];
  try {
    const db = loadMysqlHelpers(pools);
    const sessionHash = crypto.randomBytes(32).toString('hex');
    const files = {};
    const name = 'ந'.repeat(120);
    for (const [field, code, count] of [['sistemInformasi', '10', 3334], ['informatika', '30', 3333], ['teknologiInformasi', '20', 3333]]) {
      const rows = [['NIM', 'NAMA'], ...Array.from({ length: count }, (_, index) => [`23${String(index).padStart(6, '0')}${code}01`, name])];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'Mahasiswa');
      files[field] = new File([XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx', compression: true })], `${field}.xlsx`);
    }
    const before = await dbClient.query('SELECT nim FROM student_master ORDER BY nim');
    const preview = await db.previewStudentImport(files, sessionHash);
    assert.equal(preview.errors.length, 0);
    assert.equal(preview.validRows, 10_000);
    const bytes = (await dbClient.query('SELECT OCTET_LENGTH(students) AS bytes FROM student_import_previews WHERE batch_id = $1', [preview.batchId])).rows[0].bytes;
    assert.ok(Number(bytes) > 4 * 1024 * 1024, `Expected a large JSON snapshot; actual bytes: ${bytes}`);
    await db.commitStudentImport(preview.batchId, sessionHash, '198.18.206.1');
    const active = await db.getActiveStudentImportBatch();
    assert.equal(active.count, 10_000);
    assert.equal(active.canRollback, true);
    const counts = (await dbClient.query('SELECT COUNT(*) AS count, COUNT(DISTINCT import_batch_id) AS batches FROM student_master')).rows[0];
    assert.equal(counts.count, 10_000);
    assert.equal(counts.batches, 1);
    const unicode = (await dbClient.query('SELECT official_name FROM student_master LIMIT 1')).rows[0];
    assert.equal(unicode.official_name, name);
    await assert.rejects(dbClient.query(`INSERT INTO student_import_batches
      (batch_id, prodi, total_rows, valid_rows, invalid_rows, duplicate_nims, empty_names, invalid_nims, status)
      VALUES ($1, 'ALL_PRODI', 3, 3, 0, 0, 0, 0, 'ACTIVE')`, [`STU-${crypto.randomUUID()}`]), (error) => error.code === 'ER_DUP_ENTRY');
    const rollback = await db.rollbackToPreviousBatch();
    assert.equal(rollback.count, before.rows.length);
    assert.deepEqual((await dbClient.query('SELECT nim FROM student_master ORDER BY nim')).rows, before.rows);
    record('MYSQL-04', 'Ten-thousand-row Unicode import and transactional rollback', {
      rows: 10_000, snapshotBytes: bytes, perStatementRows: 500, oneActiveBatchEnforced: true,
      restoredRows: rollback.count, originalMasterRestored: true,
    });
  } finally { await Promise.all(pools.map((p) => p.end())); }
}

async function main() {
  console.log(`Review artifacts: ${runDir}`);

  if (databaseOnly) {
    const { dbUrl } = await startDatabase();
    await check('IMPORT-11', 'Active batch metadata and database lifecycle', () => checkActiveBatchQuery(dbUrl));
    await check('RATE-01', 'Persistent concurrent rate limits', () => checkPersistentLimits(dbUrl));
    if (useMysql) {
      await check('MYSQL-01', 'Refuse non-transactional engines', checkMysqlEngineGuard);
      await check('MYSQL-02', 'Persisted quota integrity', checkMysqlCorruptQuota);
      await check('MYSQL-03', 'MySQL-native data/session helpers and diagnostic', checkMysqlHelpersAndDiagnostic);
      await check('MYSQL-04', 'Maximum supported import on real MySQL', checkMysqlMaximumImport);
      await check('MYSQL-06', 'Protocol and pool deadlines on real MySQL', async () => {
        const evidence = await require('./review-mysql-timeouts.cjs').checkMysqlTimeouts({
          source, databaseEnv, dbClient,
          load: (pools, messages, environment) => loadMysqlHelpers(pools, messages, {}, environment),
        });
        record('MYSQL-06', 'Complete query deadlines, discarded leases, and safe recovery', evidence);
      });
    }
    return;
  }

  // Deterministic helper tests use a virtual clock and captured external calls.
  await check('HELPER-01', 'One-hour email limiter after eleven minutes', async () => {
    let now = 100_000;
    class Clock extends Date { static now() { return now; } }
    const limiter = transpiledModule('src/lib/ratelimit.ts', { './db': { consumeRateLimit: async () => null } }, { Date: Clock, process: { env: { NODE_ENV: 'development' } } });
    const first = await limiter.rateLimit('email:test@example.test', 2, 3_600_000);
    const second = await limiter.rateLimit('email:test@example.test', 2, 3_600_000);
    const third = await limiter.rateLimit('email:test@example.test', 2, 3_600_000);
    assert.equal(first.allowed && second.allowed && !third.allowed, true);
    const elapsed = [];
    for (const minutes of [11, 59, 61]) {
      now = 100_000 + minutes * 60_000;
      const result = await limiter.rateLimit('email:test@example.test', 2, 3_600_000);
      assert.equal(result.allowed, minutes > 60);
      elapsed.push({ minutes, allowed: result.allowed });
    }
    record('HELPER-01', 'Development fallback respects a one-hour window', { thirdAllowed: third.allowed, elapsed });
  });

  await check('HELPER-02', 'CSV formula guard and control-character prefixes', async () => {
    const { csvSafe } = transpiledModule('src/lib/validation.ts');
    const outputs = ['=1+1', '+1+1', '-1+1', '@SUM(1)', '\t=1+1', '\r=1+1', ' =1+1'].map((input) => ({ input, output: csvSafe(input) }));
    assert.ok(outputs.every(({ output }) => output.startsWith("'")));
    assert.equal(csvSafe('Nama "Uji"'), 'Nama ""Uji""');
    record('HELPER-02', 'CSV guard outputs', outputs);
  });

  await check('HELPER-03', 'Turnstile response binding and fail-closed behavior', async () => {
    const env = { NODE_ENV: 'production', TURNSTILE_SECRET_KEY: 'synthetic-turnstile-secret' };
    const wrongHost = transpiledModule('src/lib/turnstile.ts', {}, {
      process: { env }, fetch: async () => Response.json({ success: true, hostname: 'other.example.test', action: 'unrelated' }),
    });
    const outage = transpiledModule('src/lib/turnstile.ts', {}, { process: { env }, fetch: async () => { throw new Error('Synthetic timeout'); } });
    assert.equal(await outage.verifyTurnstile('synthetic-token', '198.18.0.1'), false);
    assert.equal(await wrongHost.verifyTurnstile('', '198.18.0.1'), false);
    record('HELPER-03', 'Turnstile verification; hostname/action follow-up remains open', {
      acceptedWrongHostnameAndAction: await wrongHost.verifyTurnstile('synthetic-token', '198.18.0.1'),
      acceptedMissingToken: await wrongHost.verifyTurnstile('', '198.18.0.1'),
      acceptedOutage: await outage.verifyTurnstile('synthetic-token', '198.18.0.1'),
      transport: 'mocked siteverify; no Cloudflare requests',
    });
  });

  await check('HELPER-04', 'HTML email output using a capturing SMTP transport', async () => {
    let captured;
    const mailer = transpiledModule('src/lib/mailer.ts', { nodemailer: { createTransport: () => ({ sendMail: async (mail) => { captured = mail; } }) } }, {
      process: { env: { NODE_ENV: 'production', GMAIL_USER: 'sender@example.test', GMAIL_APP_PASSWORD: 'synthetic', NEXT_PUBLIC_APP_URL: 'https://event.example.test' } },
    });
    await mailer.sendInvitationEmail({ to: 'receiver@example.test', name: '<img src=x onerror=alert(1)>', qrToken: `FAN26-${crypto.randomUUID()}`, category: 'A&B', batch: '2023' });
    assert.equal(captured.html.includes('<img src=x onerror=alert(1)>'), false);
    assert.ok(captured.html.includes('&lt;img src=x onerror=alert(1)&gt;'));
    assert.equal(captured.attachments.length, 1);
    record('HELPER-04', 'HTML escaping', { rawPayloadPresent: captured.html.includes('<img src=x onerror=alert(1)>'), escapedPayloadPresent: captured.html.includes('&lt;img src=x onerror=alert(1)&gt;'), attachmentCount: captured.attachments.length, deliveredExternally: false });
  });

  await check('HELPER-05', 'Trust only configured ingress and fail closed in production', async () => {
    const env = { NODE_ENV: 'production' };
    const limiter = transpiledModule('src/lib/ratelimit.ts', { './db': { consumeRateLimit: async () => null } }, { process: { env } });
    const incoming = new Request('https://event.example.test', { headers: { 'x-real-ip': '198.18.1.1', 'cf-connecting-ip': '198.18.2.2', 'x-forwarded-for': '198.18.3.3' } });
    assert.equal(limiter.getClientIp(incoming), 'unknown');
    env.TRUSTED_PROXY = 'reverse-proxy';
    assert.equal(limiter.getClientIp(incoming), '198.18.1.1');
    env.TRUSTED_PROXY = 'cloudflare';
    assert.equal(limiter.getClientIp(incoming), '198.18.2.2');
    env.TRUSTED_PROXY = 'vercel';
    assert.equal(limiter.getClientIp(incoming), '198.18.3.3');
    delete env.TRUSTED_PROXY;
    env.VERCEL = '1';
    assert.equal(limiter.getClientIp(incoming), '198.18.3.3');
    env.TRUSTED_PROXY = 'reverse-proxy';
    const ipv6 = limiter.getClientIp(new Request('https://event.example.test', { headers: { 'x-real-ip': '2001:0db8:0:0:0:0:0:1' } }));
    assert.equal(ipv6, '2001:db8::1');
    assert.equal(limiter.getClientIp(new Request('https://event.example.test', { headers: { 'x-real-ip': 'fe80::1%eth0' } })), 'unknown');
    assert.equal(limiter.getClientIp(new Request('https://event.example.test', { headers: { 'x-real-ip': 'untrusted, values' } })), 'unknown');
    const unavailable = await limiter.rateLimit('test:fail-closed', 2, 60_000);
    assert.equal(unavailable.allowed, false);
    assert.equal(limiter.rateLimitResponse(unavailable).status, 503);
    record('HELPER-05', 'Ingress and unavailable-store boundaries', { unconfiguredIp: 'unknown', selectedProxies: ['reverse-proxy', 'cloudflare', 'vercel'], normalizedIpv6: ipv6, scopedIpv6Fallback: 'unknown', unavailableStatus: 503 });
  });

  await check('HELPER-06', 'Bounded streamed request bodies and malformed encodings', async () => {
    const { readJsonBody, readImportForm } = transpiledModule('src/lib/requestBody.ts');
    const jsonRequest = (body, headers = {}) => new Request('https://event.example.test', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body, duplex: 'half' });
    assert.equal((await readJsonBody(jsonRequest('{"ok":true}'))).ok, true);
    await assert.rejects(readJsonBody(jsonRequest('{"broken":')), (error) => error.status === 400);
    await assert.rejects(readJsonBody(jsonRequest(new Uint8Array([0xff]))), (error) => error.status === 400);
    await assert.rejects(readJsonBody(jsonRequest('{}', { 'Content-Type': 'text/plain' })), (error) => error.status === 415);
    await assert.rejects(readJsonBody(jsonRequest('{}', { 'Content-Length': '99999999' })), (error) => error.status === 413);
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(2048)); controller.close(); } });
    await assert.rejects(readJsonBody(jsonRequest(stream, { 'Content-Length': '1' }), 1024), (error) => error.status === 413);
    await assert.rejects(readImportForm(jsonRequest('x', { 'Content-Type': 'multipart/form-data; boundary=review', 'Content-Length': String(16 * 1024 * 1024) })), (error) => error.status === 413);
    record('HELPER-06', 'Body limits enforced before parsing', { validJson: true, malformedJsonAndUtf8: 400, wrongMediaType: 415, oversizedAdvertisedAndActualBodies: 413 });
  });

  await check('HELPER-07', 'XLSX archive format and actual expansion boundaries', async () => {
    const { validateXlsxArchive } = transpiledModule('src/lib/xlsxArchive.ts');
    await validateXlsxArchive(filesFor()[0].data);
    const invalidArchives = [
      { name: 'renamed-csv', data: filesFor({ format: 'csv' })[0].data },
      { name: 'too-many-entries', data: zipFixture(Array.from({ length: 513 }, (_, index) => ({ name: `entry-${index}`, data: Buffer.from('x') }))) },
      { name: 'oversized-entry', data: zipFixture([{ name: 'large.xml', data: Buffer.from('x'), declaredSize: 21 * 1024 * 1024 }]) },
      { name: 'understated-expansion', data: zipFixture([{ name: 'large.xml', data: Buffer.alloc(64 * 1024, 65), declaredSize: 1 }]) },
      { name: 'duplicate-entry', data: zipFixture([{ name: 'same.xml', data: Buffer.from('x') }, { name: 'same.xml', data: Buffer.from('y') }]) },
      { name: 'invalid-workbook-structure', data: zipFixture([{ name: 'unrelated.xml', data: Buffer.from('x') }]) },
    ];
    for (const fixture of invalidArchives) await assert.rejects(validateXlsxArchive(fixture.data), (error) => error.status === 400, fixture.name);
    record('HELPER-07', 'Archive validation', { acceptedValidWorkbook: true, rejected: invalidArchives.map(({ name }) => name), largestCompressedFixtureBytes: Math.max(...invalidArchives.map(({ data }) => data.length)) });
  });

  await check('HELPER-08', 'Production helpers never read filesystem participants', async () => {
    let reads = 0;
    const db = transpiledModule('src/lib/db.ts', { fs: { ...fs, existsSync() { reads++; throw new Error('Unexpected fallback read'); } } }, { console: { ...console, error() {} } });
    const actions = [() => db.getParticipantByToken('FAN26-synthetic'), () => db.getAllParticipants(), () => db.isNimRegistered('232410101099'), () => db.checkInParticipant('FAN26-synthetic'), () => db.deleteParticipant('TKT-SYNTHETIC')];
    for (const action of actions) await assert.rejects(action(), (error) => error.status === 503);
    assert.equal(reads, 0);
    record('HELPER-08', 'Central production fallback guard', { guardedHelpers: actions.length, fileReads: reads, errorStatus: 503 });
  });

  await check('HELPER-09', 'MySQL configuration, TLS, and version boundaries', async () => {
    const output = execFileSync(process.execPath, [path.join(source, 'scripts/check-mysql.cjs'), '--self-test'], { encoding: 'utf8', timeout: 30_000 });
    const result = JSON.parse(output);
    assert.equal(result.selfTest, 'passed');
    assert.equal(result.databaseContacted, false);
    record('HELPER-09', 'MySQL connection configuration without database contact', result);
  });

  await check('REVOKE-01', 'Historical token fingerprints match the blocked values', async () => {
    const { isTicketRevoked } = transpiledModule('src/lib/revokedTickets.ts');
    const commits = execFileSync('git', ['log', '--all', '--format=%h', '--', '.participants_data.json'], { cwd: source, encoding: 'utf8' }).trim().split(/\s+/).filter(Boolean);
    const tokens = new Set();
    for (const commit of commits) {
      let raw;
      try { raw = execFileSync('git', ['show', `${commit}:.participants_data.json`], { cwd: source, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); }
      catch { continue; }
      for (const row of JSON.parse(raw)) if (typeof row.qrToken === 'string') tokens.add(row.qrToken);
    }
    for (const token of tokens) assert.equal(isTicketRevoked(token), true, 'An exposed historical token is not revoked');
    assert.equal(isTicketRevoked(`FAN26-${crypto.randomUUID()}`), false);
    record('REVOKE-01', 'Historical revocation coverage', { uniqueTokensChecked: tokens.size, allRejected: true, rawTokensLoggedOrCopiedToTestApp: false });
  });

  if (helpersOnly) return;

  const { dbUrl, dbPassword } = await startDatabase();
  await check('RATE-01', 'Persistent concurrent rate limits', () => checkPersistentLimits(dbUrl));
  const appPort = await freePort();
  const syntheticRevokedToken = `FAN26-${crypto.randomUUID()}`;
  const fallbackToken = `FAN26-${crypto.randomUUID()}`;
  const fallback = { id: 'TKT-REVIEW-LOCAL', nimNip: '232410101099', name: 'Synthetic Local Store', role: 'Mahasiswa', category: 'Mahasiswa Fasilkom', batch: '2023', prodi: 'Sistem Informasi', email: 'synthetic-local@example.test', phone: '080000000099', qrToken: fallbackToken, isCheckedIn: false, checkedInAt: null, createdAt: new Date().toISOString() };

  fs.mkdirSync(appDir);
  for (const name of ['src', 'public', 'package.json', 'package-lock.json', 'next.config.ts', 'tsconfig.json', 'next-env.d.ts', 'postcss.config.mjs']) {
    fs.cpSync(path.join(source, name), path.join(appDir, name), { recursive: true });
  }
  if (cpanel) fs.copyFileSync(path.join(source, 'server.js'), path.join(appDir, 'server.js'));
  // Exercise deployed revocation wiring using a synthetic fingerprint only.
  fs.appendFileSync(path.join(appDir, 'src/lib/revokedTickets.ts'), `\nrevokedTokenHashes.add('${crypto.createHash('sha256').update(syntheticRevokedToken).digest('hex')}');\n`);
  artifacts.syntheticRevocationFixture = true;
  fs.writeFileSync(path.join(appDir, '.participants_data.json'), JSON.stringify([fallback]));
  fs.symlinkSync(path.join(source, 'node_modules'), path.join(appDir, 'node_modules'), 'junction');
  const pin = `Review-${crypto.randomUUID()}`;
  appEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|USERPROFILE|APPDATA|LOCALAPPDATA|TEMP|TMP|HOME|NUMBER_OF_PROCESSORS|PROCESSOR_ARCHITECTURE)$/i.test(key)));
  Object.assign(appEnv, {
    NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1', ...databaseEnv, TRUSTED_PROXY: 'reverse-proxy',
    ADMIN_PIN_HASH: await bcrypt.hash(pin, 12), ADMIN_PIN: '', GMAIL_USER: '', GMAIL_APP_PASSWORD: '',
    TURNSTILE_SECRET_KEY: '', NEXT_PUBLIC_TURNSTILE_SITE_KEY: '', NEXT_PUBLIC_APP_URL: `http://127.0.0.1:${appPort}`, QR_EMAIL_MODE: 'cid',
  });
  const build = await runProcess([path.join(source, 'node_modules/next/dist/bin/next'), 'build', '--webpack'], 'build.log', appEnv);
  record('BUILD-01', 'Isolated production build', build);
  assert.equal(build.code, 0, `Build failed; inspect ${path.join(runDir, 'build.log')}`);
  await check('BUILD-02', 'Server-only values absent from client assets', async () => {
    const leaked = [];
    const walk = (directory) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const filename = path.join(directory, entry.name);
        if (entry.isDirectory()) walk(filename);
        else if (/\.(?:js|json|map|html)$/.test(entry.name)) {
          const text = fs.readFileSync(filename, 'utf8');
          if ([pin, dbPassword, appEnv.ADMIN_PIN_HASH].some((secret) => text.includes(secret))) leaked.push(path.relative(appDir, filename));
        }
      }
    };
    walk(path.join(appDir, '.next', 'static'));
    assert.equal(leaked.length, 0);
    record('BUILD-02', 'Client bundle secret sentinel scan', { leakedFiles: leaked, checked: ['synthetic admin PIN', 'synthetic DB password', 'synthetic bcrypt hash'] });
  });
  baseUrl = `http://127.0.0.1:${appPort}`;
  await startApp(appPort);

  await check('AUTH-01', 'Unauthenticated and fabricated session access', async () => {
    const routes = [
      ['/api/admin/participants', 'GET'], ['/api/admin/participants/test', 'DELETE'], ['/api/admin/checkin', 'POST'],
      ['/api/admin/student-imports/preview', 'POST'], ['/api/admin/student-imports/commit', 'POST'],
      ['/api/admin/student-imports/rollback', 'POST'], ['/api/admin/student-imports/active', 'GET'],
    ];
    const results = [];
    for (const [route, method] of routes) {
      const missing = await request(route, { method });
      const forged = await request(route, { method, cookie: 'fan26_session=forged' });
      assert.equal(missing.status, 401);
      assert.equal(forged.status, 401);
      results.push({ route, missing: missing.status, forged: forged.status });
    }
    const page = await request('/admin/dashboard');
    const forgedPage = await request('/admin/dashboard', { cookie: 'fan26_session=forged' });
    record('AUTH-01', 'API authority versus UI guard', { routes: results, pageWithoutCookie: page.status, pageWithForgedCookie: forgedPage.status });
  });

  const loginPage = await request('/admin/login');
  const csrfCookie = loginPage.headers.getSetCookie().find((value) => value.startsWith('fan26_csrf='));
  assert.ok(csrfCookie, 'Expected CSRF cookie');
  csrfToken = csrfCookie.split(';')[0].slice('fan26_csrf='.length);
  const login = await request('/api/admin/login', { method: 'POST', body: { pin } });
  assert.equal(login.status, 200);
  const sessionSetCookie = login.headers.getSetCookie().find((value) => value.startsWith('fan26_session='));
  assert.ok(sessionSetCookie);
  adminCookie = `${sessionSetCookie.split(';')[0]}; fan26_csrf=${csrfToken}`;
  record('AUTH-02', 'Successful login cookie attributes', { httpOnly: /httponly/i.test(sessionSetCookie), secure: /; secure/i.test(sessionSetCookie), sameSiteStrict: /samesite=strict/i.test(sessionSetCookie), maxAge: /max-age=(\d+)/i.exec(sessionSetCookie)?.[1] });

  await check('CSRF-01', 'Mutation endpoints with absent or incorrect CSRF', async () => {
    const results = [];
    for (const [route, method] of [['/api/admin/participants/test', 'DELETE'], ['/api/admin/checkin', 'POST'], ['/api/admin/student-imports/preview', 'POST'], ['/api/admin/student-imports/commit', 'POST'], ['/api/admin/student-imports/rollback', 'POST'], ['/api/admin/logout', 'POST']]) {
      const missing = await adminRequest(route, { method, csrf: undefined });
      const wrong = await adminRequest(route, { method, csrf: 'wrong' });
      assert.equal(missing.status, 403);
      assert.equal(wrong.status, 403);
      results.push({ route, missing: missing.status, wrong: wrong.status });
    }
    record('CSRF-01', 'CSRF rejection', results);
  });

  await check('IMPORT-01', 'Normal three-file preview and commit', async () => {
    const files = filesFor();
    const preview = await adminRequest('/api/admin/student-imports/preview', { method: 'POST', body: upload(files) });
    assert.equal(preview.status, 200);
    assert.equal(preview.json.validRows, 3);
    assert.equal(preview.json.errors.length, 0);
    const commit = await adminRequest('/api/admin/student-imports/commit', { method: 'POST', body: { batchId: preview.json.batchId } });
    assert.equal(commit.status, 200);
    assertNoStore(preview);
    assertNoStore(commit);
    record('IMPORT-01', 'Valid import baseline', { preview: preview.status, validRows: preview.json.validRows, invalidRows: preview.json.invalidRows, commit: commit.status });
  });

  await check('REGISTER-01', 'Server-side role and identity checks', async () => {
    const sample = filesFor()[0];
    const normal = { nimNip: sample.nim, name: sample.name, role: 'Mahasiswa', category: 'Mahasiswa Fasilkom', batch: '2026', prodi: 'Tampered', email: 'review@example.test', phone: '080000000000' };
    const results = [];
    for (const override of [{ role: 'Dosen' }, { nimNip: '232410101099' }, { name: 'Nama Tidak Cocok' }]) {
      const response = await request('/api/register', { method: 'POST', body: { ...normal, ...override } });
      assert.equal(response.status, 403);
      results.push({ changed: Object.keys(override)[0], status: response.status });
    }
    record('REGISTER-01', 'Direct API validation', results);
  });

  let claimedParticipant;
  let claimedPrivate;
  await check('REGISTER-02', 'Known identity registered with unrelated email', async () => {
    const sample = filesFor()[0];
    const body = { nimNip: sample.nim, name: sample.name.toUpperCase(), role: 'Mahasiswa', category: 'BEM', batch: '2026', prodi: 'Tampered', email: 'unrelated-recipient@example.test', phone: '080000000001' };
    const first = await request('/api/register', { method: 'POST', body });
    assert.equal(first.status, 200);
    claimedParticipant = first.json.participant;
    assertNoPrivateFields(claimedParticipant);
    assertNoStore(first);
    claimedPrivate = { email: body.email, phone: body.phone };
    const stored = (await dbClient.query('SELECT email FROM participants WHERE id = $1', [claimedParticipant.id])).rows[0];
    const second = await request('/api/register', { method: 'POST', body: { ...body, email: 'student-owner@example.test' } });
    assert.equal(second.status, 409);
    assert.equal(stored.email, body.email);
    assert.equal(claimedParticipant.prodi, 'Sistem Informasi');
    assert.equal(claimedParticipant.batch, '2023');
    record('REGISTER-02', 'Identity ownership deliberately deferred; public fields minimized', { firstStatus: first.status, ticketReturned: Boolean(first.json.ticketUrl), unrelatedEmailStored: stored.email === body.email, privateFieldsReturned: false, ownerRetryStatus: second.status, storedProdi: claimedParticipant.prodi, storedBatch: claimedParticipant.batch, clientSelectedCategory: claimedParticipant.category, emailSent: first.json.emailSent });
  });

  await check('REGISTER-03', 'Concurrent registration uniqueness', async () => {
    const sample = filesFor()[1];
    const responses = await Promise.all([0, 1].map((index) => request('/api/register', { method: 'POST', body: { nimNip: sample.nim, name: sample.name, role: 'Mahasiswa', category: 'Mahasiswa Fasilkom', email: `concurrent-${index}@example.test` } })));
    const statuses = responses.map((r) => r.status).sort();
    assert.deepEqual(statuses, [200, 409]);
    record('REGISTER-03', 'One registration per NIM', { statuses });
  });

  await check('REGISTER-04', 'Invalid identities do not consume recipient quota', async () => {
    const email = 'quota-target@example.test';
    const sample = filesFor()[2];
    const statuses = [];
    for (let index = 0; index < 2; index++) {
      const response = await request('/api/register', { method: 'POST', body: { nimNip: '232410101099', name: 'Not In Master', role: 'Mahasiswa', category: 'Mahasiswa Fasilkom', email } });
      statuses.push(response.status);
    }
    const valid = await request('/api/register', { method: 'POST', body: { nimNip: sample.nim, name: sample.name, role: 'Mahasiswa', category: 'Mahasiswa Fasilkom', email } });
    const persisted = await dbClient.query('SELECT COUNT(*)::int AS count FROM participants WHERE email = $1', [email]);
    const quota = await dbClient.query('SELECT cardinality(hits)::int AS hits FROM request_rate_limits WHERE bucket_key = $1', [crypto.createHash('sha256').update(`register:email:${email}`).digest('hex')]);
    assert.deepEqual(statuses, [403, 403]);
    assert.equal(valid.status, 200);
    assert.equal(persisted.rows[0].count, 1);
    assert.equal(quota.rows[0].hits, 1);
    record('REGISTER-04', 'Recipient quota only counts successful-registration email attempts', { invalidAttemptStatuses: statuses, validAttemptStatus: valid.status, persistedRegistrationsForEmail: persisted.rows[0].count, quotaHits: quota.rows[0].hits });
  });

  await check('PRIVACY-01', 'Public enumeration and ticket serialization', async () => {
    const used = await request(`/api/register/check?nim=${claimedParticipant.nimNip}`);
    const unused = await request('/api/register/check?nim=232410101099');
    const identity = await request('/api/register/validate-identity', { method: 'POST', body: { nim: claimedParticipant.nimNip, name: claimedParticipant.name } });
    const ticket = await request(`/ticket/${claimedParticipant.qrToken}`);
    let rsc = await request(`/ticket/${claimedParticipant.qrToken}?_rsc=security-review`, { headers: { RSC: '1' } });
    // Next 16 validates the _rsc discriminator and redirects to its correct hash.
    if (rsc.status === 307) {
      const target = new URL(rsc.headers.get('location'), baseUrl);
      assert.equal(target.origin, baseUrl);
      rsc = await request(target.pathname + target.search, { headers: { RSC: '1' } });
    }
    const wrongTicket = await request(`/ticket/FAN26-${crypto.randomUUID()}`);
    assert.equal(ticket.status, 200);
    assert.equal(wrongTicket.status, 404);
    assert.equal(rsc.status, 200);
    assert.match(rsc.headers.get('content-type') || '', /text\/x-component/);
    for (const response of [ticket, rsc]) {
      assert.equal(response.text.includes(claimedPrivate.email), false);
      assert.equal(response.text.includes(claimedPrivate.phone), false);
      assertNoStore(response);
    }
    record('PRIVACY-01', 'No contacts in ticket HTML/RSC; public status feedback remains open', { registeredAvailable: used.json.available, unregisteredAvailable: unused.json.available, knownIdentityValid: identity.json.valid, ticketStatus: ticket.status, wrongTicketStatus: wrongTicket.status, rscStatus: rsc.status, emailInTicketHtml: false, phoneInTicketHtml: false, contactsInRsc: false, ticketCacheControl: ticket.headers.get('cache-control'), ticketRobots: ticket.headers.get('x-robots-tag') });
  });

  await check('CHECKIN-01', 'Concurrent QR scans and SQL metacharacters', async () => {
    const responses = await Promise.all([0, 1].map(() => adminRequest('/api/admin/checkin', { method: 'POST', body: { qrToken: claimedParticipant.qrToken } })));
    assert.equal(responses.filter((r) => r.json.success).length, 1);
    const oversized = await adminRequest('/api/admin/checkin', { method: 'POST', body: { qrToken: 'A'.repeat(80) } });
    const sql = await adminRequest('/api/admin/checkin', { method: 'POST', body: { qrToken: "' OR '1'='1" } });
    assert.equal(oversized.status, 400);
    assert.equal(sql.json.success, false);
    record('CHECKIN-01', 'Atomic check-in and bounded input', { successfulConcurrentScans: responses.filter((r) => r.json.success).length, oversizedStatus: oversized.status, sqlPayloadAccepted: sql.json.success });
  });

  await check('HEADERS-01', 'Production security and cache headers', async () => {
    const page = await request('/');
    const participants = await adminRequest('/api/admin/participants');
    const csv = await adminRequest('/api/admin/participants?format=csv');
    const qr = await request(`/api/qr/${claimedParticipant.qrToken}`);
    const invalidCsrfEncoding = await adminRequest('/api/admin/checkin', { method: 'POST', cookie: `${adminCookie.split(';')[0]}; fan26_csrf=%`, body: { qrToken: 'invalid' } });
    assert.equal(invalidCsrfEncoding.status, 403);
    for (const response of [participants, csv, qr, invalidCsrfEncoding]) assertNoStore(response);
    assert.equal(participants.status, 200);
    assert.equal(csv.status, 200);
    assert.equal(qr.status, 200);
    record('HEADERS-01', 'Observed production headers', { csp: page.headers.get('content-security-policy'), hsts: page.headers.get('strict-transport-security'), xFrameOptions: page.headers.get('x-frame-options'), noSniff: page.headers.get('x-content-type-options'), poweredBy: page.headers.get('x-powered-by'), participantsCache: participants.headers.get('cache-control'), csvCache: csv.headers.get('cache-control'), qrCache: qr.headers.get('cache-control'), malformedCsrfCookieStatus: invalidCsrfEncoding.status });
  });

  await check('IMPORT-02', 'Wrong Origin with otherwise valid admin credentials', async () => {
    const foreign = 'https://other.example.test';
    const checkin = await adminRequest('/api/admin/checkin', { method: 'POST', origin: foreign, body: { qrToken: 'invalid' } });
    assert.equal(checkin.status, 403);
    const results = [];
    for (const route of ['/api/admin/student-imports/preview', '/api/admin/student-imports/commit', '/api/admin/student-imports/rollback', '/api/admin/logout']) {
      const response = await adminRequest(route, { method: 'POST', origin: foreign });
      assert.equal(response.status, 403);
      results.push({ route, status: response.status });
    }
    record('IMPORT-02', 'Origin policy consistency', { checkinStatus: checkin.status, mutations: results, prerequisites: 'valid session and matching CSRF supplied; tests server Origin policy' });
  });

  await check('IMPORT-03', 'XLSX format, length, and field-type validation', async () => {
    const csv = await adminRequest('/api/admin/student-imports/preview', { method: 'POST', body: upload(filesFor({ format: 'csv' })) });
    const length = await adminRequest('/api/admin/student-imports/preview', { method: 'POST', body: upload(filesFor({ nimOverrides: { sistemInformasi: '2324101010', informatika: '23241010300199999999' } })) });
    const invalid = new FormData();
    for (const field of ['sistemInformasi', 'informatika', 'teknologiInformasi']) invalid.append(field, 'not-a-file');
    const stringFields = await adminRequest('/api/admin/student-imports/preview', { method: 'POST', body: invalid });
    const codes = await adminRequest('/api/admin/student-imports/preview', { method: 'POST', body: upload(filesFor({ nimOverrides: { sistemInformasi: '232410101101', informatika: '232410103101', teknologiInformasi: '232410102101' } })) });
    const numeric = await adminRequest('/api/admin/student-imports/preview', { method: 'POST', body: upload(filesFor({ numericNims: true })) });
    assert.equal(csv.json.validRows, 0);
    assert.ok(csv.json.errors.length > 0);
    assert.equal(length.json.invalidRows, 2);
    assert.equal(codes.json.validRows, 3);
    assert.equal(codes.json.errors.length, 0);
    assert.equal(numeric.json.validRows, 3);
    assert.equal(numeric.json.errors.length, 0);
    assert.equal(stringFields.status, 400);
    record('IMPORT-03', 'Workbook and exact NIM validation', { csvRenamedXlsxValidRows: csv.json.validRows, nonTwelveDigitValidRows: length.json.validRows, alternateCodesValidRows: codes.json.validRows, numericCellValidRows: numeric.json.validRows, stringFieldsStatus: stringFields.status });
  });

  await check('IMPORT-04', 'Invalid rows, wrong program, and oversize upload', async () => {
    const wrong = await adminRequest('/api/admin/student-imports/preview', { method: 'POST', body: upload(filesFor({ nimOverrides: { sistemInformasi: '232410103001' } })) });
    const malformed = filesFor();
    malformed[0].data = Buffer.from([0, 255, 0, 255]);
    const corrupt = await adminRequest('/api/admin/student-imports/preview', { method: 'POST', body: upload(malformed) });
    const large = filesFor();
    large[0].data = Buffer.alloc(5 * 1024 * 1024 + 1, 65);
    const tooLarge = await adminRequest('/api/admin/student-imports/preview', { method: 'POST', body: upload(large) });
    assert.ok(wrong.json.invalidRows > 0);
    assert.ok(corrupt.json.errors.length > 0);
    assert.equal(tooLarge.status, 400);
    record('IMPORT-04', 'Rejected upload cases', { wrongProgramInvalidRows: wrong.json.invalidRows, corruptErrors: corrupt.json.errors, oversizedStatus: tooLarge.status });
  });

  await check('IMPORT-05', 'Preview ownership, expiry, snapshot binding, and replay', async () => {
    const before = await dbClient.query('SELECT nim FROM student_master ORDER BY nim');
    const preview = await adminRequest('/api/admin/student-imports/preview', { method: 'POST', body: upload(filesFor({ suffix: '02' })) });
    assert.equal(preview.json.errors.length, 0);
    const batchId = preview.json.batchId;
    const changedCommit = await adminRequest('/api/admin/student-imports/commit', { method: 'POST', body: upload(filesFor({ suffix: '03' }), batchId) });
    assert.equal(changedCommit.status, 415);
    const changedJson = await adminRequest('/api/admin/student-imports/commit', { method: 'POST', body: { batchId, students: [] } });
    assert.equal(changedJson.status, 400);
    const direct = await adminRequest('/api/admin/student-imports/commit', { method: 'POST', body: { batchId: `STU-${crypto.randomUUID()}` } });
    assert.equal(direct.status, 409);

    const otherLogin = await request('/api/admin/login', { method: 'POST', body: { pin } });
    assert.equal(otherLogin.status, 200);
    const otherCookie = `${otherLogin.headers.getSetCookie().find((value) => value.startsWith('fan26_session=')).split(';')[0]}; fan26_csrf=${csrfToken}`;
    const otherSession = await adminRequest('/api/admin/student-imports/commit', { method: 'POST', cookie: otherCookie, body: { batchId } });
    assert.equal(otherSession.status, 409);

    const expiring = await adminRequest('/api/admin/student-imports/preview', { method: 'POST', body: upload(filesFor({ suffix: '03' })) });
    await dbClient.query("UPDATE student_import_previews SET expires_at = NOW() - INTERVAL '1 second' WHERE batch_id = $1", [expiring.json.batchId]);
    const expired = await adminRequest('/api/admin/student-imports/commit', { method: 'POST', body: { batchId: expiring.json.batchId } });
    assert.equal(expired.status, 409);
    assert.deepEqual((await dbClient.query('SELECT nim FROM student_master ORDER BY nim')).rows, before.rows);

    const commit = await adminRequest('/api/admin/student-imports/commit', { method: 'POST', body: { batchId } });
    assert.equal(commit.status, 200);
    const current = await dbClient.query('SELECT nim FROM student_master ORDER BY nim');
    assert.ok(current.rows.every((row) => row.nim.endsWith('02')));
    const consumed = (await dbClient.query('SELECT consumed_at IS NOT NULL AS consumed, jsonb_array_length(students)::int AS students FROM student_import_previews WHERE batch_id = $1', [batchId])).rows[0];
    assert.equal(consumed.consumed, true);
    assert.equal(consumed.students, 0);
    const replay = await adminRequest('/api/admin/student-imports/commit', { method: 'POST', body: { batchId } });
    assert.equal(replay.status, 409);

    const nextPreview = await adminRequest('/api/admin/student-imports/preview', { method: 'POST', body: upload(filesFor({ suffix: '03' })) });
    const nextCommit = await adminRequest('/api/admin/student-imports/commit', { method: 'POST', body: { batchId: nextPreview.json.batchId } });
    assert.equal(nextCommit.status, 200);
    const rollback = await adminRequest('/api/admin/student-imports/rollback', { method: 'POST' });
    assert.equal(rollback.status, 200);
    const after = await dbClient.query('SELECT nim FROM student_master ORDER BY nim');
    assert.deepEqual(after.rows, current.rows);
    const active = await dbClient.query("SELECT COUNT(*)::int AS count FROM student_import_batches WHERE status = 'ACTIVE'");
    assert.equal(active.rows[0].count, 1);
    record('IMPORT-05', 'Snapshot workflow rejects unauthorized changes', { changedMultipartStatus: changedCommit.status, extraJsonStatus: changedJson.status, inventedPreviewStatus: direct.status, otherSessionStatus: otherSession.status, expiredStatus: expired.status, validCommitStatus: commit.status, replayStatus: replay.status, consumedSnapshotCleared: true, rollbackStatus: rollback.status, restoredApprovedSnapshot: true, activeBatches: active.rows[0].count });
  });

  await check('IMPORT-11', 'Active metadata exposed correctly over HTTP', async () => {
    const response = await adminRequest('/api/admin/student-imports/active');
    const stored = (await dbClient.query("SELECT batch_id FROM student_import_batches WHERE status = 'ACTIVE'")).rows[0];
    assert.equal(response.status, 200);
    assert.equal(response.json.active, true);
    assert.equal(response.json.batchId, stored.batch_id);
    assert.equal(response.json.count, 3);
    assert.equal(response.json.canRollback, true);
    record('IMPORT-11', 'Active batch metadata', { status: response.status, count: response.json.count, matchesDatabase: true, canRollback: response.json.canRollback });
  });

  await check('IMPORT-06', 'Reject oversized official and normalized names in preview', async () => {
    const before = await dbClient.query('SELECT nim FROM student_master ORDER BY nim');
    const batchCount = (await dbClient.query('SELECT COUNT(*)::int AS count FROM student_import_batches')).rows[0].count;
    const files = filesFor({ suffix: '04', names: { sistemInformasi: 'A'.repeat(121), informatika: '\ufb03'.repeat(41) } });
    const preview = await adminRequest('/api/admin/student-imports/preview', { method: 'POST', body: upload(files) });
    const commit = await adminRequest('/api/admin/student-imports/commit', { method: 'POST', body: { batchId: preview.json.batchId } });
    const after = await dbClient.query('SELECT nim FROM student_master ORDER BY nim');
    const afterCount = (await dbClient.query('SELECT COUNT(*)::int AS count FROM student_import_batches')).rows[0].count;
    assert.deepEqual(after.rows, before.rows);
    assert.equal(afterCount, batchCount);
    assert.equal(preview.json.invalidRows, 2);
    assert.equal(commit.status, 409);
    record('IMPORT-06', 'Name length errors caught before activation', { previewStatus: preview.status, previewInvalidRows: preview.json.invalidRows, commitStatus: commit.status, masterPreserved: true, batchCountPreserved: true });
  });

  await check('IMPORT-07', 'Serialized concurrent commits and rollback', async () => {
    const previews = await Promise.all(['05', '06'].map((suffix) => adminRequest('/api/admin/student-imports/preview', { method: 'POST', body: upload(filesFor({ suffix })) })));
    const responses = await Promise.all(previews.map((preview) => adminRequest('/api/admin/student-imports/commit', { method: 'POST', body: { batchId: preview.json.batchId } })));
    const active = await dbClient.query("SELECT COUNT(*)::int AS count FROM student_import_batches WHERE status = 'ACTIVE'");
    const current = await dbClient.query('SELECT COUNT(*)::int AS count, COUNT(DISTINCT import_batch_id)::int AS batches FROM student_master');
    record('IMPORT-07', 'Concurrent batch activation', { statuses: responses.map((r) => r.status), activeBatches: active.rows[0].count, masterRows: current.rows[0].count, masterDistinctBatches: current.rows[0].batches });
    assert.equal(active.rows[0].count, 1);
    assert.equal(current.rows[0].batches, 1);
    assert.ok(responses.every((response) => response.status === 200));
  });

  await check('IMPORT-08', 'Commit racing with rollback', async () => {
    const preview = await adminRequest('/api/admin/student-imports/preview', { method: 'POST', body: upload(filesFor({ suffix: '07' })) });
    const responses = await Promise.all([
      adminRequest('/api/admin/student-imports/commit', { method: 'POST', body: { batchId: preview.json.batchId } }),
      adminRequest('/api/admin/student-imports/rollback', { method: 'POST' }),
    ]);
    const state = await dbClient.query("SELECT COUNT(DISTINCT s.import_batch_id)::int AS master_batches, COUNT(s.nim)::int AS master_rows FROM student_master s JOIN student_import_batches b ON b.batch_id = s.import_batch_id WHERE b.status = 'ACTIVE'");
    const active = (await dbClient.query("SELECT COUNT(*)::int AS count FROM student_import_batches WHERE status = 'ACTIVE'")).rows[0].count;
    assert.equal(active, 1);
    assert.equal(state.rows[0].master_batches, 1);
    assert.equal(state.rows[0].master_rows, 3);
    assert.ok(responses.every((response) => response.status === 200));
    record('IMPORT-08', 'Concurrent commit/rollback integrity', { statuses: responses.map((r) => r.status), activeBatches: active, ...state.rows[0] });
  });

  await check('IMPORT-09', 'Failure after deleting the old master rolls everything back', async () => {
    const before = await dbClient.query('SELECT nim FROM student_master ORDER BY nim');
    const beforeBatches = (await dbClient.query('SELECT COUNT(*)::int AS count FROM student_import_batches')).rows[0].count;
    const preview = await adminRequest('/api/admin/student-imports/preview', { method: 'POST', body: upload(filesFor({ suffix: '08' })) });
    if (useMysql) {
      await dbClient.query("CREATE TRIGGER review_abort BEFORE INSERT ON student_master FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Synthetic review failure during master insert'");
    } else {
      await dbClient.query("CREATE FUNCTION review_abort_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic review failure during master insert'; END $$");
      await dbClient.query('CREATE TRIGGER review_abort BEFORE INSERT ON student_master FOR EACH ROW EXECUTE FUNCTION review_abort_insert()');
    }
    let response;
    try {
      response = await adminRequest('/api/admin/student-imports/commit', { method: 'POST', body: { batchId: preview.json.batchId } });
    } finally {
      await dbClient.query(useMysql ? 'DROP TRIGGER review_abort' : 'DROP TRIGGER review_abort ON student_master');
      if (!useMysql) await dbClient.query('DROP FUNCTION review_abort_insert()');
    }
    const after = await dbClient.query('SELECT nim FROM student_master ORDER BY nim');
    const afterBatches = (await dbClient.query('SELECT COUNT(*)::int AS count FROM student_import_batches')).rows[0].count;
    assert.deepEqual(after.rows, before.rows);
    assert.equal(afterBatches, beforeBatches);
    assert.equal(response.status, useMysql ? 503 : 500);
    assert.equal(response.text.includes('Synthetic review failure'), false);
    assert.equal(response.text.includes('review_abort'), false);
    const previewState = (await dbClient.query('SELECT consumed_at, jsonb_array_length(students)::int AS students FROM student_import_previews WHERE batch_id = $1', [preview.json.batchId])).rows[0];
    assert.equal(previewState.consumed_at, null);
    assert.equal(previewState.students, 3);
    const retry = await adminRequest('/api/admin/student-imports/commit', { method: 'POST', body: { batchId: preview.json.batchId } });
    assert.equal(retry.status, 200);
    record('IMPORT-09', 'Late transaction rollback and safe retry', { failedCommitStatus: response.status, masterRestored: true, batchCountRestored: true, errorSanitized: true, previewPreserved: true, retryStatus: retry.status });
  });

  await check('IMPORT-10', 'Empty program file, duplicate NIM, and malformed JSON body', async () => {
    const empty = filesFor();
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['NO', 'NIM', 'NAMA']]), 'Mahasiswa');
    empty[0].data = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const emptyPreview = await adminRequest('/api/admin/student-imports/preview', { method: 'POST', body: upload(empty) });
    const duplicate = filesFor();
    const repeated = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(repeated, XLSX.utils.aoa_to_sheet([['NO', 'NIM', 'NAMA'], [1, duplicate[0].nim, duplicate[0].name], [2, duplicate[0].nim, duplicate[0].name]]), 'Mahasiswa');
    duplicate[0].data = XLSX.write(repeated, { type: 'buffer', bookType: 'xlsx' });
    const duplicatePreview = await adminRequest('/api/admin/student-imports/preview', { method: 'POST', body: upload(duplicate) });
    const badJson = await request('/api/register', { method: 'POST', body: '{"broken":', headers: { 'Content-Type': 'application/json' } });
    const large = await request('/api/register/validate-identity', { method: 'POST', body: { nim: '232410101099', name: 'Unknown', ignored: 'A'.repeat(512 * 1024) } });
    assert.ok(emptyPreview.json.errors.length > 0);
    assert.equal(duplicatePreview.json.duplicateNims, 1);
    assert.equal(badJson.status, 400);
    assert.equal(large.status, 413);
    record('IMPORT-10', 'Remaining input boundaries', { headerOnlyProgramValidRows: emptyPreview.json.validRows, headerOnlyProgramErrors: emptyPreview.json.errors, duplicateCount: duplicatePreview.json.duplicateNims, malformedJsonStatus: badJson.status, halfMegabyteIdentityRequestStatus: large.status });
  });

  await check('IMPORT-12', 'File fields, year/prodi allowlists, and workbook size boundaries', async () => {
    const duplicateFields = upload(filesFor());
    duplicateFields.append('sistemInformasi', new Blob([filesFor()[0].data]), 'duplicate.xlsx');
    const duplicated = await adminRequest('/api/admin/student-imports/preview', { method: 'POST', body: duplicateFields });
    const extraFields = upload(filesFor());
    extraFields.append('unexpected', 'value');
    const extra = await adminRequest('/api/admin/student-imports/preview', { method: 'POST', body: extraFields });
    const emptyFiles = filesFor();
    emptyFiles[0].data = Buffer.alloc(0);
    const empty = await adminRequest('/api/admin/student-imports/preview', { method: 'POST', body: upload(emptyFiles) });
    assert.equal(duplicated.status, 400);
    assert.equal(extra.status, 400);
    assert.equal(empty.status, 400);

    const years = await adminRequest('/api/admin/student-imports/preview', { method: 'POST', body: upload(filesFor({ nimOverrides: { sistemInformasi: '242410101001', informatika: '252410103001', teknologiInformasi: '262410102001' } })) });
    assert.equal(years.json.validRows, 3);
    assert.equal(years.json.errors.length, 0);
    const invalidCodes = await adminRequest('/api/admin/student-imports/preview', { method: 'POST', body: upload(filesFor({ nimOverrides: { sistemInformasi: '222410101001', informatika: '232410104001' } })) });
    assert.equal(invalidCodes.json.invalidRows, 2);

    const sparseFiles = filesFor();
    for (const [index, range] of ['A1:DY2', 'A1:C10003'].entries()) {
      const workbook = XLSX.read(sparseFiles[index].data, { type: 'buffer' });
      workbook.Sheets[workbook.SheetNames[0]]['!ref'] = range;
      sparseFiles[index].data = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx', compression: true });
    }
    const sparse = await adminRequest('/api/admin/student-imports/preview', { method: 'POST', body: upload(sparseFiles) });
    assert.ok(sparse.json.errors.length >= 2);

    const many = filesFor();
    for (const file of many) {
      const code = file.nim.slice(8, 10);
      const workbook = XLSX.utils.book_new();
      const rows = [['NIM', 'NAMA'], ...Array.from({ length: 3334 }, (_, index) => [`23${String(index).padStart(6, '0')}${code}01`, `Mahasiswa Uji ${index}`])];
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'Mahasiswa');
      file.data = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx', compression: true });
    }
    const rowCap = await adminRequest('/api/admin/student-imports/preview', { method: 'POST', body: upload(many) });
    assert.equal(rowCap.status, 400);
    record('IMPORT-12', 'Import boundaries', { duplicateFieldsStatus: duplicated.status, extraFieldStatus: extra.status, emptyFileStatus: empty.status, validLaterYears: years.json.validRows, invalidYearOrProgramRows: invalidCodes.json.invalidRows, sparseRangeErrors: sparse.json.errors.length, overTenThousandRowsStatus: rowCap.status });
  });

  await check('IMPORT-13', 'Valid aggregate uploads above the Next Proxy default limit', async () => {
    const files = filesFor();
    for (const file of files) file.data = await paddedWorkbook(file.data);
    const total = files.reduce((sum, file) => sum + file.data.length, 0);
    assert.ok(total > 10 * 1024 * 1024);
    assert.ok(files.every((file) => file.data.length <= 5 * 1024 * 1024));
    const preview = await adminRequest('/api/admin/student-imports/preview', { method: 'POST', body: upload(files) });
    assert.equal(preview.status, 200);
    assert.equal(preview.json.validRows, 3);
    assert.equal(preview.json.errors.length, 0);
    record('IMPORT-13', 'Large valid multipart preserved through Proxy', { totalFileBytes: total, perFileBytes: files.map((file) => file.data.length), status: preview.status, validRows: preview.json.validRows, environment: 'isolated self-hosted Next production server; not Vercel ingress' });
  });

  await check('BODY-01', 'JSON route shapes, limits, and media types', async () => {
    const results = [];
    for (const route of ['/api/register', '/api/register/validate-identity', '/api/admin/login', '/api/admin/checkin', '/api/admin/student-imports/commit']) {
      const invalid = await adminRequest(route, { method: 'POST', body: null });
      const wrongType = await adminRequest(route, { method: 'POST', body: '{}', headers: { 'Content-Type': 'text/plain' } });
      const tooLarge = await adminRequest(route, { method: 'POST', body: { ignored: 'A'.repeat(20 * 1024) } });
      assert.equal(invalid.status, 400);
      assert.equal(wrongType.status, 415);
      assert.equal(tooLarge.status, 413);
      for (const response of [invalid, wrongType, tooLarge]) assertNoStore(response);
      results.push({ route, invalidShape: invalid.status, wrongType: wrongType.status, tooLarge: tooLarge.status });
    }
    record('BODY-01', 'Bounded JSON endpoints', results);
  });

  await check('REGISTER-05', 'Exhausted mail quota still issues valid tickets', async () => {
    const email = 'quota-full@example.test';
    const students = (await dbClient.query('SELECT nim, official_name FROM student_master ORDER BY nim')).rows;
    assert.equal(students.length, 3);
    const responses = [];
    for (const student of students) responses.push(await request('/api/register', { method: 'POST', body: { nimNip: student.nim, name: student.official_name, role: 'Mahasiswa', category: 'Mahasiswa Fasilkom', email } }));
    assert.ok(responses.every((response) => response.status === 200 && response.json.ticketUrl));
    assert.equal(responses[2].json.emailSent, false);
    const quota = (await dbClient.query('SELECT cardinality(hits)::int AS hits FROM request_rate_limits WHERE bucket_key = $1', [crypto.createHash('sha256').update(`register:email:${email}`).digest('hex')])).rows[0];
    assert.equal(quota.hits, 2);
    record('REGISTER-05', 'Email quota does not block ticket issuance', { statuses: responses.map((response) => response.status), quotaHits: quota.hits, thirdEmailSent: responses[2].json.emailSent, smtpConfigured: false });
  });

  await check('REVOKE-02', 'Revoked bearer rejected by ticket, QR, and check-in', async () => {
    await dbClient.query(`INSERT INTO participants (id, nim_nip, name, role, category, batch, prodi, email, phone, qr_token)
      VALUES ('TKT-REVOKED-TEST', '232410101098', 'Synthetic Revoked Ticket', 'Mahasiswa', 'Mahasiswa Fasilkom', '2023', 'Sistem Informasi', 'revoked@example.test', '-', $1)`, [syntheticRevokedToken]);
    const ticket = await request(`/ticket/${syntheticRevokedToken}`);
    const qr = await request(`/api/qr/${syntheticRevokedToken}`);
    const checkin = await adminRequest('/api/admin/checkin', { method: 'POST', body: { qrToken: syntheticRevokedToken } });
    const row = (await dbClient.query("SELECT is_checked_in FROM participants WHERE id = 'TKT-REVOKED-TEST'")).rows[0];
    assert.equal(ticket.status, 404);
    assert.equal(qr.status, 404);
    assert.equal(checkin.json.success, false);
    assert.equal(row.is_checked_in, false);
    assert.equal(ticket.text.includes('Synthetic Revoked Ticket'), false);
    record('REVOKE-02', 'Revocation enforcement', { ticketStatus: ticket.status, qrStatus: qr.status, checkinAccepted: checkin.json.success, storedAttendanceUnchanged: true, fixture: 'synthetic token hash added only to temporary test app' });
  });

  await check('PRIVACY-02', 'Healthy DB misses do not resurrect local records or seeds', async () => {
    const local = await request(`/ticket/${fallbackToken}`);
    const demo = await request('/ticket/FAN26-DEMO-VIP-001');
    assert.equal(local.status, 404);
    assert.equal(demo.status, 404);
    assert.equal(local.text.includes(fallback.name), false);
    record('PRIVACY-02', 'Database is authoritative on misses', { localFileTicketStatus: local.status, demoTicketStatus: demo.status, localRecordRendered: false });
  });

  await check('AUTH-03', 'Alternate headers cannot rotate the selected trusted IP', async () => {
    const fixed = [];
    const rotated = [];
    for (let index = 0; index < 7; index++) fixed.push((await request('/api/admin/login', { method: 'POST', ip: '198.18.200.1', body: { pin: 'wrong-review-pin' } })).status);
    for (let index = 0; index < 7; index++) rotated.push((await request('/api/admin/login', { method: 'POST', ip: '198.18.200.1', headers: { 'cf-connecting-ip': `198.18.201.${index + 1}` }, body: { pin: 'wrong-review-pin' } })).status);
    const audit = await dbClient.query("SELECT COUNT(DISTINCT actor_ip)::int AS ips FROM audit_log WHERE action = 'login_failed' AND actor_ip LIKE '198.18.201.%'");
    assert.deepEqual(fixed, [401, 401, 401, 401, 401, 429, 429]);
    assert.ok(rotated.every((status) => status === 429));
    assert.equal(audit.rows[0].ips, 0);
    record('AUTH-03', 'Configured proxy header trust', { fixedIpStatuses: fixed, rotatedCfHeaderStatuses: rotated, rotatedIpsInAudit: audit.rows[0].ips, environment: 'local production server with synthetic TRUSTED_PROXY=reverse-proxy; live ingress sanitization not measured' });
  });

  await check('RATE-02', 'HTTP quota survives an actual application process restart', async () => {
    const ip = '198.18.204.1';
    const before = [];
    for (let index = 0; index < 6; index++) before.push((await request('/api/admin/login', { method: 'POST', ip, body: { pin: 'wrong-review-pin' } })).status);
    assert.deepEqual(before, [401, 401, 401, 401, 401, 429]);
    await stopApp();
    await startApp(appPort);
    const after = await request('/api/admin/login', { method: 'POST', ip, body: { pin } });
    assert.equal(after.status, 429);
    assert.equal((await adminRequest('/api/admin/participants')).status, 200);
    record('RATE-02', 'Rate limit and session survive restart', { beforeStatuses: before, afterRestartStatus: after.status, previousSessionStillValid: true });
  });

  await check('AUTH-04', 'Persistent lockout, expiry, and logout revocation', async () => {
    for (let index = 0; index < 12; index++) await dbClient.query("INSERT INTO audit_log(action, actor_ip) VALUES ('login_failed', '198.18.202.1')");
    const locked = await request('/api/admin/login', { method: 'POST', ip: '198.18.202.1', body: { pin } });
    const token = adminCookie.split(';')[0].slice('fan26_session='.length);
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const stored = await dbClient.query('SELECT token_hash FROM admin_sessions');
    await dbClient.query("UPDATE admin_sessions SET expires_at = NOW() - INTERVAL '1 second' WHERE token_hash = $1", [hash]);
    const expired = await adminRequest('/api/admin/participants');
    await dbClient.query("UPDATE admin_sessions SET expires_at = NOW() + INTERVAL '1 hour' WHERE token_hash = $1", [hash]);
    const invalidLogout = await adminRequest('/api/admin/logout', { method: 'POST', csrf: undefined, origin: 'https://other.example.test' });
    const preserved = await adminRequest('/api/admin/participants');
    const logout = await adminRequest('/api/admin/logout', { method: 'POST' });
    const reused = await adminRequest('/api/admin/participants');
    assert.equal(locked.status, 429);
    assert.equal(stored.rows.some((row) => row.token_hash === token), false);
    assert.equal(expired.status, 401);
    assert.equal(invalidLogout.status, 403);
    assert.equal(preserved.status, 200);
    assert.equal(logout.status, 200);
    assert.equal(reused.status, 401);
    record('AUTH-04', 'Session lifecycle', { lockedCorrectPinStatus: locked.status, rawTokenStored: false, expiredStatus: expired.status, logoutWithoutCsrfStatus: invalidLogout.status, validLogoutStatus: logout.status, loggedOutTokenReuseStatus: reused.status });
  });

  if (useMysql) {
    await check('MYSQL-05', 'Lockout-query outage cannot authenticate a correct PIN', async () => {
      await dbClient.query('RENAME TABLE audit_log TO review_audit_backup');
      let response;
      try { response = await request('/api/admin/login', { method: 'POST', body: { pin } }); }
      finally { await dbClient.query('RENAME TABLE review_audit_backup TO audit_log'); }
      assert.equal(response.status, 503);
      assertNoStore(response);
      assert.equal(response.text.includes('audit_log'), false);
      record('MYSQL-05', 'Lockout outage after a successful limiter fails closed', { status: response.status, sessionIssued: response.headers.getSetCookie().some((value) => value.startsWith('fan26_session=')) });
    });
  }

  // A fresh process with a deliberately unreachable local DB tests failure paths.
  await stopApp();
  const faultPort = await freePort();
  appEnv.DATABASE_URL = `postgres://reviewer:synthetic@127.0.0.1:${faultPort}/unavailable`;
  if (useMysql) { appEnv.DATABASE_URL = ''; appEnv.MYSQL_PORT = String(faultPort); }
  await startApp(appPort);
  await check('FAILURE-01', 'Production database outage behavior', async () => {
    const ticket = await request(`/ticket/${fallbackToken}`);
    const identity = await request('/api/register/validate-identity', { method: 'POST', body: { nim: fallback.nimNip, name: fallback.name } });
    const registration = await request('/api/register', { method: 'POST', body: { nimNip: fallback.nimNip, name: fallback.name, role: 'Mahasiswa', category: 'Mahasiswa Fasilkom', email: 'outage@example.test' } });
    const loginFailure = await request('/api/admin/login', { method: 'POST', body: { pin } });
    const qr = await request(`/api/qr/${fallbackToken}`);
    const admin = await adminRequest('/api/admin/participants');
    assert.ok(ticket.status >= 500);
    assert.equal(ticket.text.includes(fallback.name), false);
    for (const response of [identity, registration, loginFailure, qr, admin]) {
      assert.equal(response.status, 503);
      assertNoStore(response);
    }
    record('FAILURE-01', 'Production outages fail closed', { ticketFromFilesystemStatus: ticket.status, localRecordInHtml: false, identityStatus: identity.status, registrationStatus: registration.status, loginStatus: loginFailure.status, qrStatus: qr.status, adminStatus: admin.status });
  });
}

main().catch((error) => {
  console.error(error.stack);
  observations.push({ id: 'RUNNER', harnessError: error.message });
  process.exitCode = 1;
}).finally(async () => {
  const cleanupErrors = [];
  const cleanup = async (label, action) => {
    try { await action(); }
    catch (error) { cleanupErrors.push(`${label}: ${error.message}`); process.exitCode = 1; }
  };
  await cleanup('Next server', stopApp);
  if (dbClient) await cleanup('DB client', () => dbClient.end());
  await cleanup('PostgreSQL', stopDatabase);
  for (const stream of logStreams) if (!stream.writableEnded) stream.end();
  await cleanup('Log streams', () => Promise.all(logStreams.map((stream) => finished(stream))));
  artifacts.cleanupErrors = cleanupErrors;
  const output = path.join(runDir, 'observations.json');
  fs.writeFileSync(output, JSON.stringify({ ...artifacts, completedAt: new Date().toISOString(), observations }, null, 2));
  console.log(`Evidence saved: ${output}`);
});
