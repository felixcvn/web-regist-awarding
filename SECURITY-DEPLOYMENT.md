# Konfigurasi keamanan dan operasional

Panduan untuk perubahan setelah [audit 7 November 2026](SECURITY-AUDIT-2026-11-07.md). Gunakan `.env.example` sebagai acuan; isi kredensial deployment melalui pengaturan hosting.

## Database dan sesi admin

- Pilih `DATABASE_PROVIDER=postgres` (default) atau `mysql` (termasuk MariaDB). PostgreSQL membutuhkan `DATABASE_URL`; MySQL membutuhkan `MYSQL_DATABASE`, `MYSQL_USER`, dan `MYSQL_PASSWORD` serta koneksi internal/terverifikasi sesuai [MYSQL-CPANEL.md](./MYSQL-CPANEL.md). Seluruh instance harus menggunakan provider dan database yang sama untuk peserta, sesi, snapshot impor, dan rate limit.
- Saat pertama digunakan, aplikasi membuat tabel/index yang diperlukan. Akun database membutuhkan izin DDL sesuai `src/lib/db.ts` / `src/lib/mysqlSchema.ts`. MySQL memerlukan InnoDB, MySQL 8.0+ atau MariaDB 10.6+, serta `max_allowed_packet` minimal 16 MiB. Inisialisasi menolak tabel aplikasi non-InnoDB; engine tidak diubah otomatis.
- Rate limit menggunakan operasi atomik PostgreSQL atau transaksi dengan penguncian row InnoDB pada MySQL. Saat store tidak tersedia, endpoint yang dibatasi mengembalikan `503`, bukan beralih ke kuota memori. MySQL tidak beralih ke provider lain atau file JSON. Kuota memori/file development pada jalur PostgreSQL tetap non-produksi.
- Gunakan `ADMIN_PIN_HASH` bcrypt, dibuat melalui `npm run hash-pin -- "<pin-kuat>"`. Pada `.env.local`, escape setiap `$` menjadi `\$`; pada dashboard hosting, simpan hash mentah. Sesi berlaku delapan jam dan cookie produksi memerlukan HTTPS.
- Login tetap dibatasi lima request/menit/IP, dengan lockout tambahan setelah 12 login gagal dalam 15 menit. Batas endpoint lain berada pada handler masing-masing.

## Sumber IP yang dipercaya

`TRUSTED_PROXY` memilih **satu** header berdasarkan ingress yang benar-benar digunakan:

| Nilai | Sumber IP |
| --- | --- |
| `vercel` | IP pertama pada `X-Forwarded-For` yang disediakan ingress Vercel |
| `cloudflare` | `CF-Connecting-IP` |
| `reverse-proxy` | `X-Real-IP` |
| `none` / nilai lain | `unknown`; header pengguna diabaikan |
| Kosong | Otomatis `vercel` hanya bila `VERCEL=1`; selain itu `unknown` |

IP tidak valid juga menjadi `unknown`. Request dengan IP `unknown` berbagi bucket, sehingga produksi perlu memilih ingress yang tepat. Header alternatif tidak digunakan sebagai fallback.

Untuk Cloudflare atau reverse proxy, batasi akses langsung ke origin dan pastikan ingress menimpa header pilihannya. Jangan memilih Cloudflare hanya karena request memiliki `CF-Connecting-IP`. Verifikasi konfigurasi hosting dengan mengirim header yang saling bertentangan: IP audit dan kuota harus tetap mengikuti alamat dari ingress, termasuk lintas instance/restart.

Contoh bagian konfigurasi Nginx bila Nginx adalah ingress langsung:

