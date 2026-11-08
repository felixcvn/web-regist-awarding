# Laporan Review Keamanan — Registrasi FAN 2026

**Tanggal:** 7 November 2026

**Baseline Git:** `5ba1fcf349c23a582c911206a3b9de3577f77a82`

**Status:** audit baseline selesai; remediasi urgent dan hasil verifikasi diperbarui pada **Bagian 9 (8 November 2026)**. Bagian 1–8 mempertahankan temuan/bukti sebelum remediasi.

## 1. Ringkasan eksekutif

Risiko utama yang terbukti adalah **pendaftaran atas identitas mahasiswa lain**: mengetahui NIM dan nama yang cocok dengan master sudah cukup untuk memperoleh tiket menggunakan email pilihan pendaftar. Percobaan berikutnya oleh pemilik identitas ditolak sebagai duplikat. Validasi kecocokan data sudah ada, tetapi pembuktian kepemilikan identitas belum ada.

Prioritas berikutnya adalah dependency `xlsx@0.18.5` dengan dua advisory tingkat tinggi, data peserta/token dalam riwayat Git, kepercayaan terhadap header IP, serta integritas alur preview–commit impor. Ditemukan juga bug query status batch aktif yang menyembunyikan informasi untuk rollback di UI.

Kontrol penting yang berhasil diuji: autentikasi API admin, expiry dan pencabutan sesi, penolakan CSRF yang hilang/salah, keunikan registrasi, check-in atomik, pengambilan prodi/angkatan dari master, serta transaksi commit/rollback. Kegagalan yang sengaja dipicu **setelah penghapusan master lama** memulihkan data dan jumlah batch sebelumnya.

Pengujian mencakup **29 kelompok observasi pada helper/build/HTTP + 1 pengujian database terfokus**. Status sukses pada harness berarti pengamatan berhasil dilakukan; sebagian pengamatan justru mereproduksi kelemahan.

### Prioritas temuan

P1 = ditangani sebelum alur terkait dipakai operasional; P2 = perbaikan lanjutan terjadwal. Tingkat risiko memperhitungkan akses yang dibutuhkan dan dampak, bukan semata angka dari scanner.

| ID | Risiko | Prioritas | Temuan | Dasar bukti |
| --- | --- | --- | --- | --- |
| SEC-01 | Tinggi | P1 | NIM/nama dapat diklaim dengan email lain | HTTP + PostgreSQL |
| SEC-02 | Tinggi pada dependency | P1 | `xlsx` memiliki advisory prototype pollution dan ReDoS | Lockfile, npm audit, advisory |
| SEC-03 | Tinggi untuk kerahasiaan data | P1 | Identitas, kontak, dan token peserta masih dalam riwayat Git | Scan riwayat; cakupan akses repo belum diketahui |
| SEC-04 | Tinggi bersyarat | P1 | Header IP buatan melewati rate limit login | Terbukti lokal; sanitasi hosting perlu diverifikasi |
| SEC-05 | Sedang | P1 | Kuota email terhapus terlalu dini dan dapat dihabiskan dengan identitas invalid | Helper dengan jam virtual + HTTP |
| SEC-06 | Sedang | P1 | Commit tidak terikat pada preview yang disetujui | HTTP admin terautentikasi |
| SEC-07 | Sedang | P1 | Validasi impor belum menegakkan kontrak data | HTTP admin + constraint database |
| SEC-08 | Sedang, bergantung fallback yang tersedia | P1 | Pembacaan fallback masih aktif di produksi | HTTP dengan DB uji tidak tersedia |
| SEC-09 | Sedang | P1 | Email/telepon ikut terserialisasi pada halaman tiket bearer | Respons HTML/RSC |
| SEC-10 | Sedang | P2 | Endpoint publik mengungkap status registrasi dan kecocokan identitas | HTTP |
| SEC-11 | Rendah | P2 | Error internal bocor dan input malformed menjadi HTTP 500 | HTTP |
| SEC-12 | Rendah | P2 | Respons daftar peserta/CSV tanpa kebijakan cache eksplisit | Header HTTP produksi lokal |
| OPS-01 | Sedang, keandalan operasional | P1 | Query batch aktif gagal dan mengembalikan `null` | Helper asli + PostgreSQL nyata |

Tidak ada bukti pengambilalihan admin tanpa sesi sah dari pengujian ini. Bypass header IP bukan bukti keberhasilan menebak PIN. Risiko SEC-02 juga belum diuji dengan payload eksploit advisory.

## 2. Lingkup, baseline, dan metode

- Kode aplikasi yang diperiksa adalah working tree pada baseline di atas, termasuk perubahan pengguna yang sudah ada di `src/components/EventDetails.tsx` dan `src/lib/mailer.ts`.
- Alur: login/logout admin, sesi, CSRF/Origin, rate limit, registrasi, validasi mahasiswa aktif, impor tiga Excel, preview/commit/rollback, check-in, tiket/QR, ekspor CSV, email, dependency, Git history, dan konfigurasi.
- Runtime: Windows, Node.js `v22.15.0`, Next.js `16.4.3`, React/React DOM `19.2.8`, PostgreSQL `18.6` melalui tooling terpisah `embedded-postgres@18.6.0-beta.19`.
- Build produksi menggunakan `next build --webpack` pada salinan sementara. Source dan dependency proyek dipakai, tetapi `.env` dan participant store proyek tidak disalin. Kredensial/identitas uji dibuat sintetis; database hanya mendengarkan localhost.
- HTTP memakai `NODE_ENV=production`. Cookie sesi dan header CSRF dikirim eksplisit oleh klien uji, sehingga hasilnya tidak menyimulasikan seluruh aturan cookie/CORS browser.
- SMTP dinonaktifkan untuk pengujian HTTP. Pengujian template memakai transport penangkap; tidak ada email eksternal yang dikirim. Respons Cloudflare pada pengujian helper Turnstile dimock.
- Konfigurasi lokal diperiksa dalam bentuk boolean/parameter nonrahasia; pemeriksaan itu tidak menyambung ke database remote atau Gmail.
- `SECURITY-AUDIT-2026-10-25.md` diperlakukan sebagai catatan historis. Kesimpulan lama diverifikasi ulang, bukan dijadikan bukti keadaan sekarang.

### Kontrak impor yang menjadi acuan

| Ketentuan | Keadaan saat audit |
| --- | --- |
| Tiga field: `sistemInformasi`, `informatika`, `teknologiInformasi` | Kehadiran diperiksa; tipe runtime `File` belum diperiksa |
| Format `.xlsx`, maksimal 5 MB per file | Ekstensi dan batas `5 * 1024 * 1024` byte diperiksa; CSV yang diganti nama masih diterima |
| NIM tepat 12 digit | Parser menerima 10–20 digit |
| Digit 1–2 = tahun; 3–8 = penomoran fakultas; 9–10 = prodi; 11–12 = penomoran tambahan | Posisi prodi **sudah benar**, menggunakan `nim.slice(8, 10)` |
| Tahun `23`–`26` | Allowlist ada pada parser |
| SI `10`/`11`, TI `20`/`21`, Informatika `30`/`31` | Mapping ada; kode alternatif berhasil diuji |
| Preview sebelum commit | UI menyediakan preview; server belum mengikat commit ke hasil preview |
| Aktivasi transaksional dan rollback | Terbukti pada skenario normal, concurrency, dan kegagalan di tengah transaksi |
| Registrasi cocok dengan `student_master` aktif | Diperiksa pada server; nama resmi/prodi/angkatan digunakan dari master |

