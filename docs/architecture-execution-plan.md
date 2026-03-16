# Architecture Execution Plan

Dokumen ini menerjemahkan `docs/system-architecture.md` menjadi rencana implementasi bertahap yang bisa dieksekusi tanpa melompat langsung ke refactor besar.

## Prinsip Eksekusi

1. Benahi flow dan domain boundary dulu, baru persistence.
2. Pertahankan perubahan kecil tetap deployable.
3. Jangan pindahkan model yang salah ke database baru.
4. Gunakan naming canonical: `student`, `creator`, `admin`, `course`, `lesson`, `media asset`.
5. Simpan access control sebagai capability, bukan hardcode role di setiap route.
6. MySQL boleh dipakai sebagai storage awal, tetapi repository dan use case harus tetap engine-agnostic agar migrasi ke PostgreSQL tidak mahal.

## Milestone

### Milestone 1: Route and Read Model Alignment

Tujuan:
- Memisahkan flow `course` dan `lesson` secara perilaku.
- Menghilangkan asumsi bahwa `lessonId === courseId`.

Scope:
- Tambah resolver lesson nyata di layer server.
- Rapikan route `/courses/[courseId]`, `/lesson/[lessonId]`, `/watch/[titleId]`.
- Konsistenkan API `GET /api/courses` dan `GET /api/lessons`.

Acceptance criteria:
- `/courses` menampilkan daftar course.
- `/courses/[courseId]` menampilkan detail course dan daftar lesson.
- `/lesson/[lessonId]` membaca lesson record, bukan course record.
- Link “Back to course” pada lesson page memakai `courseId` milik lesson.
- `/watch/[titleId]` tetap redirect ke `/lesson/[lessonId]`.
- Tidak ada lagi function bernama `getCourseById()` yang dipakai untuk membaca lesson.

Primary files:
- `app/courses/page.tsx`
- `app/courses/[courseId]/page.tsx`
- `app/lesson/[lessonId]/page.tsx`
- `app/watch/[titleId]/page.tsx`
- `app/api/courses/route.ts`
- `app/api/lessons/route.ts`
- `lib/server/course-flow.ts`
- `lib/server/data-store.ts`

Suggested tasks:
1. Tambah type `CourseRecord` dan `LessonRecord` terpisah.
2. Tambah server functions:
   - `listCourses()`
   - `getCourseById()`
   - `listLessonsByCourse(courseId)`
   - `getLessonById(lessonId)`
3. Ubah lesson page agar resolve lesson dahulu, lalu course.
4. Ubah API response shape agar lesson selalu membawa `courseId`.

### Milestone 2: Canonical Role and Capability Model

Tujuan:
- Menyamakan auth model dengan blueprint: `student`, `creator`, `admin`.
- Membuka route creator untuk creator/admin, bukan admin-only.

Scope:
- Ubah role type.
- Ubah issue/read session.
- Tambah helper capability.
- Rapikan guard di route dan API.

Acceptance criteria:
- `UserRole` canonical menjadi `student | creator | admin`.
- Wallet sign-in mengeluarkan role canonical.
- Route `/creator/uploads`, `/creator/courses`, `/creator/analytics` bisa diakses `creator` dan `admin`.
- Route admin moderation tetap admin-only.
- Guard logic tidak lagi tersebar sebagai `auth.role !== "admin"` untuk semua kebutuhan non-student.

Primary files:
- `lib/contracts/profile.ts`
- `lib/auth/types.ts`
- `lib/server/auth.ts`
- `app/api/auth/wallet/verify/route.ts`
- `app/admin/page.tsx`
- `app/creator/uploads/page.tsx`
- `app/creator/courses/page.tsx`
- `app/creator/courses/[courseId]/page.tsx`
- `app/creator/analytics/page.tsx`
- `app/api/v1/storage/ingest/route.ts`
- `app/api/v1/admin/categories/route.ts`
- `app/api/v1/admin/videos/route.ts`

Suggested tasks:
1. Tambah `capabilities.ts` di layer auth/server.
2. Implement helper:
   - `canPublishContent`
   - `canViewCreatorAnalytics`
   - `canModeratePlatform`
3. Default role baru:
   - non-admin => `student`
   - creator => allowlist/env/profile metadata
