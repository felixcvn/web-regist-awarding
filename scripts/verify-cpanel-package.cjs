/*
 * Exercise the extracted release with production-only dependencies and the
 * selector's node_modules layout. All requests stay on loopback; database and
 * Gmail credentials are deliberately empty. Run after package:cpanel.
 */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawn } = require('node:child_process');
const { parseArgs } = require('node:util');

const source = path.resolve(__dirname, '..');
const checks = [];
let work;
let server;
let serverClosed;
let serverOutput = '';

function digest(filename) {
  return crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
}

function isolatedEnvironment(appUrl, siteKey) {
  const inherited = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|USERPROFILE|APPDATA|LOCALAPPDATA|TEMP|TMP|HOME|LANG|LC_ALL)$/i.test(key)));
  return {
    ...inherited,
    NODE_ENV: 'production',
    NEXT_TELEMETRY_DISABLED: '1',
    NEXT_PUBLIC_APP_URL: appUrl,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: siteKey || '',
    DATABASE_URL: '',
    ADMIN_PIN: '',
    ADMIN_PIN_HASH: '',
    GMAIL_USER: '',
    GMAIL_APP_PASSWORD: '',
    TURNSTILE_SECRET_KEY: '',
    TRUSTED_PROXY: 'none',
  };
}

function npmCli() {
  const candidates = [
    process.env.npm_execpath,
    path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
    path.join(path.dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js'),
  ];
  const cli = candidates.find((candidate) => candidate && candidate.endsWith('.js') && fs.existsSync(candidate));
  if (!cli) throw new Error('Cannot locate npm. Run this check with npm run verify:cpanel.');
  return cli;
}

async function freePort() {
  const listener = net.createServer();
  await new Promise((resolve, reject) => listener.once('error', reject).listen(0, '127.0.0.1', resolve));
  const port = listener.address().port;
  await new Promise((resolve) => listener.close(resolve));
  return port;
}

async function startServer(runtime, env, lowercase = false) {
  const port = await freePort();
  serverOutput = '';
  server = spawn(process.execPath, [path.join(runtime, 'server.js')], {
    // Passenger can launch an absolute startup file from a different directory.
    cwd: work,
    env: { ...env, NODE_ENV: 'development', HOST: '127.0.0.1', [lowercase ? 'port' : 'PORT']: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  serverClosed = new Promise((resolve) => server.once('close', (code, signal) => resolve({ code, signal })));
  const capture = (chunk) => { serverOutput = (serverOutput + chunk.toString()).slice(-64 * 1024); };
  server.stdout.on('data', capture);
  server.stderr.on('data', capture);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Packaged server readiness timed out')), 45_000);
    server.once('error', (error) => { clearTimeout(timer); reject(error); });
    server.once('exit', (code) => { clearTimeout(timer); reject(new Error(`Packaged server exited before readiness: ${code}`)); });
    let output = '';
    server.stdout.on('data', (chunk) => {
      output = (output + chunk.toString()).slice(-4096);
      if (output.includes('> Ready on')) { clearTimeout(timer); resolve(); }
    });
  });
  return `http://127.0.0.1:${port}`;
}

async function stopServer(checkGraceful = false) {
  if (!server) return;
  const child = server;
  const closed = serverClosed;
  server = null;
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
  const deadline = setTimeout(() => child.kill('SIGKILL'), 20_000);
  try {
    const result = await closed;
    if (checkGraceful && process.platform !== 'win32') {
      assert.equal(result.code, 0, 'The packaged server did not shut down cleanly');
    }
  } finally {
    clearTimeout(deadline);
  }
}

async function request(url, options = {}) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(30_000) });
}

