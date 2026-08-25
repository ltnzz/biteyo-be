# Biteyo Backend — Arsitektur & Keputusan Teknis

Dokumen ini menjelaskan *kenapa* di balik struktur kode, bukan hanya *apa*.
Ditulis sebagai catatan keputusan engineering: masalah yang ditemukan,
opsi yang dipertimbangkan, dan trade-off yang dipilih.

## Gambaran Umum

```
React SPA (www.biteyo.my.id)
   │  fetch credentials:"include", path relatif /api/*
   ▼
Vercel rewrite (vercel.json)  ──►  Express API (biteyo-be.vercel.app)
                                      │ Drizzle ORM
                                      ├──► Supabase PostgreSQL (triggers + realtime)
                                      ├──► Supabase Storage (media)
                                      ├──► Firebase FCM (push)
                                      └──► Nominatim (location search)
```

---

## 1. God Controller → Domain Services

**Masalah.** `feed.controller.js` tumbuh menjadi ~800 baris yang menangani
list/search/trending/detail/like/save/comment/view/create/update/delete +
mention + engagement. Review lama, bug regression mudah terjadi.

**Keputusan.** Pecah per use-case ke `src/services/`:

| Service | Tanggung jawab |
|---|---|
| `feedQuery.service.js` | query builder list/detail/view + viral score SQL |
| `engagement.service.js` | like/save toggle + push |
| `comment.service.js` | komentar + mention |
| `biteMutation.service.js` | create/update/delete + storage cleanup |

Controller kini lapisan HTTP tipis: parse request → panggil service → bentuk
response. Error 4xx dinyatakan service lewat `AppError(statusCode)` dan satu
wrapper `handle()` menerjemahkannya ke response JSON.

**Trade-off.** Refactor bertahap berisiko regression — dimitigasi dengan
contract tests (13) + integration tests (2) yang berjalan sebelum dan sesudah.

---

## 2. Auth Cookie-Only + Same-Origin Proxy

**Masalah.** Awalnya hybrid: backend men-set cookie httpOnly, tapi frontend
juga menyimpan token di localStorage dan mengirim header Bearer. Ini
memperluas permukaan serangan XSS dan membuat state auth ganda.

**Kendala nyata.** FE (`www.biteyo.my.id`) dan BE (`biteyo-be.vercel.app`)
adalah **cross-site** — `vercel.app` ada di Public Suffix List. Cookie
`SameSite=Lax` tidak akan terkirim; bahkan `SameSite=None; Secure` bisa
diblokir browser karena termasuk third-party cookie.

**Keputusan.**
1. Hapus semua penyimpanan token di FE (localStorage, JS cookie).
2. Semua request memakai path relatif `/api/...`.
3. `vercel.json` me-rewrite `/api/*` ke backend → cookie menjadi
   **first-party** di domain frontend, CORS lintas-site hilang dari persamaan.
4. Flag cookie ditentukan dari protokol request (`req.secure` /
   `x-forwarded-proto`), bukan `NODE_ENV`, supaya produksi selalu dapat
   `Secure + SameSite=None` apa pun konfigurasi environment-nya.

**Alternatif yang ditolak.** Kembali ke Bearer fallback (permukaan XSS
kembali); custom domain untuk BE (biaya). Rotasi token sesi didukung kolom
`token_valid_after` — reset password mambatalkan semua JWT lama.

---

## 3. Counter Engagement: COUNT(*) → Incremental Trigger

**Masalah.** Trigger lama mensinkronkan `likes_count`/`comments_count`
dengan `SELECT COUNT(*)` pada setiap INSERT/DELETE. Write amplification
O(n) per interaksi.

**Keputusan.** Migration `0015` mengganti badan trigger menjadi
increment/decrement atomik:

```sql
likes_count = greatest(0, likes_count + CASE WHEN TG_OP = 'INSERT' THEN 1 ELSE -1 END)
```

**Trade-off.** Incremental bisa drift jika ada kegagalan parsial —
ditangani guard `greatest(0,...)` dan integration test yang membandingkan
stored count vs actual count setelah siklus like/unlike/comment.
Validasi dilakukan di Postgres vanilla (Docker) sebelum diterapkan ke produksi.

---

## 4. Ownership Notifikasi: DB Trigger vs Application Layer

**Masalah.** Record notifikasi ditulis trigger DB (0006, 0013), tetapi fungsi
aplikasi bernama `createNotificationAndPush` — menyiratkan ia membuat record.
Nama menyesatkan = risiko duplikasi saat refactor oleh engineer baru.

**Keputusan.** Single source of truth: **trigger DB memiliki data notifikasi;
aplikasi hanya mengirim push FCM**. Fungsi direname `sendNotificationPush`
dengan dokumentasi ownership eksplisit di atasnya.

**Alternatif yang ditolak.** Memindahkan pembuatan notifikasi ke app layer:
lebih mudah di-test unit, tapi butuh idempotency ketat dan migrasi berisiko —
tidak sepadan untuk skala saat ini.

---

## 5. Push FCM Fire-and-Forget

**Masalah.** `sendEachForMulticast` di-await di jalur request like/komentar —
latensi respons menggantung pada network call Firebase.

**Keputusan.** Push dijalankan tanpa await (`.catch(logger.error)`).
Aman karena record notifikasi dibuat trigger DB secara independen;
push hanyalah enhancer UX. Pembersihan token invalid masih inline di dalam
task background tersebut.

**Dipertimbangkan untuk nanti.** Queue (BullMQ/Redis) untuk retry & batching —
ditunda sampai volume push benar-benar menuntut infra tambahan.

---

## 6. Realtime: Satu Kanal, Bukan Dua

**Masalah.** Frontend berlangganan Supabase `postgres_changes` **dan** channel
broadcast kustom yang dikirim manual setiap mutasi → event dobel, fetch
berulang, flicker.

**Keputusan.** `postgres_changes` sebagai satu-satunya sumber realtime.
Broadcast service dihapus beserta 9 titik panggilannya. Ditambah debounce
refresh 300ms per bite-id karena satu aksi like memicu dua event
(`INSERT likes` + `UPDATE bites`).

---

## 7. Cache Frontend: Invalidasi Terarah

**Masalah.** Setiap mutasi memanggil `clearApiCache()` yang menghapus seluruh
cache user → over-fetch dan UX "kedip".

**Keputusan.** `invalidateApiCache(prefix)` menghapus hanya key berawalan
prefix: like/save → `feed:*` + `bite:{id}`; comment → tambah `comments:{id}`;
follow → `profile:*`. Logout tetap sapu penuh (memang harus bersih).

---

## 8. Keamanan Operasional

- **Gitleaks** di CI kedua repo, full-history scan tiap push.
- **Cron secret** hanya diterima via header `x-cron-secret`; jalur query param
  dihapus (rawan bocor ke access log) dan nilai secret tidak pernah dicatat.
- **Migration runner** dengan tabel `_migrations` menghilangkan eksekusi SQL
  manual yang rawan salah urutan.

## Yang Sengaja Di-defer

| Item | Alasan |
|---|---|
| Upload queue (Redis/BullMQ) | Overhead operasional > manfaat pada trafik saat ini |
| Keyset pagination | Offset + limit ≤ 50 dengan index masih cepat |
| Sentry/error tracking | Menunggu kebutuhan monitoring nyata |

Prinsipnya: **selesaikan akar masalah yang sudah nyata, catat sisanya sebagai
keputusan sadar — bukan kelalaian.**