**Koreksi atas pembahasan sebelumnya:** tidak ada dasar untuk memindahkan pembacaan kode prodi ke digit 7–8. Kode saat ini juga mencari kolom berdasarkan header `NIM` dan `NAMA`/`NAMA LENGKAP`, bukan posisi kolom yang tetap (`src/lib/db.ts:707–751`).

## 3. Temuan terperinci

### SEC-01 — Kepemilikan identitas mahasiswa tidak diverifikasi

**Lokasi:** `src/lib/db.ts:239–275`; `src/app/api/register/route.ts:50–95`.

**Reproduksi (`REGISTER-02`):**

1. Masukkan identitas sintetis melalui impor valid.
2. Kirim registrasi dengan NIM/nama yang cocok, email `unrelated-recipient@example.test`, dan prodi/angkatan yang sengaja diubah.
3. Respons `200`, email pilihan tersimpan, dan URL/token tiket langsung dikembalikan. Prodi dan angkatan dikoreksi dari master, tetapi email tidak dibuktikan keterkaitannya dengan mahasiswa.
4. Ulangi identitas tersebut dengan email pemilik: respons `409`.

**Dampak:** orang yang mengetahui identitas dapat mengambil slot/tiket dan menghalangi pendaftaran pemiliknya. SMTP yang dinonaktifkan pada uji tidak menghalangi penerbitan tiket. Kategori `BEM` juga diterima sebagai pilihan pengguna; bila kategori memberi hak khusus, perlu sumber otoritatif tersendiri.

**Perbaikan:** ikat NIM ke identitas kampus yang sudah terautentikasi, atau challenge ke kontak resmi yang sebelumnya terasosiasi dengan NIM. OTP ke sembarang email yang baru diisi hanya membuktikan kepemilikan email tersebut. Tahan aktivasi registrasi dan penerbitan tiket sampai challenge selesai, dengan expiry dan jalur pemulihan untuk klaim yang salah.

**Verifikasi penutupan:** mengetahui NIM/nama saja tidak menghasilkan tiket atau reservasi permanen; pemilik dapat menyelesaikan registrasi setelah challenge; perubahan email tidak memindahkan kepemilikan tanpa verifikasi.

### SEC-02 — Dependency pembaca Excel memiliki advisory tingkat tinggi

**Lokasi:** `package.json:24`; `package-lock.json:7236`; `src/lib/db.ts:690–701`.

- Versi terpasang dan terkunci: `xlsx@0.18.5`.
- [GHSA-4r6h-8v6p-xvw6 / CVE-2023-30533](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6): prototype pollution, versi terdampak `<0.19.3`.
- [GHSA-5pgg-2g8v-p4x9 / CVE-2024-22363](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9): ReDoS, versi terdampak `<0.20.2`.
- `npm audit --omit=dev --json` melaporkan satu paket produksi terdampak, dengan dua advisory di atas. npm melaporkan `fixAvailable: false` untuk paket `xlsx` pada distribusi npm tersebut.

**Keterjangkauan:** parser membaca file yang diunggah admin setelah autentikasi dan CSRF. File berbahaya yang diteruskan kepada panitia tetap merupakan jalur input relevan. Audit ini membuktikan versi terdampak dan pemakaiannya, bukan keberhasilan prototype pollution, eksekusi kode, atau DoS di aplikasi ini.

**Perbaikan:** migrasikan ke distribusi SheetJS yang dipelihara sesuai panduan vendor/advisory, atau parser terpelihara yang memenuhi kebutuhan impor. Kunci versi/provenance, pertahankan validasi server, dan batasi resource parsing. Mengubah ekstensi atau mengandalkan batas file saja tidak memperbaiki dependency.

**Verifikasi penutupan:** versi/distribusi pengganti tidak terkena advisory terkait; tiga workbook representatif, pembacaan header/NIM, invalid rows, preview, commit, dan rollback tetap benar.

### SEC-03 — Data peserta dan token tetap dapat dibaca dari riwayat Git

**Bukti:** `scripts/security-history-scan.cjs`; snapshot `.participants_data.json` pada commit berikut:

| Commit | Jumlah record | Record dengan `qrToken` |
| --- | ---: | ---: |
| `36c143e` | 5 | 5 |
| `30ed81d` | 2 | 2 |
| `fec5198` | 3 | 3 |

Terdapat **7 NIM historis berbeda**. Field snapshot mencakup nama, NIM, email, telepon, ID tiket, token QR, dan status/waktu kehadiran. Angka 5/2/3 adalah ukuran snapshot, bukan 10 orang berbeda. `.gitignore:43–45` mencegah penambahan file tertentu berikutnya tetapi tidak membersihkan blob lama; `dev26.log` masih tracked.

**Dampak:** pihak yang memperoleh riwayat repository dapat membaca data historis. Token dapat menjadi akses tiket jika masih berlaku. Visibilitas repository, pihak yang pernah mengkloning, keaslian setiap record, dan validitas token pada deployment saat ini belum diverifikasi.

**Perbaikan:** inventarisasi akses repository dan token terdampak; cabut/ganti token yang masih berlaku. Bersihkan data dari history dengan koordinasi pemilik clone/remote, keluarkan log runtime dari tracking, dan gunakan fixture sintetis. Pembersihan history tidak menarik kembali salinan yang sudah diperoleh pihak lain.

**Verifikasi penutupan:** riwayat yang didistribusikan tidak lagi memuat snapshot sensitif, token lama yang relevan ditolak, dan log/data peserta tidak masuk commit baru.

Scan meliputi 15 commit dan 202 blob teks. Pattern kredensial yang cocok berasal dari dokumentasi PIN dalam laporan lama; itu **bukan temuan baru kredensial aktif**. Nilai identitas/kredensial historis sengaja tidak dicetak dalam laporan ini.

### SEC-04 — Kepercayaan terhadap header IP dapat melewati pembatas login

**Lokasi:** `src/lib/ratelimit.ts:53–70`; `src/app/api/admin/login/route.ts:10–22`; `src/lib/db.ts:591–603`.

**Bukti (`AUTH-03`):** pada server produksi lokal, tujuh PIN salah dengan IP tetap menghasilkan `[401, 401, 401, 401, 401, 429, 429]`. Mempertahankan `x-real-ip` yang sama sambil mengganti `cf-connecting-ip` menghasilkan tujuh `401`; database audit mencatat tujuh IP berbeda.

`getClientIp()` memilih `cf-connecting-ip` sebelum header lain tanpa memastikan request datang melalui Cloudflare. Sumber IP yang sama digunakan untuk limiter memori dan hitungan kegagalan login di database.

