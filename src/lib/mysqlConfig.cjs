/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');

function invalid(message) {
  throw Object.assign(new Error(message), { code: 'MYSQL_CONFIGURATION' });
}

/**
 * Shared by the application and the credential-free-output hosting diagnostic.
 * Separate fields avoid shell/URL escaping of cPanel-generated passwords.
 * @param {NodeJS.ProcessEnv} env
 * @returns {import('mysql2/promise').PoolOptions}
 */
function getMysqlOptions(env = process.env) {
  for (const name of ['MYSQL_DATABASE', 'MYSQL_USER', 'MYSQL_PASSWORD']) {
    if (!env[name]) invalid(`${name} belum diisi.`);
  }
  const host = (env.MYSQL_HOST || '127.0.0.1').trim();
  if (!host) invalid('MYSQL_HOST belum diisi.');
  const socketPath = env.MYSQL_SOCKET_PATH?.trim() || undefined;
  if (socketPath && !path.isAbsolute(socketPath)) invalid('MYSQL_SOCKET_PATH harus berupa path absolut.');
  const rawPort = env.MYSQL_PORT || '3306';
  const port = Number(rawPort);
  if (!/^\d+$/.test(rawPort) || port < 1 || port > 65535) invalid('MYSQL_PORT tidak valid.');
  const local = Boolean(socketPath) || host === 'localhost' || host === '::1' || (net.isIP(host) === 4 && host.startsWith('127.'));
  const sslMode = env.MYSQL_SSL_MODE || (local ? 'disabled' : 'verify-full');
  if (!['disabled', 'verify-full'].includes(sslMode)) invalid('MYSQL_SSL_MODE harus disabled atau verify-full.');
  if (sslMode === 'disabled' && !local) invalid('Koneksi MySQL non-local memerlukan MYSQL_SSL_MODE=verify-full.');
  // mysql2 does not perform its hostname check for an IP literal. Require a
  // certificate hostname when TLS is selected rather than weakening verification.
  if (sslMode === 'verify-full' && net.isIP(host)) invalid('MYSQL_HOST untuk TLS harus berupa hostname DNS sesuai sertifikat, bukan alamat IP.');
  return {
    host,
    port,
    socketPath,
    user: env.MYSQL_USER,
    password: env.MYSQL_PASSWORD,
    database: env.MYSQL_DATABASE,
    ssl: sslMode === 'verify-full' ? {
      rejectUnauthorized: true,
      verifyIdentity: true,
      minVersion: 'TLSv1.2',
      ...(env.MYSQL_SSL_CA_FILE ? { ca: fs.readFileSync(env.MYSQL_SSL_CA_FILE, 'utf8') } : {}),
    } : undefined,
    charset: 'utf8mb4_bin',
    timezone: 'Z',
    decimalNumbers: true,
    multipleStatements: false,
    connectTimeout: 10000,
    connectionLimit: 5,
    maxIdle: 2,
    idleTimeout: 30000,
    waitForConnections: true,
    queueLimit: 100,
    maxPreparedStatements: 100,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
  };
}

/** @param {{ version: string, maxAllowedPacket: number }} server */
function assertMysqlServer(server) {
  const maria = /mariadb/i.test(server.version);
  const version = server.version.replace(/^5\.5\.5-(?=\d+\.\d+\.\d+.*mariadb)/i, '');
  const match = /^(\d+)\.(\d+)\./.exec(version);
  const major = match ? Number(match[1]) : 0;
  const minor = match ? Number(match[2]) : 0;
  if (maria ? major < 10 || (major === 10 && minor < 6) : major < 8) {
    throw Object.assign(new Error('Database memerlukan MySQL 8.0+ atau MariaDB 10.6+.'), { code: 'MYSQL_VERSION_UNSUPPORTED' });
  }
  if (!Number.isFinite(Number(server.maxAllowedPacket)) || Number(server.maxAllowedPacket) < 16 * 1024 * 1024) {
    throw Object.assign(new Error('max_allowed_packet database harus minimal 16 MiB untuk mendukung batas impor penuh.'), { code: 'MYSQL_PACKET_TOO_SMALL' });
  }
}

module.exports = { getMysqlOptions, assertMysqlServer };
