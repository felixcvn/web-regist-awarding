# MySQL/MariaDB internal — Rumahweb cPanel

Jalur ini mempertahankan aplikasi Next.js pada paket Rumahweb sekarang:

```text
Browser peserta → HTTPS Rumahweb → Node.js → MySQL/MariaDB internal
```

Keberadaan phpMyAdmin menunjukkan fasilitas database tersedia, tetapi belum
membuktikan proses Node.js boleh mengaksesnya. Koneksi internal harus diuji.
Port listener website (`PORT`, default 8080) tidak menentukan port database.
Tidak perlu mengubah DNS atau pengaturan perangkat peserta untuk migrasi database.

## 1. Prasyarat hosting

- Node.js 22 dan aplikasi yang sudah dibuat melalui Setup NodeJS App.
- **MySQL 8.0+ atau MariaDB 10.6+**, dengan InnoDB dan `utf8mb4`.
- `max_allowed_packet` minimal **16 MiB** untuk batas impor penuh.
- Node.js dapat mengakses loopback TCP internal (biasanya `127.0.0.1:3306`) atau
  Unix socket yang dikonfirmasi support. Jangan menebak path socket atau port lain.
- Database khusus aplikasi dan user yang memiliki akses pada database tersebut.
- Ingress/WAF tetap harus menerima request multipart minimal **16 MiB**.

Versi server dapat dilihat pada halaman utama phpMyAdmin. Jika database berada di
host non-local, gunakan hostname DNS sesuai sertifikat, TLS terverifikasi, serta
CA resmi bila diperlukan. Kode menolak koneksi non-local tanpa verifikasi TLS.
Jangan memakai `MYSQL_SSL_MODE=disabled` untuk mengatasi masalah sertifikat remote.

Pesan untuk support bila alamat internal belum diketahui:

> Saya menjalankan aplikasi Node.js pada root fan26-test. Saya ingin memakai
> MySQL/MariaDB bawaan paket ini, bukan PostgreSQL eksternal. Mohon konfirmasi
> versi database, akses InnoDB, max_allowed_packet minimal 16 MiB, serta host/port
> loopback atau path Unix socket yang dapat diakses Node.js. Mohon konfirmasi
> juga akses SMTP Gmail port 465 atau fasilitas SMTP internal paket ini.

## 2. Buat database uji melalui cPanel

1. Buka **Database Wizard / MySQL Database Wizard** atau **Manage My Databases**.
2. Buat database khusus trial, misalnya nama pendek `fan26_trial`.
3. Buat user khusus, misalnya `fan26_app`, menggunakan password baru yang kuat.
4. Hubungkan user ke database tersebut. Pilih **ALL PRIVILEGES** hanya untuk
   database aplikasi ini, bukan hak global pada server.
5. Catat **nama lengkap** database dan user yang ditampilkan cPanel. Prefix akun
   termasuk bagian nama: contoh `awaw8329_fan26_trial` dan `awaw8329_fan26_app`.
   Gunakan nilai yang benar-benar ditampilkan panel, bukan menebak prefix.

Tidak perlu membuat tabel secara manual di phpMyAdmin. Aplikasi membuat tabel
dan indeks saat request pertama yang membutuhkan database. Seluruh tabel aplikasi
harus InnoDB; jika ada tabel aplikasi dengan engine lain, aplikasi menolak
menggunakannya, bukan diam-diam kehilangan transaksi.

**Database trial harus terpisah.** Dukungan MySQL tidak menyalin data Neon secara
otomatis, tidak mengekspor data produksi, dan tidak mengubah database Neon.
Jika sudah ada peserta/tiket yang wajib dipertahankan, backup dan migrasi data
teruji harus dilakukan sebelum cutover produksi. Jangan mengganti sumber data
live dengan database kosong dan menganggap peserta lama sudah ikut berpindah.

## 3. Siapkan rilis yang mendukung MySQL

Gunakan [CPANEL-DEPLOY.md](./CPANEL-DEPLOY.md) untuk build Linux, upload ke
Application Root, dan instalasi dependency produksi melalui prefix Selector.
Dependency runtime baru adalah `mysql2`; symlink `node_modules` harus tetap utuh.

**Arsip rilis PostgreSQL lama belum memiliki adapter ini.** Mengisi environment
MySQL pada rilis lama saja tidak mengubah driver database. Manifest rilis baru
(`cpanel-release.json`) mencantumkan `databaseProviders: ["postgres", "mysql"]`.
Build dan verifikasi lokal Windows bukan pengganti artefak Linux untuk hosting.

