# Deploy Fasilkom Awarding Night 2026 ke cPanel Rumahweb

Paket ini menjalankan Next.js full-stack melalui **Setup NodeJS App**, dengan
startup file `server.js`. Gunakan Node.js **22.x**. Build dilakukan di luar shared
hosting; database, Gmail, dan sesi admin dikonfigurasi saat aplikasi dijalankan.

Tujuan trial yang dipilih adalah **`https://awarding.fasilkomapp.id`**, dengan IP
hosting Rumahweb **`203.175.8.166`**. Aplikasi cPanel sudah dibuat menggunakan root
`fan26-test`, mode Production, startup `server.js`, dan Node.js 22.23.4. Pengelola
DNS kampus mengatur A record khusus `awarding` ke IP Rumahweb tersebut.

## 1. Siapkan tujuan deployment

1. Tentukan domain/subdomain uji yang kamu kelola dan daftarkan di cPanel. Arahkan
   DNS-nya ke IP hosting yang diberikan Rumahweb, lalu aktifkan SSL/AutoSSL.
2. Pasang aplikasi di **root subdomain** `https://awarding.fasilkomapp.id`, dengan
   kolom path Application URL dikosongkan.
3. Siapkan database uji terpisah. Untuk paket yang memblokir PostgreSQL eksternal,
   gunakan **MySQL/MariaDB internal** melalui [MYSQL-CPANEL.md](./MYSQL-CPANEL.md).
   Alternatif PostgreSQL tetap tersedia bila koneksi eksternal diizinkan. Akun
   database perlu izin operasi serta membuat tabel dan index saat inisialisasi.
4. Konfirmasikan koneksi internal MySQL/socket atau TCP/TLS PostgreSQL sesuai
   provider yang dipilih, serta akses `smtp.gmail.com:465` secara terpisah.
   Seluruh lapisan proxy/WAF harus menerima request multipart **16 MiB**.
5. Konfirmasikan header IP yang ditetapkan ingress Rumahweb. Jika ingress menimpa
   `X-Real-IP` dengan IP pengunjung dan backend tidak dapat dilewati, gunakan
   `TRUSTED_PROXY=reverse-proxy`. Lihat [konfigurasi ingress](SECURITY-DEPLOYMENT.md).

Jadwal pendaftaran tetap dikelola panitia. Proses aplikasi dijalankan oleh cPanel;
tidak perlu memasang PM2 atau cron untuk menyalakan Next.js pada metode ini.

## 2. Buat paket Linux dengan GitHub Actions

Setelah perubahan deployment ini tersedia pada branch default repository GitHub
(agar tombol **Run workflow** tersedia):

1. Buka **Actions → Build cPanel package → Run workflow**.
2. Isi `app_url` dengan `https://awarding.fasilkomapp.id`.
3. Jika memakai Turnstile, isi `turnstile_site_key` dengan **site key publik** dan
   tambahkan hostname uji pada pengaturan Turnstile. Kosongkan untuk menonaktifkannya.
4. Tunggu workflow selesai. Unduh artifact **fan26-cpanel-linux**.
5. Ekstrak ZIP artifact di laptop. File yang diunggah ke cPanel adalah
   **`fan26-cpanel-...-linux-....tar.gz`** di dalamnya, bukan ZIP pembungkus artifact.

Workflow menggunakan Ubuntu dan Node.js 22. Sesudah build, workflow mengekstrak
arsip ke folder baru, memasang dependency produksi melalui layout symlink Selector,
dan memeriksa startup, aset/optimasi gambar, redirect, serta proteksi API tanpa
database/Gmail. Paket menyertakan checksum `.sha256` dan laporan `.verification.json`.
Database, PIN admin, dan App Password tidak diperlukan sebagai input build.

### Build dari mesin Linux sendiri

Dengan Node.js 22 dan perintah `tar` tersedia, jalankan dari source project:

```bash
npm ci --include=dev
npm run package:cpanel -- --url "https://awarding.fasilkomapp.id"
npm run verify:cpanel
```

Jika Turnstile digunakan:

```bash
npm run package:cpanel -- --url "https://awarding.fasilkomapp.id" --site-key "SITE_KEY_PUBLIK"
```

