# Architecture Option B - Vercel Now, VPS Later

Dokumen ini menetapkan plan implementasi Option B yang:

- **bisa dijalankan di Vercel-only untuk sekarang**
- tetap **selaras dengan narasi full web3**
- dan **mudah dipindahkan ke VPS** nanti tanpa bongkar kontrak aplikasi

Dokumen ini adalah turunan praktis dari:

- [architecture-option-b.md](./architecture-option-b.md)
- [architecture-option-b-stack.md](./architecture-option-b-stack.md)
- [architecture-option-b-cutover-plan.md](./architecture-option-b-cutover-plan.md)

## 1. Tujuan

Untuk fase sekarang, targetnya bukan langsung menjalankan stack final penuh.

Targetnya:

1. aplikasi tetap deployable di Vercel saja
2. tidak kembali ke MySQL/PostgreSQL
3. boundary arsitektur sudah benar:
   - command -> event
   - read -> projection
   - media -> Shelby
4. saat pindah ke VPS, kita cukup ganti adapter event/projection/worker

## 2. Constraint Nyata di Vercel

Karena runtime awal adalah `Vercel-only`, ada batasan penting:

- tidak ada worker process long-running milik kita sendiri
- background processing harus dibatasi ke:
  - route handlers
  - cron jobs
  - external managed services
- Vercel KV lama tidak lagi jadi opsi baru; untuk Redis harus lewat provider Marketplace / external Redis
- cron jobs di Vercel memanggil HTTP endpoint, bukan daemon internal

Jadi desain awal harus:

- serverless-friendly
- idempotent
- bisa diproses per-batch kecil

## 3. Stack yang Dipakai Sekarang di Vercel

### 3.1 Event Store

Gunakan:

- `Upstash Redis Streams` lewat Redis integration yang terhubung ke Vercel

Kenapa:

- bisa dipakai dari Vercel Function
- mendukung append-only stream
- mendukung consumer semantics sederhana
- mudah diganti ke JetStream nanti

Boundary aplikasi tetap pakai interface:

- `appendEvent`
- `appendEvents`
- `readEventsByAggregate`
- `readEventsByType`
- `readEventsFromCursor`

Jadi nanti saat pindah ke VPS:

- adapter `UpstashRedisEventStore` diganti ke `JetStreamEventStore`
- contract aplikasi tidak berubah

### 3.2 Projection Store

Gunakan:

- `Upstash Redis` yang sama, tetapi keyspace dipisah untuk projection

Contoh keyspace:

```text
stream:events:*
stream:projection:catalog:*
stream:projection:lesson:*
stream:projection:creator-dashboard:*
stream:projection:student-dashboard:*
stream:projection:entitlement:*
stream:projection:payout:*
stream:projection:creator-application:*
```

Kenapa:

- sederhana
- cepat
- cocok untuk projection snapshot
- tidak menambah service baru di fase awal

Saat pindah ke VPS:

- tetap bisa lanjut di Valkey/Redis
- atau tetap memakai provider managed jika tidak mau mengoperasikan sendiri

### 3.3 Worker / Queue Runtime

Gunakan:

- `Vercel Cron Jobs`
- endpoint internal `/api/internal/projections/*`
- endpoint internal `/api/internal/jobs/*`

Model kerjanya:

1. command route append event
2. command route bisa trigger lightweight projection update sinkron untuk UX cepat
3. cron job memanggil processor endpoint untuk catch-up / replay batch

Jadi worker awal bukan daemon, tetapi:

- serverless batch processors
- dipanggil berkala oleh cron

Saat pindah ke VPS:

- endpoint internal ini dipindah jadi worker process / JetStream consumer permanen
- logic projector tetap dipakai ulang

### 3.4 Blob / Media Storage

Tetap:

- `Shelby Protocol`

Tidak berubah saat dari Vercel ke VPS.

### 3.5 Proof Layer

Tetap:

- `Aptos signed proof`
- optional `on-chain anchor` untuk settlement/publish/approval

Tidak perlu diubah saat migrasi runtime.

## 4. Keputusan Final untuk Fase Vercel

Jadi untuk **fase sekarang**, stack final yang benar-benar dipakai adalah:

- `Frontend / BFF`: Next.js di Vercel
- `Event Store`: Upstash Redis Streams
- `Projection Store`: Upstash Redis keys/hashes/sets
- `Worker Runtime`: Vercel Cron + internal batch processing routes
- `Blob Storage`: Shelby Protocol
- `Proof Layer`: Aptos signed proof / hash anchor

Untuk **fase nanti di VPS**, target migrasinya:

- `Event Store`: NATS JetStream
- `Projection Store`: Valkey/Redis self-hosted atau managed
- `Worker Runtime`: Node.js long-running workers + JetStream consumers
- `Blob Storage`: Shelby tetap
- `Proof Layer`: tetap

## 5. Arsitektur Boundary yang Harus Dijaga dari Sekarang

Supaya migrasi ke VPS nanti murah, codebase harus dipisah seperti ini:

### 5.1 Event Store Boundary

Folder:

```text
lib/event-store/
  event-store.ts
  upstash-event-store.ts
  jetstream-event-store.ts
  index.ts
```