```nginx
location / {
    client_max_body_size 16m;
    client_body_timeout 15s;
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Gunakan `TRUSTED_PROXY=reverse-proxy` dan batasi port Next.js ke loopback/jaringan privat. Bila ada proxy tambahan di depan Nginx, konfigurasi trusted real-IP harus disesuaikan dengan jaringan proxy tersebut.

## Impor tiga workbook

1. Login, lalu unggah tepat satu `.xlsx` pada masing-masing field `sistemInformasi`, `informatika`, dan `teknologiInformasi`.
2. Setiap file maksimal **5 MiB** (`5 * 1024 * 1024` byte). Total request multipart maksimal **15 MiB + 64 KiB**. Extension dan isi ZIP/OOXML diperiksa.
3. Worksheet pertama digunakan, dengan header `NIM` dan `NAMA` atau `NAMA LENGKAP`. Worksheet tambahan tidak dipakai sebagai data mahasiswa.
4. Total maksimum 10.000 baris mahasiswa untuk ketiga file; setiap worksheet maksimal 128 kolom. Setiap prodi harus memiliki baris valid. Nama resmi dan nama hasil normalisasi maksimal 120 karakter.
5. NIM tepat 12 digit: tahun pada digit 1–2 (`23`–`26`), penomoran fakultas pada digit 3–8, prodi pada digit 9–10, dan penomoran tambahan pada digit 11–12. SI memakai `10`/`11`, TI `20`/`21`, Informatika `30`/`31`. NIM string maupun angka bulat 12 digit didukung.
6. Preview valid disimpan di database, terikat ke sesi admin pembuatnya, dan berlaku **15 menit**. Commit hanya menerima JSON `{ "batchId": "STU-<UUID>" }`; data berasal dari snapshot yang sudah diperiksa.
7. ID karangan, preview sesi lain, kedaluwarsa, atau sudah dipakai menghasilkan `409`. Lakukan preview ulang setelah login ulang, expiry, atau perubahan file.
8. Aktivasi, pengarsipan batch sebelumnya, dan konsumsi preview dilakukan dalam satu transaksi. Rollback mengembalikan snapshot batch sebelumnya. Setelah commit berhasil, daftar mahasiswa dalam preview dikosongkan; snapshot rollback tetap tersedia pada `student_import_records`.

Pada MySQL, aktivasi/rollback memakai lock row persisten `operation_locks`, bukan
`GET_LOCK` yang terikat koneksi dan tidak dilepas oleh rollback. Snapshot dimasukkan
bertahap maksimal 500 mahasiswa per statement dalam transaksi yang sama. Penggantian
master memakai `DELETE`, bukan `TRUNCATE`/DDL yang melakukan implicit commit.
Unique generated column memastikan hanya satu batch berstatus `ACTIVE`. Registrasi
memegang shared row lock pada identitas mahasiswa sampai insert peserta selesai.

Pemeriksaan ZIP membatasi 512 entry, 20 MiB hasil dekompresi per entry, 40 MiB hasil dekompresi total per file, metadata content-type 64 KiB, dan waktu validasi arsip sepuluh detik. Ukuran hasil dekompresi yang benar-benar terbaca juga diperiksa. Batas waktu ini berlaku pada validasi ZIP; parsing SheetJS dilindungi batas ukuran/range dan pembacaan worksheet pertama.

Preview expired dibersihkan saat preview valid berikutnya disimpan. Bucket rate limit expired dibersihkan bertahap saat limiter dipanggil. Penolakan expiry tetap berlaku meskipun pembersihan belum berjalan. Tentukan retensi operasional untuk snapshot rollback dan audit log sesuai kebutuhan acara.

### Batas hosting

`next.config.ts` menaikkan `experimental.proxyClientMaxBodySize` dari default 10 MB menjadi `16mb`, agar buffer Next Proxy tidak memotong unggahan sah. Handler tetap menerapkan batas request di atas pada byte aktual.

[Vercel Functions](https://vercel.com/docs/functions/limitations) memiliki batas request 4,5 MB menurut dokumentasi yang diperiksa saat audit. Pengaturan Next.js **tidak menaikkan batas platform itu**. Agar kontrak tiga file 5 MiB tersedia penuh, gunakan ingress/runtime yang menerima request multipart tersebut. Jika deployment tetap di Vercel Functions, unggahan besar memerlukan alur upload sementara terpisah yang belum diimplementasikan. Periksa ukuran gabungan workbook operasional pada deployment target.

## Tiket, email, dan cache

- Tiket publik dan respons registrasi memakai allowlist: ID, NIM, nama, peran, kategori, angkatan, prodi, token QR, dan status check-in. Email, telepon, serta timestamp internal tetap hanya tersedia pada alur admin yang memerlukannya.
- Halaman tiket dinamis. Respons admin, registrasi, dan QR diberi `Cache-Control: private, no-store`; CDN harus menghormati header ini dan melewatkan cache untuk rute sensitif. Jika sebelumnya ada cache di hosting, purge varian HTML/RSC terkait saat deployment.
- Kuota email adalah dua **percobaan pengiriman** per alamat ternormalisasi per jam. Hanya pembuatan peserta yang berhasil mengonsumsi kuota. Kegagalan validasi atau registrasi duplikat tidak menghabiskannya. Jika kuota habis atau pengiriman gagal, tiket tetap diterbitkan dengan `emailSent: false`.
- Isi `NEXT_PUBLIC_APP_URL` dengan origin HTTPS publik yang benar. SMTP menggunakan `GMAIL_USER` dan `GMAIL_APP_PASSWORD`. Mode `QR_EMAIL_MODE=cid` menyematkan QR ke email; mode `url` memakai endpoint QR publik yang juga memiliki rate limit.
- Turnstile diaktifkan dengan mengisi key server/client dan allowed hostname pada Cloudflare. Pemeriksaan hostname/action di helper masih merupakan tindak lanjut audit.

## Token historis dan risiko yang masih terbuka

`src/lib/revokedTickets.ts` menyimpan SHA-256 dari **delapan token** yang ditemukan pada snapshot historis. Setelah versi ini dideploy, token tersebut ditolak pada halaman tiket, pembuat gambar QR, dan check-in. Kode berisi fingerprint, bukan nilai bearer mentah.

Pemblokiran ini membutuhkan deployment ke seluruh instance. Panitia perlu mengidentifikasi tiket terdampak dan menerbitkan pengganti melalui prosedur operasionalnya. Database live belum dirotasi oleh pekerjaan ini.

`dev26.log` dikeluarkan dari tracking; file lokal tetap tersedia. `.gitignore` mengabaikan log runtime dan file peserta lokal. Data pribadi masih ada pada **riwayat Git lama**. Pembersihan history/remote/clone memerlukan tindak lanjut pemilik repository; pengabaian file baru dan pemblokiran token tidak menghapus salinan historis.

Sesuai keputusan pengguna, pembuktian kepemilikan NIM tidak ditambahkan. Orang yang mengetahui NIM/nama resmi masih dapat mengklaim identitas menggunakan email pilihannya. Feedback publik tentang status registrasi/kecocokan identitas juga masih tersedia, kini dengan rate limit persisten. Status keduanya harus tetap dicatat sebagai risiko terbuka.

## Verifikasi terisolasi

`scripts/security-review.cjs` menuntut perilaku hasil remediasi melalui assertion. Runner memakai database PostgreSQL atau opsi MySQL terisolasi dan salinan aplikasi baru di folder sementara, environment sintetis, dan SMTP penangkap/nonaktif. Ia tidak menggunakan `.env.local` atau database produksi. Satu fingerprint sintetis ditambahkan hanya ke salinan aplikasi untuk menguji wiring revokasi HTTP; token historis hanya dibandingkan di memori pada uji helper.

```powershell
$env:SECURITY_REVIEW_TEMP = Join-Path $env:LOCALAPPDATA 'Temp\opencode'
$env:SECURITY_REVIEW_TOOLS = Join-Path $env:SECURITY_REVIEW_TEMP 'web-regist-security-20261107'
New-Item -ItemType Directory -Force -Path $env:SECURITY_REVIEW_TEMP | Out-Null
npm install --prefix $env:SECURITY_REVIEW_TOOLS --no-audit --no-fund --ignore-scripts embedded-postgres@18.6.0-beta.19
node scripts/security-review.cjs --helpers-only
node scripts/security-review.cjs --database-only
node scripts/security-review.cjs
```

Full run sudah mencakup helper, PostgreSQL bersama, build produksi `--webpack`, serta HTTP. Mode terfokus berguna saat mengubah komponen terkait. Runner mencetak lokasi `observations.json`/log, mengembalikan exit nonzero saat assertion gagal, dan membersihkan cluster uji saat selesai. Observasi SEC-01/SEC-10 dan hostname/action Turnstile dicatat sebagai tindak lanjut, bukan dinyatakan tertutup.

Untuk MySQL, gunakan executable MySQL 8+ yang sudah tersedia (bukan datadir existing):

```powershell
$env:SECURITY_REVIEW_MYSQLD = 'C:\laragon\bin\mysql\mysql-8.0.44-winx64\bin\mysqld.exe'
node scripts/check-mysql.cjs --self-test
node scripts/security-review.cjs --mysql --database-only
node scripts/security-review.cjs --mysql --cpanel
```

Binary MariaDB portable Windows juga dapat digunakan pada `SECURITY_REVIEW_MYSQLD`;
initializer `mariadb-install-db.exe` / `mysql_install_db.exe` harus tersedia di folder
yang sama. Runner tidak memakai `--service` atau membuat service Windows.

`scripts/review-mysql.cjs` menjalankan server dengan `--no-defaults` dan datadir baru di folder
review, bind loopback, user/password sintetis, dan shutdown server setelah tes.
Path executable perlu disesuaikan instalasi mesin pengembang. Database/rootpassword
Laragon existing tidak digunakan. Assertion HTTP yang sama menguji adapter native
`src/lib/dbMysql.ts`; hanya query inspeksi/fixture runner yang dinormalisasi antar
dialect. Diagnostic koneksi hosting sendiri tetap read-only dan tidak menguji
kapasitas, SMTP, atau hak tulis aplikasi.

Mode `--mysql --database-only` juga menguji deadline dengan proxy TCP loopback
yang menahan COM_STMT_PREPARE, COM_STMT_EXECUTE, serta COMMIT. Penundaan Prepare
7 detik diikuti Execute macet tetap memakai satu deadline command 15 detik.
Tes menguji pembuangan koneksi, rollback insert saat COMMIT belum dikirim,
pemulihan pada koneksi baru, pengembalian lease pool yang datang terlambat,
dan diagnostic read-only yang berhenti setelah timeout. Tidak ada write retry
otomatis; COMMIT yang sudah diterima server tetapi balasannya hilang harus
diperiksa hasilnya, bukan diasumsikan pasti rollback.