**Dampak bersyarat:** bila ingress meneruskan header ini dari pengguna, penyerang dapat memperbanyak percobaan PIN, menghindari kuota endpoint lain, dan memalsukan atribusi audit. Ini terkonfirmasi untuk akses langsung lokal; belum ada pengujian sanitasi header pada hosting produksi.

**Perbaikan:** pilih satu sumber IP berdasarkan topologi proxy yang benar-benar dipercaya, hapus/timpa header buatan pengguna pada ingress, dan batasi akses langsung ke origin. Gunakan store rate limit bersama untuk deployment multi-instance; pertahankan lockout persisten dengan identitas IP yang sudah benar. Perlindungan PIN juga perlu tahan terhadap sumber IP terdistribusi tanpa mengunci semua panitia secara global.

**Verifikasi penutupan:** melalui ingress deployment sebenarnya, mengganti header IP alternatif tidak mengubah identitas yang dihitung; pembatas tetap berlaku lintas worker/restart. Uji dengan header yang saling bertentangan dan akses origin yang relevan.

### SEC-05 — Kuota email 60 menit tidak bekerja sesuai kontrak

**Lokasi:** `src/lib/ratelimit.ts:6–18, 26–50`; `src/app/api/register/route.ts:50–70`.

**Dua perilaku berbeda terbukti:**

- `HELPER-01`: limit dua percobaan per 60 menit menolak percobaan ketiga, tetapi mengizinkan lagi setelah **11 menit waktu virtual**. `sweep()` membuang semua timestamp yang lebih tua dari 10 menit, tanpa mempertimbangkan window key.
- `REGISTER-04`: dua registrasi beridentitas invalid untuk email target menghasilkan `[403, 403]`; registrasi valid berikutnya dengan email itu mendapat `429`, sementara jumlah peserta dengan email tersebut masih nol. Kuota dikonsumsi sebelum pemeriksaan master/hasil registrasi.

**Dampak:** proteksi email dapat terbuka lebih cepat daripada yang dijanjikan, sementara pengguna sah bisa diblokir hanya dengan mengetahui alamat emailnya. Penyimpanan `Map` juga tidak berbagi kuota antar-instance dan reset saat proses berganti; aspek multi-instance ini ditelusuri dari kode, bukan diuji pada cluster hosting.

**Perbaikan:** simpan expiry/window per key atau gunakan TTL yang sesuai dalam store bersama. Pisahkan pembatas percobaan request dari kuota pengiriman email; jangan menghabiskan kuota penerima untuk identitas invalid. Penghitungan pengiriman perlu atomik, termasuk saat request paralel dan pengiriman gagal.

**Verifikasi penutupan:** batas 60 menit tetap berlaku pada menit ke-11 dan ke-59, pulih setelah expiry, berlaku lintas instance, dan identitas invalid tidak menghabiskan kuota pengiriman penerima lain.

### SEC-06 — Preview belum mengikat file atau otorisasi commit

**Lokasi:** `src/lib/db.ts:788–821, 825–851`; `src/app/api/admin/student-imports/commit/route.ts:23–48`.

**Bukti (`IMPORT-05`):**

- Preview file set A, kemudian commit file set B dengan ID preview A: `200`.
- Buat sendiri `STU-<UUID>` tanpa preview, lalu commit workbook valid: `200`.
- Kirim ulang ID batch yang telah dipakai: `500` dengan pesan duplicate key.

Preview hanya menghasilkan UUID dan statistik; tidak ada snapshot/digest preview tersimpan yang dibandingkan pada commit. Commit memvalidasi ulang workbook baru, sehingga input invalid tetap dapat ditolak, tetapi isi yang diaktifkan tidak harus sama dengan yang ditinjau.

**Dampak:** kesalahan pemilihan file, perubahan payload, atau klien admin lain dapat mengganti seluruh master tanpa preview yang sesuai. Sesi admin dan CSRF sah tetap dibutuhkan; ini bukan eskalasi akses pengguna publik.

**Perbaikan:** persistensikan preview sebagai snapshot tervalidasi dengan hash, pemilik sesi/admin, expiry, dan status sekali-pakai. Commit berdasarkan snapshot tersebut, atau cocokkan digest seluruh file terhadap preview sebelum transaksi aktivasi. Tangani replay sebagai hasil idempoten atau konflik `409` yang jelas.

**Verifikasi penutupan:** ID karangan, preview kedaluwarsa, file berubah, dan replay yang tidak sah ditolak tanpa mengganti master; preview sah hanya mengaktifkan data yang diperiksa.

### SEC-07 — Validasi impor tidak sepenuhnya sesuai kontrak

**Lokasi:** `src/app/api/admin/student-imports/preview/route.ts:23–45`; `src/app/api/admin/student-imports/commit/route.ts:23–42`; `src/lib/db.ts:34–55, 688–778`.

| Kasus | Hasil teramati |
| --- | --- |
| CSV yang diberi nama `.xlsx` | Tiga baris dianggap valid (`IMPORT-03`) |
| NIM 10 digit dan 20 digit di workbook tiga-prodi | Tetap dihitung valid (`IMPORT-03`) |
| Nama 121 karakter | Preview `200`/tiga valid; commit `500` akibat `VARCHAR(120)` (`IMPORT-06`) |
| Satu file hanya berisi header, dua prodi lain terisi | Dua baris valid, `errors: []` (`IMPORT-10`) |
| Multipart string sebagai pengganti file | `500` saat membaca `file.name` (`IMPORT-03`) |

**Dampak:** master dapat memuat NIM di luar format yang diminta; preview dapat menyatakan valid untuk data yang kemudian gagal disimpan. Berdasarkan syarat commit di kode, satu prodi kosong tidak ditolak selama keseluruhan masih mempunyai baris valid. Aktivasi file header-only tidak dieksekusi pada uji tersebut.

**Perbaikan:** periksa tipe runtime file dan tipe `batchId`; validasi struktur OOXML, bukan hanya ekstensi; gunakan pola NIM tepat 12 digit dengan mapping/tahun yang disepakati; batasi nama resmi dan hasil normalisasi sesuai schema. Terapkan ketentuan baris minimum per prodi, dengan kebijakan eksplisit bila pengosongan prodi memang diperlukan. Gunakan validator yang sama untuk preview dan commit.

**Verifikasi penutupan:** CSV tersamar, NIM 10/20 digit, nama terlalu panjang, field bertipe salah, dan prodi kosong yang tidak diizinkan menghasilkan error validasi yang spesifik sebelum perubahan data. NIM 12 digit dengan keenam kode prodi tetap diterima.

Kontrol yang bekerja: file di atas `5 * 1024 * 1024` byte ditolak `400`, prodi yang salah ditandai invalid, duplicate NIM terdeteksi, dan header yang tidak ditemukan menghasilkan error preview (`IMPORT-04`, `IMPORT-10`). Posisi pembacaan prodi tidak perlu diubah.

### SEC-08 — Fallback pembacaan data masih digunakan dalam produksi

**Lokasi:** `src/lib/db.ts:74–138, 324–343, 400–443, 446–463, 485–503`.

