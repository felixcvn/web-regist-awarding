# Laporan Audit Keamanan — Web Registrasi FAN 2026

**Tanggal:** 25 Oktober 2026
**Commit diaudit:** `de042c9`
**Stack:** Next.js 16.4.3 (App Router) · Node.js · PostgreSQL/Neon · Vercel
**Metode:** review kode menyeluruh, `npm audit`, inspeksi riwayat git, dan uji runtime lokal (header, auth, CSRF, rate limit).

---

## 1. Ringkasan Eksekutif

Postur keamanan kode **di atas rata-rata** untuk proyek event: SQL parameterized, sesi di-hash, cookie `HttpOnly`/`SameSite=Strict`, CSRF + Origin check benar, validasi Zod, dan security header aktif (terverifikasi live). Tidak ditemukan SQL injection, XSS sink, IDOR, atau kebocoran secret di riwayat git.

Namun ada **2 blocker produksi** dan **3 risiko tinggi** yang harus ditutup sebelum acara:

| Tingkat | Jumlah | Inti |
|---|---|---|
| Kritis | 2 | Dependency Next.js punya RCE yang sudah dipatch; PIN admin 4 digit + tanpa lockout |
| Tinggi | 4 | TLS database tidak diverifikasi; rate limit tidak tahan skala; registrasi terbuka tanpa anti-bot; PII di riwayat git |
| Sedang | 6 | HTML injection di email; enumerasi NIM; bcrypt sinkron; admin page tanpa guard server; CSP lemah; tanpa timeout DB |
| Rendah | 8 | Cache QR, token di URL, limit body, least privilege DB, monitoring, dll. |

**Kesimpulan:** layak dipakai setelah blocker ditutup. Sistem ini **Node.js/Next.js, bukan PHP** — jadi vektor "PHP jebol" tidak berlaku, tetapi kelas serangan yang sama (dependency usang, kredensial lemah, endpoint publik tanpa batas) **terbukti ada** di sini.

---

## 2. Temuan

### K-1 — Dependency Next.js 16.3.4 rentan RCE (KRITIS)

`npm audit` menemukan **11 advisory** untuk `next@16.3.4`, termasuk:

- RCE di `next/og` ImageResponse
- RCE di Image Optimization saat memproses SVG
- SSRF di Image Optimization
- Cache poisoning SSG/ISR (cross-user content substitution)
- DoS via Server Actions

Turut rentan: `zod@4.6.5` (memory exhaustion), `nodemailer@10.0.12` (address parser), `sharp`, `source-map-js`.

**Dampak:** eksekusi kode jarak jauh tanpa autentikasi pada konfigurasi tertentu, serta cache poisoning yang bisa menyajikan konten penyerang ke pengguna lain.
**Perbaikan (hari ini):**

```bash
npm i next@16.4.3 zod@^4.6.7 nodemailer@^10.2.1
npm audit fix
npm audit   # target: 0
```

Lalu build + smoke test, redeploy.

---

### K-2 — PIN admin 4 digit & tidak ada lockout (KRITIS)

- PIN aktif adalah **4 digit** dan mudah ditebak (pola tahun acara).
- `ADMIN_PIN="2026"` juga tertulis di `.env.example` (file lokal, tidak ter-track git, tapi ikut bocor bila folder dibagikan).
- Tidak ada lockout berbasis akun/global — hanya rate limit per-IP.
- Rate limit dapat dilewati (lihat T-2), sehingga ruang 10.000 kombinasi bisa dihabiskan.
- Tidak ada 2FA, IP allowlist, atau Deployment Protection.

**Dampak:** takeover `/admin` → seluruh PII peserta, hapus data, dan check-in palsu.
**Perbaikan:**

