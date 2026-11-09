/*
 * Read-only connectivity check. Does not load .env files, create tables, expose
 * credentials, or modify participant/import/session data. Use dashboard values
 * through environment variables; see MYSQL-CPANEL.md for hidden Terminal input.
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const sourceConfig = path.join(__dirname, '../src/lib/mysqlConfig.cjs');
const { getMysqlOptions, assertMysqlServer } = require(fs.existsSync(sourceConfig) ? sourceConfig : './mysqlConfig.cjs');

function codeOf(error) {
  return typeof error?.code === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(error.code) ? error.code : 'MYSQL_ERROR';
}

function selfTest() {
  const env = { MYSQL_DATABASE: 'synthetic', MYSQL_USER: 'synthetic', MYSQL_PASSWORD: 'synthetic-$-password' };
  const local = getMysqlOptions(env);
  assert.equal(local.host, '127.0.0.1');
  assert.equal(local.password, env.MYSQL_PASSWORD);
  assert.equal(local.ssl, undefined);
  assert.equal(local.multipleStatements, false);
  assert.equal(local.timezone, 'Z');
  for (const changes of [{ MYSQL_PASSWORD: '' }, { MYSQL_PORT: '70000' }, { MYSQL_PORT: '3306x' },
    { MYSQL_HOST: 'database.example.invalid', MYSQL_SSL_MODE: 'disabled' }, { MYSQL_SSL_MODE: 'insecure' },
    { MYSQL_HOST: '192.0.2.1', MYSQL_SSL_MODE: 'verify-full' }, { MYSQL_SOCKET_PATH: 'relative/mysql.sock' }]) {
    assert.throws(() => getMysqlOptions({ ...env, ...changes }), (error) => error.code === 'MYSQL_CONFIGURATION');
  }
  const remote = getMysqlOptions({ ...env, MYSQL_HOST: 'database.example.invalid' });
  assert.equal(remote.ssl.rejectUnauthorized, true);
  assert.equal(remote.ssl.verifyIdentity, true);
  assert.equal(remote.ssl.minVersion, 'TLSv1.2');
  assert.equal(getMysqlOptions({ ...env, MYSQL_SOCKET_PATH: '/run/mysql/mysql.sock' }).socketPath, '/run/mysql/mysql.sock');
  for (const version of ['8.0.44', '8.4.7', '10.6.24-MariaDB', '10.11.14-MariaDB', '5.5.5-10.6.24-MariaDB']) {
    assertMysqlServer({ version, maxAllowedPacket: 16 * 1024 * 1024 });
  }
  for (const version of ['5.7.44', '10.5.28-MariaDB', '5.5.5-10.5.28-MariaDB', 'unknown']) {
    assert.throws(() => assertMysqlServer({ version, maxAllowedPacket: 64 * 1024 * 1024 }), (error) => error.code === 'MYSQL_VERSION_UNSUPPORTED');
  }
  assert.throws(() => assertMysqlServer({ version: '8.0.44', maxAllowedPacket: 8 * 1024 * 1024 }), (error) => error.code === 'MYSQL_PACKET_TOO_SMALL');
  assert.throws(() => assertMysqlServer({ version: '8.0.44', maxAllowedPacket: NaN }), (error) => error.code === 'MYSQL_PACKET_TOO_SMALL');
  assert.equal(codeOf({ code: 'contains synthetic-$-password' }), 'MYSQL_ERROR');
  console.log(JSON.stringify({ selfTest: 'passed', readOnly: true, databaseContacted: false, checks: [
    'required fields and raw password preservation', 'local socket/TCP configuration', 'verified remote TLS and DNS identity',
    'port and socket validation', 'MySQL/MariaDB version boundaries', 'full-import packet limit', 'safe error codes',
  ] }, null, 2));
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some((argument) => !['--help', '--self-test'].includes(argument))) throw Object.assign(new Error('Use --help for supported options.'), { code: 'MYSQL_DIAGNOSTIC_ARGUMENTS' });
  if (args.includes('--help')) {
    console.log('Usage: node scripts/check-mysql.cjs [--self-test]');
    console.log('Runtime input: MYSQL_DATABASE, MYSQL_USER, MYSQL_PASSWORD; optional MYSQL_HOST, MYSQL_PORT, MYSQL_SOCKET_PATH, MYSQL_SSL_MODE, MYSQL_SSL_CA_FILE.');
    console.log('No .env files are loaded. Dashboard variables may not be available in Terminal. Use the hidden-input block in MYSQL-CPANEL.md.');
    console.log('This check is read-only; a successful connection does not prove application writes or hosting capacity.');
    return;
  }
  if (args.includes('--self-test')) { selfTest(); return; }
  let connection;
  let stage = 'configuration';
  try {
    const options = getMysqlOptions(process.env);
    stage = 'connection';
    connection = await require('mysql2/promise').createConnection(options);
    stage = 'server capabilities';
    const [servers] = await connection.query({ sql: 'SELECT VERSION() AS version, @@max_allowed_packet AS maxAllowedPacket', timeout: 15000 });
    assertMysqlServer(servers[0]);
    const [engines] = await connection.query({ sql: 'SHOW ENGINES', timeout: 15000 });
    const innodb = engines.find((engine) => String(engine.Engine).toLowerCase() === 'innodb');
    if (!innodb || !['YES', 'DEFAULT'].includes(String(innodb.Support).toUpperCase())) {
      throw Object.assign(new Error('InnoDB is required.'), { code: 'MYSQL_ENGINE_UNSAFE' });
    }
    const [tables] = await connection.query({ sql:
      "SELECT TABLE_NAME AS tableName, ENGINE AS engine FROM information_schema.tables WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('participants', 'admin_sessions', 'audit_log', 'student_import_batches', 'student_master', 'student_import_records', 'student_import_previews', 'request_rate_limits', 'operation_locks', 'site_settings')", timeout: 15000 });
    if (tables.some((table) => String(table.engine).toLowerCase() !== 'innodb')) {
      throw Object.assign(new Error('Existing application tables must use InnoDB.'), { code: 'MYSQL_ENGINE_UNSAFE' });
    }
    console.log(JSON.stringify({ connected: true, readOnly: true, transport: options.socketPath ? 'local socket' : options.ssl ? 'TCP with verified TLS' : 'loopback TCP',
      serverVersion: servers[0].version, maxAllowedPacketBytes: Number(servers[0].maxAllowedPacket), innodb: true,
      applicationTablesFound: tables.length, schemaWritesVerified: false, liveApplicationVerified: false,
    }, null, 2));
  } catch (error) {
    // A driver query timeout does not finish the underlying command. Do not
    // queue QUIT behind it and leave this read-only diagnostic hanging.
    if (connection) { connection.destroy(); connection = undefined; }
    const code = codeOf(error);
    const hints = {
      MYSQL_CONFIGURATION: error.message,
      MYSQL_VERSION_UNSUPPORTED: 'Memerlukan MySQL 8.0+ atau MariaDB 10.6+.',
      MYSQL_PACKET_TOO_SMALL: 'Minta max_allowed_packet minimal 16 MiB ke support.',
      MYSQL_ENGINE_UNSAFE: 'Gunakan database khusus aplikasi dengan tabel InnoDB.',
      ER_ACCESS_DENIED_ERROR: 'Periksa nama user lengkap beserta prefix cPanel, password, dan akses user ke database.',
      ER_DBACCESS_DENIED_ERROR: 'Hubungkan user ke database melalui Manage My Databases / Database Wizard.',
      ER_BAD_DB_ERROR: 'Periksa nama database lengkap beserta prefix cPanel.',
      ECONNREFUSED: 'Konfirmasikan host/port internal atau socket MySQL yang dapat diakses proses Node.js.',
      ENOTFOUND: 'Hostname database tidak dapat di-resolve; konfirmasikan alamat ke support.',
      ETIMEDOUT: 'Koneksi tidak selesai; konfirmasikan jalur internal yang diizinkan hosting.',
      PROTOCOL_SEQUENCE_TIMEOUT: 'Query metadata tidak selesai dalam 15 detik; periksa kondisi database bersama support.',
      HANDSHAKE_SSL_ERROR: 'Periksa dukungan TLS, CA, dan hostname sesuai sertifikat; jangan menonaktifkan verifikasi untuk host non-local.',
    };
    console.error(JSON.stringify({ connected: false, readOnly: true, stage, code, hint: hints[code] || 'Periksa konfigurasi internal database bersama support; jangan kirim password atau URL berkredensial.' }, null, 2));
    process.exitCode = 1;
  } finally { if (connection) await connection.end().catch(() => connection.destroy()); }
}

main().catch((error) => { console.error(JSON.stringify({ connected: false, readOnly: true, code: codeOf(error) })); process.exitCode = 1; });