**Bukti (`FAILURE-01`):** dengan `NODE_ENV=production`, database lokal yang sengaja tidak tersedia, dan satu record sintetis yang ditanam pada `.participants_data.json` **di salinan uji**, halaman tiket record itu mengembalikan `200` dan menampilkan nama dari file. Validasi identitas dan registrasi mengembalikan `503`; login mengembalikan `500`.

`saveFallbackData()` melarang penulisan di produksi, tetapi `loadFallbackData()` tidak memiliki guard yang setara. `getParticipantByToken()` bahkan mencapai fallback bila query database berhasil tetapi tidak menemukan token; jalur tambahan ini ditelusuri dari kode. Helper daftar peserta, cek NIM, check-in, dan hapus juga mempunyai jalur fallback.

**Dampak:** hasil pembacaan bisa berasal dari data lama/file lokal atau seed demo, bukan database otoritatif. Untuk operasi admin, autentikasi tetap dapat menolak saat database mati; audit ini tidak membuktikan bypass autentikasi admin melalui fallback.

**Perbaikan:** batasi seluruh fallback pada mode development secara terpusat. Bedakan data tidak ditemukan (`404`/hasil kosong yang sah) dari layanan database gagal (`503`); jangan menyatakan check-in/hapus berhasil bila perubahan tidak dapat disimpan.

**Verifikasi penutupan:** pada mode produksi, DB gagal maupun lookup tidak ditemukan tidak pernah membaca file/seed lokal; tiket yang dicabut tidak muncul kembali dari fallback; kegagalan penyimpanan tidak menghasilkan sukses palsu.

### SEC-09 — Halaman tiket menyertakan data kontak yang tidak diperlukan

**Lokasi:** `src/app/ticket/[id]/page.tsx:15–40`; `src/components/TicketCard.tsx:10–14`; `src/lib/db.ts:330–333`.

**Bukti (`PRIVACY-01`):** HTML/RSC untuk tiket valid memuat email dan nomor telepon sintetis. Server meneruskan seluruh objek `Participant` ke client component. Tiket acak yang tidak valid mendapat `404`.

**Dampak:** setiap pemegang URL/token tiket mendapat data kontak tambahan, termasuk bila URL dibagikan atau tersimpan pada kanal lain. Token acak merupakan pembatas akses; tidak ditemukan bukti penebakan token atau pengambilan tiket hanya berdasarkan ID pendek.

**Perbaikan:** buat DTO tiket dengan allowlist field yang benar-benar diperlukan untuk tampilan/unduhan. Ambil data kontak hanya pada endpoint yang membutuhkannya dengan otorisasi sesuai. Perlakukan QR/URL sebagai bearer credential dan sediakan pencabutan jika perlu.

**Verifikasi penutupan:** HTML, payload RSC, dan client props tidak memuat email/telepon/field internal yang tidak dibutuhkan; tampilan dan unduhan tiket tetap berfungsi.

### SEC-10 — Endpoint publik menjadi oracle registrasi/identitas

**Lokasi:** `src/app/api/register/check/route.ts:10–19`; `src/app/api/register/validate-identity/route.ts:11–31`; `src/app/api/register/route.ts:69–70`.

**Bukti (`PRIVACY-01`):** NIM terdaftar menghasilkan `available: false`, NIM lain `available: true`, dan pasangan NIM/nama yang cocok menghasilkan `valid: true`. Endpoint identitas membutuhkan tebakan nama juga; ia tidak mengembalikan daftar seluruh nama.

**Dampak:** pihak luar dapat mengonfirmasi keikutsertaan serta memvalidasi pasangan identitas yang telah diketahui. Kelemahan rate limit pada SEC-04/05 meningkatkan peluang otomasi. Feedback ini juga membantu serangan klaim identitas SEC-01.

**Perbaikan:** pindahkan feedback rinci ke alur setelah challenge kepemilikan; gunakan respons publik yang tidak membedakan keberadaan identitas bila memungkinkan. Terapkan rate limit persisten dan pembatas abuse pada kedua endpoint bantu, bukan hanya endpoint submit.

**Verifikasi penutupan:** klien yang belum memenuhi challenge tidak dapat membedakan status mahasiswa/registrasi melalui endpoint alternatif, termasuk error submit. Feedback pemilik yang sah tetap cukup untuk menyelesaikan pendaftaran.

### SEC-11 — Error internal dikirim ke klien; input malformed menjadi 500

**Lokasi:** `src/app/api/admin/student-imports/preview/route.ts:54–58`; `src/app/api/admin/student-imports/commit/route.ts:51–55`; `src/app/api/admin/student-imports/rollback/route.ts:30–34`; `src/lib/csrf.ts:12–15`; `src/app/api/register/route.ts:96–100`.

**Bukti:**

- Replay commit membocorkan `duplicate key value violates unique constraint "student_import_batches_batch_id_key"` (`IMPORT-05`).
- Nama terlalu panjang membocorkan `value too long for type character varying(120)` (`IMPORT-06`).
- Multipart string membocorkan `Cannot read properties of undefined (reading 'toLocaleLowerCase')` (`IMPORT-03`).
- Cookie CSRF `fan26_csrf=%` memicu `500` karena decoding tanpa penanganan (`HEADERS-01`). JSON registrasi malformed juga mendapat `500` (`IMPORT-10`).

**Dampak:** detail schema/implementasi bocor kepada klien admin; input yang sebenarnya error pengguna menghasilkan false server-error dan menyulitkan observabilitas. Tidak terbukti eksekusi kode atau bypass sesi dari payload ini.

**Perbaikan:** petakan validation/conflict/unavailable ke `400`/`409`/`503`, tangkap decoding cookie, dan gunakan pesan generik dengan correlation ID untuk error internal. Simpan detail teknis pada log server dengan redaksi yang sesuai.

**Verifikasi penutupan:** payload malformed ditolak konsisten tanpa nama constraint, tipe internal, atau stack detail di respons; conflict/replay dapat ditangani UI secara benar.

### SEC-12 — Daftar peserta dan ekspor tidak memiliki Cache-Control eksplisit

**Lokasi:** `src/app/api/admin/participants/route.ts:42–51`.

**Bukti (`HEADERS-01`):** respons JSON peserta dan ekspor CSV tidak memiliki header `Cache-Control`. Sebagai pembanding, tiket memiliki `private, no-cache, no-store, max-age=0, must-revalidate`, dan endpoint QR `private, no-store`.

**Dampak:** kebijakan penyimpanan data sensitif bergantung pada perilaku browser/proxy. Tidak ada bukti CDN benar-benar membagikan respons admin kepada pihak lain dari pengujian ini.

**Perbaikan:** tetapkan `Cache-Control: private, no-store` pada respons admin sensitif dan respons penerbitan data/token; verifikasi kebijakan CDN deployment.

**Verifikasi penutupan:** respons sensitif sukses maupun error terkait tidak disimpan oleh browser/CDN; sesi lain dan sesi yang sudah logout tetap harus melewati otorisasi.

### OPS-01 — Query status batch aktif gagal pada PostgreSQL

**Lokasi:** `src/lib/db.ts:1014–1037`; `src/app/api/admin/student-imports/active/route.ts:17–25`; `src/app/admin/dashboard/page.tsx:73–86, 641–655`.

