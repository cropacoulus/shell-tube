# Architecture Option B - Final Stack

Dokumen ini menetapkan stack final untuk Option B agar arsitektur **full web3 + event-first + Shelby-native** tidak lagi menggantung di level konsep.

## 1. Keputusan Final

Tiga keputusan utama ditetapkan sebagai berikut:

1. `Event Store`: **NATS JetStream**
2. `Projection Store`: **Valkey / Redis-compatible KV**
3. `Worker / Queue Runtime`: **Node.js worker processes + JetStream consumers**

Dengan tambahan:

4. `Blob / Media Storage`: **Shelby Protocol**
5. `Proof / Settlement Layer`: **Aptos-compatible signed proof / on-chain hash anchor**

## 2. Kenapa Stack Ini Dipilih

### 2.1 Event Store: NATS JetStream

Dipilih karena:

- append-only stream cocok untuk event-first architecture
- durable consumer cocok untuk projection worker
- lightweight dibanding membangun event store sendiri
- cocok untuk command event, analytics event, dan payout event
- tidak memaksa model relational

Kebutuhan yang dipenuhi:

- append single event
- append batch event
- stream per subject
- consumer cursor / replay
- durable subscription

Subject yang disarankan:

```text
events.profile.*
events.creator_application.*
events.course.*
events.lesson.*
events.media_asset.*
events.playback_session.*
events.progress.*
events.qoe.*
events.payout.*
```

### 2.2 Projection Store: Valkey / Redis-Compatible KV

Dipilih karena:

- cepat untuk read-heavy UI
- cocok untuk snapshot projection
- sederhana untuk overwrite/update projection
- cocok untuk dashboard, entitlement snapshot, dan catalog read model
- lebih ringan daripada document DB besar untuk tahap awal

Use case yang cocok:

- `catalog_projection:{courseId}`
- `lesson_projection:{lessonId}`
- `creator_dashboard:{profileId}`
- `student_dashboard:{profileId}`
- `entitlement:{userId}:{courseId}`
- `payout_projection:{creatorProfileId}`

Format yang disarankan:

- JSON string snapshot per key
- secondary index sederhana dengan sorted set / set

### 2.3 Worker Runtime: Node.js Workers + JetStream Consumers

Dipilih karena:

- codebase sekarang sudah Node/Next.js
- lebih sedikit context switching untuk tim
- event processing bisa ditulis dengan contract TypeScript yang sama
- worker dapat dijalankan terpisah dari Next.js app

Worker minimum:

- `projection-worker`
- `media-worker`
- `analytics-worker`
- `revenue-worker`

## 3. Stack Lengkap Option B

### 3.1 Experience Layer

- `Next.js App Router`
- `React 19`
- `TailwindCSS`
- `hls.js`
- `Aptos wallet auth`

### 3.2 Command / BFF Layer

- `Next.js route handlers`
- `TypeScript domain contracts`
- `event publisher` ke JetStream

### 3.3 Event Layer

- `NATS JetStream`
- typed domain events
- idempotency key per command penting

### 3.4 Projection Layer

- `Valkey / Redis-compatible KV`
- JSON snapshots
- secondary index via set/sorted-set

### 3.5 Worker Layer

- `Node.js worker runtime`
- JetStream consumer per bounded context

### 3.6 Media Layer

- `Shelby Protocol`
- source video
- HLS manifest
- renditions
- segments
- captions
- metadata snapshot JSON

### 3.7 Proof Layer

- `Aptos signed proof`
- optional on-chain anchoring untuk:
  - creator approval
  - publish proof
  - payout settlement proof

## 4. Komponen yang Tidak Dipilih

### 4.1 Tidak Memilih MySQL/PostgreSQL

Karena bertentangan dengan target arsitektur full web3 dan membuat dual-source-of-truth yang tidak perlu.

### 4.2 Tidak Memilih MongoDB sebagai Projection Store Utama

Alasan:

- bisa dipakai, tetapi untuk tahap awal terlalu berat untuk sekadar projection snapshot
- Valkey lebih sederhana untuk key-based dashboard/catalog reads

### 4.3 Tidak Memilih Shelby sebagai Event Store

Alasan:

- Shelby cocok untuk blob/media
- tidak cocok untuk event replay, cursor consumer, dan projection worker stream consumption

### 4.4 Tidak Memilih Queue Terpisah dari Event Bus

Alasan:

- JetStream sudah bisa menangani event consumption
- menambah queue lain sejak awal hanya menambah kompleksitas

## 5. Bounded Context dan Mapping Runtime

### 5.1 Auth Context

Publishes:

