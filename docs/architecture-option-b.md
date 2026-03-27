# Architecture Option B

Dokumen ini menjelaskan arsitektur target **tanpa MySQL/PostgreSQL sama sekali**.

Option B diposisikan sebagai arsitektur:

- `full web3 narrative`
- `event-first`
- `Verra` dengan blob/media berbasis Shelby
- `projection-first` untuk query UI
- `proof-backed` untuk state yang perlu trust tinggi

Jadi pada Option B:

- tidak ada database relasional konvensional
- tidak ada fallback MySQL/PostgreSQL
- tidak ada repository relational sebagai safety net jangka panjang

## 1. Ringkasan

Option B memakai empat lapisan utama:

1. `Wallet + Chain / Ledger Proof`
   untuk creator approval proof, ownership proof, publish proof, dan payout settlement proof.
2. `Shelby Protocol Storage`
   untuk source video, HLS manifest, segment, thumbnail, captions, dan metadata snapshot.
3. `Append-Only Event Store`
   untuk seluruh perubahan state yang penting secara domain.
4. `Projection Store`
   untuk semua query UI dan API read.

Intinya:

- **write path** = command -> event
- **read path** = projection
- **media path** = Shelby
- **trust path** = chain / proof

## 2. Prinsip Arsitektur

### 2.1 Tidak Ada Relational Core

Option B tidak mempertahankan:

- MySQL
- PostgreSQL
- relational fallback
- dual-source-of-truth antara event dan relational table

State operasional utama harus berasal dari:

- event stream
- Shelby metadata snapshot
- projection store

### 2.2 Shelby Adalah Blob Storage Utama

Shelby dipakai untuk:

- source upload
- HLS manifest
- rendition playlist
- segments
- thumbnail
- captions
- metadata snapshot file bila dibutuhkan

Shelby **bukan** event store dan **bukan** projection store.

### 2.3 Event Store Adalah Source of Truth untuk Perubahan State

Event store menyimpan perubahan penting:

- siapa melakukan apa
- terhadap aggregate apa
- kapan terjadi
- payload domain final

Event store harus:

- append-only
- replayable
- ordered per aggregate
- mendukung idempotency key

### 2.4 Projection Store Adalah Satu-Satunya Read Path Resmi

UI dan BFF read endpoints tidak boleh query event mentah untuk kebutuhan harian.

Semua query experience harus membaca projection:

- catalog
- lesson detail
- dashboard
- creator analytics
- payout
- entitlement

## 3. Komponen Utama

### 3.1 Experience Layer

Tetap sama:

- `Next.js App Router`
- `TailwindCSS UI`
- `hls.js Video Player`

Perubahan utamanya:

- page membaca projection, bukan relational query
- status UI harus siap menghadapi eventual consistency

### 3.2 Command API / BFF Layer

Komponen:

- `Auth Command Service`
- `Catalog Command Service`
- `Creator Workflow Command Service`
- `Playback Command Service`
- `Revenue Command Service`
- `Admin Moderation Command Service`

Tanggung jawab:

- validasi input
- validasi capability
- bentuk event final
- append ke event store
- trigger projection refresh / async processing

### 3.3 Event Store

Contoh event:

- `profile_created`
- `profile_updated`
- `creator_application_submitted`
- `creator_application_approved`
- `creator_application_rejected`
- `course_created`
- `course_updated`
- `lesson_created`
- `lesson_updated`
- `lesson_source_uploaded`
- `lesson_manifest_ready`
- `lesson_published`
- `lesson_unpublished`
- `playback_session_created`
- `progress_checkpoint_recorded`
- `lesson_completed`
- `qoe_event_recorded`
- `payout_projected`
- `payout_settled`

Event store dipakai untuk:

- audit history
- replay state
- input projection
- input analytics
- input revenue calculation

### 3.4 Projection Store

Projection minimum:

- `catalog_projection`
- `course_projection`
- `lesson_projection`
- `student_dashboard_projection`
- `creator_dashboard_projection`
- `entitlement_projection`
- `playback_session_projection`
- `payout_projection`
- `creator_application_projection`

Store projection boleh berupa:

- document store
- KV store
- replicated edge store

Selama:

- cepat dibaca
- mudah di-overwrite
- tidak dipakai sebagai write-ahead system of record

### 3.5 Proof / Ledger Layer

Dipakai untuk state yang perlu trust tinggi:

- creator approval proof
- content ownership proof
- publish proof
- payout settlement proof

Tidak semua state harus on-chain.

Yang perlu di-chain hanyalah state yang memang butuh:

- public verifiability
- settlement trust
- auditability lintas pihak

### 3.6 Media Processing Layer

Komponen:

- `Upload Session API`
- `Processing Job Dispatcher`
- `Transcode Worker`
- `HLS Packaging Worker`
- `Shelby Storage Adapter`
- `Manifest Ready Emitter`

Output:

- source video blob
- HLS manifest
- rendition playlist
- segments
- metadata snapshot

## 4. Aggregate dan Boundary

### 4.1 Profile Aggregate

State:

- `profileId`
- `walletAddress`
- `role`
- `displayName`
- `avatarUrl`

Event:

- `profile_created`
- `profile_updated`
- `creator_role_granted`
- `creator_role_revoked`

### 4.2 Creator Application Aggregate

State:

- `applicationId`
- `userId`
- `status`
- `reviewedBy`
- `reviewedAt`

Event:

- `creator_application_submitted`
- `creator_application_approved`
- `creator_application_rejected`

### 4.3 Course Aggregate

State:

- `courseId`
- `creatorProfileId`
- `title`
- `description`
- `categoryId`
- `publishState`

Event:

- `course_created`
- `course_updated`
- `course_archived`

### 4.4 Lesson Aggregate

State:

- `lessonId`
- `courseId`
- `title`
- `manifestBlobKey`
- `sourceAssetId`
- `streamAssetId`
- `publishStatus`
- `processingStatus`

Event:

- `lesson_created`
- `lesson_updated`
- `lesson_source_uploaded`
- `lesson_manifest_attached`
- `lesson_processing_started`
- `lesson_manifest_ready`
- `lesson_published`
- `lesson_unpublished`

### 4.5 Playback Aggregate

State:

- `playbackSessionId`
- `lessonId`
- `courseId`
- `userId`
- `entitlementSource`
- `startedAt`
- `endedAt`

Event:

- `playback_session_created`
- `playback_session_ended`
- `qoe_event_recorded`

### 4.6 Revenue Aggregate

State:

- `ledgerEntryId`
- `creatorProfileId`
- `courseId`
- `periodKey`
- `amount`
- `status`
- `formulaSnapshot`

Event:

- `payout_projected`
- `payout_settled`
- `payout_adjusted`

## 5. Canonical Read Models

### 5.1 Catalog Projection

Dipakai oleh:

- `/courses`
- `/courses/[courseId]`
- `/lesson/[lessonId]`

Isi minimum:

- published course
- published lesson
- category label
- creator summary
- thumbnail
- preview status

### 5.2 Student Dashboard Projection

Dipakai oleh:

- `/dashboard`

Isi minimum:

- continue watching
- active courses
- completed lessons
- latest progress per lesson

### 5.3 Creator Dashboard Projection

Dipakai oleh:

- `/creator/courses`
- `/creator/uploads`
- `/creator/analytics`

Isi minimum:

- ownership
- lesson status
- processing status
- publish status
- views
- watch time
- completion rate
- projected payout
- settled payout

### 5.4 Entitlement Projection

Dipakai oleh:

- playback token issuance
- lesson lock state

Isi minimum:

- access per user per course
- source access: `purchase`, `subscription`, `admin_grant`, `preview`
- effective start / end

### 5.5 Payout Projection

Dipakai oleh:

- `/api/payouts`
- creator analytics
- admin reconciliation

Isi minimum:

- ledger rows
- period grouping
- projected vs settled
- formula snapshot

## 6. Flow End-to-End

### 6.1 Authentication

1. User connect wallet.
2. User sign challenge.
3. BFF verify signature.
4. BFF load `profile_projection`.
5. Session dibuat dengan role hasil projection.
6. Jika profile belum ada, emit `profile_created`.

### 6.2 Creator Application

