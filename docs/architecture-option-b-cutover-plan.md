# Architecture Option B - Cutover Plan

Dokumen ini menerjemahkan [architecture-option-b.md](./architecture-option-b.md) menjadi rencana cutover yang konkret dari codebase saat ini ke runtime **Verra full web3 + event-first + Shelby-backed media**.

Target akhir:

- tidak ada MySQL/PostgreSQL di runtime
- tidak ada relational migration sebagai dependency aplikasi
- write path memakai event store
- read path memakai projection store
- media memakai Shelby

## 1. Prinsip Cutover

1. Jangan mencampur dua source of truth terlalu lama.
2. Ganti write path dulu secara eksplisit, baru ganti read path.
3. Projection harus dibangun dari event yang stabil.
4. Shelby hanya untuk media/blob, bukan untuk query dashboard.
5. Setelah cutover satu fase selesai, hapus dependency lama yang sudah tidak dipakai.

## 2. Komponen Runtime Target

### 2.1 Wajib Ada

- `event-store`
- `projection-store`
- `projection-worker`
- `media-processing-worker`
- `Shelby storage adapter`
- `proof/ledger adapter`

### 2.2 Tidak Boleh Jadi Dependency Runtime

- `mysql2`
- `DATABASE_URL`
- `db/migrations/*.sql` sebagai dependency operasional
- repository relational sebagai source query

## 3. Keputusan Teknis yang Harus Dibuat Dulu

Sebelum refactor besar dimulai, harus dipilih:

1. backend event store
2. backend projection store
3. mekanisme worker / queue
4. format metadata snapshot di Shelby
5. state apa saja yang perlu proof / on-chain

Kalau lima keputusan ini belum dibuat, implementasi akan muter di tempat.

## 4. Rekomendasi Komponen

Karena narasinya full web3 dan tanpa relational DB, pilihan paling realistis:

### 4.1 Event Store

Gunakan durable append-only event log.

Syarat:

- append event
- append batch
- list by aggregate
- list by type
- support cursor/offset untuk worker

### 4.2 Projection Store

Gunakan document/KV store.

Projection minimum:

- `catalog_projection`
- `lesson_projection`
- `student_dashboard_projection`
- `creator_dashboard_projection`
- `entitlement_projection`
- `payout_projection`
- `creator_application_projection`

### 4.3 Queue / Worker

Gunakan satu dispatcher sederhana lebih dulu:

- `projection-worker`
- `analytics-worker`
- `media-worker`

### 4.4 Shelby Metadata Snapshot

Simpan snapshot JSON terstruktur per course/lesson:

```text
courses/{courseId}/metadata/course.json
courses/{courseId}/lessons/{lessonId}/metadata/lesson.json
```

Snapshot ini bukan source of truth utama, tapi berguna untuk:

- portability
- audit
- recovery
- bootstrap projection ulang

## 5. Fase Cutover

### Status Implementasi Saat Ini

Update status codebase saat ini:

- `C1 Event Runtime Foundation`: **sebagian besar selesai**
- `C2 Command Cutover`: **core runtime path pada dasarnya sudah event-first saat Option B aktif**
- `C3 Projection Bootstrap`: **mayoritas read path utama sudah projection-aware**
- `C4 Media Processing Cutover`: **belum selesai**, masih manual manifest/HLS
- `C5 Entitlement Cutover`: **belum selesai penuh**
- `C6 Revenue Cutover`: **sebagian**, payout projection ada tetapi settlement penuh belum event-native sepenuhnya
- `C7 Relational Removal`: **belum dilakukan**

Command yang sudah event-first saat `OPTION_B_PROJECTION_STORE_BACKEND=upstash`:

- wallet/profile bootstrap
- creator applications submit
- creator content create/update/delete
- admin categories
- admin videos
- admin courses
- admin lessons
- storage ingest
- playback session create
- progress checkpoint
- QoE ingest
- payout status update
- creator application review

Read path yang sudah projection-aware:

- courses
- lessons
- lesson detail
- creator content list/detail
- dashboard
- creator analytics
- payouts read
- creator applications read
- profile/navbar

### Fase C0: Freeze Arsitektur

Tujuan:

- hentikan penambahan fitur baru yang memperdalam ketergantungan ke MySQL

Langkah:

1. tandai Option B sebagai target resmi
2. hentikan pengembangan fitur baru berbasis relational-only
3. pastikan semua fitur baru masuk lewat event contract

Acceptance:

- tidak ada fitur baru yang menambah tabel/kolom relasional baru

### Fase C1: Event Runtime Foundation

Tujuan:

- event store menjadi write destination resmi

Langkah:

1. finalkan `DomainEvent` contract
2. finalkan event store adapter
3. finalkan idempotency helper
4. finalkan event append logging

File area:

- `lib/events/*`
- `lib/event-store/*`

Acceptance:

- event append berhasil untuk command utama
- event bisa di-query per aggregate dan per type

### Fase C2: Command Cutover

Tujuan:

- command utama tidak lagi bergantung pada repository relational

Urutan:

1. creator applications
2. payout commands
3. creator content create/update/delete/publish
4. storage ingest
5. playback session create
6. progress
7. QoE
8. auth profile bootstrap

Acceptance:

- seluruh endpoint command menghasilkan event tanpa write ke relational database

Catatan status:

- command inti untuk runtime aktif sudah pada dasarnya mencapai target ini
- yang tersisa lebih banyak berupa compatibility path non-Upstash dan fallback repository lokal

### Fase C3: Projection Bootstrap

Tujuan:

- read path utama pindah ke projection store

Urutan projection:

1. `creator_application_projection`
2. `payout_projection`
3. `catalog_projection`
4. `lesson_projection`
5. `student_dashboard_projection`
6. `creator_dashboard_projection`
7. `entitlement_projection`

Acceptance:

- route read utama tidak lagi membaca repository lama

Catatan status:

- mayoritas route read utama sudah berpindah
- yang masih tersisa terutama route/flow yang berhubungan dengan payout settlement dan sebagian compatibility admin lama

### Fase C4: Media Processing Cutover

Tujuan:

- source video upload tidak lagi bergantung pada manifest manual

Langkah:

1. source upload emit `lesson_source_uploaded`
2. media worker transcode + package
3. upload hasil ke Shelby
4. emit `lesson_manifest_ready`
5. projection update lesson status jadi `ready`

Acceptance:

- creator cukup upload source video
- manifest generated otomatis

### Fase C5: Entitlement Cutover

Tujuan:

- playback dan lesson lock state membaca projection entitlement

Langkah:

1. tambahkan event purchase/subscription/admin grant/preview
2. bangun `entitlement_projection`
3. playback token hanya baca projection

Acceptance:

- entitlement konsisten di lesson page, player, dan dashboard

### Fase C6: Revenue Cutover

Tujuan:

- revenue dan payout penuh berbasis event

Langkah:

1. jadikan playback/progress/QoE/completion input revenue worker
2. bangun settlement period snapshot
3. emit `payout_projected`
4. emit `payout_settled`
5. simpan proof settlement bila perlu

Acceptance:

- creator analytics dan payouts sepenuhnya projection-driven

### Fase C7: Relational Removal

Tujuan:

- buang seluruh dependency MySQL/PostgreSQL dari repo runtime

Langkah:

1. hapus `mysql2` dependency
2. hapus `DATABASE_URL` usage
3. hapus adapter `lib/repositories/mysql/*`
4. hapus fallback JSON yang mensimulasikan relational state
5. hapus wiring repository lama yang sudah tidak dipakai
6. arsipkan atau hapus `db/migrations/*`

Acceptance:

- app build dan jalan tanpa dependency relational apa pun

## 6. Mapping File Codebase Sekarang

### 6.1 Area yang Harus Dipertahankan

- `app/` routes
- `lib/auth/*`
- `lib/contracts/*`
- `lib/services/playback-client.ts`
- `lib/server/effective-role.ts`
- `app/creator/*`
- `app/watch/*`

### 6.2 Area yang Akan Diganti Bertahap

- `lib/repositories/*`
- `lib/server/data-store.ts`
- `db/migrations/*`
- `lib/server/*-flow.ts` yang masih baca repository lama

### 6.3 Area Baru yang Akan Menjadi Fondasi

- `lib/events/*`
- `lib/event-store/*`
- `lib/projections/*`
- `lib/jobs/*`
- `lib/media/*`

## 7. Urutan Eksekusi yang Paling Masuk Akal

1. Finalkan event contract
2. Finalkan event store runtime
3. Cutover creator applications + payouts
4. Cutover creator content + ingest
5. Bangun projection pertama
6. Pindahkan `/courses` dan `/dashboard` ke projection
7. Bangun media worker
8. Bangun entitlement projection
9. Bangun revenue worker
10. Hapus relational runtime

## 8. Open Questions yang Harus Diputuskan

1. Event store backend final apa?
2. Projection store backend final apa?
3. Worker dijalankan di mana?
4. Proof mana yang benar-benar wajib on-chain?
5. Apakah creator approval harus on-chain atau cukup signed proof off-chain?
6. Apakah payout settlement perlu hash snapshot ke chain?
7. Apakah metadata snapshot di Shelby harus immutable per version?

## 9. Definition of Ready

Cutover Option B baru layak dimulai kalau:

1. backend event store dipilih
2. backend projection store dipilih
3. bentuk worker runtime dipilih
4. snapshot metadata format dipilih
5. tim setuju tidak lagi mempertahankan MySQL/PostgreSQL

Kalau lima hal ini belum beres, refactor akan mahal dan mudah bolak-balik.

## 10. Definition of Done

Option B dianggap benar-benar selesai kalau:

- app tidak lagi memakai MySQL/PostgreSQL
- command path event-first
- read path projection-first
- creator upload source video saja cukup untuk publish pipeline
- entitlement, analytics, payouts, dan creator dashboard berjalan dari event/projection
- Shelby menjadi media/blob storage resmi
- proof layer aktif untuk state trust tinggi yang dipilih