- `profile_created`
- `profile_updated`
- `creator_role_granted`

Reads:

- `profile_projection`

### 5.2 Creator Workflow Context

Publishes:

- `creator_application_submitted`
- `creator_application_approved`
- `creator_application_rejected`
- `course_created`
- `course_updated`
- `lesson_created`
- `lesson_updated`
- `lesson_published`
- `lesson_unpublished`

Reads:

- `creator_application_projection`
- `creator_dashboard_projection`

### 5.3 Media Context

Publishes:

- `lesson_source_uploaded`
- `media_asset_registered`
- `lesson_manifest_ready`

Reads:

- `lesson_projection`

### 5.4 Playback Context

Publishes:

- `playback_session_created`
- `progress_checkpoint_recorded`
- `lesson_completed`
- `qoe_event_recorded`

Reads:

- `lesson_projection`
- `entitlement_projection`

### 5.5 Revenue Context

Publishes:

- `payout_projected`
- `payout_settled`

Reads:

- `creator_dashboard_projection`
- `payout_projection`

## 6. Projection Key Design

Key naming yang disarankan:

```text
projection:catalog:course:{courseId}
projection:catalog:index:courses
projection:lesson:{lessonId}
projection:student-dashboard:{profileId}
projection:creator-dashboard:{profileId}
projection:creator-application:index:pending
projection:creator-application:index:approved
projection:entitlement:{userId}:{courseId}
projection:payout:{creatorProfileId}
projection:playback-session:{playbackSessionId}
```

Gunakan:

- string JSON untuk snapshot object
- set untuk index membership
- sorted set bila perlu ordering by updated time

## 7. Worker Topology

### 7.1 Projection Worker

Tugas:

- consume domain events
- update catalog projection
- update dashboard projection
- update creator application projection

### 7.2 Media Worker

Tugas:

- listen `lesson_source_uploaded`
- transcode video
- package HLS
- upload output ke Shelby
- emit `lesson_manifest_ready`

### 7.3 Analytics Worker

Tugas:

- consume `playback_session_created`
- consume `progress_checkpoint_recorded`
- consume `qoe_event_recorded`
- update creator metrics snapshot

### 7.4 Revenue Worker

Tugas:

- consume analytics/completion events
- hitung projected payout
- build payout snapshot
- emit `payout_projected`

## 8. Metadata Snapshot di Shelby

Format yang disarankan:

```text
courses/{courseId}/metadata/course.json
courses/{courseId}/lessons/{lessonId}/metadata/lesson.json
courses/{courseId}/lessons/{lessonId}/metadata/playback.json
courses/{courseId}/lessons/{lessonId}/thumbnails/poster.jpg
courses/{courseId}/lessons/{lessonId}/master.m3u8
```

Isi `course.json` minimum:

- `courseId`
- `creatorProfileId`
- `title`
- `description`
- `categoryId`
- `publishStatus`
- `lessonIds`
- `version`

Isi `lesson.json` minimum:

- `lessonId`
- `courseId`
- `title`
- `sourceAssetId`
- `streamAssetId`
- `manifestBlobKey`
- `processingStatus`
- `publishStatus`
- `durationSec`
- `version`

## 9. Proof Strategy

State yang disarankan untuk proof / anchor:

- creator approval
- creator ownership of course
- lesson publish proof
- payout settlement snapshot hash

State yang tidak perlu on-chain:

- progress checkpoint detail
- QoE detail
- dashboard snapshot
- course discovery projection

## 10. Development Mode

Untuk local/dev tanpa relational DB:

- JetStream lokal
- Valkey lokal
- Shelby dev/test environment
- worker processes lokal

Artinya local environment tetap menyerupai production Option B.

## 11. Cutover Prioritas

Urutan implementasi yang disarankan:

1. JetStream event publisher
2. Valkey projection adapter
3. projection worker untuk creator applications + payouts
4. creator content command cutover
5. catalog projection cutover
6. playback/progress/QoE event cutover
7. analytics worker
8. media worker
9. entitlement projection
10. revenue worker

## 12. Final Stack Summary

Stack final Option B:

- `Frontend / BFF`: Next.js + React + TypeScript
- `Auth / Wallet`: Aptos wallet challenge + signed session
- `Blob Storage`: Shelby Protocol
- `Event Store`: NATS JetStream
- `Projection Store`: Valkey / Redis-compatible KV
- `Workers`: Node.js worker processes consuming JetStream
- `Proof Layer`: Aptos signed proof / on-chain settlement anchor

Ini adalah stack yang saya rekomendasikan sebagai baseline resmi untuk Option B.
