# Biteyo Backend

Biteyo Backend adalah REST API untuk aplikasi sosial berbagi rekomendasi makanan. Backend ini menangani autentikasi, feed bite, komentar, like, save, profil user, mention username, notifikasi, push notification, upload media, dan pencarian lokasi.

## Fitur

- Autentikasi user dengan signup, signin, logout, JWT, dan cookie HTTP-only.
- Login dengan Google ID token.
- Forgot password dan reset password lewat email.
- Feed bite makanan dengan foto, nama makanan, lokasi, alamat, rating, kategori, dan review.
- Kategori bite: `street_food`, `cafe`, `fine_dining`, `dessert`, `viral`, dan `hidden_gems`.
- Search bite berdasarkan nama makanan, lokasi, dan review.
- Trending bite berdasarkan skor dari view, like, dan komentar.
- Detail bite, update bite, delete bite, dan hapus file foto dari storage.
- Like dan unlike bite.
- Save dan unsave bite.
- Komentar pada bite.
- Mention user dengan format `@username` di review bite dan komentar.
- Notifikasi untuk like, comment, follow, trending, dan mention.
- Push notification memakai Firebase Cloud Messaging.
- Profil user dengan bio, avatar, banner, follow, unfollow, saved bites, dan liked bites.
- Upload avatar, banner, dan foto bite ke Supabase Storage.
- Pencarian lokasi lewat Maps endpoint.
- Dokumentasi OpenAPI tersedia di `/api/docs`.

## Tech Stack

- Node.js dengan ES Modules.
- Express untuk HTTP server dan routing.
- PostgreSQL sebagai database utama.
- Drizzle ORM untuk schema dan query database.
- Drizzle Kit untuk migration.
- Supabase untuk storage dan integrasi PostgreSQL/Supabase.
- Firebase Admin untuk FCM push notification.
- Nodemailer untuk pengiriman email reset password.
- Google Auth Library untuk validasi Google ID token.
- JWT untuk token autentikasi.
- Zod untuk validasi request body.
- Multer dan Sharp untuk upload dan pemrosesan gambar.

## Dependency Utama

- `express`: framework API.
- `drizzle-orm`: ORM PostgreSQL.
- `pg`: driver PostgreSQL.
- `dotenv`: load environment variable dari `.env`.
- `jsonwebtoken`: membuat dan memverifikasi JWT.
- `bcrypt` / `bcryptjs`: hashing password.
- `zod`: validasi input.
- `cors`: konfigurasi CORS frontend.
- `cookie-parser`: membaca cookie auth.
- `multer`: menerima upload file.
- `sharp`: kompresi/pemrosesan gambar.
- `@supabase/supabase-js`: akses Supabase Storage.
- `firebase-admin`: kirim FCM push notification.
- `google-auth-library`: validasi login Google.
- `nodemailer`: kirim email reset password.
- `express-rate-limit`: rate limit endpoint tertentu.
- `node-fetch`: HTTP request dari backend.

## Struktur Folder

```txt
src/
  config/          Konfigurasi Supabase dan Firebase Admin
  controllers/     Handler logic untuk auth, feed, profile, notification, maps
  db/              Drizzle schema dan koneksi database
  docs/            OpenAPI document
  middlewares/     Auth, upload, validasi request
  routes/          Express routes
  templates/       Template email
  utils/           Helper email, mention, notification, storage, rate limit
drizzle/           File migration database
```

## Environment Variable

Buat file `.env` berdasarkan `.env.example`.

```env
DATABASE_URL=your_database_url_here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
JWT_SECRET=your_jwt_secret_here
CLIENT_URL=http://localhost:5173
CLIENT_URLS=http://localhost:5173,https://biteyo-fe.vercel.app
PORT=8000
EMAIL_USER=your_email_here
EMAIL_PASS=your_email_password_here
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_REDIRECT_URI=your_google_redirect_uri_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
NODE_ENV=development
```

Untuk production, `FIREBASE_SERVICE_ACCOUNT_KEY` bisa dipakai sebagai JSON service account string agar tidak perlu menyimpan file service account.

## Menjalankan Project

Install dependency:

```bash
npm install
```

Jalankan development server:

```bash
npm run dev
```

Jalankan production server:

```bash
npm start
```

Default local API:

```txt
http://localhost:8000
```

Dokumentasi API:

```txt
http://localhost:8000/api/docs
```

## Database dan Migration

Schema Drizzle ada di `src/db/schema.js`, sedangkan migration SQL ada di folder `drizzle/`.

Migration terbaru menambahkan fitur mention:

- `bite_mentions`
- `comment_mentions`
- enum notification `mention`

Pastikan migration dijalankan ke database sebelum fitur mention dipakai di production.

## Endpoint Utama

Auth:

- `POST /api/auth/signup`
- `POST /api/auth/signin`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password/:token`
- `POST /api/auth/google`

Feed:

- `GET /api/feed/categories`
- `GET /api/feed/bites`
- `POST /api/feed/bites`
- `GET /api/feed/bites/search`
- `GET /api/feed/bites/trending`
- `GET /api/feed/bites/category/:category`
- `GET /api/feed/bites/:id`
- `PATCH /api/feed/bites/:id`
- `DELETE /api/feed/bites/:id`
- `POST /api/feed/bites/:id/view`
- `POST /api/feed/bites/:id/like`
- `POST /api/feed/bites/:id/save`
- `GET /api/feed/bites/:id/comments`
- `POST /api/feed/bites/:id/comments`

Profile:

- `GET /api/profile/:username`
- `PATCH /api/profile`
- `DELETE /api/profile`
- `POST /api/profile/:username/follow`
- `DELETE /api/profile/:username/follow`
- `GET /api/profile/:username/bites`
- `GET /api/profile/:username/liked`
- `GET /api/profile/saved`
- `GET /api/profile/liked`

Notifications:

- `GET /api/notifications`
- `POST /api/notifications/fcm-token`
- `DELETE /api/notifications/fcm-token`
- `PATCH /api/notifications/:id/read`

Maps:

- `GET /api/maps/location/search`

## Mention Username

User bisa mention user lain di review bite atau komentar dengan format:

```txt
@username
```

Backend akan:

- membaca username dari teks,
- mencari user yang valid,
- menyimpan relasi mention,
- membuat notification tipe `mention`,
- mengirim push notification jika user punya FCM token.

Mention duplikat dalam satu teks tidak dibuat dobel, dan mention ke diri sendiri diabaikan.

## Catatan Development

- Semua route utama, kecuali auth tertentu, memakai middleware `protect`.
- File upload diproses lewat middleware `upload`.
- Validasi body request memakai Zod.
- Like, comment, follow, dan mention terhubung ke sistem notifikasi.
- OpenAPI document bisa diubah di `src/docs/openapi.js`.
