# Architecture Option B - Vercel Env and Deploy Checklist

Dokumen ini adalah checklist operasional untuk menjalankan runtime Option B di Vercel dengan:

- `Next.js` di Vercel
- `Upstash Redis` sebagai event store + projection store
- `Shelby` sebagai blob/media storage
- `Aptos wallet auth`

Dokumen ini melengkapi:

- [architecture-option-b-vercel-plan.md](./architecture-option-b-vercel-plan.md)
- [architecture-option-b-cutover-plan.md](./architecture-option-b-cutover-plan.md)

## 1. Minimum Env Wajib

Set env berikut di Vercel Project Settings.

### 1.1 Runtime Option B

```env
OPTION_B_EVENT_STORE_BACKEND=upstash
OPTION_B_PROJECTION_STORE_BACKEND=upstash
OPTION_B_MEDIA_PIPELINE_MODE=manual-pending
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
CRON_SECRET=...
```

### 1.2 Auth

```env
AUTH_JWT_SECRET=...
```

Catatan:

- jangan pakai secret pendek
- pakai value acak yang panjang

### 1.3 Shelby

```env
SHELBY_RPC_URL=...
SHELBY_API_KEY=...
```

Kalau flow upload memakai credential lain di project ini, samakan dengan env yang sudah dipakai adapter Shelby saat ini.

### 1.4 Service Token Internal

Kalau service internal lain masih dipakai:

```env
SERVICE_AUTH_TOKEN=...
```

## 2. Env Opsional yang Masih Relevan

```env
PLAYBACK_SERVICE_URL=...
ANALYTICS_SERVICE_URL=...
ALLOW_MOCK_FALLBACK=false
```

Rekomendasi:

- production: `ALLOW_MOCK_FALLBACK=false`
- development lokal: boleh `true`

## 3. Env yang Tidak Boleh Jadi Dependency Option B

Kalau targetnya runtime full Option B, env ini tidak boleh lagi jadi requirement:

```env
DATABASE_URL
PERSISTENCE_DRIVER
```

Kalau masih ada di project settings tidak masalah, tapi runtime Option B tidak boleh bergantung padanya.

## 4. Urutan Aktivasi di Vercel

1. Buat Upstash Redis database.
2. Pasang `UPSTASH_REDIS_REST_URL` dan `UPSTASH_REDIS_REST_TOKEN`.
3. Set `OPTION_B_EVENT_STORE_BACKEND=upstash`.
4. Set `OPTION_B_PROJECTION_STORE_BACKEND=upstash`.
5. Set `CRON_SECRET`.
6. Set env auth dan Shelby.
7. Redeploy project.

## 5. Verifikasi Setelah Deploy

Setelah deploy, cek urutan ini:

1. wallet signin sukses
2. `POST /api/auth/wallet/verify` membuat profile event dan projection
3. `GET /api/v1/profile` return profile yang benar
4. creator application submit masuk projection
5. creator approval update projection role
6. creator content create/update/delete muncul di `/api/courses` dan `/api/lessons`
7. `POST /api/v1/playback/token` membuat `playback_session_created`
8. `POST /api/progress` mengubah dashboard projection
9. `POST /api/v1/qoe/events` mengubah creator analytics projection
10. `POST /api/v1/creator/content/process` memindahkan lesson ke `packaging_requested`
11. `POST /api/internal/media/process/complete` menempelkan `manifestBlobKey` dan membuat draft jadi `manifest ready`

## 6. Route Internal yang Wajib Aman

Route ini harus diamankan dengan `CRON_SECRET`:

- `/api/internal/projections/run`
- `/api/internal/media/process/run`
- `/api/internal/media/process/complete`

Kalau nanti ada route internal lain untuk analytics/revenue/media jobs, pakai pola yang sama.

## 7. Tanda Runtime Sudah Benar

Runtime dianggap benar kalau:

- route read utama tetap jalan saat env relational dihapus
- profile/navbar role creator tetap benar setelah login baru
- progress/dashboard tetap terisi tanpa activity repository write
- creator content create/update/delete tetap muncul dari projection
- media pipeline tetap bisa bergerak dari `source uploaded` ke `manifest ready`

## 8. Known Transitional Gaps

Masih ada beberapa dependency transisional yang belum sepenuhnya hilang:

- payout status update masih repository-driven
- creator application persistence lama masih ada sebagai compatibility path untuk write tertentu
- profile persistence lama masih ada sebagai compatibility path untuk write tertentu
- admin creator application review masih masih menulis repository compatibility saat approve/reject
- admin content compatibility routes masih mempertahankan fallback repository untuk mode non-Upstash
- media pipeline masih belum auto-transcode HLS
- processor media saat ini masih butuh worker eksternal atau mode mock-manifest untuk menyelesaikan packaging

Gap ini tidak memblokir deploy Option B di Vercel, tapi masih perlu dibereskan sebelum repository lama bisa dihapus total.

## 9. Status Implementasi Saat Ini

Yang sudah berjalan di jalur Option B saat backend Upstash aktif:

- wallet signin meng-append sinkronisasi profile ke event/projection
- profile/navbar read path memakai projection
- creator application submit/read memakai projection-aware flow
- creator approval read path memakai projection
- categories memakai event + projection
- creator content memakai event-first write path
- admin `videos`, `courses`, `lessons` memakai event-first write path
- catalog, lesson detail, dashboard, creator analytics, progress read path memakai projection
- playback session, progress, QoE, media ingest memakai event-first primary path
- creator media pipeline sudah punya state `source uploaded -> packaging requested -> manifest ready`

Yang masih transisional:

- beberapa helper non-Option-B masih menyimpan fallback repository untuk local/dev safety
- repository compatibility masih dipertahankan untuk mode non-Upstash
- adapter relational lama masih belum dihapus dari repo