**Bukti (`IMPORT-11`, pengujian terfokus):** setelah dua impor valid melalui helper asli pada PostgreSQL nyata, ada satu batch aktif dan tiga baris master. `getActiveStudentImportBatch()` mengembalikan `null`. Query asli menghasilkan SQLSTATE `42803`:

```text
column "b.previous_batch_id" must appear in the GROUP BY clause or be used in an aggregate function
```

Query memilih `b.previous_batch_id`, tetapi hanya mengelompokkan `b.batch_id, b.created_at`. Primary key tabel adalah `id`; unique constraint pada `batch_id` tidak memenuhi ketergantungan fungsional yang dibutuhkan query tersebut. Error ditelan oleh `catch` dan diubah menjadi `null`.

**Dampak berdasarkan alur kode:** route memetakan `null` ke `active: false`, count nol, dan `canRollback: false`; UI menghilangkan informasi batch dan tombol pemulihan. Transaksi rollback lewat API sudah terbukti bekerja. Uji terfokus ini memverifikasi helper/database, bukan interaksi UI di browser.

**Perbaikan:** koreksi agregasi agar seluruh kolom yang dipilih sah, misalnya menambahkan `b.previous_batch_id` pada `GROUP BY` yang ada. Bedakan kegagalan query dari keadaan tidak ada batch; laporkan kegagalan sebagai error layanan.

**Verifikasi penutupan:** setelah dua impor, endpoint menampilkan ID batch aktif yang benar, jumlah mahasiswa benar, dan `canRollback: true`; UI menyediakan pemulihan; setelah rollback, metadata mengikuti batch yang dipulihkan.

## 4. Penguatan tambahan dan batas pembuktian

| Area | Bukti dan penilaian | Tindak lanjut |
| --- | --- | --- |
| Origin pada impor | Preview menerima Origin asing jika sesi dan pasangan cookie/header CSRF sah dikirim eksplisit (`IMPORT-02`); check-in menolak `403`. Import routes hanya memanggil `validateCsrf`. | Seragamkan validasi Origin pada preview/commit/rollback. Ini belum merupakan bukti CSRF browser karena penyerang tetap perlu kredensial/token dan cookie `SameSite=Strict`. |
| Logout | Request tanpa CSRF/ber-Origin asing yang diberi cookie sah menghasilkan `200` lalu sesi tidak berlaku (`AUTH-04`). | Tambahkan pemeriksaan CSRF/Origin untuk konsistensi; aturan pengiriman cookie browser tetap faktor pembatas. |
| Guard halaman admin | Tanpa cookie mendapat `307`; cookie palsu membuat shell dashboard dirender `200`; seluruh tujuh API yang diuji tetap `401` (`AUTH-01`). | Verifikasi sesi pada layout/page server bila shell admin juga perlu dibatasi. Jangan menilai render UI ini sebagai akses data admin. |
| Turnstile | Mock `success: true` dengan hostname/action yang berbeda diterima; token kosong dan outage ditolak (`HELPER-03`). Kunci lokal belum dikonfigurasi. | Konfigurasikan kunci/allowed host pada deployment dan periksa hostname/action bila digunakan. Hasil mock bukan bukti bypass Cloudflare nyata, dan CAPTCHA tidak membuktikan pemilik NIM. |
| CSV | `csvSafe()` mengawali formula langsung `=`, `+`, `-`, `@` dengan apostrof; awalan tab/CR/spasi sebelum formula tidak diubah (`HELPER-02`, `src/lib/validation.ts:3–7`). | Perkuat export boundary dan uji di spreadsheet target. Jalur input saat ini melakukan trim/normalisasi sehingga eksploit end-to-end dari form belum terbukti. |
| Batas resource | Field identitas dibatasi panjang, tetapi body JSON 512 KiB dengan field tambahan diterima `200` (`IMPORT-10`). Upload dibaca dengan `formData()` sebelum cek ukuran; parser membaca workbook penuh. | Batasi total request, jumlah file/part, row/cell/sheet, dekompresi, dan waktu parsing pada ingress/parser. Pengujian ini bukan demonstrasi DoS atau ZIP bomb. |
| CSP | Produksi lokal memakai `script-src 'self' 'unsafe-inline'`; `unsafe-eval` tidak muncul (`HEADERS-01`, `src/proxy.ts:7–28`). | Migrasikan script inline ke nonce/hash sesuai rendering Next.js; uji widget dan scanner. Tidak ada stored/reflected XSS browser yang dibuktikan dalam audit ini. |

## 5. Kontrol yang berhasil diverifikasi

| Kontrol | Hasil |
| --- | --- |
| Otorisasi API admin | Tujuh endpoint admin menolak sesi hilang/palsu `401` (`AUTH-01`) |
| Cookie sesi | `HttpOnly`, `Secure`, `SameSite=Strict`, `Max-Age=28800` pada mode produksi (`AUTH-02`) |
| Penyimpanan dan lifecycle sesi | Token mentah tidak tersimpan pada kolom hash; expiry dan reuse setelah logout ditolak `401` (`AUTH-04`); implementasi SHA-256 di `src/lib/auth.ts:22–24` |
| Lockout persisten | Setelah 12 event gagal yang ditanam untuk IP uji, PIN benar pun ditolak `429` (`AUTH-04`); ketepatan sumber IP tetap SEC-04 |
| CSRF | Lima mutasi admin menolak token hilang maupun salah `403` (`CSRF-01`) |
| Pemeriksaan master | Peran nonmahasiswa, NIM di luar master, dan nama salah ditolak `403` (`REGISTER-01`) |
| Canonical academic fields | Prodi dan angkatan pilihan klien diganti oleh nilai master (`REGISTER-02`) |
| Keunikan registrasi | Dua request bersamaan menghasilkan satu `200` dan satu `409` (`REGISTER-03`) |
| Check-in atomik | Dua scan bersamaan hanya satu berhasil; token terlalu panjang `400`; payload SQL metacharacter tidak diterima sebagai tiket (`CHECKIN-01`) |
| Impor normal | Tiga file menghasilkan tiga baris valid, nol invalid, dan commit `200` (`IMPORT-01`) |
| Transaksi impor | Rollback memulihkan snapshot; commit paralel dan commit vs rollback menyisakan satu batch aktif/master konsisten (`IMPORT-05`, `IMPORT-07`, `IMPORT-08`) |
| Kegagalan transaksi | Constraint nama dan trigger sintetis pada insert master tidak meninggalkan penggantian parsial (`IMPORT-06`, `IMPORT-09`) |
| Escaping email | Payload HTML pada nama muncul ter-escape, tidak sebagai tag mentah; satu attachment QR terbentuk (`HELPER-04`) |
| Isolasi secret server | PIN, password DB, dan bcrypt hash sintetis tidak ditemukan pada aset client `.next/static` (`BUILD-02`); bukan scan seluruh secret produksi |
| Header | HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, dan CSP hadir; `X-Powered-By` tidak ada; tiket memiliki `noindex, nofollow` (`HEADERS-01`, `PRIVACY-01`) |