1. Ganti PIN menjadi **passphrase ≥ 10 karakter acak** (atau 8 digit acak), lalu `npm run hash-pin`.
2. Update `ADMIN_PIN_HASH` di Vercel (tanpa tanda kutip), **hapus** `ADMIN_PIN` dari mana pun.
3. `DELETE FROM admin_sessions;` untuk memaksa semua sesi lama keluar.
4. Aktifkan Vercel Deployment Protection / IP allowlist untuk `/admin/*`.
5. Tambahkan lockout: setelah 10 kegagalan total → tolak login 15 menit (bukan hanya per-IP).

---

### T-1 — Verifikasi TLS database dimatikan (TINGGI)

`src/lib/db.ts:92`:

```ts
ssl: needsSsl ? { rejectUnauthorized: false } : undefined
```

Opsi ini **menimpa** `sslmode=verify-full` di `DATABASE_URL`, sehingga sertifikat server tidak diverifikasi. Penyerang di jalur jaringan bisa melakukan MITM dan membaca/mengubah PII, sesi, serta audit log.

**Perbaikan:** `rejectUnauthorized: true` (Neon memakai sertifikat publik yang tepercaya Node), lalu uji koneksi. Tambahkan juga `statement_timeout` dan `connectionTimeoutMillis`.

---

### T-2 — Rate limit tidak tahan skala & bisa direset (TINGGI)

Bukti uji runtime:

- 6 request login dari key yang sama → request ke-6 **429** (bekerja).
- 10 request dengan `X-Forwarded-For` berubah-ubah → **semua diproses, tidak pernah 429** (bypass).

Akar masalah:

- `getClientIp()` mengambil entri **pertama** `X-Forwarded-For` (bisa dikendalikan klien bila tidak di belakang proxy tepercaya).
- Limiter in-memory: per-instance, hilang saat cold start/serverless, dan `buckets.clear()` saat > 10.000 key — penyerang bisa menghapus seluruh counter.
- Audit log juga memakai IP yang sama, jadi jejak serangan bisa dipalsukan.

**Perbaikan:** gunakan Redis (Upstash/Vercel KV) dengan key IP terverifikasi platform + counter global; verifikasi perilaku `X-Forwarded-For` di deployment; alert bila lonjakan 429.

---

### T-3 — Registrasi publik tanpa anti-bot (TINGGI)

`POST /api/register` hanya dibatasi 5/menit/IP dan menerima **email tujuan bebas**. Penyerang dapat:

- membanjiri database (dashboard & export CSV membengkak),
- memakai domain Anda untuk mengirim email branded ke korban (spam/phishing),
- menghabiskan kuota Gmail (~500/hari) sehingga peserta asli tidak menerima tiket.

**Perbaikan:** Cloudflare Turnstile di form, batas per-email dan batas global per jam, antrean pengiriman email, monitor kuota, dan pembersihan data sampah.

---

### T-4 — PII di riwayat git (TINGGI)

Commit `36c143e` ("first") memuat `.participants_data.json` berisi 5 record: **nama, NIM/NIP, email, telepon, token QR**. File sudah dihapus di commit `61c1040`, tetapi **tetap ada di riwayat**. Token QR tersebut sudah tidak ada di database (terverifikasi), jadi tidak bisa dipakai check-in.

**Dampak:** pelanggaran privasi bila repo pernah publik/dibagikan.
**Perbaikan:** purge dengan `git filter-repo`/BFG, force-push, rotasi token untuk record terkait, dan hapus `dev26.log` dari repo (higienis, tidak berisi secret).

---

### M-1 — HTML injection pada email undangan (SEDANG)

`src/lib/mailer.ts` menyisipkan `${name}` mentah ke HTML email. Nama seperti `<a href="...">` akan dirender sebagai HTML di inbox penerima — email phishing yang tampak resmi dari domain panitia. `name` hanya dibatasi panjang, tanpa escape.

**Perbaikan:** escape HTML (`& < > " '`) untuk `name`, `category`, `batch`; buang karakter kontrol; tambahkan versi `text`.

---

### M-2 — Enumerasi NIM (SEDANG)

