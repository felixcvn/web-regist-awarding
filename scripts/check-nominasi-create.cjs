/*
 * Regression check: creating a nominasi team must be readable inside the same
 * transaction. A fresh pool connection cannot see uncommitted rows, so the
 * store loader has to reuse the transaction connection.
 *
 * Needs an isolated MySQL 8+ binary, never a real database:
 *   $env:SECURITY_REVIEW_MYSQLD="C:\laragon\bin\mysql\mysql-8.0.44-winx64\bin\mysqld.exe"
 *   node scripts/check-nominasi-create.cjs
 */
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const mysql = require('mysql2/promise');

const REPO = path.join(__dirname, '..');
const { startMysql } = require(path.join(REPO, 'scripts', 'review-mysql.cjs'));

const MYSQL_PORT = 3399;
const APP_PORT = 3123;
const APP_ORIGIN = `http://127.0.0.1:${APP_PORT}`;
const CSRF = 'a'.repeat(48);

function waitForHttp(url, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const res = await fetch(url);
        if (res.status < 500) return resolve();
      } catch { /* not up yet */ }
      if (Date.now() > deadline) return reject(new Error('App did not become ready'));
      setTimeout(tick, 1000);
    };
    tick();
  });
}

(async () => {
  const runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fan26-nom-e2e-'));
  const logStreams = [];
  let app;
  let db;
  const failures = [];
  const check = (name, ok, extra) => {
    if (ok) console.log(`ok - ${name}`);
    else { failures.push(name); console.log(`FAIL - ${name}${extra ? ' :: ' + extra : ''}`); }
  };

  try {
    db = await startMysql({ runDir, port: MYSQL_PORT, logStreams });

    app = spawn(process.execPath, [path.join(REPO, 'node_modules', 'next', 'dist', 'bin', 'next'), 'dev', '-p', String(APP_PORT)], {
      cwd: REPO,
      env: {
        ...process.env,
        NODE_ENV: 'development',
        DATABASE_PROVIDER: 'mysql',
        DATABASE_URL: '',
        MYSQL_HOST: '127.0.0.1',
        MYSQL_PORT: String(MYSQL_PORT),
        MYSQL_DATABASE: 'security_review',
        MYSQL_USER: 'reviewer',
        MYSQL_PASSWORD: db.dbPassword,
        MYSQL_SOCKET_PATH: '',
        MYSQL_SSL_MODE: 'disabled',
        NEXT_PUBLIC_APP_URL: APP_ORIGIN,
        GMAIL_USER: 'noreply@example.com',
        GMAIL_APP_PASSWORD: 'dummy-app-password',
        TRUSTED_PROXY: '',
        PORT: String(APP_PORT),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const appLog = fs.createWriteStream(path.join(runDir, 'app.log'));
    app.stdout.pipe(appLog);
    app.stderr.pipe(appLog);

    await waitForHttp(APP_ORIGIN + '/');

    // Seed a session directly; PIN env parsing is unrelated to this regression.
    // Tables appear on first DB request (ensureSchema), so retry until seeded.
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex');
    const admin = await mysql.createConnection({
      host: '127.0.0.1', port: MYSQL_PORT, user: 'reviewer', password: db.dbPassword, database: 'security_review',
    });
    let seeded = false;
    for (let i = 0; i < 40 && !seeded; i++) {
      await fetch(APP_ORIGIN + '/api/admin/nominasi/teams').catch(() => {});
      try {
        await admin.query(
          'INSERT INTO admin_sessions (id, token_hash, ip, user_agent, expires_at) VALUES (?, ?, ?, ?, DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 1 HOUR))',
          ['SES-E2E', tokenHash, '127.0.0.1', 'e2e'],
        );
        seeded = true;
      } catch (error) {
        if (!/doesn't exist|does not exist/i.test(error.message)) throw error;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    await admin.end();
    check('schema ready for session seed', seeded);
    const cookies = `fan26_session=${sessionToken}`;

    const headers = {
      'content-type': 'application/json',
      origin: APP_ORIGIN,
      cookie: `${cookies}; fan26_csrf=${CSRF}`,
      'x-csrf-token': CSRF,
    };

    // Two registered participants whose NIMs will also join the team.
    const seedParticipants = await mysql.createConnection({
      host: '127.0.0.1', port: MYSQL_PORT, user: 'reviewer', password: db.dbPassword, database: 'security_review',
    });
    const memberNims = ['232410101001', '232410101002'];
    for (const [index, nim] of memberNims.entries()) {
      await seedParticipants.query(
        `INSERT INTO participants (id, nim_nip, name, role, category, batch, prodi, email, phone, qr_token)
         VALUES (?, ?, ?, 'Mahasiswa', 'UKM-O', '2023', 'Sistem Informasi', ?, '08120000000', ?)`,
        [`TKT-E2E-${index}`, nim, `Peserta ${index}`, `peserta${index}@example.com`, `FAN26-E2E-${index}`],
      );
    }
    await seedParticipants.end();

    const create = await fetch(APP_ORIGIN + '/api/admin/nominasi/teams', {
      method: 'POST',
      headers,
      body: JSON.stringify({ namaTeam: 'Tim Uji Regresi', memberNims }),
    });
    const bodyText = await create.text();
    let body = {};
    try { body = JSON.parse(bodyText); } catch { /* keep raw */ }
    check('create team 200/201', create.ok, `${create.status} ${bodyText.slice(0, 300)}`);
    check('members persisted in response', Array.isArray(body.team?.members) && body.team.members.length === 2,
      JSON.stringify(body.team?.members));

    const list = await fetch(APP_ORIGIN + '/api/admin/nominasi/teams', { headers: { origin: APP_ORIGIN, cookie: cookies } });
    const listBody = await list.json();
    check('team visible after commit', list.ok && listBody.teams.some((t) => t.id === body.team?.id));

    if (body.team?.qrToken) {
      const ci = await fetch(APP_ORIGIN + '/api/admin/nominasi/checkin', {
        method: 'POST',
        headers,
        body: JSON.stringify({ qrToken: body.team.qrToken }),
      });
      const ciBody = await ci.text();
      check('team check-in succeeds', ci.ok && /berhasil/i.test(ciBody), `${ci.status} ${ciBody.slice(0, 300)}`);

      // Team check-in must also mark the members' registration rows as present.
      const verify = await mysql.createConnection({
        host: '127.0.0.1', port: MYSQL_PORT, user: 'reviewer', password: db.dbPassword, database: 'security_review',
      });
      const [rows] = await verify.query(
        'SELECT nim_nip, is_checked_in, checked_in_at FROM participants WHERE nim_nip IN (?, ?) ORDER BY nim_nip',
        memberNims,
      );
      await verify.end();
      check('member registrations marked present', rows.length === 2 && rows.every((r) => Boolean(r.is_checked_in) && r.checked_in_at),
        JSON.stringify(rows));
    }
  } catch (error) {
    failures.push('harness');
    console.error('harness error:', error.message);
  } finally {
    if (app) app.kill();
    if (db) await db.database.stop().catch(() => {});
    for (const s of logStreams) s.end();
    console.log(failures.length ? `\nFAILED: ${failures.join(', ')}` : '\nALL CHECKS PASSED');
    process.exitCode = failures.length ? 1 : 0;
  }
})();