Query SQL yang ditinjau menggunakan parameter untuk input pengguna. Satu payload metacharacter bukan pembuktian menyeluruh bahwa semua kelas SQL injection mustahil. Penggunaan bcrypt async, pool maksimum 5, connection timeout 10 detik, dan query/statement timeout 15 detik juga terkonfirmasi dari kode (`src/lib/auth.ts:26–38`, `src/lib/db.ts:153–163`).

## 6. Dependency, pemeriksaan proyek, dan konfigurasi

### Hasil pemeriksaan

| Pemeriksaan | Hasil |
| --- | --- |
| `npm audit --json` | 9 paket terdampak: 1 high + 8 moderate; exit 1 karena advisory |
| `npm audit --omit=dev --json` | Hanya `xlsx` pada dependency produksi, dengan dua advisory high |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false` | Lolos |
| Production build terisolasi (`next build --webpack`) | Lolos (`BUILD-01`); full run terakhir compile 23 detik, TypeScript 6,2 detik |
| `npm run lint` | 4 error dan 1 warning yang sudah ada |
| Syntax dua skrip audit (`node --check`) | Lolos |
| ESLint untuk skrip `.cjs` | Diabaikan oleh konfigurasi proyek; bukan validasi lint yang lulus |
| Uji helper/build/HTTP | 29 kelompok observasi tersimpan tanpa `harnessError`; lifecycle proses memiliki catatan di bagian 8 |
| `node scripts/security-review.cjs --database-only` | 1 observasi tambahan; proses selesai exit 0 dan `cleanupErrors: []` |

Delapan entri moderate berasal dari rantai development tooling `minimatch`, advisory [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249), melalui `typescript-eslint`/`eslint-config-next` (`package-lock.json:1941`). Jumlah paket terdampak tidak sama dengan sembilan celah aplikasi yang dapat dieksploitasi. Saran otomatis npm menyertakan downgrade `eslint-config-next`; jangan menerapkannya tanpa menilai kompatibilitas Next.js 16.

Lint yang masih terbuka:

- `src/app/admin/login/page.tsx:34`: `no-explicit-any`.
- `src/app/admin/scan/page.tsx:23,38`: dua `no-explicit-any`.
- `src/components/Countdown.tsx:20`: `react-hooks/set-state-in-effect`.
- `src/components/AudioPlayer.tsx:8`: warning variabel tidak dipakai.

### Konfigurasi lokal yang diperiksa secara teredaksi

| Parameter | Hasil lokal |
| --- | --- |
| `ADMIN_PIN_HASH` | Ada, bcrypt cost 12 |
| `ADMIN_PIN` plaintext | Tidak dikonfigurasi |
| `DATABASE_URL` | Remote, `sslmode=verify-full`; tidak dihubungi oleh audit runtime |
| Gmail | User dan app password tersedia; nilainya tidak dicetak |
| Turnstile server/client | Keduanya belum dikonfigurasi |
| `NEXT_PUBLIC_APP_URL` | URL HTTP localhost |

Ini adalah konfigurasi development lokal, bukan bukti pengaturan deployment. Entropi PIN asli, validitas sertifikat remote, pengiriman email sungguhan, dan konfigurasi domain Turnstile tidak diuji.

### Batas deployment yang perlu ditindaklanjuti

- Jika memakai Vercel Functions, dokumentasi [Vercel Functions Limits](https://vercel.com/docs/functions/limitations) menyebut batas body request/response **4,5 MB**. Satu file maksimum aplikasi sudah 5 MiB; tiga file dapat mencapai 15 MiB ditambah overhead multipart. Request sah menurut aplikasi dapat ditolak sebelum mencapai handler. Rancang upload sementara terkontrol atau sesuaikan ukuran/topologi; uji batas pada deployment target.
- Verifikasi sanitasi header IP, jumlah instance, TLS, domain HTTPS publik, dan konfigurasi email/Turnstile di hosting sebenarnya.
- Uji backup/restore dan pemulihan operasional sebelum acara; transaksi rollback impor yang berhasil bukan pengganti restore database.
- Tentukan retensi snapshot impor, peserta, sesi, audit log, dan log hosting. PIN bersama saat ini membatasi atribusi per operator; kebutuhan akun individual perlu dipertimbangkan sesuai cara kerja panitia.

## 7. Urutan remediasi yang disarankan

1. **Kepemilikan identitas dan data yang sudah tersebar:** tutup SEC-01; inventarisasi akses/record historis dan cabut token yang relevan pada SEC-03.
2. **Permukaan input dan abuse:** perbarui parser SEC-02, verifikasi trusted ingress SEC-04, dan perbaiki kuota SEC-05. Konfigurasikan proteksi bot pada deployment sesuai kebutuhan.
3. **Alur impor:** ikat preview/commit SEC-06, selaraskan validator SEC-07, dan perbaiki query status batch OPS-01. Verifikasi batas upload platform pada langkah yang sama.
4. **Keandalan dan privasi:** tutup fallback produksi SEC-08, minimalkan payload tiket SEC-09, kemudian atasi enumerasi SEC-10, error SEC-11, dan cache SEC-12.
5. **Uji penutupan:** jalankan kriteria verifikasi per temuan, termasuk browser dan ingress deployment. Assertion keamanan baru perlu menuntut perilaku yang telah diperbaiki; runner audit ini merekam perilaku saat dijalankan dan bukan gerbang kelulusan remediasi otomatis.

## 8. Bukti, reproduksi, dan keterbatasan

### Artefak audit

Direktori bukti lengkap:

```text
C:\Users\Pongo\AppData\Local\Temp\opencode\fan26-review-AeIAry\
  observations.json
  build.log
  server.log
  postgres.log

C:\Users\Pongo\AppData\Local\Temp\opencode\fan26-review-kpQpIv\
  observations.json
  postgres.log