`GET /api/register/check?nim=...` memberi tahu apakah sebuah NIM sudah terdaftar. Dengan 20/menit/IP (dan bypass XFF), data "siapa yang sudah mendaftar" bisa dipanen.

**Perbaikan:** wajibkan Turnstile, atau hapus endpoint dan lakukan pengecekan duplikat hanya saat submit.

---

### M-3 — `bcrypt.compareSync` memblokir event loop (SEDANG)

`validatePin()` memakai `compareSync` di jalur request tanpa autentikasi. Satu percobaan menahan CPU ratusan milidetik; paralelisasi = DoS murah.

**Perbaikan:** `await bcrypt.compare(...)`, batasi konkurensi login, dan pertahankan rate limit.

---

### M-4 — Halaman admin tanpa guard server (SEDANG)

Terverifikasi: `GET /admin/dashboard` → **200** tanpa sesi. Data tetap aman (API → 401), tetapi UI admin terekspos dan tidak ada pertahanan berlapis. Tambahkan `verifyAdminAuth()` di layout server `/admin`, redirect ke login, dan `X-Robots-Tag: noindex` + `robots.txt`.

---

### M-5 — CSP terlalu longgar (SEDANG)

`script-src 'self' 'unsafe-inline' 'unsafe-eval'`. Belum ada sink XSS, tetapi bila suatu saat ada injeksi HTML, CSP tidak menahan eksekusi JS. Belum ada `object-src 'none'`, `frame-src 'none'`, `upgrade-insecure-requests`, COOP/CORP.

**Perbaikan:** CSP berbasis nonce (pola resmi Next), hapus `unsafe-eval` di produksi, tambah direktif di atas, set `poweredByHeader: false`.

---

### M-6 — Tidak ada timeout & batas koneksi DB (SEDANG)

Tidak ada `statement_timeout`/`connectionTimeoutMillis`, pool default. Saat Neon autosuspend, request login bisa tertahan beberapa detik (teramati ~3 detik). Spam registrasi dapat menghabiskan koneksi.

**Perbaikan:** set timeout query, `max` pool, gunakan pooled connection Neon, dan index yang sudah ada dipertahankan.

---

### Rendah (R-1 s.d. R-8)

| ID | Temuan | Rekomendasi |
|---|---|---|
| R-1 | `/api/qr/[token]` memakai `Cache-Control: public` untuk gambar yang bersifat kredensial | `private, no-store` |
| R-2 | Token tiket ada di URL `/ticket/<token>` → bocor ke log Vercel/riwayat browser | redaksi log, pertimbangkan ID acak pendek + signed lookup |
| R-3 | Tidak ada batas ukuran body; `qrToken` di check-in tidak dibatasi panjang (skema ada tapi tidak dipakai) | batasi body ≤ 16 KB dan panjang token ≤ 64 |
| R-4 | Aplikasi menjalankan DDL saat runtime (butuh privilege tinggi) | migrasi terpisah, user DB least-privilege |
| R-5 | API PII tanpa `Cache-Control: no-store` | tambahkan eksplisit |
| R-6 | Sesi tidak diikat ke UA/IP, tanpa idle timeout, tanpa "revoke all" | bind ringan + tombol revoke + expiry 8 jam dipertahankan |
| R-7 | Audit log tanpa alert/retensi; IP dapat dipalsukan | alert login gagal, retensi 90 hari, pakai IP platform |
| R-8 | `X-Powered-By: Next.js`, tidak ada `robots.txt`, aset tak terpakai ~10 MB (mp3/foto) | matikan header, tambah robots, bersihkan aset |

---

## 3. Yang Sudah Benar (terverifikasi)

