# Architecture Option B - Phase B0

Dokumen ini memecah `Phase B0` dari [architecture-option-b.md](./architecture-option-b.md) menjadi langkah implementasi teknis awal untuk arsitektur **tanpa MySQL/PostgreSQL**.

Tujuan `Phase B0`:

- menambahkan `event envelope` ke seluruh write path penting
- memindahkan source of truth write ke event store
- menyiapkan projection input yang bersih
- mempertahankan route/UI yang ada selama contract masih kompatibel

Artinya pada fase ini:

- tidak ada dual-write ke relational database
- tidak ada repository relational sebagai operational source of truth
- event store menjadi sumber perubahan state
- Shelby tetap menjadi blob/media storage utama

## 1. Scope Phase B0

Write path yang harus lebih dulu di-event-kan:

1. authentication/profile bootstrap
2. creator application flow
3. creator content flow
4. upload/asset attachment flow
5. playback session issuance
6. progress checkpoints
7. QoE ingestion
8. payout settlement / projected ledger sync

Fase ini **tidak** mencakup:

- projection store produksi penuh
- transcode worker penuh
- entitlement projection penuh
- optimasi analytics lanjutan

## 2. Prinsip Desain

### 2.1 Event Adalah Write Source of Truth

Urutan yang disarankan:

1. validasi request
2. bentuk aggregate state final
3. bentuk event domain dari final state
4. append event ke event store
5. trigger sink/projection/bootstrap update yang dibutuhkan

Jangan menulis operational record dulu lalu menjadikan event sebagai tempelan.

### 2.2 Shelby Tetap di Media Plane

Event store tidak menyimpan blob media.

Yang masuk Shelby:

- source video
- HLS manifest
- segments
- thumbnail
- captions

Yang masuk event store:

- reference ke blob key
- status processing
- status publish
- lifecycle state

### 2.3 Projection Akan Datang Setelah Event Stabil

Phase B0 belum memaksa projection penuh, tetapi event yang dihasilkan harus:

- cukup typed
- cukup kecil
- cukup stabil
- cukup kaya untuk nanti membentuk projection

## 3. Event Contract Awal

### 3.1 Folder Baru

```text
lib/events/
  contracts.ts
  event-types.ts
  event-factory.ts
  idempotency.ts

lib/event-store/
  event-store.ts
  append-only-store.ts
  event-log-adapter.ts
```

### 3.2 Bentuk Event Minimal

```ts
type DomainEvent<TType extends string = string, TPayload = unknown> = {
  id: string;
  type: TType;
  aggregateType: string;
  aggregateId: string;
  occurredAt: string;
  actorUserId?: string;
  actorRole?: "student" | "creator" | "admin";
  correlationId?: string;
  causationId?: string;
  idempotencyKey?: string;
  payload: TPayload;
  version: 1;
};
```

### 3.3 Event Type Awal

- `profile_created`
- `profile_updated`
- `creator_application_submitted`
- `creator_application_approved`
- `creator_application_rejected`
- `course_created`
- `course_updated`
- `course_deleted`
- `lesson_created`
- `lesson_updated`
- `lesson_deleted`
- `lesson_asset_attached`
- `lesson_manifest_attached`
- `lesson_published`
- `lesson_unpublished`
- `media_asset_registered`
- `playback_session_created`
- `progress_checkpoint_recorded`
- `lesson_completed`
- `qoe_event_recorded`
- `payout_projected`
- `payout_settled`

### 3.4 Aggregate Type Awal

- `profile`
- `creator_application`
- `course`
- `lesson`
- `media_asset`
- `playback_session`
- `progress`
- `qoe`
- `payout_ledger`

## 4. Event Store Fase Awal

### 4.1 Pilihan Praktis

Untuk Phase B0, event store jangan dibuat terlalu kompleks dulu.

Pilihan yang disarankan:

- append-only event log adapter
- durable event stream
- atau event-native document/KV backend

Syarat minimum:

- append-only
- ordered per aggregate
- replayable
- support idempotency key

### 4.2 Struktur Event Log yang Disarankan

Setiap event harus punya:

- `id`
- `type`
- `aggregateType`
- `aggregateId`
- `occurredAt`
- `actor`
- `payload`
- `version`
- `idempotencyKey`

Kalau implementasi backend event store berbeda-beda, contract ini tetap harus konsisten di layer aplikasi.

## 5. Ownership File Map

### 5.1 Core Event Infrastructure

File baru:

- `lib/events/contracts.ts`
- `lib/events/event-types.ts`
- `lib/events/event-factory.ts`
- `lib/events/idempotency.ts`
- `lib/event-store/event-store.ts`
- `lib/event-store/index.ts`

### 5.2 Runtime Wiring

File yang perlu disentuh:

- `lib/repositories/index.ts`
- `lib/repositories/persistence-config.ts`
- routing command yang akan emit event

### 5.3 Command Endpoint yang Harus Event-First

- `app/api/auth/wallet/verify/route.ts`
- `app/api/creator/applications/route.ts`
- `app/api/v1/admin/creator-applications/route.ts`
- `app/api/v1/creator/content/route.ts`
- `app/api/v1/storage/ingest/route.ts`
- `app/api/v1/playback/token/route.ts`
- `app/api/progress/route.ts`
- `app/api/v1/qoe/events/route.ts`
- `app/api/payouts/route.ts`

## 6. Event Plan Per Endpoint

### 6.1 `POST /api/auth/wallet/verify`

Event:

- `profile_created` jika profile baru
- `profile_updated` jika profile berubah saat login

Payload minimum:

- `profileId`
- `walletAddress`
- `role`
- `displayName`
- `avatarUrl`

### 6.2 `POST /api/creator/applications`