Output ada di `build/cpanel/`. Opsi `--output` dapat memilih folder lain. Alternatif
input untuk otomasi adalah `CPANEL_APP_URL` dan `CPANEL_TURNSTILE_SITE_KEY`.
Jika folder output berisi beberapa rilis, pilih arsip yang akan diperiksa dengan
`npm run verify:cpanel -- --archive "build/cpanel/NAMA_PAKET.tar.gz"`.

Script dapat dijalankan di Windows untuk pemeriksaan lokal; nama dan manifest
paket mencatat platform build. Gunakan hasil build **Linux** untuk hosting Linux.

### Isi paket

- `.next/` hasil build produksi, termasuk folder tersembunyi dan aset client.
- `public/`, `server.js`, `package.json`, dan `package-lock.json`.
- `next.config.mjs`, hasil kompilasi `next.config.ts` yang sama dengan konfigurasi
  build. Ini memungkinkan instalasi dependency produksi tanpa TypeScript di hosting.
- `scripts/hash-pin.cjs`, diagnostic read-only `scripts/check-mysql.cjs` beserta
  config-nya, panduan deployment/MySQL, dan `cpanel-release.json`.

Pembuat paket bekerja di salinan bersih dengan daftar file yang ditentukan.
`.env.local`, `.git`, `node_modules`, log, file peserta lokal, dan cache build tidak
disertakan. Source `.next` lama tidak digunakan kembali. `cpanel-release.json`
mencatat URL, site key publik, versi Node/Next, platform, build ID, dan hash lockfile.

**`NEXT_PUBLIC_*` terkunci saat build.** URL dan site key pada paket harus sesuai
target. Perubahan domain atau site key memerlukan paket baru, bukan hanya restart.
Jika paket dibangun tanpa Turnstile, kosongkan kedua variabel Turnstile di cPanel.

## 3. Buat aplikasi di cPanel

Pilih **Setup NodeJS App → Create Application**:

| Field | Nilai |
| --- | --- |
| Node.js Version | 22.x |
| Application Mode | Production |
| Application Root | `fan26-test`, di luar `public_html` |
| Application URL | `awarding.fasilkomapp.id`, kolom path dikosongkan |
| Application Startup File | `server.js` |

Unggah `.tar.gz` melalui File Manager dan ekstrak ke **Application Root**. File
`server.js`, `package.json`, serta folder `.next` harus langsung berada di root itu,
bukan di folder tambahan. Aktifkan **Show Hidden Files** untuk memeriksa `.next`.

## 4. Isi environment variables di Setup NodeJS App