```

`AeIAry` memuat 29 kelompok observasi, selesai merekam pada `2026-11-07T15:00:24.897Z`. `kpQpIv` memuat `IMPORT-11` serta hasil cleanup, selesai pada `2026-11-07T15:08:07.576Z`. Fakta dan hasil utama disalin dalam laporan ini karena direktori sementara dapat dibersihkan oleh sistem.

SHA-256 `observations.json`:

```text
AeIAry: 0D9799FE84091C3917A7B9997072F1C1A937583A3391FE0BD71D29594DA546B3
kpQpIv: 2311F5D8D11E613060E28E08CA79BB1AB395BBC11BEEC4625243CE2C28D18965
```

**Catatan lifecycle runner:** full run menyimpan seluruh observasi tetapi command foreground melewati timeout 240 detik. Ditemukan worker PostgreSQL 18 `io_worker` yang tertinggal dan mempertahankan pipe; setelah worker milik uji dihentikan, run background sebelumnya selesai. Runner sekarang memakai `pg_ctl` untuk shutdown Windows dan menunggu penutupan stream. Perbaikan shutdown diverifikasi lewat `--database-only`, exit 0, `cleanupErrors: []`, serta tidak ada proses audit/PostgreSQL uji tersisa. Full suite tidak diulang setelah perubahan lifecycle; bukti HTTP berasal dari full run di atas.

### Perintah reproduksi (PowerShell, dari root proyek)

Prasyarat: Node.js 22 seperti lingkungan audit, dependency proyek terpasang, dan binary PostgreSQL uji eksternal berikut. Dependency uji dipasang di direktori sementara, terpisah dari `package.json` proyek.

```powershell
$env:SECURITY_REVIEW_TEMP = Join-Path $env:LOCALAPPDATA 'Temp\opencode'
$env:SECURITY_REVIEW_TOOLS = Join-Path $env:SECURITY_REVIEW_TEMP 'web-regist-security-20261107'
New-Item -ItemType Directory -Force -Path $env:SECURITY_REVIEW_TEMP | Out-Null
npm install --prefix $env:SECURITY_REVIEW_TOOLS --no-audit --no-fund --ignore-scripts embedded-postgres@18.6.0-beta.19
node scripts/security-review.cjs
```

Runner mengaktifkan `autoRehydrateSymlinks` untuk binary embedded PostgreSQL. Ia membuat cluster dan salinan aplikasi baru setiap run, kemudian mencetak lokasi `observations.json`. File/environment produksi tidak digunakan sebagai target pengujian. Database uji dibersihkan saat shutdown; salinan aplikasi/log dipertahankan sebagai bukti.

Pengujian terfokus query batch aktif dan lifecycle:

```powershell
node scripts/security-review.cjs --database-only
```

Scan history read-only dan pemeriksaan statis:

```powershell
node scripts/security-history-scan.cjs
node --check scripts/security-review.cjs
node --check scripts/security-history-scan.cjs
node node_modules/typescript/bin/tsc --noEmit --incremental false
npm run lint
npm audit --json
npm audit --omit=dev --json
```

`security-history-scan.cjs` hanya melaporkan jenis kecocokan, path/blob, nama field, dan jumlah record. Pattern scanner adalah heuristik; tidak mencakup semua bentuk secret, file biner, atau seluruh kemungkinan nama/path penyimpanan data.

### Hal yang belum dibuktikan

- Eksploit pada deployment live, sanitasi header CDN/proxy, perilaku cache hosting, serta akses langsung origin.
- Pengiriman/penyerahan email asli, penerimaan OTP, dan integrasi Cloudflare Turnstile asli.
- Eksploit browser end-to-end seperti XSS, CSRF lintas situs, dan eksekusi formula pada aplikasi spreadsheet.
- Status token historis pada database live, pihak yang pernah menerima salinan repo, serta keaslian setiap record historis.
- Load test, denial of service, ZIP bomb, pemulihan backup, dan race registration bersamaan dengan pergantian master pada skala produksi.

Laporan ini memberi hasil terukur untuk source dan lingkungan uji yang disebutkan. Status penutupan tiap temuan harus didasarkan pada implementasi perbaikan dan pengujian ulang yang sesuai.

## 9. Pembaruan remediasi — 8 November 2026

Perubahan telah diimplementasikan pada working tree dan diuji secara terisolasi. **Belum ada commit, push, atau deployment dari pekerjaan ini.** Pengujian tidak memakai database live atau SMTP nyata. Konfigurasi deployment tersedia pada [SECURITY-DEPLOYMENT.md](SECURITY-DEPLOYMENT.md) dan `.env.example`.

### Status per temuan

| ID | Status setelah perubahan | Implementasi dan bukti |
| --- | --- | --- |
| SEC-01 | **Ditunda atas keputusan pengguna** | Pengguna meminta risiko ini dilewati. Kecocokan NIM/nama dengan master tetap diperiksa, tetapi kepemilikannya belum dibuktikan. Uji `REGISTER-02` tetap memperlihatkan klaim melalui email pilihan pendaftar. |
| SEC-02 | **Terverifikasi lokal** | SheetJS resmi `0.20.3` dari CDN vendor, terkunci di lockfile; ZIP divalidasi dengan `yauzl@3.4.0`. `npm audit --omit=dev --json`: nol vulnerability. Impor/rollback lolos dengan dependency baru. |
| SEC-03 | **Mitigasi parsial; tindak lanjut operasional terbuka** | Delapan fingerprint token historis diblokir pada tiket, QR, dan check-in. `REVOKE-01` mencocokkan kedelapan nilai di memori; `REVOKE-02` menguji wiring HTTP dengan token sintetis. `dev26.log` dikeluarkan dari index Git, file lokal tetap ada; log baru di-ignore. Data historis masih ada di Git, database live belum dirotasi, dan pemblokiran baru berlaku setelah deployment. |
| SEC-04 | **Implementasi terverifikasi lokal; ingress hosting perlu diverifikasi** | `TRUSTED_PROXY` memilih satu header; default non-Vercel `unknown`. Rate limit memakai upsert atomik PostgreSQL bersama. `AUTH-03`: mengganti header alternatif tetap `429`. `RATE-01/02`: concurrency dan restart tetap mempertahankan batas. |
| SEC-05 | **Terverifikasi lokal** | Expiry mengikuti window sebenarnya. Kuota email dikonsumsi setelah peserta berhasil dibuat, tepat sebelum percobaan kirim. `HELPER-01`, `RATE-01`, `REGISTER-04/05`: menit 11/59 tetap dibatasi; identitas invalid tidak menghabiskan kuota; tiket ketiga tetap terbit ketika kuota email penuh. |
| SEC-06 | **Terverifikasi lokal** | Preview tersimpan, terikat hash sesi, expired setelah 15 menit, dan sekali pakai. Commit hanya JSON `batchId` ke snapshot server. `IMPORT-05`: ID karangan/sesi lain/expired/replay ditolak `409`, multipart pengganti `415`, field JSON tambahan `400`; master tetap utuh. |
| SEC-07 | **Terverifikasi lokal** | Tepat tiga file, struktur XLSX, NIM 12 digit, enam kode prodi, tahun 23–26, batas nama resmi/normalisasi, isi per prodi, ukuran/row/kolom/ZIP. `IMPORT-03/04/06/10/12/13` dan `HELPER-07` menguji batas tersebut, termasuk NIM angka dan upload gabungan di atas 10 MiB. |
| SEC-08 | **Terverifikasi lokal** | Guard produksi berada di pembaca fallback terpusat; lookup DB sukses tanpa hasil langsung `null`. `HELPER-08`, `PRIVACY-02`, `FAILURE-01`: file/seed tidak dibaca atau dirender, termasuk saat DB mati. API yang dibatasi mengembalikan `503`; halaman tiket mengembalikan error server `500`, bukan tiket lokal. |
| SEC-09 | **Terverifikasi lokal** | Query tiket dan `toPublicTicket()` memakai allowlist runtime. Email, telepon, serta timestamp internal dikeluarkan dari payload publik. `REGISTER-02` memeriksa field JSON; `PRIVACY-01` membuktikan kontak tidak muncul di HTML maupun RSC. |
| SEC-10 | **Tetap terbuka; pembatas abuse diperkuat** | Feedback `available`/`valid` masih tersedia. Kedua endpoint kini memakai rate limit persisten dan validasi/batas body. Perubahan feedback yang bergantung pada challenge kepemilikan belum diterapkan. |
| SEC-11 | **Terverifikasi lokal untuk kasus audit** | Error validasi/conflict/unavailable dibedakan; detail internal hanya di log server. Cookie CSRF malformed ditolak `403`; JSON malformed `400`; tipe media salah `415`; body berlebih `413`. `BODY-01`, `HEADERS-01`, `IMPORT-05/06/09/10`, `HELPER-06`. |
| SEC-12 | **Terverifikasi lokal; kebijakan CDN perlu diverifikasi** | Proxy memberi `private, no-store` pada halaman/API sensitif, dengan header tambahan di respons error/CSV/QR. `HEADERS-01`, `BODY-01`, `PRIVACY-01`, `FAILURE-01` menguji respons sukses dan error. |
| OPS-01 | **Terverifikasi lokal** | Agregasi mencakup `previous_batch_id`; kegagalan query tidak lagi menyamar sebagai ketiadaan batch. `IMPORT-11` pada PostgreSQL terfokus dan HTTP mengembalikan batch yang benar, tiga mahasiswa, dan `canRollback: true`. Dashboard menampilkan error layanan ketika pengambilan metadata gagal. |

Penguatan tambahan: Origin dan CSRF diseragamkan pada impor/logout; guard formula CSV mencakup awalan whitespace/control character; ukuran body aktual dibatasi sebelum parsing; buffer Next Proxy disesuaikan ke `16mb` agar kontrak tiga unggahan terpenuhi pada runtime yang mendukungnya.

### Hasil pengujian ulang

| Pemeriksaan | Hasil |
| --- | --- |
| Full runner `node scripts/security-review.cjs` | **43 kelompok uji/observasi**, exit 0, tanpa `harnessError`, `cleanupErrors: []` |
| Build produksi terisolasi `next build --webpack` | Lolos; compile 17,9 detik; TypeScript 5,2 detik |
| TypeScript standalone `tsc --noEmit --incremental false` | Lolos |
| PostgreSQL terfokus `--database-only` | Dua kelompok (`IMPORT-11`, `RATE-01`), exit 0, cleanup bersih |
| Helper terfokus `--helpers-only` | Sembilan kelompok, exit 0; input ZIP/body, fallback, revokasi, dan kuota diuji tanpa layanan eksternal |
| ESLint file aplikasi yang diubah | Lolos untuk API, lib, Proxy, konfigurasi Next, dashboard, halaman tiket, dan TicketCard |
| `npm run lint` seluruh proyek | Masih empat error + satu warning baseline di login/scan/Countdown/AudioPlayer yang tercantum pada Bagian 6 |
| `npm audit --omit=dev --json` | **0 vulnerability produksi** |
| `npm audit --json` | **8 moderate** pada rantai development tooling yang sama; 0 high/critical |
| `npm ls xlsx yauzl` | `xlsx@0.20.3`, `yauzl@3.4.0` |
| Syntax runner dan `git diff --check` | Lolos; skrip CJS tetap di luar cakupan ESLint proyek |

Hasil penting dari full run:

- **20 request paralel** dari dua instance helper untuk kuota lima: tepat lima diizinkan, 15 ditolak; instance helper baru tetap dibatasi. Setelah restart proses Next, login yang sudah dibatasi tetap `429` dan sesi sah tetap berlaku.
- Preview sah hanya mengaktifkan snapshot yang disetujui. Setelah kegagalan sintetis **di tengah pengisian master**, master/batch lama dan preview pulih; retry preview yang sama berhasil. Commit paralel dan commit melawan rollback menyisakan satu batch aktif yang konsisten.
- Tiga workbook sah dengan ukuran gabungan **12.604.111 byte** berhasil dipreview melalui Next Proxy. Ini pengujian self-hosted lokal; batas Vercel Functions 4,5 MB tetap memerlukan penanganan deployment sebagaimana panduan.
- Token sintetis yang dicabut mendapat `404` pada tiket/QR dan tidak dapat check-in, walaupun record peserta masih ada pada database uji. Kedelapan token historis dicocokkan terhadap fingerprint secara terpisah, tanpa menyalin data historis ke aplikasi uji.
- Saat database sengaja tidak tersedia, tiket tidak muncul dari file dan seluruh API yang diuji berhenti dengan `503`. Kontak peserta tidak ditemukan pada HTML/RSC tiket maupun payload registrasi.

Uji helper tambahan setelah review akhir juga mencakup IPv6 ber-scope (`fe80::1%eth0`): input yang tidak dapat dinormalisasi menjadi `unknown`, bukan melempar error URL. Penguatan kecil ini diverifikasi dengan pengulangan mode helper.

### Artefak remediasi

```text
C:\Users\Pongo\AppData\Local\Temp\opencode\fan26-review-mMcBuC\
  observations.json   # 43 kelompok, full run
  build.log
  server.log
  postgres.log

