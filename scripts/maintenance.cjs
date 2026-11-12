#!/usr/bin/env node
/*
 * Toggle the static maintenance page on cPanel.
 *
 *   node scripts/maintenance.cjs on
 *   node scripts/maintenance.cjs off
 *   node scripts/maintenance.cjs status
 *
 * The page must be named index.html in the document root: LiteSpeed serves it
 * before Passenger, so it only works while the Node app is stopped. `off`
 * removes it again, otherwise the app stays hidden.
 *
 * Optional: --docroot /path/to/public_html (default: $HOME/public_html)
 */
const fs = require('node:fs');
const path = require('node:path');

const MARKER = 'Sedang Dalam Perawatan';
const source = path.join(__dirname, '..', 'maintenance.html');

function fail(message) {
  console.error(`[maintenance] ${message}`);
  process.exitCode = 1;
}

function parseArgs(argv) {
  const args = { command: argv[0], docroot: null };
  for (let i = 1; i < argv.length; i++) {
    if (argv[i] === '--docroot') args.docroot = argv[++i];
    else if (argv[i].startsWith('--docroot=')) args.docroot = argv[i].slice('--docroot='.length);
  }
  return args;
}

function resolveDocroot(explicit) {
  if (explicit) return path.resolve(explicit);
  if (process.env.MAINTENANCE_DOCROOT) return path.resolve(process.env.MAINTENANCE_DOCROOT);
  if (!process.env.HOME) throw new Error('HOME is not set; pass --docroot /path/to/public_html');
  return path.join(process.env.HOME, 'public_html');
}

function readHtaccess(docroot) {
  const file = path.join(docroot, '.htaccess');
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function report(docroot) {
  const target = path.join(docroot, 'index.html');
  const exists = fs.existsSync(target);
  const size = exists ? fs.statSync(target).size : 0;
  const htaccess = readHtaccess(docroot);

  console.log(`docroot        : ${docroot}`);
  console.log(`index.html     : ${exists ? `ada (${size} byte)` : 'tidak ada'}`);
  console.log(`maintenance.html: ${fs.existsSync(source) ? 'ada' : 'TIDAK ADA'}`);
  console.log(`Passenger      : ${htaccess && /PassengerAppRoot/.test(htaccess) ? 'terkonfigurasi' : 'TIDAK DITEMUKAN di .htaccess'}`);
  console.log(`Options -Indexes: ${htaccess && /^\s*Options\s+-Indexes/m.test(htaccess) ? 'aktif' : 'belum aktif'}`);

  if (exists) {
    const body = fs.readFileSync(target, 'utf8');
    console.log(`isi halaman    : ${body.includes(MARKER) ? 'benar' : 'TIDAK dikenali'}`);
  }
  return { exists, size, htaccess };
}

function main() {
  const { command, docroot: explicit } = parseArgs(process.argv.slice(2));
  if (!['on', 'off', 'status'].includes(command)) {
    console.log('Usage: node scripts/maintenance.cjs <on|off|status> [--docroot /path/to/public_html]');
    process.exitCode = 1;
    return;
  }

  let docroot;
  try {
    docroot = resolveDocroot(explicit);
  } catch (error) {
    fail(error.message);
    return;
  }
  if (!fs.existsSync(docroot)) {
    fail(`Document root tidak ditemukan: ${docroot}`);
    return;
  }

  const target = path.join(docroot, 'index.html');

  if (command === 'status') {
    report(docroot);
    return;
  }

  if (command === 'on') {
    if (!fs.existsSync(source)) {
      fail(`maintenance.html tidak ada di ${source}. Ekstrak paket cPanel lebih dulu.`);
      return;
    }
    const body = fs.readFileSync(source, 'utf8');
    if (!body.includes(MARKER)) {
      fail('maintenance.html tidak berisi penanda halaman pemeliharaan. Dibatalkan.');
      return;
    }
    fs.writeFileSync(target, body);
    const written = fs.statSync(target).size;
    if (written !== Buffer.byteLength(body)) {
      fail(`index.html tidak lengkap (${written} byte).`);
      return;
    }
    console.log(`[maintenance] ON  -> ${target} (${written} byte)`);
    console.log('[maintenance] Sekarang Stop aplikasi di cPanel > Setup NodeJS App.');
    report(docroot);
    return;
  }

  // off
  if (fs.existsSync(target)) {
    fs.unlinkSync(target);
    console.log(`[maintenance] OFF -> ${target} dihapus`);
  } else {
    console.log('[maintenance] OFF -> index.html memang tidak ada');
  }
  const { htaccess } = report(docroot);
  if (!htaccess || !/PassengerAppRoot/.test(htaccess)) {
    fail('Blok Passenger tidak ada di .htaccess. Stop lalu Start aplikasi di cPanel untuk membuatnya ulang.');
    return;
  }
  console.log('[maintenance] Sekarang Start aplikasi di cPanel > Setup NodeJS App.');
}

try {
  main();
} catch (error) {
  fail(error.message);
}
