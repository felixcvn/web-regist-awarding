/*
 * Isolated MySQL/MariaDB fixture backend for security-review.cjs --mysql.
 * The executable is supplied by SECURITY_REVIEW_MYSQLD (or mysqld on PATH).
 * It is started with --no-defaults and a NEW datadir under the review directory;
 * the user's Laragon/cPanel databases and configuration are never opened.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn, execFileSync } = require('node:child_process');
const mysql = require('mysql2/promise');

async function startMysql({ runDir, port, logStreams }) {
  const executable = process.env.SECURITY_REVIEW_MYSQLD || 'mysqld';
  const version = execFileSync(executable, ['--no-defaults', '--version'], { encoding: 'utf8', windowsHide: true });
  const maria = /mariadb/i.test(version);
  if (maria && process.platform !== 'win32') throw new Error('This MariaDB fixture initializer requires Windows portable binaries; MySQL fixtures also work on Linux.');
  if (maria && !path.isAbsolute(executable)) throw new Error('Provide an absolute SECURITY_REVIEW_MYSQLD path for portable MariaDB.');
  const datadir = path.join(runDir, 'mysqldata');
  fs.mkdirSync(datadir);
  const base = path.isAbsolute(executable) ? path.dirname(path.dirname(executable)) : null;
  const defaults = ['--no-defaults', ...(base ? [`--basedir=${base}`] : []), `--datadir=${datadir}`];
  const rootPassword = crypto.randomBytes(24).toString('hex');
  const dbPassword = crypto.randomBytes(24).toString('hex');
  const installer = maria ? ['mariadb-install-db.exe', 'mysql_install_db.exe'].map((name) => path.join(path.dirname(executable), name)).find((file) => fs.existsSync(file)) : executable;
  if (!installer) throw new Error('Portable MariaDB initializer was not found next to the server binary.');
  const initArgs = maria ? [`--datadir=${datadir}`, `--port=${port}`, `--password=${rootPassword}`]
    : [...defaults, '--initialize-insecure', `--log-error=${path.join(runDir, 'mysql-init.log')}`];
  // No --service flag: never register/start a Windows service or change an
  // existing installation. Initialization only targets our newly created path.
  const initialized = execFileSync(installer, initArgs, {
    windowsHide: true, timeout: 120_000, stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (maria) fs.writeFileSync(path.join(runDir, 'mysql-init.log'), initialized);
  const log = fs.createWriteStream(path.join(runDir, 'mysql.log'));
  logStreams.push(log);
  const child = spawn(executable, [...defaults, `--port=${port}`, '--bind-address=127.0.0.1', ...(maria ? [] : ['--mysqlx=OFF', '--log-error-verbosity=3']),
    '--max-connections=40', '--max-allowed-packet=64M', '--innodb-buffer-pool-size=32M', '--innodb-log-buffer-size=8M',
    '--skip-log-bin', '--console'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const closed = new Promise((resolve) => child.once('close', resolve));
  child.stdout.pipe(log, { end: false });
  child.stderr.pipe(log, { end: false });
  let rootConfigured = maria;
  const database = {
    process: child,
    async stop() {
      if (child.exitCode !== null || child.signalCode !== null) return;
      let admin;
      try {
        admin = await mysql.createConnection({ host: '127.0.0.1', port, user: 'root', password: rootConfigured ? rootPassword : '', connectTimeout: 5000 });
        await admin.query('SHUTDOWN');
      } catch (error) {
        if (!['PROTOCOL_CONNECTION_LOST', 'ECONNRESET'].includes(error.code)) {
          child.kill();
          throw new Error(`Could not gracefully stop isolated MySQL (${error.code || 'MYSQL_ERROR'}).`);
        }
      } finally {
        if (admin) admin.destroy();
      }
      await closed;
      await fs.promises.rm(datadir, { recursive: true, force: true });
    },
  };
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Isolated MySQL readiness deadline exceeded')), 60_000);
      const onError = (error) => { clearTimeout(timer); reject(error); };
      child.once('error', onError);
      child.once('exit', (code) => { clearTimeout(timer); reject(new Error(`Isolated MySQL exited before readiness: ${code}`)); });
      const ready = (chunk) => {
        if (/ready for connections/i.test(chunk.toString())) {
          clearTimeout(timer);
          child.removeListener('error', onError);
          resolve();
        }
      };
      child.stdout.on('data', ready);
      child.stderr.on('data', ready);
    });
    const admin = await mysql.createConnection({ host: '127.0.0.1', port, user: 'root', password: maria ? rootPassword : '', charset: 'utf8mb4_bin' });
    try {
      await admin.query("ALTER USER 'root'@'localhost' IDENTIFIED BY ?", [rootPassword]);
      rootConfigured = true;
      await admin.query('CREATE DATABASE security_review CHARACTER SET utf8mb4 COLLATE utf8mb4_bin');
      await admin.query("CREATE USER 'reviewer'@'localhost' IDENTIFIED BY ?", [dbPassword]);
      await admin.query("GRANT ALL PRIVILEGES ON security_review.* TO 'reviewer'@'localhost'");
    } finally { await admin.end(); }
    const dbEnv = { DATABASE_PROVIDER: 'mysql', DATABASE_URL: '', MYSQL_HOST: '127.0.0.1', MYSQL_PORT: String(port),
      MYSQL_DATABASE: 'security_review', MYSQL_USER: 'reviewer', MYSQL_PASSWORD: dbPassword, MYSQL_SOCKET_PATH: '', MYSQL_SSL_MODE: 'disabled' };
    const connection = await mysql.createConnection({ host: '127.0.0.1', port, user: 'reviewer', password: dbPassword,
      database: 'security_review', timezone: 'Z', charset: 'utf8mb4_bin', decimalNumbers: true, multipleStatements: false });
    await connection.query("SET SESSION time_zone = '+00:00'");
    const [servers] = await connection.query('SELECT VERSION() AS version');
    return { database, dbClient: fixtureClient(connection), dbEnv, dbPassword, version: servers[0].version };
  } catch (error) {
    await database.stop().catch(() => {});
    throw error;
  }
}

// Only the runner's small fixture/inspection SQL uses PostgreSQL notation.
// Normalize it here to share HTTP assertions. Application SQL is NEVER passed
// through this adapter: dbMysql.ts executes its own native MySQL statements.
function fixtureClient(connection) {
  return {
    async query(sql, values = []) {
      let statement = sql.replace(/::int\b/gi, '')
        .replace(/cardinality\(hits\)/gi, 'JSON_LENGTH(hits)')
        .replace(/jsonb_array_length\(students\)/gi, 'JSON_LENGTH(students)')
        .replace(/NOW\(\)\s*([+-])\s*INTERVAL\s*'(\d+)\s+(second|minute|hour)s?'/gi,
          (_, sign, count, unit) => `TIMESTAMPADD(${unit.toUpperCase()}, ${sign === '-' ? '-' : ''}${count}, UTC_TIMESTAMP(3))`);
      const args = [];
      statement = statement.replace(/\$(\d+)/g, (_, index) => { args.push(values[Number(index) - 1]); return '?'; });
      const [rows] = await connection.query(statement, args);
      if (!Array.isArray(rows)) return { rows: [], rowCount: rows.affectedRows };
      for (const row of rows) {
        for (const field of ['consumed', 'is_checked_in']) if (Object.hasOwn(row, field)) row[field] = Boolean(row[field]);
      }
      return { rows, rowCount: rows.length };
    },
    end: () => connection.end(),
  };
}

module.exports = { startMysql };
