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

### 6.1 Perubahan File (Pembaruan Palette — Seksi 9)

```
EDIT src/app/globals.css        token warna baru + .bg-vignette/.glow/print
EDIT src/app/layout.tsx         surface base
EDIT src/app/page.tsx           surface base
EDIT src/app/ticket/[id]/page.tsx  surface base
EDIT src/components/Navbar.tsx
EDIT src/components/Hero.tsx
EDIT src/components/EventDetails.tsx
EDIT src/components/PastInsights.tsx
EDIT src/components/Gallery.tsx
EDIT src/components/Footer.tsx
EDIT src/components/RegistrationForm.tsx
EDIT src/components/TicketCard.tsx   (JSX + canvas literals)
EDIT src/components/Countdown.tsx
EDIT src/components/FloatingRunes.tsx
EDIT src/components/BotanicalDecoration.tsx
EDIT src/components/AudioPlayer.tsx
EDIT src/components/Dialog.tsx
EDIT src/components/Enchanted3DCanvas.tsx
EDIT src/app/admin/dashboard/page.tsx
EDIT src/app/admin/scan/page.tsx
EDIT src/app/admin/login/page.tsx
EDIT src/lib/mailer.ts          warna email (inline, manual)
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

---

## 9. Pembaruan Palette Warna — "Emerald Base + Pink Gradient"

### 9.1 Latar Belakang
Tema awal (mint dominan, dark emerald) → percobaan pink dominan di atas base gelap → percobaan light theme penuh (pink pucat). Evaluasi akhir: light theme membuat pink terlalu mengambil alih dan menghilangkan identitas hijau emerald. Arah final: **kembali ke base emerald gelap sebagai warna dominan**, dengan **pink sebagai sekunder/aksen CTA**, dan **gradasi pink pada background seluruh halaman** agar terasa florid tanpa kehilangan emerald.

### 9.2 Prinsip Desain
- **Emerald gelap = dominan** (surface & latar).
- **Pink = sekunder** — warna CTA/highlight/border/glow.
- **Gradasi pink** di background global (radial + linear emerald→plum).
- **Mint, gold, lavender** = aksen.
- Teks terang (`ink`/`ivory`) di atas surface gelap.

### 9.3 Token Warna (`@theme` di `src/app/globals.css`)

```css
--color-bloom-pink:      #FFB5E8;  /* pink primer (CTA/highlight) */
--color-bloom-pink-deep: #F58AD4;  /* hover/active CTA */
--color-blush:           #FFD9F0;  /* pink lembut */
--color-petal:           #FFE8F6;
--color-mint:            #AFF8DB;  /* aksen sekunder */
--color-gold:            #FFF3B0;  /* aksen */
--color-lavender:        #E7C6FF;  /* aksen */
--color-ink:             #EDE8DF;  /* teks body (terang) */
--color-ivory:           #FAF7F0;  /* teks heading (terang) */
--color-surface-base:    #061510;  /* emerald gelap (latar) */
--color-surface-card:    #0F2D23;  /* permukaan kartu */
--color-surface-card-2:  #0A1F18;
--color-field:           #082017;  /* latar input */
--color-field-2:         #0E2A20;
--color-on-accent:       #061811;  /* teks di atas pink */
```

### 9.4 Gradasi Background Global (`.bg-garden`)
```css
.bg-garden {
  background-color: #061510;
  background-image:
    radial-gradient(circle at 78% 12%, rgba(245,138,212,0.28) 0%, transparent 42%),
    radial-gradient(circle at 12% 88%, rgba(255,181,232,0.18) 0%, transparent 45%),
    radial-gradient(circle at 50% 50%, rgba(175,248,219,0.06) 0%, transparent 60%),
    linear-gradient(160deg, #061510 0%, #0C2018 45%, #2A1424 100%);
}
```
Diterapkan di `<body>` (`layout.tsx`), `<main>` (`page.tsx`), dan halaman tiket. Section (EventDetails, Gallery, RegistrationForm) dibuat **transparan** agar gradasi mengalir menyatu di seluruh halaman.

### 9.5 Aturan Pemetaan
| Peran | Warna |
|---|---|
| Surface / latar | emerald gelap (`--color-surface-*`) |
| Gradasi latar | `.bg-garden` (emerald → plum/pink) |
| CTA / highlight / border fokus | `--color-bloom-pink` |
| Hover CTA | `--color-bloom-pink-deep` |
| Teks body / heading | `--color-ink` / `--color-ivory` (terang) |
| Latar input | `--color-field` / `--color-field-2` |
| Badge/pill | `bg-surface-card` |
| Aksen | gold, mint, lavender |

### 9.6 Kendala Teknis
- **Email HTML** (`mailer.ts`) & **canvas PNG tiket** (`TicketCard`) tak baca CSS var → hex disinkronkan manual (tema gelap + aksen pink).
- **`Enchanted3DCanvas`** pakai `mixBlendMode: 'screen'` (cocok latar gelap).
- **Gmail dark-mode** dapat meng-invert; uji render.
- **`AudioPlayer`** (vinyl) & **`BotanicalDecoration`** (dedaunan hijau) sengaja tetap gelap/hijau.

### 9.7 Acceptance Criteria
- Base halaman emerald gelap; gradasi pink terlihat di seluruh halaman.
- Pink jadi warna CTA/aksen, bukan mendominasi surface.
- Teks terang terbaca di atas latar gelap (kontras WCAG AA).
- Email & PNG tiket sinkron (gelap + aksen pink).
- `npm run lint` dan `npm run build` hijau.

### 9.8 Risiko & Mitigasi
| Risiko | Dampak | Mitigasi |
|---|---|---|
| Kontras pink di atas dark kurang | Teks sulit dibaca | Uji kontras; gunakan pink hanya untuk CTA di atas surface gelap, teks utama tetap ivory/ink |
| Gmail dark-mode invert | Email tampak berbeda | Uji render; pakai warna solid, hindari shadow |
| Diff besar (~22 file) | Risiko regresi visual | Kerjakan bertahap per fase, verifikasi build tiap fase |
| Mint tersisa tak sengaja | Palette tak konsisten | Grep `#AFF8DB` & `rgba(175,248,219` setelah migrasi, sisakan hanya yang disengaja |