4. Ubah UI navbar dan route visibility mengikuti capability.

### Milestone 3: Publish Flow Closure

Tujuan:
- Menutup loop dari upload sampai konten muncul di discovery.
- Menghilangkan input manual `manifestBlobKey`.

Scope:
- Pisahkan metadata course, lesson, dan media asset.
- Tambah lifecycle publish.
- Hubungkan upload result ke lesson metadata.

Acceptance criteria:
- Setelah upload berhasil, asset record tersimpan.
- Lesson bisa di-attach ke manifest asset hasil upload.
- Lesson punya status `draft`, `processing`, `ready`, `published`, `failed`.
- Discovery hanya menampilkan lesson/course yang published.
- Creator/admin tidak perlu copy manual `manifestBlobKey` ke form terpisah.

Primary files:
- `app/admin/admin-client.tsx`
- `app/api/v1/storage/ingest/route.ts`
- `app/api/v1/admin/videos/route.ts`
- `lib/storage/blob-path.ts`
- `lib/server/data-store.ts`
- `lib/server/course-flow.ts`

Suggested tasks:
1. Tambah entity `MediaAsset`.
2. Tambah attach flow:
   - upload source/manifest
   - simpan hasil ingest
   - bind asset ke lesson
3. Pisahkan “create course” dan “create lesson”.
4. Tambah status publish di read model creator.

### Milestone 4: Persistence Refactor on MySQL

Tujuan:
- Memindahkan source of truth dari JSON lokal ke relational model yang sesuai blueprint.
- Menjaga jalur migrasi ke PostgreSQL tetap murah.

Scope:
- Buat repository interface.
- Implementasi MySQL sebagai adapter pertama.
- Port use case bertahap dari file store ke repository.

Acceptance criteria:
- Read/write course, lesson, media asset, enrollment, progress, playback session tersimpan di MySQL.
- Page dan API tidak membaca file JSON lagi.
- Query penting berada di repository layer, bukan di page/API.
- Migration script bisa dijalankan idempotent.

Primary files:
- `lib/server/data-store.ts` atau pengganti repository baru
- `lib/server/course-flow.ts`
- `app/api/*`
- `package.json`
- folder migrasi baru

Suggested tasks:
1. Tambah folder:
   - `lib/repositories/`
   - `lib/use-cases/`
   - `db/migrations/`
2. Buat interface:
   - `CourseRepository`
   - `LessonRepository`
   - `MediaAssetRepository`
   - `ProfileRepository`
   - `EnrollmentRepository`
   - `ProgressRepository`
3. Implement MySQL adapter.
4. Tambah seed minimal untuk local dev.

### Milestone 5: Lesson-Centric Playback and Entitlement

Tujuan:
- Menjadikan playback token dan session context berbasis lesson.

Scope:
- Ubah input playback menjadi lesson-aware.
- Hubungkan lesson ke course dan entitlement source.

Acceptance criteria:
- Playback token dibuat dari `lessonId`.
- Session context menyimpan `lessonId`, `courseId`, `userId`, `entitlementSource`, `manifestBlobKey`.
- Playback ditolak untuk lesson yang belum `ready/published`.
- Entitlement tetap bisa dievaluasi di level course, tapi entry point selalu lesson.

Primary files:
- `app/api/v1/playback/token/route.ts`
- `app/api/v1/shelby/bootstrap/route.ts`
- `app/watch/[titleId]/stream-player.tsx`
- `lib/contracts/playback.ts`
- `lib/services/playback-client.ts`
- `lib/services/entitlement-client.ts`

Suggested tasks:
1. Tambah resolver `lesson -> course -> entitlement`.
2. Tambah validasi publish state sebelum issue playback session.
3. Rapikan naming contract jika `titleId` masih dipakai sebagai compatibility alias.

### Milestone 6: Progress, Analytics, Revenue Read Models

Tujuan:
- Menghidupkan flow `Browse to Learn`, `Watch to Revenue`, dan creator analytics.

Scope:
- Simpan progress per lesson.
- Turunkan analytics dari playback/QoE/progress.
- Tambah payout ledger placeholder yang audit-friendly.

