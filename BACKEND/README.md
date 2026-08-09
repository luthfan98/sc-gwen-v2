# Fastify Backend (HTTP/HTTPS, SQL Server, Uploads)

## Struktur Folder
- `src/server.js` - entry point, menyalakan HTTP dan HTTPS (jika sertifikat tersedia)
- `src/app.js` - inisialisasi Fastify + plugin umum
- `src/config/index.js` - konfigurasi terpusat (PORT, SSL, DB, upload)
- `src/plugins/db.js` - koneksi pool SQL Server (mssql)
- `src/routes/health.js` - health check + ping database
- `src/routes/uploads.js` - upload file gambar/video ke disk
- `src/utils/logger.js` - logger pino (pretty-print di non-production)
- `uploads/` - folder penyimpanan file (tersaji via `/uploads/...`)
- `certs/` - tempatkan `server.key` dan `server.crt` jika ingin HTTPS

## Setup Cepat
1) Install dependencies
```
npm install
```
2) Salin env
```
cp .env.example .env
```
   - Sesuaikan DB_USER jika berbeda (default `sa`) dan path SSL jika ingin HTTPS.
3) Jalankan
```
npm run start   # produksi sederhana
npm run dev     # dengan nodemon
```

## Akses dari PC Lain
- Gunakan `HOST=0.0.0.0` di `.env` supaya Fastify listen di semua network interface.
- Gunakan `PORT=3500` atau port lain sesuai kebutuhan.
- Set `WEB_BASE_URL=http://IP_PC_FRONTEND:3000` agar proses backend yang membuka halaman frontend, seperti print PDF, memakai URL PC yang benar.
- Di frontend, set `BACKEND_API_URL=http://IP_PC_BACKEND:3500/api`. Browser tetap memanggil `/api`, lalu Next.js meneruskan ke URL backend ini.

## HTTPS
- Letakkan `SSL_KEY_PATH` dan `SSL_CERT_PATH` (misal `./certs/server.key`, `./certs/server.crt`) di `.env`.
- Jika file tidak ditemukan, server hanya akan menjalankan HTTP.
- Contoh self-signed (Linux/WSL/OSX):
```
openssl req -x509 -nodes -newkey rsa:2048 -keyout certs/server.key -out certs/server.crt -days 365 -subj "/CN=localhost"
```

## Uploads
- Endpoint: `POST /api/uploads` (multipart/form-data, field `file`).
- File disimpan ke folder `uploads/` dengan nama acak dan dapat diakses via `/uploads/{nama_file}`.
- Batas default: 50MB, hanya `image/*` dan `video/*` (atur di `src/config/index.js` atau `.env`).

## Database
- Koneksi: SQL Server `server-ppj:9777`, DB `db_gwen_v2`, password default `resmi12`.
- Query contoh: health check menjalankan `SELECT 1 AS ok`.
- Opsi SSL DB: `options.encrypt` dan `trustServerCertificate` dapat disesuaikan di `src/config/index.js`.
