# Stream P2P Video Course Platform Architecture

Dokumen ini adalah **acuan flow aplikasi**.  
Perubahan kode harus mengikuti dokumen ini, bukan sebaliknya.

## 1) Product Scope
- Creator-first video course platform untuk konten edukasi.
- Next.js App Router sebagai Web App + BFF layer.
- Shelby Protocol untuk penyimpanan aset video lesson.
- HLS sebagai format playback.
- Wallet-based authentication (Aptos) untuk session user/admin.

## 2) Core Roles
- `Student`: browse course, buka lesson, menonton, melacak progress.
- `Creator`: upload/publish lesson, kelola konten, lihat analytics.
- `Admin`: moderasi dan operasi platform (kategori, lesson/video, policy).

## 3) Main Architecture Blueprint

Bagian ini adalah **blueprint utama sistem** yang menjadi konteks untuk flow canonical di bawahnya.

### A) Experience Layer
- `Next.js App Router`: landing page, course discovery, detail course, lesson page, dashboard, profile, signin.
- `TailwindCSS UI`: komponen UI untuk course card, lesson list, analytics widget, purchase CTA, progress state.
- `hls.js Video Player`: load manifest HLS lesson, adaptive playback, progress tracking, QoE event emission.

### B) Application / BFF Layer
- `Auth Service`: wallet auth, JWT session cookie, role enforcement (`student`, `creator`, `admin`).
- `Catalog Service`: metadata course, metadata lesson, kategori, creator profile, syllabus.
- `Entitlement Service`: validasi apakah user boleh stream lesson berdasarkan purchase, subscription, atau admin grant.
- `Playback Service`: membuat playback session token, memberi manifest access, menyimpan session context.
- `Analytics Service`: menerima watch event, QoE event, completion event, lalu mengagregasi creator metrics.
- `Revenue Service`: menghitung revenue split course purchase, subscription pool, dan tip creator.
- `Admin Moderation Service`: review konten, payout hold, dan policy control.

### C) Media Processing Layer
- `Upload Session API`: menerima upload request dari creator/admin.
- `Video Processing Service`: orkestrasi job ingest, transcode, package, dan publish.
- `FFmpeg`: transcoding video source menjadi rendition course lesson.
- `HLS Packager`: menghasilkan `master.m3u8`, rendition playlist, dan `segments/*.ts`.
- `Shelby Storage Adapter`: upload seluruh output lesson ke Shelby Protocol decentralized storage.

### D) Data Layer
- `PostgreSQL`: source of truth untuk users, courses, lessons, enrollments, purchases, watch progress, creator revenue, creator analytics.
- `Shelby Protocol Storage`: source of truth untuk blob media lesson seperti manifest, segments, thumbnails, captions.
- `Ledger / Revenue Records`: payout transparency untuk creator dan admin reconciliation.

### E) Main System Diagram

```text
Student / Creator / Admin
        |
        v
Next.js App Router + TailwindCSS
        |
        v
Next.js API / BFF
  |        |         |          |
  |        |         |          +--> Analytics Service
  |        |         +-------------> Revenue / Payout Service
  |        +-----------------------> Entitlement / Catalog / Auth
  +-------------------------------> Playback / Upload Control
                                     |
                                     v
                          Video Processing Service
                                     |
                   +-----------------+-----------------+
                   |                                   |
                   v                                   v
                FFmpeg                         HLS Segmentation
                   |                                   |
                   +-----------------+-----------------+
                                     |
                                     v
                           Shelby Protocol Storage
                                     |
                                     v
                               HLS Lesson Playback

PostgreSQL <--------------------------------------+
  users, courses, lessons, purchases, progress,   |
  creator_revenue, creator_analytics              |
                                                  |
Analytics, entitlement, dashboard, and payouts ---+
```

### F) Core Product Flows
- `Browse to Learn`: student browse `/courses` -> buka course detail -> pilih lesson -> stream jika entitled.
- `Create to Publish`: creator buat course -> upload lesson -> transcode + HLS -> upload ke Shelby -> publish.
- `Watch to Revenue`: watch metrics masuk analytics -> dihitung jadi creator performance dan subscription revenue share.
- `Purchase to Access`: user beli course / berlangganan -> enrollment aktif -> lesson terbuka via entitlement service.

### G) Monetization Blueprint
- `Course Purchase Model`: contoh split `70% creator / 30% platform`.
- `Subscription Pool Model`: payout creator berdasarkan proporsi watch time entitled:

```text
watch_time_share = creator_watch_time / total_platform_watch_time
creator_subscription_payout = subscription_pool_net * watch_time_share
```

- `Tip Model`: contoh split `95% creator / 5% platform fee`.
- Semua payout harus punya `formula_snapshot` atau audit metadata agar creator bisa melihat asal angka revenue.

### H) Creator Analytics Blueprint
- Metrics utama:
  - `total_views`
  - `watch_time`
  - `course_revenue`
  - `subscription_revenue_share`
  - `lesson_completion_rate`
- Dashboard creator harus memperlihatkan:
  - performa per course
  - performa per lesson
  - payout ledger
  - projected subscription share
  - processing/publish status lesson

### I) Recommended Next.js Structure

