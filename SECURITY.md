# Keamanan — Web Registrasi FAN 2026

Dokumen ini merangkum **postur keamanan**, **teori** yang diterapkan, dan **implementasi** di kode.

## Ringkasan ancaman yang dimitigasi

| # | Ancaman | Teori | Implementasi |
|---|---|---|---|
| 1 | Pencurian/pemalsuan sesi admin | Session token server-side, bukan kredensial di cookie | `lib/auth.ts`, `lib/session` via tabel `admin_sessions`; cookie `fan26_session` httpOnly + `sameSite=strict` |
| 2 | Brute-force PIN | Rate-limit + lockout | `lib/ratelimit.ts` (5/menit/IP) + lockout 12 kegagalan/15 menit yang disimpan di `audit_log` (bertahan lintas instance) |
| 3 | PIN plaintext bocor | Password hashing | bcrypt (`ADMIN_PIN_HASH`, cost 12); hash di `.env.local` meng-escape `$` sebagai `\$` karena `@next/env` melakukan ekspansi variabel |
| 4 | Timing attack pada PIN | Constant-time compare | `crypto.timingSafeEqual` di `auth.ts` (fallback dev) |
| 5 | Spam registrasi / banjir email | Rate-limit + anti-bot | register 5/menit/IP, 2/jam per email, honeypot, dan Cloudflare Turnstile (aktif bila `TURNSTILE_SECRET_KEY` diisi) |
| 6 | Enumerasi NIM | Rate-limit endpoint cek | `register/check` 20/menit/IP |
| 7 | Abuse QR generator | Rate-limit + validasi token | `/api/qr/[token]` 30/menit/IP, token max 64 char |
| 8 | Input oversized / malformed (DoS) | Validasi skema di trust boundary | `lib/validation.ts` (Zod) di `register` |
| 9 | CSV formula injection | Sanitasi sel | `csvSafe()` — prefix `'` untuk nilai mulai `= + - @` |
| 10 | Clickjacking / MIME sniffing / XSS | Security headers + CSP | `src/proxy.ts` (CSP, COOP/CORP, HSTS, `noindex` untuk admin/tiket) |
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
ADMIN_PIN_HASH="<bcrypt hash>"   # WAJIB di produksi; escape "$" -> "\$" HANYA di .env.local
DATABASE_URL="postgres://...?...sslmode=verify-full"
GMAIL_USER / GMAIL_APP_PASSWORD
NEXT_PUBLIC_APP_URL="https://domain-anda"
TURNSTILE_SECRET_KEY / NEXT_PUBLIC_TURNSTILE_SITE_KEY   # opsional, anti-bot
```

Generate hash: `npm run hash-pin -- <pin-rahasia>`.

## Security headers (middleware)

`Content-Security-Policy` (default-src 'self'; frame-ancestors 'none'), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`, `Referrer-Policy`, `Permissions-Policy` (kamera hanya self).

## Rate limiting

In-memory sliding window (`lib/ratelimit.ts`) dengan prioritas IP dari header platform (`cf-connecting-ip` / `x-real-ip`), bukan `X-Forwarded-For` yang bisa dipalsukan klien. Login juga memiliki **lockout berbasis database** (12 kegagalan/15 menit per IP) yang tidak hilang saat cold start. Untuk trafik multi-region sangat tinggi, pindahkan limiter ke Redis/Upstash.

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