1. Student submit creator application.
2. BFF emit `creator_application_submitted`.
3. Projection update queue review admin.
4. Admin approve.
5. BFF emit:
   - `creator_application_approved`
   - `creator_role_granted`
6. Projection update:
   - pending queue berkurang
   - active creators bertambah
   - navbar creator aktif

### 6.3 Create to Publish

1. Creator buat draft course.
2. BFF emit `course_created`.
3. Creator buat lesson.
4. BFF emit `lesson_created`.
5. Creator upload source video.
6. BFF emit `lesson_source_uploaded`.
7. Worker transcode + package HLS.
8. Worker upload hasil ke Shelby.
9. Worker emit `lesson_manifest_ready`.
10. Creator publish lesson.
11. BFF emit `lesson_published`.
12. Catalog projection update sehingga konten muncul di discovery.

### 6.4 Browse to Learn

1. Student buka `/courses`.
2. UI baca `catalog_projection`.
3. Student buka `/lesson/[lessonId]`.
4. UI baca `lesson_projection`.
5. BFF baca `entitlement_projection`.
6. Jika allowed, BFF emit `playback_session_created`.
7. Player load manifest dari Shelby blob key yang ada di projection.

### 6.5 Watch to Revenue

1. Player kirim progress dan QoE event.
2. BFF emit:
   - `progress_checkpoint_recorded`
   - `qoe_event_recorded`
   - `lesson_completed`
3. Worker analytics update creator projection.
4. Worker revenue emit `payout_projected`.
5. Payout projection update dashboard creator.

### 6.6 Admin Settlement

1. Admin review payout period.
2. Admin mark payout settled.
3. BFF emit `payout_settled`.
4. Settlement proof disimpan ke ledger layer jika dibutuhkan.
5. Payout projection pindah dari `projected` ke `settled`.

## 7. API Surface untuk Option B

### 7.1 Command APIs

- `POST /api/creator/applications`
- `PATCH /api/v1/admin/creator-applications`
- `POST /api/v1/creator/content`
- `PATCH /api/v1/creator/content`
- `DELETE /api/v1/creator/content`
- `POST /api/v1/storage/ingest`
- `POST /api/v1/playback/token`
- `POST /api/progress`
- `POST /api/v1/qoe/events`
- `PATCH /api/payouts`

Output command API ideal:

- `accepted`
- `eventId`
- `aggregateId`
- `projectionVersion` bila tersedia

### 7.2 Read APIs

- `GET /api/courses`
- `GET /api/lessons?courseId=...`
- `GET /api/progress`
- `GET /api/v1/profile`
- `GET /api/v1/creator/content`
- `GET /api/payouts`

Semua read API harus membaca projection, bukan event mentah.

## 8. Komponen Baru yang Dibutuhkan dari Codebase Sekarang

### 8.1 Event Contract Layer

```text
lib/events/
  contracts.ts
  event-factory.ts
  event-types.ts
  idempotency.ts
```

### 8.2 Event Store Layer

```text
lib/event-store/
  event-store.ts
  append-only-store.ts
  event-log-adapter.ts
```

### 8.3 Projection Workers

```text
lib/projections/
  catalog/
  creator-dashboard/
  student-dashboard/
  entitlement/
  payouts/
```

### 8.4 Background Jobs

```text
lib/jobs/
  projection-dispatcher.ts
  media-processing.ts
  revenue-projection.ts
  analytics-projection.ts
```

### 8.5 Blob Metadata Snapshot Builder

```text
lib/media/
  lesson-metadata-snapshot.ts
  manifest-binding.ts
```

## 9. Mapping dari Codebase Saat Ini

### 9.1 Yang Bisa Dipertahankan

- route App Router
- auth wallet flow
- creator/admin/student pages
- contracts `course`, `lesson`, `playback`, `activity`, `revenue`
- Shelby ingest flow
- creator application flow
- creator analytics UI
- payout UI

### 9.2 Yang Harus Diubah

- seluruh write path harus event-first
- seluruh read path harus projection-first
- flow progress/QoE harus masuk event stream
- playback session harus dibentuk sebagai event
- revenue harus dihitung dari event/projection
- state metadata konten harus berpindah dari row/record ke aggregate + projection

### 9.3 Yang Boleh Tetap Sama