```text
app/
  courses/
    page.tsx
    [courseId]/
      page.tsx
  lesson/
    [lessonId]/
      page.tsx
  dashboard/
    page.tsx
  creator/
    courses/
    uploads/
    analytics/
  api/
    courses/
    lessons/
    purchases/
    subscriptions/
    progress/
    analytics/
    payouts/
    uploads/

components/
  VideoPlayer/
  CourseCard/
  LessonList/
  CreatorAnalytics/
```

## 4) Canonical User Flow (Wajib)

### A) Authentication
1. User buka `/signin`.
2. Wallet connect.
3. User sign challenge.
4. Server verify signature, issue JWT session cookie.

### B) Course Discovery
1. User buka `/courses`.
2. User pilih `/courses/[courseId]`.
3. User pilih lesson.

### C) Lesson Playback
1. User masuk `/lesson/[lessonId]`.
2. BFF create playback session token.
3. BFF bootstrap Shelby session.
4. Player load HLS manifest.
5. QoE events dikirim ke ingestion endpoint.

### D) Creator/Admin Publish Flow
1. Admin/Creator isi metadata konten.
2. Upload file video/manifest.
3. Blob metadata diregister ke L1 (wallet-signed transaction).
4. Byte data di-ingest server-side ke Shelby RPC.
5. Simpan blob key ke metadata lesson/video.
6. Konten tampil pada discovery flow.

## 5) Canonical Route Structure

### Primary Experience Routes
- `/` (landing + navigation entry)
- `/courses`
- `/courses/[courseId]`
- `/lesson/[lessonId]`
- `/dashboard`
- `/profile`
- `/signin`

### Creator/Admin Routes
- `/admin`
- `/creator/analytics`
- `/creator/courses`
- `/creator/uploads`

### Legacy Compatibility Route
- `/watch/[titleId]` boleh ada, tetapi hanya sebagai compatibility/redirect ke `/lesson/[lessonId]`.

## 6) Canonical API Surface

### Auth
- `POST /api/auth/wallet/challenge`
- `POST /api/auth/wallet/verify`
- `POST /api/auth/logout`

### Course/Lesson
- `GET /api/courses`
- `GET /api/lessons?courseId=...`
- `GET /api/progress`

### Playback/Shelby
- `POST /api/v1/playback/token`
- `POST /api/v1/shelby/bootstrap`
- `POST /api/v1/qoe/events`
- `POST /api/v1/storage/ingest`
- `GET /api/v1/storage/read/[...blobKey]`

### Admin Content Management
- `GET/POST/PATCH/DELETE /api/v1/admin/categories`
- `GET/POST/PATCH/DELETE /api/v1/admin/videos`

## 7) Data and Control Plane

### Client and Edge
- Next.js UI (App Router)
- HLS player (`hls.js`) + custom UX controls
- QoE event emitter

### BFF / Control
- Auth/session enforcement
- Playback token issuance
- Shelby bootstrap
- Admin content CRUD

### Media Plane
- Shelby storage read/write
- L1 blob registration
- HLS playback via internal storage read path

## 8) Storage Convention

Canonical blob namespace:

```text
courses/{courseId}/lessons/{lessonId}/
  master.m3u8
  1080p.m3u8
  720p.m3u8
  segments/*.ts
  thumbnails/poster.jpg
  captions/en.vtt
```

Catatan:
- Jika implementasi masih transisi dari namespace lain, mapping harus konsisten di BFF.
- Entitlement checks dilakukan sebelum manifest URL dibuka.

## 9) Access Control Rules
- Playback lesson memerlukan entitlement valid:
  - purchase, subscription, atau admin grant.
- Preview lesson boleh dibuka tanpa purchase jika ditandai `preview`.
- Semua endpoint admin wajib session role `admin`.

## 10) Admin UX Requirements (Minimum)
- Manage categories: create, edit, delete.
- Manage video/lesson metadata: create, edit, delete.
- Confirm modal untuk action delete.
- Upload status bertahap (register -> ingest -> save metadata).
- Preview image URL (hero/card/thumbnail) saat editing.

## 11) Analytics and QoE Requirements
- Tangkap event minimum:
  - `startup`
  - `rebuffer_start`
  - `rebuffer_end`
  - `bitrate_change`
  - `fatal_error`
- Event dikirim batch ke ingestion endpoint.

## 12) Target Service Expansion (Roadmap)
- Entitlement service penuh (purchase/subscription/admin grant).
- Payment + subscription + payout ledger.
- PostgreSQL sebagai source of truth.
- Video processing pipeline (ingest -> FFmpeg -> package -> publish).
- Creator analytics modules lengkap (performance, payout, drop-off, completion).

## 13) Compliance Checklist Before Merge
- [ ] Route flow utama tetap `courses -> course -> lesson`.
- [ ] Auth flow wallet challenge-sign-verify tidak regress.
- [ ] Upload flow selalu L1 register dulu sebelum Shelby ingest.
- [ ] Admin CRUD category/video tetap lengkap.
- [ ] Playback + QoE ingestion tetap aktif.
- [ ] Tidak menambah flow baru yang bertentangan dengan dokumen ini.