| Variabel | Nilai |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATABASE_PROVIDER` | `mysql` untuk MySQL/MariaDB internal, `postgres` untuk PostgreSQL (default) |
| `DATABASE_URL` | URL PostgreSQL uji; kosong untuk MySQL |
| `ADMIN_PIN_HASH` | Hash bcrypt mentah, tanpa tanda kutip atau escape `$` |
| `GMAIL_USER` | Alamat lengkap akun Gmail panitia |
| `GMAIL_APP_PASSWORD` | App Password dari akun yang sama, tanpa spasi pemisah |
| `NEXT_PUBLIC_APP_URL` | Origin HTTPS yang sama dengan `appUrl` dalam `cpanel-release.json` |
| `QR_EMAIL_MODE` | `cid` |
| `TRUSTED_PROXY` | Sesuai ingress terverifikasi; `reverse-proxy` hanya untuk `X-Real-IP` yang ditimpa ingress |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Sama dengan site key yang digunakan saat build, atau kosong |
| `TURNSTILE_SECRET_KEY` | Secret untuk site key tersebut, atau kosong jika Turnstile tidak dipakai |

Untuk MySQL, tambahkan `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD` beserta
host/port atau socket sesuai [tabel environment MySQL](./MYSQL-CPANEL.md#5-isi-environment-runtime-nodejs-app).
Menu phpMyAdmin saja belum membuktikan akses dari Node.js. Gunakan diagnostic
read-only sebelum mengganti provider live. Rilis lama PostgreSQL harus diganti
dengan paket baru yang mencantumkan kedua provider dalam manifest.

`server.js` menggunakan port **8080** secara default, mengikuti panduan Rumahweb.
Jika hosting menentukan port lain, gunakan `PORT`; nama `port` dari contoh lama
Rumahweb juga diterima. Default alamat listener adalah `127.0.0.1`; ubah `HOST`
hanya jika topologi hosting memerlukan alamat bind berbeda. HTTPS ditangani web
server cPanel di depan listener Node.js.

Untuk membuat hash admin, jalankan `npm run hash-pin -- "PIN_PILIHANMU"` secara lokal
dan gunakan bagian **hosting dashboard** dari output. Pengaturan environment
Vercel tidak otomatis berpindah ke cPanel.

Jika `TRUSTED_PROXY` belum sesuai, pengunjung dapat berbagi bucket IP `unknown`.
Konfirmasikan header ingress sebelum membuka registrasi untuk peserta.

## 5. Install dependency dan mulai aplikasi

1. Hentikan aplikasi melalui tombol **Stop** sebelum mengganti dependency. Salin
   dan jalankan perintah aktivasi environment Node.js yang ditampilkan oleh cPanel,
   lalu pastikan terminal berada pada Application Root.
2. Jalankan blok berikut di Terminal cPanel. Blok ini memilih lokasi instalasi
   yang sesuai, termasuk ketika NodeJS Selector membuat symlink `node_modules`:

   ```bash
   (
     set -eu
     install_root="$PWD"
     if [ -L node_modules ]; then
       modules_target="$(readlink -f node_modules)"
       test -d "$modules_target"
       test "$(basename "$modules_target")" = node_modules
       install_root="$(dirname "$modules_target")"
       cp package.json package-lock.json "$install_root/"
     fi
     npm --prefix "$install_root" ci --omit=dev
   )
   ```

3. Setelah instalasi berhasil, klik **Start/Restart** pada Setup NodeJS App.
4. Buka URL HTTPS uji dan periksa log aplikasi/`stderr.log`.

Pada npm standar, `npm ci` langsung di Application Root dapat menghapus symlink
`node_modules`. Blok di atas memasang dependency melalui direktori target asli
(`--prefix`) sehingga symlink Selector tetap utuh. Tanpa symlink, blok ini setara
dengan menjalankan `npm ci --omit=dev` di Application Root. Gunakan virtual
environment khusus aplikasi ini.

Paket tidak membawa `node_modules` dari laptop.
Perintah startup dalam **paket** adalah `node server.js`; pada source project,
startup ini juga dapat dijalankan dengan `npm run start:cpanel` setelah build.

## 6. Tes pada domain uji

- Halaman depan, gambar, dan JavaScript termuat tanpa error.
- Login/logout admin berhasil; cookie sesi produksi menggunakan HTTPS.
- Preview tiga `.xlsx`, aktivasi, dan rollback berjalan dengan data uji.
- Upload gabungan yang besar mencapai handler Node.js tanpa 413 dari hosting.
  Pengaturan upload PHP tidak menentukan batas request untuk aplikasi Node.js ini.
- Registrasi mahasiswa uji menghasilkan tiket, email, dan QR yang dapat dipakai
  check-in. Email dapat masuk Spam; log `535 / EAUTH` berarti kredensial ditolak.
- Rute admin, tiket, dan API sensitif mempertahankan `Cache-Control: private, no-store`.
- Rate limit memakai IP pengunjung yang benar melalui ingress. Batas registrasi
  saat ini adalah lima percobaan/menit/IP; uji juga pemakaian Wi-Fi bersama.
- Restart aplikasi mempertahankan data database, sesi yang masih berlaku, dan kuota.

Pembukaan halaman depan saja belum menguji database, SMTP, upload, atau kapasitas
akses bersamaan. Ikuti juga [panduan operasional](SECURITY-DEPLOYMENT.md).

## 7. Aktifkan registrasi di domain acara

Setelah tes cPanel berhasil, gunakan rilis yang sudah diperiksa untuk
`https://awarding.fasilkomapp.id`, konfirmasikan database produksi serta hostname
Turnstile jika digunakan, dan pastikan DNS/SSL Rumahweb sudah aktif. Perubahan site
key publik memerlukan build baru. Simpan paket rilis sebelumnya serta backup
database untuk pemulihan. Hosting tetap diperlukan sampai acara 1 Desember 2026
untuk tiket dan check-in.

## Pemecahan masalah

