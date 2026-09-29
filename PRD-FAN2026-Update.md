# PRD — Fasilkom Awarding Night 2026: Registration Update

**Versi:** 1.0
**Tanggal:** 28 September 2026
**Status:** Disetujui untuk implementasi
**Produk:** Web Registrasi Fasilkom Awarding Night 2026 (Next.js)

---

## 1. Latar Belakang & Tujuan

Web registrasi FAN 2026 saat ini menerima pendaftaran civitas Fasilkom dan menerbitkan tiket digital berisi QR Code kehadiran. Tiga masalah yang perlu diselesaikan:

1. **Pendaftaran ganda.** Satu orang berisiko terdaftar beberapa kali di kategori berbeda, sehingga rekap kehadiran dan distribusi konsumsi tidak akurat.
2. **Data kategori tidak terstruktur.** Panitia butuh tahu peserta "datang sebagai apa" (BPM/BEM/HIMASIF/HIMATIF, angkatan 2023–2026, Mahasiswa Fasilkom). Kolom yang ada hanya `role` (Mahasiswa/Dosen/Tenaga Pendidik/Tamu) dan `prodi`, tidak cukup untuk rekap per organisasi/angkatan.
3. **Distribusi tiket manual.** Peserta harus menyimpan/mengunduh sendiri tiket dari halaman. Panitia ingin mengirim QR undangan langsung ke email yang didaftarkan.

**Tujuan:** mencegah duplikasi NIM, menambah dimensi kategori civitas untuk rekap panitia, dan mengirim QR undangan otomatis via email.

**Non-tujuan:** perubahan autentikasi admin, sistem pembayaran, redesign visual halaman.

---

## 2. Scope

### In-scope
- Validasi "satu NIM = satu registrasi" di sisi DB (sudah ada) + UX (endpoint cek real-time + inline error + tombol disable).
- Dua dropdown baru: **Kategori Civitas** dan **Angkatan**.
- Pengiriman email berisi QR inline + link tiket setelah registrasi sukses.
- Penyesuaian rekap CSV admin (kolom baru).

### Out-of-scope
- Queue/worker email, retry otomatis.
- Perubahan skema auth (`src/lib/auth.ts`) dan alur check-in.
- Migrasi data historis.

---

## 3. Requirement 1 — Satu NIM, Satu Registrasi

### 3.1 Kondisi saat ini
- DB PostgreSQL sudah punya constraint `nim_nip VARCHAR(50) UNIQUE NOT NULL` (`src/lib/db.ts:82`, indeks `idx_nim_nip` di `:94`).
- `createParticipant` sudah mengecek duplikat sebelum insert (`src/lib/db.ts:115-118` untuk PG, `:139-141` untuk fallback JSON).
- Route `POST /api/register` mengembalikan `409` dengan pesan "NIM / NIP ini sudah terdaftar sebelumnya!" (`src/app/api/register/route.ts:32-34`).

**Kesimpulan:** enforcement inti sudah benar. Perbaikan berfokus pada konsistensi normalisasi dan UX pencegahan dini.

### 3.2 Perubahan
1. **Normalisasi konsisten.** Nilai `nimNip` disimpan ternormalisasi (`trim()` + lowercase) pada PG dan fallback JSON agar pengecekan duplikat tidak case-sensitive.
2. **Endpoint cek real-time.** Tambah `GET /api/register/check?nim=<nilai>`.
   - Return `{ available: boolean }`.
   - `200` jika tersedia, `200` dengan `available: false` jika sudah terdaftar (bukan error HTTP — agar mudah dikonsumsi UI).
   - Validasi `nim` kosong → `400`.
3. **UX form.** Pada `blur`/`onChange` (debounced) field NIM, panggil endpoint cek:
   - Jika sudah terdaftar → tampilkan inline error "NIM ini sudah terdaftar. Satu NIM hanya untuk satu registrasi." dan **disable tombol submit**.
   - Jika tersedia → bersihkan inline error.
4. **Pesan 409** dari submit tetap ditampilkan sebagai fallback (mis. race condition).

### 3.3 Acceptance Criteria
- Input NIM yang sudah ada di DB → setelah field ditinggalkan, muncul inline error dan tombol submit disabled.
- Submit dengan NIM duplikat (bypass UI) tetap ditolak `409` dengan pesan jelas.
- Pengecekan tidak case-sensitive ("23241..." vs " 23241..." dianggap sama).

### 3.4 Catatan implementasi
- `ponytail:` endpoint pengecekan to the point tanpa rate-limit. Upgrade path: tambah debounce lebih agresif / rate-limit bila traffic tinggi.

---

## 4. Requirement 2 — Dropdown Kategori Civitas & Angkatan

### 4.1 Model data
Tipe baru di `src/lib/types.ts`:

```ts
export type CategoryType =
  | 'BPM'
  | 'BEM'
  | 'HIMASIF'
  | 'HIMATIF'
  | 'Mahasiswa Fasilkom'
  | 'Lainnya';

export type BatchType = '2023' | '2024' | '2025' | '2026' | '-';
```

Field baru pada `Participant` dan `RegistrationInput`:
- `category: CategoryType`
- `batch: BatchType`

`role` dan `prodi` **tetap dipertahankan** (tidak digantikan).

### 4.2 Migrasi DB
Kolom baru bersifat nullable dengan default non-breaking:

```sql
ALTER TABLE participants ADD COLUMN IF NOT EXISTS category VARCHAR(40);
ALTER TABLE participants ADD COLUMN IF NOT EXISTS batch VARCHAR(4) DEFAULT '-';
```

Query `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` dijalankan di dalam `initPostgresTable` agar idempoten terhadap data lama (baris existing akan berisi `NULL`/`'-'`).