Paket runtime baru menyertakan `scripts/check-mysql.cjs`, config diagnostik,
dan panduan ini. Build tidak membutuhkan password MySQL. Jika instalasi dependency
terhalang akses registry npm, konfirmasikan metode instalasi yang diizinkan
Rumahweb; jangan mengubah port aplikasi atau menonaktifkan pemeriksaan TLS.

## 4. Uji koneksi read-only dari Terminal

Tes ini membaca metadata server. Ia **tidak** membuat/menghapus tabel,
mendaftarkan peserta, mengirim email, atau mengambil daftar mahasiswa.
Nilai environment pada dashboard NodeJS App belum tentu otomatis tersedia di
Terminal. Karena itu, masukkan nilai yang sama secara eksplisit dan tersembunyi
untuk password.

Aktifkan environment aplikasi dan masuk ke root:

```bash
source /home/awaw8329/nodevenv/fan26-test/22/bin/activate
cd /home/awaw8329/fan26-test
```

Jalankan blok berikut. Untuk koneksi loopback default, tekan Enter pada host dan
port. Jika support memberikan Unix socket, isi path yang dikonfirmasi pada prompt
socket. Password tidak tampil dan environment sementara hilang saat subshell selesai.

```bash
(
  set -eu
  IFS= read -r -p 'Host MySQL [127.0.0.1]: ' MYSQL_HOST </dev/tty
  MYSQL_HOST="${MYSQL_HOST:-127.0.0.1}"
  IFS= read -r -p 'Port MySQL [3306]: ' MYSQL_PORT </dev/tty
  MYSQL_PORT="${MYSQL_PORT:-3306}"
  IFS= read -r -p 'Path socket (Enter jika TCP): ' MYSQL_SOCKET_PATH </dev/tty
  IFS= read -r -p 'Nama database lengkap: ' MYSQL_DATABASE </dev/tty
  IFS= read -r -p 'Nama user lengkap: ' MYSQL_USER </dev/tty
  IFS= read -r -s -p 'Password database: ' MYSQL_PASSWORD </dev/tty
  printf '\n' >/dev/tty
  test -n "$MYSQL_DATABASE"
  test -n "$MYSQL_USER"
  test -n "$MYSQL_PASSWORD"
  export MYSQL_HOST MYSQL_PORT MYSQL_SOCKET_PATH MYSQL_DATABASE MYSQL_USER MYSQL_PASSWORD
  unset MYSQL_SSL_MODE MYSQL_SSL_CA_FILE
  node scripts/check-mysql.cjs
)
```

Blok tersebut memilih TLS otomatis untuk hostname non-local. Bila server remote
memerlukan CA privat/resmi provider, isi `MYSQL_SSL_CA_FILE` dengan path berkas
CA yang benar di dalam subshell sebelum menjalankan diagnostic; jangan mengirim
private key. Output hanya menampilkan status, versi, kemampuan server, serta kode
error yang aman. Tidak ada URL/password di output.

`"connected": true` berarti koneksi dan kemampuan dasar server lulus. Output
`"schemaWritesVerified": false` memang disengaja: hak pembuatan tabel dan semua
operasi aplikasi baru dibuktikan oleh tes login/impor berikutnya.

## 5. Isi environment runtime NodeJS App

Set **hanya setelah rilis baru siap**. Nilai dashboard mentah, tanpa tanda kutip.

| Variabel | Nilai |
| --- | --- |
| `DATABASE_PROVIDER` | `mysql` — berlaku juga untuk MariaDB |
| `DATABASE_URL` | Kosong untuk deployment MySQL |
| `MYSQL_HOST` | Host internal terkonfirmasi; default `127.0.0.1` |
| `MYSQL_PORT` | Port internal terkonfirmasi; default `3306` |
| `MYSQL_SOCKET_PATH` | Kosong untuk TCP; path absolut hanya bila socket dikonfirmasi |
| `MYSQL_DATABASE` | Nama database lengkap beserta prefix cPanel |
| `MYSQL_USER` | Nama user lengkap beserta prefix cPanel |
| `MYSQL_PASSWORD` | Password baru user database; tempel mentah, tanpa escape `$` |
| `MYSQL_SSL_MODE` | Kosong untuk pilihan otomatis; `disabled` hanya untuk loopback/socket, `verify-full` untuk host non-local |
| `MYSQL_SSL_CA_FILE` | Kosong untuk CA publik/default; path CA resmi bila diperlukan |