Event:

- `creator_application_submitted`

Payload minimum:

- `applicationId`
- `userId`
- `displayName`
- `pitch`
- `status`

### 6.3 `PATCH /api/v1/admin/creator-applications`

Event:

- `creator_application_approved` atau `creator_application_rejected`
- bila approved, juga emit `profile_updated` atau `creator_role_granted`

Payload minimum:

- `applicationId`
- `userId`
- `reviewedBy`
- `status`

### 6.4 `POST/PATCH/DELETE /api/v1/creator/content`

Event:

- `course_created`
- `course_updated`
- `course_deleted`
- `lesson_created`
- `lesson_updated`
- `lesson_deleted`
- `lesson_published`
- `lesson_unpublished`

Catatan:

- publish/unpublish harus dibedakan dari update biasa
- payload harus merepresentasikan state final course dan lesson

### 6.5 `POST /api/v1/storage/ingest`

Event:

- `media_asset_registered`
- `lesson_asset_attached`
- `lesson_manifest_attached` bila asset adalah manifest

Payload minimum:

- `assetId`
- `lessonId`
- `courseId`
- `blobKey`
- `assetType`
- `storageProvider`

### 6.6 `POST /api/v1/playback/token`

Event:

- `playback_session_created`

Payload minimum:

- `playbackSessionId`
- `lessonId`
- `courseId`
- `userId`
- `manifestBlobKey`
- `entitlementSource`

### 6.7 `POST /api/progress`

Event:

- `progress_checkpoint_recorded`
- `lesson_completed` bila threshold completion tercapai

Payload minimum:

- `userId`
- `lessonId`
- `courseId`
- `positionSec`
- `completionPercent`
- `completedAt`

### 6.8 `POST /api/v1/qoe/events`

Event:

- satu `qoe_event_recorded` per item QoE

Payload minimum:

- `playbackSessionId`
- `lessonId`
- `courseId`
- `userId`
- `eventName`
- `peerHitRatio`
- `rebufferCount`
- `fatalError`

### 6.9 `PATCH /api/payouts`

Event:

- `payout_settled`

Dan ketika sistem membentuk projection payout:

- `payout_projected`

Payload minimum:

- `ledgerEntryId`
- `creatorProfileId`
- `courseId`
- `periodKey`
- `amountUsd`
- `status`
- `formulaSnapshot`

## 7. Implementasi Bertahap yang Disarankan

### Batch 1

- `POST /api/creator/applications`
- `PATCH /api/v1/admin/creator-applications`
- `PATCH /api/payouts`

Alasan:

- command jarang
- audit value tinggi
- payload mudah distabilkan

### Batch 2

- `POST /api/v1/creator/content`
- `PATCH /api/v1/creator/content`
- `DELETE /api/v1/creator/content`
- `POST /api/v1/storage/ingest`

### Batch 3

- `POST /api/v1/playback/token`
- `POST /api/progress`
- `POST /api/v1/qoe/events`

### Batch 4

- `POST /api/auth/wallet/verify`

## 8. Event Factory Rules

1. Semua event dibuat lewat helper.
2. `occurredAt` selalu UTC ISO string.
3. `id` dan `correlationId` dibuat di server.
4. `actorUserId` dan `actorRole` diisi bila session tersedia.
5. `payload` harus JSON-serializable.
6. Jangan taruh blob besar di payload; simpan hanya reference.

## 9. Idempotency Strategy

### 9.1 Command Idempotency

Gunakan `idempotencyKey` untuk:

- creator application submit
- payout settle
- creator content update
- publish lesson

Contoh:

- `creator-application-submit:{userId}`
- `payout-settled:{ledgerEntryId}`
- `lesson-publish:{lessonId}:{publishStatus}`

### 9.2 Progress dan QoE

Untuk progress/QoE:

- jangan terlalu agresif dedupe di Phase B0
- lebih realistis menerima duplicate ringan lalu bersihkan saat projection/aggregation

## 10. Logging dan Observability

Minimal log:

- `domain_event_append_started`
- `domain_event_append_succeeded`
- `domain_event_append_failed`

Field penting:

- `eventType`
- `aggregateType`
- `aggregateId`
- `eventId`
- `correlationId`
- `route`

## 11. Acceptance Criteria

Phase B0 dianggap selesai kalau:

1. event contract typed sudah ada
2. event store adapter sudah ada
3. Batch 1 endpoint sudah event-first
4. Batch 2 endpoint sudah event-first
5. command sukses menghasilkan event nyata
6. contract UI utama tidak regress
7. test unit mencakup event factory, idempotency, event adapter, dan minimal satu endpoint per batch

## 12. Test Plan

Test yang disarankan:

```text
test/events/event-factory.test.mts
test/events/idempotency.test.mts
test/event-store/event-store.test.mts
test/api/creator-applications-events.test.mts
test/api/creator-content-events.test.mts
test/api/payout-events.test.mts
```

Assertion penting:

- event type benar
- aggregate id benar
- payload final state benar
- duplicate command tidak menghasilkan event salah

## 13. Definition of Done

Phase B0 selesai kalau:

- command utama creator/admin sudah emit event nyata
- event log cukup untuk replay kasar
- log append event bisa dipakai debug
- tidak ada route utama creator/admin yang masih bergantung pada relational persistence

## 14. Langkah Setelah Phase B0

Langkah berikutnya adalah `Phase B1`:

1. buat `catalog_projection`
2. buat `creator_dashboard_projection`
3. buat `student_dashboard_projection`
4. sambungkan `/courses` dan `/dashboard` ke projection

Jadi hasil B0 harus cukup rapi untuk langsung menjadi input projection worker dan read model resmi.
