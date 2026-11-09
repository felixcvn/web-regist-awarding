# Deploy & Hosting — Fasilkom Awarding Night 2026

Panduan singkat agar sistem tetap berfungsi setelah di-hosting (bukan localhost).

Untuk **cPanel Rumahweb**, gunakan [CPANEL-DEPLOY.md](./CPANEL-DEPLOY.md): startup
`server.js`, paket runtime dari build Linux, dan database internal
[MySQL/MariaDB](./MYSQL-CPANEL.md) atau PostgreSQL yang dapat diakses hosting.

## 1. Environment Variables (WAJIB di hosting)

Set semua ini di dashboard hosting (Vercel → Project → Settings → Environment Variables):

| Variabel | Contoh | Catatan |
|---|---|---|
| `DATABASE_PROVIDER` | `postgres` atau `mysql` | Default `postgres`; `mysql` juga untuk MariaDB. |
| `DATABASE_URL` | `postgres://user:pass@host/db?sslmode=verify-full` | Wajib untuk PostgreSQL; kosong pada MySQL. TLS remote selalu diverifikasi. |
| `ADMIN_PIN_HASH` | `$2b$12$...` | **Wajib di produksi.** Generate: `npm run hash-pin -- "<pin-kuat>"`. Di `.env.local` escape `$` menjadi `\$`; di dashboard hosting tempel apa adanya. |
| `GMAIL_USER` | `panitia@gmail.com` | Akun pengirim email. |
| `GMAIL_APP_PASSWORD` | `xxxx xxxx xxxx xxxx` | App Password Gmail (bukan password akun). |
| `NEXT_PUBLIC_APP_URL` | `https://fan2026.domainkamu.com` | Tanpa trailing slash. Perbaiki link tiket di email. |
| `QR_EMAIL_MODE` | `cid` | `cid` = QR inline (aman di semua client). `url` perlu URL publik. |

> Kalau `NEXT_PUBLIC_APP_URL` kosong di Vercel, sistem otomatis pakai `VERCEL_URL`.
> Di luar Vercel tanpa variabel ini → link jatuh ke `localhost` (salah).

## 2. Database

- Gunakan **managed PostgreSQL** dengan TLS terverifikasi (`sslmode=verify-full`),
  atau MySQL/MariaDB internal dengan [environment khusus](./MYSQL-CPANEL.md).
- Tabel dan indeks dibuat otomatis saat request pertama yang membutuhkan database.
- **Fallback JSON nonaktif di production** — kalau DB tak terjangkau, registrasi
  mengembalikan pesan error (bukan diam-diam simpan ke file). Ini disengaja agar
  data tidak hilang di filesystem ephemeral serverless.

## 3. Email

- Gmail memiliki kuota pengiriman; jangan menganggap 600–700 undangan dapat dikirim
  dalam sehari tanpa memeriksa kuota akun. Pengiriman gagal tidak memiliki queue
  retry otomatis dan tetap perlu ditangani panitia.
- `QR_EMAIL_MODE=cid` direkomendasikan: QR ditempel inline, tidak butuh URL publik.
- Kalau ganti ke `url`, pastikan `NEXT_PUBLIC_APP_URL` benar-benar bisa diakses publik.

## 4. Build & Run

```bash
npm install
npm run build
npm run start
```

Hosting platform (Vercel/Netlify) menjalankan ini otomatis.

## 5. Checklist sebelum acara

- [ ] Provider/environment database sesuai dan koneksi sukses (uji daftar 1 peserta).
- [ ] `ADMIN_PIN_HASH` sudah digenerate (bukan PIN default).
- [ ] `GMAIL_USER` + `GMAIL_APP_PASSWORD` valid (uji kirim 1 email).
- [ ] `NEXT_PUBLIC_APP_URL` = domain produksi.
- [ ] Login admin + buka scanner bekerja.
- [ ] Unduh tiket (PNG) & scan QR dari email berhasil.
- [ ] Security headers aktif (cek `curl -I`).
- [ ] Backup database sebelum hari-H.

## 6. Keamanan

Lihat [`SECURITY.md`](./SECURITY.md) untuk detail ancaman, teori, dan implementasi.