| Gejala | Periksa |
| --- | --- |
| `Production build missing` | `.next/BUILD_ID` ada langsung di Application Root; ekstraksi tidak bersarang |
| `Cannot find module` | Environment Node.js benar dan instalasi pada langkah 5 berhasil |
| Halaman tersedia tetapi API 503 | Provider database, koneksi/TLS atau socket internal, privilege tabel/index, log kode database |
| `535 / EAUTH` | `GMAIL_USER` dan App Password berasal dari akun yang sama; restart sesudah mengubahnya |
| Link email menuju domain lama | Buat ulang paket dengan `--url` yang benar |
| Turnstile menolak registrasi | Site key build, secret runtime, dan allowed hostname harus cocok |
| 413 saat impor | Batas multipart pada web server/WAF/Node, minimal 16 MiB |
| Banyak pengguna terkena 429 | Header IP ingress, nilai `TRUSTED_PROXY`, dan penggunaan jaringan bersama |

Untuk pengujian terisolasi startup cPanel dengan PostgreSQL dan fixture sintetis,
siapkan alat sebagaimana [SECURITY-DEPLOYMENT.md](SECURITY-DEPLOYMENT.md), kemudian
jalankan `node scripts/security-review.cjs --cpanel`. Pengujian ini tidak memakai
database atau Gmail produksi.

Untuk regresi MySQL terisolasi pada mesin pengembangan, isi
`SECURITY_REVIEW_MYSQLD` dengan executable MySQL 8+ kemudian jalankan
`node scripts/security-review.cjs --mysql --cpanel`. Runner memakai datadir baru,
tidak membuka database Laragon/cPanel yang sudah ada. Lihat
[verifikasi database](./SECURITY-DEPLOYMENT.md#verifikasi-terisolasi).

## Hasil verifikasi persiapan — 9 November 2026

- Regresi alur lengkap melalui startup `server.js` lulus pada **PostgreSQL 18.6
  (44 kelompok)**, **MySQL 8.0.44 (45 kelompok)**, dan **MariaDB 10.11.14
  (45 kelompok)**. Cakupannya termasuk registrasi, impor/rollback, check-in,
  sesi/kuota lintas restart, serta gangguan database. Upload tiga workbook valid
  dengan total **12.604.111 byte** berhasil pada ketiga provider.
- Tes database terfokus lulus **7 kelompok pada masing-masing MySQL/MariaDB**:
  impor 10.000 mahasiswa Unicode, pemulihan snapshot, kuota bersama, sesi,
  penolakan engine non-transaksional, serta deadline persiapan/eksekusi query.
  Sepuluh scan bersamaan menghasilkan tepat satu check-in berhasil.
- **11 kelompok pemeriksaan paket** lulus: isi arsip dan checksum, instalasi
  dependency produksi, layout symlink Selector, diagnostic/driver MySQL,
  startup dari direktori berbeda, aset/optimasi gambar, proteksi API kedua
  provider, file privat, serta port huruf kecil dan shutdown.
- Build dan verifikasi paket lokal dilakukan pada **Windows, Node.js 22.15.0,
  Next.js 16.4.3**, dengan URL **`https://awarding.fasilkomapp.id`**. Paket
  `win32-20261109T163726Z` memuat perbaikan deadline dan lulus verifikasi;
  paket Windows ini hanya bukti lokal, bukan arsip upload Linux.

Evidence alur lengkap tersimpan dalam `observations.json` pada folder review
`fan26-review-1i8f6K` (PostgreSQL), `fan26-review-0gm2K2` (MySQL), dan
`fan26-review-q7kBhC` (MariaDB). Evidence terfokus adalah `fan26-review-7ipYtP`
(MySQL) dan `fan26-review-jm42oY` (MariaDB). Semua hasil final tersebut memiliki
nol kegagalan assertion dan nol error cleanup; seluruh database memakai data
sintetis terisolasi. Email eksternal dan kapasitas Rumahweb belum diukur.

Hasil di atas memverifikasi persiapan lokal. Setiap rilis baru melalui workflow
menjalankan pemeriksaan runtime Linux dan menyertakan hasilnya pada
`.verification.json`. Pengujian langsung ingress cPanel/LiteSpeed, koneksi database/SMTP,
batas unggahan ingress, serta kapasitas akses bersamaan dilakukan di hosting tujuan.

Referensi: [Next.js custom server](https://nextjs.org/docs/app/guides/custom-server),
[Next.js self-hosting](https://nextjs.org/docs/app/guides/self-hosting), dan
[panduan Next.js Rumahweb](https://www.rumahweb.com/journal/cara-upload-nextjs-di-cpanel-hosting/).