### 4.3 UI Form
Dua dropdown baru di `RegistrationForm` mengikuti pola komponen dropdown `prodi` yang sudah ada (`src/components/RegistrationForm.tsx:172-220`), termasuk ikon, state `open/close`, dan klik-luar.

- **Kategori Civitas (wajib):** opsi = nilai `CategoryType`.
- **Angkatan (kondisional):** opsi = nilai `BatchType` (tanpa `'-'`).
  - Ditampilkan aktif saat `category === 'Mahasiswa Fasilkom'`.
  - Untuk kategori lain, field di-disable atau disembunyikan dan nilai diset `'-'`.

### 4.4 Perubahan turunan
- `RegistrationInput` dan insert `createParticipant` menambah `category`, `batch`.
- `getAllParticipants` (dan semua `SELECT ... RETURNING`) mengembalikan kolom `category`, `batch`.
- CSV admin (`src/app/api/admin/participants/route.ts`) menambah kolom **Kategori** dan **Angkatan**.
- `TicketCard.tsx` mengganti label hardcoded "Mahasiswa S1" (`:163` dan `:353`) dengan nilai `category` (fallback `role` jika kosong).

### 4.5 Acceptance Criteria
- Form menampilkan 2 dropdown; kategori wajib, angkatan kondisional.
- Nilai `category`/`batch` tersimpan benar di DB/fallback JSON.
- Rekap CSV memuat kolom Kategori + Angkatan berisi nilai yang benar.
- Tiket menampilkan kategori peserta, bukan label hardcoded.

---

## 5. Requirement 3 — Kirim QR Undangan ke Email

### 5.1 Dependensi & Konfigurasi
- Dependensi baru: `nodemailer`, `@types/nodemailer`, `qrcode`, `@types/qrcode`.
- Env baru (`.env.example` & `.env.local`):
  - `GMAIL_USER` — alamat Gmail pengirim panitia.
  - `GMAIL_APP_PASSWORD` — App Password Gmail (bukan password akun).
  - `NEXT_PUBLIC_APP_URL` — base URL publik, untuk membentuk link `/ticket/[token]`.

### 5.2 Modul `src/lib/mailer.ts`
- Membuat QR Code server-side dari `qrToken` (lib `qrcode`, output PNG data-URL).
- Menyusun HTML email: sapaan, nama peserta, QR inline, tombol link tiket (`${NEXT_PUBLIC_APP_URL}/ticket/${qrToken}`), detail event.
- Transport: `nodemailer.createTransport` dengan Gmail SMTP (`service: 'gmail'`, auth user + app password).
- Ekspor fungsi `sendInvitationEmail({ to, name, qrToken, category })`.

### 5.3 Trigger
- Dipanggil dari `POST /api/register` **setelah** `createParticipant` sukses (`src/app/api/register/route.ts:36-40`).
- **Non-blocking:** pembungkus `try/catch`; kegagalan kirim email **tidak** menggagalkan registrasi. Tiket tetap terbit, error di-`console.error` dan (opsional) dikembalikan sebagai flag `emailSent: false` pada respons.
- Jika env Gmail tidak diset, kirim di-skip dengan log peringatan (agar dev tanpa kredensial tetap bisa jalan).

### 5.4 Isi Email
- Subjek: "Tiket Undangan — Fasilkom Awarding Night 2026".
- Body HTML: QR inline (data-URL) + teks token + tombol menuju halaman tiket + detail waktu/tempat.

### 5.5 Acceptance Criteria
- Registrasi sukses → email terkirim ke alamat terdaftar dalam <30 detik (SMTP normal).
- Email berisi QR yang valid (dapat di-scan) dan link tiket yang membuka halaman benar.
- Kegagalan SMTP tidak menyebabkan registrasi gagal atau error 500 ke user.
- Tanpa kredensial Gmail (dev), registrasi tetap sukses.

### 5.6 Catatan implementasi
- `ponytail:` SMTP langsung (synchronous di request handler). Upgrade path: pindah ke queue/background job atau layanan (Resend) bila volume naik atau Gmail rate-limit (batas Gmail ~500 email/hari).

---

## 6. Perubahan File

```
NEW  PRD-FAN2026-Update.md
NEW  src/lib/mailer.ts
NEW  src/app/api/register/check/route.ts
EDIT src/lib/types.ts
EDIT src/lib/db.ts
EDIT src/app/api/register/route.ts
EDIT src/components/RegistrationForm.tsx
EDIT src/components/TicketCard.tsx
EDIT src/app/api/admin/participants/route.ts
EDIT .env.example
EDIT package.json
```

---

## 7. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|--------|--------|----------|
| Gmail SMTP rate-limit (~500/hari) | Email tidak terkirim saat puncak | Non-blocking + log; upgrade ke queue/Resend bila perlu |
| App Password bocor | Penyalahgunaan akun | Simpan hanya di env, jangan commit `.env.local` |
| QR server-side butuh lib baru | Bundle/dep tambahan | Pakai `qrcode` ringan, hanya di server |
| Data lama tanpa kategori | Rekap kosong untuk baris lama | Kolom nullable + default `'-'` |
| Race condition cek NIM | Dua request lolos cek bersamaan | Constraint `UNIQUE` DB tetap penjaga terakhir |

---

## 8. Rencana Fase

- **Fase 1 (Req 1 + Req 2):** mandiri, tanpa kredensial eksternal. Bisa di-ship lebih dulu.
- **Fase 2 (Req 3):** butuh App Password Gmail panitia + base URL publik.

### Verifikasi
- `npm run lint` hijau.
- `npm run build` hijau.
- Uji manual: NIM duplikat diblokir di UI; kategori+angkatan tersimpan & tampil di CSV; email terkirim berisi QR + link tiket valid.