Acceptance criteria:
- `GET /api/progress` mengembalikan progress nyata.
- Tersedia endpoint write progress atau ingestion progress event.
- Creator analytics menampilkan minimal:
  - `total_views`
  - `watch_time`
  - `lesson_completion_rate`
  - publish/processing status
- Payout ledger memiliki `formula_snapshot`.

Primary files:
- `app/api/progress/route.ts`
- `app/api/v1/qoe/events/route.ts`
- `app/creator/analytics/page.tsx`
- `app/dashboard/page.tsx`
- `lib/services/analytics-client.ts`
- repository analytics/progress baru

Suggested tasks:
1. Simpan progress checkpoint berkala.
2. Tandai completion di threshold yang jelas.
3. Tambah materialized read model sederhana untuk creator dashboard.
4. Tambah ledger payout mock yang eksplisit sebelum formula final.

### Milestone 7: PostgreSQL Migration

Tujuan:
- Memindahkan persistence yang sudah stabil dari MySQL ke PostgreSQL tanpa mengubah use case.

Scope:
- Ganti adapter repository.
- Migrasikan schema dan data.
- Validasi compatibility query.

Acceptance criteria:
- Seluruh use case tetap lolos tanpa perubahan kontrak aplikasi.
- Migration tool menghasilkan schema PostgreSQL setara.
- Data penting dapat dipindahkan: profiles, courses, lessons, assets, enrollments, progress, playback sessions, analytics summaries.

Rules for MySQL-first design:
- Gunakan `varchar` untuk enum-like fields.
- Gunakan `decimal` untuk nilai uang.
- Simpan waktu dalam UTC.
- Gunakan UUID/ULID sebagai id domain.
- Hindari query vendor-specific untuk fase awal.
- Isolasi SQL di repository layer.

## MySQL Initial Schema

Target awal ini cukup untuk menggantikan file JSON tanpa mengunci aplikasi ke dialect tertentu.

### `profiles`
- `id` varchar(36) primary key
- `wallet_address` varchar(128) unique not null
- `display_name` varchar(255) not null
- `avatar_url` varchar(1024) null
- `role` varchar(32) not null
- `region` varchar(16) null
- `created_at` datetime not null
- `updated_at` datetime not null

### `categories`
- `id` varchar(36) primary key
- `name` varchar(255) not null
- `description` text null
- `created_at` datetime not null
- `updated_at` datetime not null

### `courses`
- `id` varchar(36) primary key
- `creator_profile_id` varchar(36) not null
- `category_id` varchar(36) not null
- `title` varchar(255) not null
- `slug` varchar(255) unique not null
- `description` text not null
- `hero_image_url` varchar(1024) null
- `card_image_url` varchar(1024) null
- `status` varchar(32) not null
- `published_at` datetime null
- `created_at` datetime not null
- `updated_at` datetime not null

### `lessons`
- `id` varchar(36) primary key
- `course_id` varchar(36) not null
- `title` varchar(255) not null
- `slug` varchar(255) not null
- `description` text null
- `sequence_no` int not null
- `duration_sec` int null
- `status` varchar(32) not null
- `published_at` datetime null
- `created_at` datetime not null
- `updated_at` datetime not null

### `media_assets`
- `id` varchar(36) primary key
- `lesson_id` varchar(36) null
- `asset_type` varchar(32) not null
- `storage_provider` varchar(64) not null
- `blob_key` varchar(1024) not null
- `source_file_name` varchar(255) null
- `content_type` varchar(255) null
- `registration_tx_hash` varchar(255) null
- `ingest_status` varchar(32) not null
- `publish_status` varchar(32) not null
- `created_by_profile_id` varchar(36) not null
- `created_at` datetime not null
- `updated_at` datetime not null

### `course_enrollments`
- `id` varchar(36) primary key
- `course_id` varchar(36) not null
- `profile_id` varchar(36) not null
- `entitlement_type` varchar(32) not null
- `entitlement_status` varchar(32) not null
- `started_at` datetime not null
- `expires_at` datetime null
- `created_at` datetime not null
- `updated_at` datetime not null