Pertahankan environment lain seperti `ADMIN_PIN_HASH`, `NEXT_PUBLIC_APP_URL`,
`QR_EMAIL_MODE`, Gmail, dan `TRUSTED_PROXY` sesuai panduan deployment. Hash/PIN dan
kredensial yang sebelumnya terungkap perlu diganti. Restart aplikasi setelah
mengubah konfigurasi runtime; pool dan pilihan provider dibaca proses aplikasi.

`DATABASE_PROVIDER` default tetap `postgres`, jadi deployment PostgreSQL yang
lama tidak otomatis berpindah. Aplikasi MySQL tidak menggunakan Neon meskipun URL
PostgreSQL lama belum terhapus. Semua instance produksi harus memilih provider
dan database yang sama; jangan menjalankan sebagian instance pada database berbeda.

## 6. Acceptance di hosting

1. Login admin, buka daftar peserta, logout, lalu login kembali.
2. Preview tepat tiga `.xlsx` pada field `sistemInformasi`, `informatika`,
   `teknologiInformasi`; maksimal 5 MiB/file.
3. Aktifkan snapshot yang valid. Ulangi dengan batch uji kedua, lalu rollback.
   Pastikan dataset dan status batch kembali dengan benar.
4. Daftarkan mahasiswa uji dari `student_master`, buka tiket, dan uji scan QR
   bersamaan: hanya satu check-in boleh berhasil.
5. Restart aplikasi. Data peserta, sesi yang belum kedaluwarsa, batch aktif,
   snapshot rollback, serta kuota percobaan harus tetap tersimpan.
6. Uji upload valid gabungan di atas 10 MiB, trusted IP ingress, Wi-Fi kampus
   bersama, jaringan seluler, dan kapasitas hosting. Total 600–700 peserta bukan
   bukti bahwa 600–700 request serentak dapat dilayani paket shared hosting.
7. Uji undangan Gmail yang benar-benar diterima. Migrasi MySQL tidak membuka
   port SMTP dan tidak memperbaiki App Password Gmail yang ditolak.

Pembukaan registrasi tetap keputusan panitia, bukan timer otomatis. Hosting
harus tetap aktif sampai acara **1 Desember 2026** untuk akses tiket dan check-in.

## Pemecahan masalah

| Kode/gejala | Tindakan |
| --- | --- |
| `MYSQL_CONFIGURATION` | Isi nama lengkap database/user/password; periksa host, port, socket, dan pilihan TLS |
| `ER_ACCESS_DENIED_ERROR` | Periksa password, nama user dengan prefix, serta user yang dihubungkan ke database |
| `ER_DBACCESS_DENIED_ERROR` | Beri akses user ke database melalui cPanel |
| `ER_BAD_DB_ERROR` | Periksa nama database lengkap |
| `ECONNREFUSED` / `ETIMEDOUT` | Minta host/port/socket internal yang diizinkan untuk Node.js |
| `MYSQL_VERSION_UNSUPPORTED` | Konfirmasikan MySQL 8.0+ atau MariaDB 10.6+ |
| `MYSQL_PACKET_TOO_SMALL` | Minta `max_allowed_packet` minimal 16 MiB |
| `MYSQL_ENGINE_UNSAFE` | Gunakan database aplikasi khusus dengan InnoDB; jangan mengubah engine live tanpa backup |
| `[DB/MySQL] ... unavailable: ER_TABLEACCESS_DENIED_ERROR` | Periksa privilege inisialisasi/operasi pada database aplikasi |
| 503 tetapi halaman depan 200 | Halaman depan tidak memerlukan koneksi database; periksa diagnostic dan log kode database |
| `535 / EAUTH` | Kredensial Gmail ditolak; masalah ini terpisah dari MySQL |

Log adapter hanya mencatat kode error, bukan SQL, password, atau nilai peserta.
Akuisisi koneksi dibatasi 10 detik; setiap command database dibatasi 15 detik
termasuk persiapan query, bukan hanya eksekusinya. Koneksi yang melewati deadline
dikeluarkan dari pool. Ini batas per-command, bukan janji durasi seluruh impor.
Write tidak diulang otomatis: bila respons COMMIT terputus, periksa hasil yang
tersimpan sebelum mengulang tindakan. Diagnostic read-only juga berhenti bila
query metadata melewati timeout, tanpa menunggu command yang macet selesai.
Jangan menonaktifkan fail-closed, menyimpan sesi/kuota produksi di memori, atau
menggunakan file JSON sebagai pengganti database produksi.