C:\Users\Pongo\AppData\Local\Temp\opencode\fan26-review-5SbuEC\
  observations.json   # PostgreSQL terfokus

C:\Users\Pongo\AppData\Local\Temp\opencode\fan26-review-Zj8qHH\
  observations.json   # helper terfokus awal

C:\Users\Pongo\AppData\Local\Temp\opencode\fan26-review-XLUvei\
  observations.json   # helper akhir, termasuk IPv6 ber-scope
```

Full run selesai pada `2026-11-07T16:56:42.656Z` (UTC). SHA-256 `observations.json`:

```text
mMcBuC: 6f5ef83bb8173c8879c84c2c365a6607f004b3c292c3dee32c509f3a08aed7a1
5SbuEC: 07329ee9a19f2baf920e0f254bbd7be3c4e6fb4d32a9860f33e7376dbf51f8eb
Zj8qHH: c2ded1f1a933bf60ddddaf4766d1ab48cf8c32d4a3e7bb7c8f9ba9bf1b0c00ae
XLUvei: 36fcb1bd6248bd1cc7de20cd47322f12ea60368dddc8b66006dc5c7c9244df46
```

Uji helper akhir selesai pada `2026-11-07T17:01:55.700Z`, sembilan kelompok tanpa error dan cleanup bersih. TypeScript serta ESLint untuk helper yang diperkuat kembali lolos setelah perubahan terakhir.

Runner sekarang merupakan regression check untuk perbaikan di atas; temuan yang sengaja terbuka tetap dicatat sebagai observasi. Hasil baseline lama pada Bagian 8 tetap tersedia sebagai pembanding.

### Tindak lanjut deployment

Terapkan versi ini pada seluruh instance dengan PostgreSQL bersama dan `TRUSTED_PROXY` yang sesuai, verifikasi sanitasi ingress/cache, serta siapkan penggantian tiket historis yang terdampak pemblokiran. Pembersihan data pada history Git, rotasi token pada DB live, dan kompatibilitas upload hosting tetap pekerjaan operasional terbuka. Pembuktian kepemilikan NIM tetap ditunda sesuai keputusan pengguna; enumerasi publik, CSP nonce/hash, guard halaman admin berbasis sesi server, dan binding hostname/action Turnstile tetap tindak lanjut audit.
