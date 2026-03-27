# Architecture Option B - Media Pipeline Contract

Dokumen ini menjelaskan kontrak operasional untuk media pipeline creator pada Option B.

Scope dokumen ini:

- `source upload -> packaging requested -> manifest ready -> publish`
- route internal yang bisa dipanggil cron atau worker eksternal
- payload callback dari packager ke aplikasi

Dokumen ini melengkapi:

- [architecture-option-b.md](./architecture-option-b.md)
- [architecture-option-b-vercel-plan.md](./architecture-option-b-vercel-plan.md)
- [architecture-option-b-vercel-env.md](./architecture-option-b-vercel-env.md)

## 1. State Lifecycle Lesson

Lesson sekarang bergerak melalui state berikut:

1. `metadata only`
   draft sudah ada, tapi belum punya source asset
2. `source uploaded`
   source video sudah attached ke lesson
3. `packaging requested`
   creator sudah mendorong draft ke queue packaging
4. `manifest ready`
   manifest `.m3u8` sudah attached ke lesson
5. `live`
   lesson sudah published

Catatan:

- `publish` hanya valid saat lesson sudah `manifest ready`
- `packaging requested` bukan berarti manifest sudah ada

## 2. Route yang Terlibat

### 2.1 Creator Source Upload

Route:

- `POST /api/v1/storage/ingest`

Efek:

- append `media_asset_registered`
- append `lesson_asset_attached` untuk source video
- projection lesson menyimpan `streamAssetId`

### 2.2 Creator Request Packaging

Route:

- `POST /api/v1/creator/content/process`

Payload:

```json
{
  "courseId": "course_xxx",
  "lessonId": "lesson_xxx"
}
```

Validasi:

- user harus `creator` atau `admin`
- user harus owner course jika bukan admin
- lesson harus punya `streamAssetId`
- lesson belum boleh punya `manifestBlobKey`

Efek:

- append `lesson_processing_requested`
- projection lesson menjadi `packaging_requested`

### 2.3 Internal Batch Scanner

Route:

- `GET /api/internal/media/process/run?limit=20`

Auth:

- `Authorization: Bearer ${CRON_SECRET}`

Fungsi:

- scan lesson yang `packaging_requested`
- mode default `manual-pending`: hanya lapor pending jobs
- mode opsional `mock-manifest`: emit manifest event otomatis untuk dev/demo

### 2.4 External Packager Callback

Route:

- `POST /api/internal/media/process/complete`

Auth:

- `Authorization: Bearer ${CRON_SECRET}`

Payload minimum:

```json
{
  "lessonId": "lesson_xxx"
}
```

Payload penuh:

```json
{
  "lessonId": "lesson_xxx",
  "courseId": "course_xxx",
  "manifestBlobKey": "lesson_xxx/manifests/master.m3u8"
}
```

Perilaku:

- lookup lesson dari projection
- validasi bahwa source asset sudah ada
- jika manifest sudah attached, return sukses idempotent
- jika belum, append:
  - `media_asset_registered`
  - `lesson_manifest_attached`
- jalankan projection batch

## 3. Event Contract yang Relevan

### 3.1 Source Asset

```json
{
  "type": "lesson_asset_attached",
  "aggregateType": "lesson",
  "aggregateId": "lesson_xxx",
  "payload": {
    "lessonId": "lesson_xxx",
    "courseId": "course_xxx",
    "streamAssetId": "asset_source_xxx",
    "updatedAt": "2026-03-27T10:00:00.000Z"
  }
}
```

### 3.2 Packaging Requested

```json
{
  "type": "lesson_processing_requested",
  "aggregateType": "lesson",
  "aggregateId": "lesson_xxx",
  "payload": {
    "lessonId": "lesson_xxx",
    "courseId": "course_xxx",
    "updatedAt": "2026-03-27T10:05:00.000Z"
  }
}
```

### 3.3 Manifest Ready

```json
{
  "type": "lesson_manifest_attached",
  "aggregateType": "lesson",
  "aggregateId": "lesson_xxx",
  "payload": {
    "lessonId": "lesson_xxx",
    "courseId": "course_xxx",
    "manifestBlobKey": "lesson_xxx/manifests/master.m3u8",
    "streamAssetId": "asset_manifest_xxx",
    "updatedAt": "2026-03-27T10:12:00.000Z"
  }
}
```

## 4. Tanggung Jawab Packager Eksternal

Packager eksternal tidak perlu memahami seluruh domain aplikasi.

Yang perlu dilakukan:

1. ambil job yang `packaging_requested`
2. baca source asset lesson dari Shelby atau source metadata lain
3. jalankan transcode / HLS packaging
4. upload `master.m3u8` dan artifact terkait ke Shelby
5. panggil callback `POST /api/internal/media/process/complete`

Minimal input yang dibutuhkan packager:

- `lessonId`
- `courseId`
- `sourceAssetId`

Minimal output yang harus dikembalikan ke app:

- `lessonId`
- `manifestBlobKey`

## 5. Mode Operasional

### 5.1 Manual Pending

Env:

```env
OPTION_B_MEDIA_PIPELINE_MODE=manual-pending
```

Mode ini dipakai untuk production awal atau saat packager belum siap.

Artinya:

- app tetap bisa menerima source upload
- creator tetap bisa request packaging
- scanner internal hanya mengembalikan daftar pending job
- manifest tetap harus datang dari worker eksternal atau upload manual

### 5.2 Mock Manifest

Env:

```env
OPTION_B_MEDIA_PIPELINE_MODE=mock-manifest
```

Mode ini hanya untuk dev/demo.

Artinya:

- scanner internal bisa langsung emit `lesson_manifest_attached`
- tidak ada transcode sungguhan
- tidak cocok untuk production

## 6. Env yang Perlu Disiapkan

Tambahan env:

```env
OPTION_B_MEDIA_PIPELINE_MODE=manual-pending
CRON_SECRET=...
```

Kalau memakai worker eksternal:

- worker harus tahu base URL aplikasi
- worker harus tahu `CRON_SECRET`

## 7. Urutan Operasional Recommended

Fase sekarang:

1. creator upload source
2. creator request packaging
3. worker eksternal memoll atau menerima daftar pending jobs
4. worker generate HLS manifest
5. worker callback ke `/api/internal/media/process/complete`
6. creator publish

Fase berikutnya:

1. job dispatcher dedicated
2. queue real-time
3. packaging status detail
4. failure event seperti `lesson_processing_failed`

## 8. Known Gap

Yang belum ada sekarang:

- event `lesson_processing_failed`
- retry policy
- projection untuk `failed reason`
- queue dedicated di luar cron scan
- ownership proof untuk artifact packaging

Namun fondasi utama sudah ada:

- source attach persisted
- packaging request persisted
- callback manifest ready persisted
- publish gate tetap aman