Rule:

- route/API hanya tahu `EventStore`
- jangan ada import langsung library Upstash di business logic

### 5.2 Projection Store Boundary

Folder:

```text
lib/projection-store/
  projection-store.ts
  upstash-projection-store.ts
  redis-projection-store.ts
  index.ts
```

Rule:

- projector hanya tahu `ProjectionStore`
- jangan hardcode Redis command di page/API layer

### 5.3 Job Runtime Boundary

Folder:

```text
lib/jobs/
  projection-runner.ts
  analytics-runner.ts
  revenue-runner.ts
  media-runner.ts
```

Rule:

- logic runner harus reusable
- Vercel cron route hanya memanggil runner
- saat pindah ke VPS, runner dipanggil worker process, bukan HTTP route

## 6. Flow Operasional di Vercel Sekarang

### 6.1 Command Flow

1. user hit route handler
2. route validate request
3. route append event ke Redis Stream
4. route optionally update small projection sinkron
5. route return response

### 6.2 Projection Catch-up Flow

1. Vercel cron panggil `/api/internal/projections/run`
2. route baca event dari cursor terakhir
3. route jalankan projector batch kecil
4. route simpan cursor baru ke projection store

### 6.3 Media Flow

1. creator upload source
2. route simpan metadata event `lesson_source_uploaded`
3. route atau cron trigger processing orchestration
4. hasil upload/manifest ke Shelby
5. event `lesson_manifest_ready`
6. projection update lesson status

Catatan:

- kalau transcode berat tidak realistis dikerjakan di Vercel Function, processing berat harus di-offload ke external media worker lebih cepat daripada menunggu migrasi penuh ke VPS

### 6.4 Analytics / Revenue Flow

1. playback/progress/QoE append event
2. cron menjalankan analytics batch
3. analytics projection diupdate
4. revenue batch menghitung payout projection
5. payout projection diupdate

## 7. Batas Aman Vercel-Only

Vercel-only cocok untuk:

- command throughput masih rendah sampai menengah
- projection batch kecil
- creator count masih terbatas
- media processing berat belum masif

Vercel-only mulai tidak ideal kalau:

- event volume tinggi
- QoE sangat ramai
- progress event sangat banyak
- transcode harus sering dan berat
- payout batch makin kompleks

Jadi dari awal, kita harus menerima:

- Vercel-only adalah **deployment mode transisi**
- bukan bentuk akhir arsitektur

## 8. Trigger untuk Pindah ke VPS

Migrasi ke VPS sebaiknya dipicu saat salah satu kondisi ini muncul:

1. cron Vercel mulai jadi bottleneck
2. projection lag makin tinggi
3. media processing berat terlalu sering timeout
4. revenue batch butuh proses panjang
5. biaya external managed services lebih mahal dari self-hosted

## 9. Fase Implementasi yang Disarankan

### Phase V1

Implement sekarang:

- `EventStore` interface
- `ProjectionStore` interface
- adapter Upstash Redis
- cron-based projection runner

### Phase V2

Lanjut:

- creator application projection
- payout projection
- creator content event-first

### Phase V3

Lanjut:

- catalog projection
- lesson projection
- dashboard projection

### Phase V4

Lanjut:

- progress/QoE stream
- analytics runner
- revenue runner

### Phase V5

Saat siap pindah:

- tambahkan `JetStreamEventStore`
- tambahkan worker runtime non-HTTP
- ganti deployment topology ke VPS

## 10. Hal yang Jangan Dilakukan

1. Jangan pakai MySQL sementara “biar gampang dulu”.
2. Jangan campur event store dan projection store tanpa boundary adapter.
3. Jangan taruh logic projector di page route langsung.
4. Jangan pakai Shelby untuk event/query.
5. Jangan hardcode Upstash di business logic.

## 11. Decision

Plan resmi yang saya rekomendasikan:

### Sekarang di Vercel

- `Event Store`: Upstash Redis Streams
- `Projection Store`: Upstash Redis
- `Workers`: Vercel Cron + internal processor routes
- `Blob`: Shelby
- `Proof`: Aptos signed proof / anchor

### Nanti di VPS

- `Event Store`: NATS JetStream
- `Projection Store`: Valkey/Redis
- `Workers`: Node.js long-running workers
- `Blob`: Shelby
- `Proof`: tetap

### Kontrak yang harus tetap stabil

- `DomainEvent`
- `EventStore`
- `ProjectionStore`
- `ProjectionRunner`
- `MediaRunner`
- `RevenueRunner`

Kalau boundary ini dijaga dari sekarang, migrasi ke VPS nanti adalah **ganti adapter dan deployment topology**, bukan rewrite arsitektur.

## 12. Referensi Resmi

Dasar keputusan Vercel plan ini:

- Vercel Cron Jobs: https://vercel.com/docs/cron-jobs
- Vercel Cron usage/pricing: https://vercel.com/docs/cron-jobs/usage-and-pricing
- Vercel Redis integration note: https://vercel.com/docs/redis
- Vercel Blob docs: https://vercel.com/docs/vercel-blob