- route path
- response shape UI sejauh kompatibel
- capability helper
- lesson-centric playback contract

## 10. Migration Path dari Codebase Sekarang

Migration path tetap bertahap, tetapi targetnya tegas:

- buang MySQL/PostgreSQL dari runtime
- pindahkan write ke event store
- pindahkan read ke projection

### Phase B0: Event Envelope

Target:

- semua write penting menghasilkan event domain

Langkah:

1. Tambah `DomainEvent` contract.
2. Tambah event emitter.
3. Semua command API menulis event sebagai source utama.

Success criteria:

- event stream terisi untuk creator application, course, lesson, progress, playback, QoE, dan payout

### Phase B1: Projection Bootstrap

Target:

- projection mulai menjadi read path resmi

Langkah:

1. Tambah `catalog_projection`
2. Tambah `creator_dashboard_projection`
3. Tambah `student_dashboard_projection`
4. Build worker projection

Success criteria:

- `/courses` dan `/dashboard` membaca projection

### Phase B2: Media Processing Eventization

Target:

- upload sampai publish benar-benar event-driven

Langkah:

1. source upload emit `lesson_source_uploaded`
2. worker packaging emit `lesson_manifest_ready`
3. publish hanya boleh jika projection lesson status = `ready`

Success criteria:

- creator tidak perlu upload manifest manual

### Phase B3: Entitlement Projection

Target:

- lesson access dibaca dari projection

Langkah:

1. tambah event purchase/subscription/admin grant
2. build `entitlement_projection`
3. playback token hanya baca projection access

Success criteria:

- lock/unlock lesson konsisten di UI dan BFF

### Phase B4: Revenue Projection First

Target:

- revenue dihitung penuh dari event stream

Langkah:

1. jadikan progress, completion, QoE, playback sebagai input revenue projection
2. build period snapshot
3. payout projected/settled hanya hasil projection + admin command

Success criteria:

- revenue tidak lagi dihitung request-time

### Phase B5: Relational Removal Complete

Target:

- seluruh ketergantungan MySQL/PostgreSQL hilang total

Langkah:

1. hapus adapter relational
2. hapus migration relational
3. hapus wiring runtime relational
4. pastikan semua route utama tetap hidup dengan event + projection + Shelby

Success criteria:

- runtime aplikasi tidak lagi membutuhkan MySQL/PostgreSQL

## 11. Tradeoff Dibanding Arsitektur Sekarang

### Kelebihan Option B

- audit trail lebih kuat
- cocok untuk payout transparency
- replay dan rebuild projection memungkinkan
- lebih natural untuk web3/proof narrative
- analytics dan revenue lebih cocok berbasis event

### Kekurangan Option B

- implementasi jauh lebih kompleks
- butuh worker dan observability yang matang
- debugging write/read inconsistency lebih sulit
- eventual consistency harus diterima di UX
- local development lebih rumit

### Kelebihan Arsitektur Sekarang

- sederhana
- cepat dikerjakan
- query dashboard mudah
- debugging lebih mudah

### Kekurangan Arsitektur Sekarang

- tidak cocok dengan narasi full web3
- audit trail tidak sekuat event log
- payout transparency kurang natural
- terlalu bergantung pada operational database

## 12. Rekomendasi Praktis

Kalau produk ini memang ingin konsisten sebagai:

- creator-first
- web3-native
- proof-backed
- payout-transparent

maka Option B harus dianggap sebagai arsitektur utama, bukan eksperimen sampingan.

Keputusan teknisnya harus tegas:

1. Shelby adalah blob/media storage utama.
2. Event store adalah source of truth utama.
3. Projection store adalah read/query path resmi.
4. Chain / ledger proof dipakai untuk state trust tinggi.
5. MySQL/PostgreSQL tidak dipertahankan sebagai fallback.

## 13. Keputusan yang Disarankan

Kalau platform ini benar-benar full web3, maka:

- jangan rancang migration ke PostgreSQL
- jangan pertahankan MySQL sebagai operational core
- fokuskan implementasi ke event store, projection, Shelby, dan proof layer

Artinya Option B bukan lagi "alternatif", tetapi **target arsitektur resmi**.
