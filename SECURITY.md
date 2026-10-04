# Keamanan — Web Registrasi FAN 2026

Dokumen ini merangkum **postur keamanan**, **teori** yang diterapkan, dan **implementasi** di kode.

## Ringkasan ancaman yang dimitigasi

| # | Ancaman | Teori | Implementasi |
|---|---|---|---|
| 1 | Pencurian/pemalsuan sesi admin | Session token server-side, bukan kredensial di cookie | `lib/auth.ts`, `lib/session` via tabel `admin_sessions`; cookie `fan26_session` httpOnly + `sameSite=strict` |
| 2 | Brute-force PIN | Rate-limit + lockout | `lib/ratelimit.ts`; login 5/menit/IP; audit `login_failed` |
| 3 | PIN plaintext bocor | Password hashing | bcrypt (`ADMIN_PIN_HASH`); hash dihasilkan `npm run hash-pin -- <pin>` |
| 4 | Timing attack pada PIN | Constant-time compare | `crypto.timingSafeEqual` di `auth.ts` |
| 5 | Spam registrasi / banjir email | Rate-limit | register 5/menit/IP |
| 6 | Enumerasi NIM | Rate-limit endpoint cek | `register/check` 20/menit/IP |
| 7 | Abuse QR generator | Rate-limit + validasi token | `/api/qr/[token]` 30/menit/IP, token max 64 char |
| 8 | Input oversized / malformed (DoS) | Validasi skema di trust boundary | `lib/validation.ts` (Zod) di `register` |
| 9 | CSV formula injection | Sanitasi sel | `csvSafe()` — prefix `'` untuk nilai mulai `= + - @` |
| 10 | Clickjacking / MIME sniffing / XSS | Security headers + CSP | `src/middleware.ts` |
| 11 | CSRF pada aksi admin | Double-submit token + Origin check | `lib/csrf.ts` + `lib/csrfClient.ts`; terapkan di delete & checkin |
| 12 | PII di filesystem/git | Jangan persist PII di FS | fallback JSON dimatikan di prod; `.participants_data.json` di `.gitignore`; seed dev memakai data palsu |
| 13 | Info leak via error | Pesan generik ke klien | route memakai pesan umum; detail hanya `console.error` |
| 14 | Kehilangan jejak insiden | Audit log | tabel `audit_log` (login, logout, checkin, delete, export CSV) |

## Autentikasi admin (alur)

1. POST `/api/admin/login` (rate-limited) → validasi PIN terhadap `ADMIN_PIN_HASH` (bcrypt).
2. Sukses → `createSession()`: token acak 32 byte, **disimpan sebagai hash SHA-256** di tabel `admin_sessions`, cookie httpOnly berisi token mentah (bukan PIN).
3. Setiap request admin → `verifyAdminAuth()` hash token → lookup DB → cek expiry (8 jam).
4. Logout → hapus row sesi + clear cookie.

Ganti dipakai di semua endpoint admin: `checkin`, `participants`, `participants/[id]`, `logout`.

## Environment (produksi)

```
ADMIN_PIN_HASH="<bcrypt hash>"   # WAJIB di produksi
DATABASE_URL="postgres://...?...sslmode=require"
GMAIL_USER / GMAIL_APP_PASSWORD
NEXT_PUBLIC_APP_URL="https://domain-anda"
```

Generate hash: `npm run hash-pin -- <pin-rahasia>`.

## Security headers (middleware)

`Content-Security-Policy` (default-src 'self'; frame-ancestors 'none'), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`, `Referrer-Policy`, `Permissions-Policy` (kamera hanya self).

## Rate limiting

In-memory sliding window (`lib/ratelimit.ts`). Cukup untuk 1 instance (skala ~700 peserta). **Jika multi-instance**, ganti `buckets` dengan Redis.

## Audit log

Tabel `audit_log(action, actor_ip, target_id, detail, created_at)`. Aksi tercatat: `login_success`, `login_failed`, `login_rate_limited`, `logout`, `checkin`, `delete_participant`, `export_csv`. Gagal menulis audit tidak pernah menggagalkan request.

## Yang sudah baik sebelumnya
- Semua query SQL **parameterized** (`$1`) → aman dari SQL injection.
- Token QR = UUID v4 (tak tertebak).
- Cookie admin httpOnly + secure (prod).

## Rekomendasi lanjutan (opsional)
- Rotasi `ADMIN_PIN_HASH` berkala & sebelum acara.
- Pindahkan session/rate-limit ke Redis bila scale-out.
- Tambah paginasi pada endpoint `participants` bila data besar.
- Monitoring & alert untuk `login_failed` / rate-limit spike.
- Backup database sebelum hari-H.
