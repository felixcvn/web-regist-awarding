/*
 * Build in a fresh directory with explicit public configuration, then package
 * only runtime files. Project .env files and local participant data are never
 * used. Run on Linux for the release uploaded to Rumahweb; see CPANEL-DEPLOY.md.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { parseArgs } = require('node:util');

const source = path.resolve(__dirname, '..');

function publicOrigin(value) {
  if (!value) throw new Error('Supply --url https://your-subdomain.example.com or CPANEL_APP_URL.');
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('The application URL must be an HTTPS origin, without credentials, a subfolder, query, or fragment.');
  }
  return url.origin;
}

function copyTree(from, to, filter = () => true) {
  fs.cpSync(from, to, {
    recursive: true,
    filter: (filename) => {
      if (fs.lstatSync(filename).isSymbolicLink()) {
        throw new Error(`Unexpected symbolic link in deployment input: ${path.relative(source, filename)}`);
      }
      const name = path.basename(filename);
      if (/^\.env(?:\.|$)|^\.git(?:ignore|attributes)?$|^\.neon$|^\.participants_data\.json$|\.(?:log|pem|key)$/i.test(name)) return false;
      return filter(filename);
    },
  });
}

function buildEnvironment(appUrl, siteKey) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|USERPROFILE|APPDATA|LOCALAPPDATA|TEMP|TMP|HOME|NUMBER_OF_PROCESSORS|PROCESSOR_ARCHITECTURE|LANG|LC_ALL)$/i.test(key)));
  return {
    ...env,
    NODE_ENV: 'production',
    NEXT_TELEMETRY_DISABLED: '1',
    NEXT_PUBLIC_APP_URL: appUrl,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: siteKey,
    // Build-time placeholders are empty: credentials are supplied only in cPanel.
    DATABASE_URL: '',
    DATABASE_PROVIDER: 'postgres',
    MYSQL_DATABASE: '',
    MYSQL_USER: '',
    MYSQL_PASSWORD: '',
    ADMIN_PIN_HASH: '',
    ADMIN_PIN: '',
    GMAIL_USER: '',
    GMAIL_APP_PASSWORD: '',
    TURNSTILE_SECRET_KEY: '',
    TRUSTED_PROXY: 'none',
  };
}

function main() {
  const { values } = parseArgs({ options: {
    url: { type: 'string' },
    'site-key': { type: 'string' },
    output: { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  } });
  if (values.help) {
    console.log('Usage: npm run package:cpanel -- --url https://your-subdomain.example.com [--site-key PUBLIC_TURNSTILE_KEY] [--output directory]');
    console.log('Environment alternatives: CPANEL_APP_URL, CPANEL_TURNSTILE_SITE_KEY. Default output: build/cpanel.');
    console.log('Use Node.js 22 on Linux for the uploadable release. .env.local is not loaded.');
    return;
  }

  const appUrl = publicOrigin(values.url || process.env.CPANEL_APP_URL);
  const siteKey = values['site-key'] ?? process.env.CPANEL_TURNSTILE_SITE_KEY ?? '';
  if (siteKey && !/^[A-Za-z0-9_-]+$/.test(siteKey)) throw new Error('Turnstile site key contains unexpected characters.');
  if (Number(process.versions.node.split('.')[0]) !== 22) throw new Error('Build this cPanel package with Node.js 22.x.');

  const ts = require('typescript');
  const packageJson = JSON.parse(fs.readFileSync(path.join(source, 'package.json'), 'utf8'));
  const lock = JSON.parse(fs.readFileSync(path.join(source, 'package-lock.json'), 'utf8'));
  const nextVersion = require('next/package.json').version;
  if (nextVersion !== lock.packages['node_modules/next'].version) throw new Error('Installed Next.js differs from package-lock.json. Run npm ci --include=dev first.');
  execFileSync('tar', ['--version'], { stdio: 'ignore' });

  const output = path.resolve(source, values.output || 'build/cpanel');
  const tempBase = process.env.CPANEL_BUILD_TEMP || path.join(source, 'build');
  fs.mkdirSync(tempBase, { recursive: true });
  const work = fs.mkdtempSync(path.join(tempBase, 'fan26-cpanel-'));
  const appDir = path.join(work, 'app');
  const releaseDir = path.join(work, 'release');
  fs.mkdirSync(appDir);
  fs.mkdirSync(releaseDir);

  try {
    for (const name of ['src', 'public', 'package.json', 'package-lock.json', 'tsconfig.json', 'postcss.config.mjs']) {
      copyTree(path.join(source, name), path.join(appDir, name));
    }
    // A JavaScript config avoids requiring TypeScript on the production host.
    // Use the same compiled config for both the build and the uploaded release.
    const config = ts.transpileModule(fs.readFileSync(path.join(source, 'next.config.ts'), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      fileName: 'next.config.ts',
      reportDiagnostics: true,
    });
    if (config.diagnostics?.some((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error)) {
      throw new Error('Could not compile next.config.ts for cPanel.');
    }
    fs.writeFileSync(path.join(appDir, 'next.config.mjs'), config.outputText);
    fs.symlinkSync(path.join(source, 'node_modules'), path.join(appDir, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');

    console.log(`[cPanel] Building for ${appUrl}; Turnstile ${siteKey ? 'enabled' : 'disabled'}.`);
    if (process.platform !== 'linux') console.log(`[cPanel] Platform: ${process.platform}. Use the Linux workflow for the final hosting release.`);
    execFileSync(process.execPath, [path.join(source, 'node_modules/next/dist/bin/next'), 'build', '--webpack'], {
      cwd: appDir,
      env: buildEnvironment(appUrl, siteKey),
      stdio: 'inherit',
      timeout: 600_000,
    });

    const nextDir = path.join(appDir, '.next');
    copyTree(nextDir, path.join(releaseDir, '.next'), (filename) => {
      const relative = path.relative(nextDir, filename);
      return !/^(?:cache|diagnostics|types|dev)(?:[/\\]|$)|^trace(?:$|-)/.test(relative);
    });
    copyTree(path.join(appDir, 'public'), path.join(releaseDir, 'public'));
    copyTree(path.join(appDir, 'next.config.mjs'), path.join(releaseDir, 'next.config.mjs'));
    for (const name of ['server.js', 'package-lock.json', 'CPANEL-DEPLOY.md', 'MYSQL-CPANEL.md', 'SECURITY-DEPLOYMENT.md', 'index.html', 'index.php', 'scripts/hash-pin.cjs', 'scripts/check-mysql.cjs']) {
      const destination = path.join(releaseDir, name);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      copyTree(path.join(source, name), destination);
    }
    copyTree(path.join(source, 'src/lib/mysqlConfig.cjs'), path.join(releaseDir, 'scripts/mysqlConfig.cjs'));
    // The archive is a runtime release, not a source checkout to build on hosting.
    fs.writeFileSync(path.join(releaseDir, 'package.json'), JSON.stringify({
      ...packageJson,
      scripts: { start: 'node server.js', 'hash-pin': 'node scripts/hash-pin.cjs', 'check:mysql': 'node scripts/check-mysql.cjs' },
    }, null, 2) + '\n');
    const manifest = {
      createdAt: new Date().toISOString(),
      appUrl,
      turnstileSiteKey: siteKey || null,
      nodeVersion: process.versions.node,
      platform: process.platform,
      architecture: process.arch,
      nextVersion,
      databaseProviders: ['postgres', 'mysql'],
      buildId: fs.readFileSync(path.join(nextDir, 'BUILD_ID'), 'utf8').trim(),
      lockfileSha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(releaseDir, 'package-lock.json'))).digest('hex'),
      installCommand: 'npm ci --omit=dev',
      selectorInstallNote: 'For a selector-managed node_modules symlink, use its real parent as --prefix; see CPANEL-DEPLOY.md section 5.',
      startupFile: 'server.js',
    };
    fs.writeFileSync(path.join(releaseDir, 'cpanel-release.json'), JSON.stringify(manifest, null, 2) + '\n');

    const stamp = manifest.createdAt.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    const host = new URL(appUrl).hostname.replace(/[^A-Za-z0-9.-]/g, '-');
    const filename = `fan26-cpanel-${host}-${process.platform}-${stamp}.tar.gz`;
    const archive = path.join(work, filename);
    execFileSync('tar', ['-czf', archive, '-C', releaseDir, '.'], { stdio: 'inherit' });
    const archiveEntries = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }).split(/\r?\n/).filter(Boolean);
    if (archiveEntries.some((entry) => /(?:^|\/)(?:node_modules|\.git|\.env[^/]*|\.participants_data\.json|\.neon)(?:\/|$)/.test(entry))) {
      throw new Error('The generated archive contains an excluded path.');
    }
    for (const required of ['.next/BUILD_ID', 'server.js', 'next.config.mjs', 'package-lock.json', 'cpanel-release.json']) {
      if (!archiveEntries.some((entry) => entry.replace(/^\.\//, '') === required)) throw new Error(`Archive is missing ${required}.`);
    }
    fs.mkdirSync(output, { recursive: true });
    fs.copyFileSync(archive, path.join(output, filename), fs.constants.COPYFILE_EXCL);
    const sha256 = crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex');
    fs.writeFileSync(path.join(output, `${filename}.sha256`), `${sha256}  ${filename}\n`, { flag: 'wx' });
    console.log(`[cPanel] Package: ${path.join(output, filename)}`);
    console.log(`[cPanel] SHA-256: ${sha256}`);
    console.log('[cPanel] Extract into Application Root, set runtime variables, follow CPANEL-DEPLOY.md section 5 to install dependencies, then restart.');
  } finally {
    fs.rmSync(work, { recursive: true, force: true, maxRetries: 3 });
  }
}

try { main(); }
catch (error) {
  console.error('[cPanel] Packaging failed:', error.message);
  process.exitCode = 1;
}