async function main() {
  const { values } = parseArgs({ options: { archive: { type: 'string' }, help: { type: 'boolean', short: 'h' } } });
  if (values.help) {
    console.log('Usage: npm run verify:cpanel -- [--archive path/to/release.tar.gz]');
    console.log('Default: the single .tar.gz in build/cpanel. Installs isolated production dependencies and writes a .verification.json report beside the archive.');
    return;
  }
  assert.equal(Number(process.versions.node.split('.')[0]), 22, 'Use Node.js 22 for cPanel verification');
  let archive = values.archive && path.resolve(source, values.archive);
  if (!archive) {
    const output = path.join(source, 'build/cpanel');
    const files = fs.readdirSync(output).filter((name) => name.endsWith('.tar.gz'));
    assert.equal(files.length, 1, 'Supply --archive when build/cpanel does not contain exactly one release');
    archive = path.join(output, files[0]);
  }
  assert.equal(digest(archive), fs.readFileSync(`${archive}.sha256`, 'utf8').trim().split(/\s+/)[0], 'Archive checksum mismatch');
  const entries = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })
    .split(/\r?\n/).filter(Boolean).map((entry) => entry.replace(/^\.\//, '')).filter(Boolean);
  const allowedRoots = new Set(['.next', 'public', 'scripts', 'server.js', 'next.config.mjs', 'package.json', 'package-lock.json', 'index.html', 'index.php', 'CPANEL-DEPLOY.md', 'MYSQL-CPANEL.md', 'SECURITY-DEPLOYMENT.md', 'cpanel-release.json']);
  for (const entry of entries) {
    assert.ok(allowedRoots.has(entry.split('/')[0]), `Unexpected archive path: ${entry}`);
    assert.doesNotMatch(entry, /(?:^|\/)\.\.(?:\/|$)|\\/);
    assert.doesNotMatch(entry, /(?:^|\/)(?:node_modules|\.git|\.env[^/]*|\.neon|\.participants_data\.json)(?:\/|$)/);
    assert.doesNotMatch(entry, /^\.next\/(?:cache|types|diagnostics|dev)(?:\/|$)|\.log$/);
  }
  checks.push('runtime allowlist and archive checksum');

  const tempBase = process.platform === 'win32' && process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, 'Temp/opencode') : os.tmpdir();
  fs.mkdirSync(tempBase, { recursive: true });
  work = fs.mkdtempSync(path.join(tempBase, 'fan26-cpanel-verify-'));
  const runtime = path.join(work, 'runtime');
  fs.mkdirSync(runtime);
  execFileSync('tar', ['-xzf', archive, '-C', runtime]);
  const manifest = JSON.parse(fs.readFileSync(path.join(runtime, 'cpanel-release.json'), 'utf8'));
  const appUrl = new URL(manifest.appUrl);
  assert.equal(appUrl.protocol, 'https:');
  assert.equal(appUrl.origin, manifest.appUrl);
  assert.equal(manifest.platform, process.platform, 'Verify the release on the same operating system as its build');
  assert.equal(manifest.architecture, process.arch);
  assert.equal(manifest.lockfileSha256, digest(path.join(runtime, 'package-lock.json')));
  assert.equal(manifest.buildId, fs.readFileSync(path.join(runtime, '.next/BUILD_ID'), 'utf8').trim());
  assert.ok(fs.existsSync(path.join(runtime, 'next.config.mjs')));
  assert.ok(fs.existsSync(path.join(runtime, 'index.html')), 'Maintenance page index.html missing');
  assert.ok(fs.existsSync(path.join(runtime, 'index.php')), 'Maintenance page index.php missing');
  assert.equal(fs.existsSync(path.join(runtime, 'next.config.ts')), false);
  assert.equal(JSON.parse(fs.readFileSync(path.join(runtime, 'package.json'), 'utf8')).scripts.start, 'node server.js');
  checks.push('build manifest and JavaScript runtime config');

  // Follow the same prefix installation documented for NodeJS Selector.
  const installRoot = path.join(work, 'nodevenv/22/lib');
  const modulesTarget = path.join(installRoot, 'node_modules');
  const modulesLink = path.join(runtime, 'node_modules');
  fs.mkdirSync(modulesTarget, { recursive: true });
  fs.symlinkSync(modulesTarget, modulesLink, process.platform === 'win32' ? 'junction' : 'dir');
  for (const name of ['package.json', 'package-lock.json']) {
    fs.copyFileSync(path.join(runtime, name), path.join(installRoot, name));
  }
  const env = isolatedEnvironment(manifest.appUrl, manifest.turnstileSiteKey);
  execFileSync(process.execPath, [npmCli(), '--prefix', installRoot, 'ci', '--omit=dev', '--no-audit', '--no-fund'], {
    cwd: runtime, env, stdio: 'inherit', timeout: 300_000,
  });
  assert.equal(fs.existsSync(path.join(modulesTarget, 'typescript')), false);
  checks.push('clean production-only dependency installation');
  assert.equal(fs.lstatSync(modulesLink).isSymbolicLink(), true);
  assert.equal(fs.realpathSync(modulesLink), fs.realpathSync(modulesTarget));
  checks.push('selector node_modules link preserved');
  assert.deepEqual(manifest.databaseProviders, ['postgres', 'mysql']);
  const mysqlSelfTest = execFileSync(process.execPath, [path.join(runtime, 'scripts/check-mysql.cjs'), '--self-test'], { cwd: runtime, env, encoding: 'utf8', timeout: 15000 });
  assert.equal(JSON.parse(mysqlSelfTest).selfTest, 'passed');
  execFileSync(process.execPath, ['-e', "require('mysql2/promise')"], { cwd: runtime, env, timeout: 15000 });
  checks.push('packaged read-only MySQL diagnostic and runtime driver');

  let baseUrl = await startServer(runtime, env);
  const home = await request(baseUrl);
  assert.equal(home.status, 200);
  const html = await home.text();
  assert.match(html, /FASILKOM/i);
  assert.equal(home.headers.get('x-powered-by'), null);
  assert.equal(home.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(home.headers.get('content-security-policy'));
  assert.doesNotMatch(home.headers.get('content-security-policy'), /unsafe-eval/);
  checks.push('relocated startup, production mode and security headers');

  const script = html.match(/<script[^>]+src="([^"]*\/_next\/static\/[^"]+\.js[^"]*)"/);
  assert.ok(script, 'No client JavaScript asset found');
  const asset = await request(new URL(script[1].replace(/&amp;/g, '&'), baseUrl));
  assert.equal(asset.status, 200);
  await asset.arrayBuffer();
  const image = await request(`${baseUrl}/_next/image?url=%2Flogo.png&w=64&q=75`);
  assert.equal(image.status, 200);
  assert.match(image.headers.get('content-type'), /^image\//);
  await image.arrayBuffer();
  checks.push('client assets and native image optimization');

  const admin = await request(`${baseUrl}/admin`, {
    redirect: 'manual',
    headers: { Host: appUrl.host, 'X-Forwarded-Host': appUrl.host, 'X-Forwarded-Proto': 'https' },
  });
  assert.equal(admin.status, 307);
  assert.equal(new URL(admin.headers.get('location'), manifest.appUrl).href, `${manifest.appUrl}/admin/login`);
  assert.match(admin.headers.get('cache-control'), /no-store/);
  await admin.text();
  for (const [route, options] of [
    ['/api/admin/participants', {}],
    ['/api/register', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } }],
  ]) {
    const response = await request(`${baseUrl}${route}`, options);
    // Shared rate-limit storage is checked before authentication/body validation.
    assert.equal(response.status, 503, `Expected fail-closed behavior for ${route} without a database`);
    assert.match(response.headers.get('cache-control'), /no-store/);
    await response.text();
  }
  checks.push('public-origin redirect and fail-closed APIs');

  for (const route of ['/.env.local', '/.participants_data.json', '/server.js', '/cpanel-release.json', '/package.json']) {
    const response = await request(`${baseUrl}${route}`);
    assert.equal(response.status, 404, `Application-root file exposed at ${route}`);
    await response.text();
  }
  checks.push('application-root files remain private');
  await stopServer(true);
  baseUrl = await startServer(runtime, { ...env, DATABASE_PROVIDER: 'mysql', MYSQL_DATABASE: '', MYSQL_USER: '', MYSQL_PASSWORD: '' }, true);
  const restarted = await request(baseUrl);
  assert.equal(restarted.status, 200);
  await restarted.arrayBuffer();
  for (const route of ['/api/admin/login', '/api/register']) {
    const response = await request(`${baseUrl}${route}`, { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } });
    assert.equal(response.status, 503, `MySQL must fail closed without credentials: ${route}`);
    await response.text();
  }
  checks.push('MySQL provider fail-closed without credentials');
  await stopServer(true);
  checks.push('lowercase port and server shutdown');

  const report = {
    verifiedAt: new Date().toISOString(),
    archive: path.basename(archive),
    sha256: digest(archive),
    appUrl: manifest.appUrl,
    platform: process.platform,
    architecture: process.arch,
    nodeVersion: process.versions.node,
    nextVersion: manifest.nextVersion,
    checks,
    liveCpanelVerified: false,
    databaseOrSmtpContacted: false,
  };
  fs.writeFileSync(`${archive}.verification.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error.stack);
  if (serverOutput) console.error('Isolated server output:\n' + serverOutput);
  process.exitCode = 1;
}).finally(async () => {
  await stopServer();
  if (work) fs.rmSync(work, { recursive: true, force: true, maxRetries: 3 });
});