### `lesson_progress`
- `id` varchar(36) primary key
- `lesson_id` varchar(36) not null
- `profile_id` varchar(36) not null
- `position_sec` int not null
- `completion_rate` decimal(5,2) not null
- `is_completed` tinyint(1) not null
- `completed_at` datetime null
- `updated_at` datetime not null

### `playback_sessions`
- `id` varchar(36) primary key
- `lesson_id` varchar(36) not null
- `course_id` varchar(36) not null
- `profile_id` varchar(36) not null
- `region` varchar(16) not null
- `device_class` varchar(32) not null
- `entitlement_source` varchar(64) null
- `manifest_blob_key` varchar(1024) not null
- `started_at` datetime not null
- `ended_at` datetime null

### `qoe_events`
- `id` varchar(36) primary key
- `playback_session_id` varchar(36) not null
- `lesson_id` varchar(36) not null
- `profile_id` varchar(36) not null
- `event_type` varchar(64) not null
- `position_ms` int null
- `bitrate_kbps` int null
- `peer_hit_ratio` int null
- `error_code` varchar(128) null
- `event_ts` datetime not null
- `created_at` datetime not null

### `creator_payout_ledger`
- `id` varchar(36) primary key
- `creator_profile_id` varchar(36) not null
- `course_id` varchar(36) null
- `period_key` varchar(32) not null
- `amount` decimal(18,2) not null
- `currency` varchar(8) not null
- `source_type` varchar(32) not null
- `formula_snapshot` text not null
- `created_at` datetime not null

## Phase 0-1 File Change Map

Urutan ini disarankan agar perubahan awal tetap kecil dan terkontrol.

### Step 1
File:
- `lib/server/course-flow.ts`
- `lib/server/data-store.ts`

Change:
- Pisahkan type course dan lesson.
- Tambah fungsi `getLessonById`.

Done when:
- Server layer bisa resolve course dan lesson secara terpisah.

### Step 2
File:
- `app/api/courses/route.ts`
- `app/api/lessons/route.ts`

Change:
- Konsistenkan payload ke read model baru.

Done when:
- API lessons selalu mengembalikan `courseId`.

### Step 3
File:
- `app/courses/[courseId]/page.tsx`
- `app/lesson/[lessonId]/page.tsx`
- `app/watch/[titleId]/page.tsx`

Change:
- Lesson page pakai `getLessonById`.
- Backlink lesson pakai `courseId`.

Done when:
- Tidak ada lookup lesson ke `getCourseById`.

### Step 4
File:
- `lib/contracts/profile.ts`
- `lib/auth/types.ts`
- `lib/server/auth.ts`
- `app/api/auth/wallet/verify/route.ts`

Change:
- Pindahkan role ke canonical role.

Done when:
- Session dan profile record memakai `student | creator | admin`.

### Step 5
File:
- `app/creator/uploads/page.tsx`
- `app/creator/courses/page.tsx`
- `app/creator/analytics/page.tsx`
- `app/admin/page.tsx`
- route/API gate terkait

Change:
- Ganti role gate menjadi capability gate.

Done when:
- Creator tidak perlu menjadi admin untuk publish dan melihat analytics sendiri.

## Non-Goals for Early Phases

Hal berikut tidak perlu diselesaikan sebelum Milestone 1-3 selesai:
- migrasi ke PostgreSQL
- revenue formula final
- transcode pipeline produksi penuh
- background worker kompleks
- optimasi query lanjutan

## Testing Strategy

Minimal untuk tiap milestone:

1. Route smoke test
- signin
- courses list
- course detail
- lesson playback page

2. API contract test
- auth verify
- courses
- lessons
- playback token

3. Role/access test
- student tidak bisa akses admin moderation
- creator bisa akses creator area
- admin bisa akses semua moderation route

4. Publish flow test
- upload asset
- attach ke lesson
- publish lesson
- lesson muncul di discovery

5. Progress/playback test
- playback session terbentuk
- QoE event diterima
- progress tersimpan

## Recommended Execution Order

1. Milestone 1
2. Milestone 2
3. Milestone 3
4. Milestone 4
5. Milestone 5
6. Milestone 6
7. Milestone 7

Jika terjadi konflik prioritas, pertahankan urutan ini. Jangan mulai dari migrasi database sebelum route, role, dan publish flow sudah benar.