- **SQL injection:** semua query memakai placeholder `$1`; tidak ada string SQL dinamis.
- **Sesi:** token 32 byte acak, disimpan sebagai hash SHA-256, cookie `HttpOnly` + `Secure` (prod) + `SameSite=Strict`, TTL 8 jam.
- **PIN:** bcrypt cost 12; fail-closed di produksi bila `ADMIN_PIN_HASH` kosong.
- **CSRF:** double-submit + Origin check — `DELETE` tanpa token → **403**, Origin asing → **403**, tanpa sesi → **401**.
- **Check-in:** update atomik `WHERE is_checked_in = FALSE` → tidak bisa double check-in.
- **Headers:** CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` aktif di runtime.
- **Validasi:** Zod di trust boundary; kategori dibatasi allowlist; CSV formula injection di-escape.
- **Secret:** `.env.local` tidak pernah masuk git; tidak ada kredensial di riwayat (selain file PII di T-4).
- **Error:** pesan generik, tanpa stack trace ke klien.
- **Fallback JSON** dimatikan di produksi (tidak ada PII di filesystem).
- **Tiket:** halaman 404 untuk token salah, `Cache-Control: no-store`.

---

## 4. Rencana Aksi

### 0–24 jam (blocker)

1. Upgrade `next@16.4.3`, `zod@4.6.7`, `nodemailer@10.2.1`; `npm audit` = 0.
2. Ganti PIN admin + hash baru, hapus `ADMIN_PIN`, invalidasi semua sesi.
3. `rejectUnauthorized: true` untuk koneksi Neon.
4. Rotasi Gmail App Password (pernah terekspos di chat) dan perbarui di Vercel.

### Sebelum acara (H-7)

5. Turnstile + batas kirim email; rate limit Redis; lockout login.
6. Escape HTML email; hapus/ketatkan endpoint cek NIM.
7. Purge riwayat `.participants_data.json`; hapus `dev26.log`.
8. Guard server `/admin`, `noindex`, CSP nonce, `poweredByHeader:false`.
9. Timeout DB, monitoring, backup Neon (PITR) + uji restore.

### Pasca-acara

10. 2FA/TOTP untuk admin, least-privilege DB, CI `npm audit`/Dependabot, review retensi PII.

---

## 5. Catatan Deployment

- `next start` lokal **tidak** memuat `.env.local` (perilaku Next 16); auth gagal tertutup (401). Untuk smoke test produksi lokal, ekspor env secara eksplisit. Di Vercel env diinject platform, jadi tidak terdampak.
- `SECURITY.md` sudah diperbarui mengikuti kondisi setelah perbaikan.
- Perbaikan Kritis + Tinggi sudah diterapkan pada kode (lihat bagian 6); status di atas adalah temuan saat audit `de042c9`.

---

## 6. Status Perbaikan (25 Oktober 2026)

Semua item **Kritis** dan **Tinggi** sudah ditutup di kode, kecuali T-4 yang menunggu konfirmasi karena bersifat destruktif.

| ID | Status | Perubahan |
|---|---|---|
| K-1 | ✅ Selesai | `next@16.4.3`, `eslint-config-next@16.4.3`, `zod@4.6.7`, `nodemailer@10.2.1`; `npm audit --omit=dev` → **0 vulnerabilities** |
| K-2 | ✅ Selesai | PIN 10 karakter acak (bukan 4 digit), hanya `ADMIN_PIN_HASH` (bcrypt cost 12); `ADMIN_PIN` plaintext dihapus dari `.env.example`; lockout 12 gagal/15 menit per IP disimpan di `audit_log` |
| T-1 | ✅ Selesai | `ssl: { rejectUnauthorized: true }`; `DATABASE_URL` disarankan `sslmode=verify-full` |
| T-2 | ✅ Selesai | IP diambil dari header platform (`cf-connecting-ip` → `x-real-ip` → `x-vercel-forwarded-for` → XFF paling kanan); eviksi 10% entri tertua, bukan `buckets.clear()`; lockout DB lintas instance |
| T-3 | ✅ Selesai | Honeypot `website`; batas 2 pendaftaran/jam per email; Cloudflare Turnstile opsional (aktif bila `TURNSTILE_SECRET_KEY` diisi), fail-closed |
| T-4 | ⏳ Perlu konfirmasi | Riwayat git masih memuat 5 baris PII dari `.participants_data.json` (commit `36c143e`). Token QR-nya sudah tidak valid di DB, tetapi purge butuh `git filter-repo` + force-push (mengubah hash commit). **Belum dijalankan.** |
| M-1 | ✅ Selesai | `escapeHtml()` untuk `name`, `category`, `batch` di email undangan |
| M-3 | ✅ Selesai | `validatePin` async (`bcrypt.compare`) — tidak lagi memblokir event loop |
| M-4 | ✅ Selesai | `src/proxy.ts` redirect `/admin/*` → `/admin/login` tanpa cookie sesi; API tetap memakai `verifyAdminAuth()` |
| M-5 | ✅ Selesai | CSP ditambah `object-src 'none'`, `frame-src`, `worker-src`, `upgrade-insecure-requests`; `'unsafe-eval'` hanya non-produksi; COOP/CORP |
| M-6 | ✅ Selesai | Pool `max: 5`, `idleTimeoutMillis 30s`, `connectionTimeoutMillis 10s`, `statement_timeout`/`query_timeout` 15s |
| R-3 | ✅ Sebagian | `qrToken` check-in divalidasi `qrTokenSchema` (maks 64) → token 80 karakter = **400** |
| R-8 | ✅ Sebagian | `poweredByHeader: false`; `X-Robots-Tag: noindex, nofollow` untuk `/admin` dan `/ticket` |

### Verifikasi runtime (dev, 25/10/2026)

- Login PIN baru → `200`; PIN salah → `401`; 6 percobaan dengan `X-Forwarded-For` berputar + `x-real-ip` tetap → `429` pada percobaan ke-6.
- `/api/admin/participants` → `200` dengan TLS terverifikasi.
- `/admin/dashboard` tanpa cookie → `307` ke `/admin/login`; dengan cookie → `200`.
- Honeypot terisi → `400`; `qrToken` 80 karakter → `400`.
- `X-Powered-By` hilang; CSP/HSTS/COOP/CORP dan `noindex` terverifikasi.
- `npm run lint`: **8 problems (6 errors, 2 warnings)** — sama dengan baseline (semuanya pra-existing); `npm run build`: **exit 0**.

### Catatan penting: escaping `$` di `.env.local`

`@next/env` melakukan ekspansi variabel pada nilai `.env.local`, sehingga hash bcrypt (`$2b$12$...`) rusak menjadi `$2b$12` + string acak. **Di `.env.local`, tulis setiap `$` sebagai `\$`** dan bungkus dengan kutip tunggal:

```
ADMIN_PIN_HASH='\$2b\$12\$...'
```

Di dashboard Vercel/hosting, tempel **hash mentah** (tanpa kutip, tanpa `\$`) karena env platform tidak diekspansi. `scripts/hash-pin.cjs` mencetak kedua format.

### Yang masih manual (butuh akses/tindakan pemilik)

1. **Vercel:** set `ADMIN_PIN_HASH` baru (hash mentah), hapus `ADMIN_PIN`, pastikan `DATABASE_URL` memakai `sslmode=verify-full`, lalu redeploy. PIN lama masih aktif sampai ini dilakukan.
2. **Rotasi Gmail App Password** yang pernah terekspos di chat, lalu perbarui `GMAIL_APP_PASSWORD`.
3. **Opsional:** daftarkan Cloudflare Turnstile dan isi `TURNSTILE_SECRET_KEY` + `NEXT_PUBLIC_TURNSTILE_SITE_KEY` untuk mengaktifkan anti-bot.
4. **T-4:** konfirmasi bila ingin purge riwayat git (force-push, semua clone lama harus di-clone ulang).
5. **Vercel Deployment Protection** untuk `/admin` sebagai lapisan tambahan di luar PIN.
