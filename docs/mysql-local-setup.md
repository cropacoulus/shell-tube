# MySQL Local Setup

Dokumen ini menjelaskan cara menyalakan persistence driver MySQL yang sekarang sudah tersedia untuk `profiles`, `categories`, `courses`, `lessons`, dan `media_assets`.

## Prasyarat

- MySQL 8.x lokal atau remote yang bisa diakses dari app.
- Dependency `mysql2` harus terpasang di project.
- Migration [db/migrations/001_initial_mysql.sql](/Users/rifqi/Development/Pribadi/Crypto/stream-p2p/db/migrations/001_initial_mysql.sql) sudah dijalankan ke database target.

## Environment

Set env berikut sebelum menjalankan app:

```bash
PERSISTENCE_DRIVER=mysql
DATABASE_URL=mysql://user:password@127.0.0.1:3306/course_lesson_creator
```

`DATABASE_URL` wajib memakai skema `mysql://`. Driver akan fail-fast jika env ini kosong atau jika package `mysql2` belum tersedia.

## Cakupan Yang Sudah Aktif

Adapter MySQL saat ini sudah menangani:

- `profiles`
- `categories`
- `courses`
- `lessons`
- `media_assets`
- `course_enrollments`
- `lesson_progress`
- `playback_sessions`
- compatibility surface `videos`

Dengan cakupan ini, flow utama berikut sudah punya adapter persistence:

- profile read/write
- admin categories
- admin courses
- admin lessons
- admin videos compatibility route
- catalog/discovery read model
- lesson-centric playback context yang membaca course/lesson dari repository
- media asset ingest persistence
- progress read/write via `/api/progress`
- playback session persistence saat token di-issue

## Batasan Saat Ini

Adapter MySQL belum mencakup:

- QoE analytics
- revenue/payout ledger

Artinya milestone persistence belum selesai penuh; MySQL saat ini baru cukup untuk catalog, publish surface utama, dan playback lookup.

## Urutan Migrasi Yang Disarankan

1. Jalankan migration awal.
2. Install `mysql2`.
3. Set `PERSISTENCE_DRIVER=mysql`.
4. Migrasikan seed awal `categories`, `profiles`, `courses`, `lessons`, `media_assets`.
5. Verifikasi route admin, catalog, lesson page, dan playback token.
6. Baru lanjut ke tabel `progress`, `enrollments`, dan analytics/event store.
