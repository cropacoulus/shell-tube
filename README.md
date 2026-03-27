# Verra

Creator-first video course platform architecture for Verra, built around Next.js, Shelby Protocol storage, HLS playback, PostgreSQL metadata, and FFmpeg video processing.

## Platform Focus
- Educational video courses instead of mass entertainment streaming.
- Creator monetization through course purchases, subscriptions, and direct tips.
- Transparent revenue distribution backed by watch metrics and payout ledgers.
- Lesson-based playback with resumable progress and creator analytics.

## Target Stack
- `Next.js` with App Router
- `TailwindCSS`
- `Shelby Protocol` decentralized storage
- `HLS` video streaming with `hls.js`
- `PostgreSQL` for metadata, progress, entitlements, analytics, and revenue
- `FFmpeg` for transcoding and HLS segmentation

## Key Roles
- `Student`: browse courses, purchase access, watch lessons, track progress
- `Creator`: publish courses, upload lessons, view analytics, earn revenue
- `Admin`: moderate content and manage payouts

## Core Architecture Deliverables
- Updated system architecture diagram: [docs/system-architecture.md](/Users/rifqi/Development/Pribadi/Crypto/stream-p2p/docs/system-architecture.md)
- Service architecture for catalog, entitlement, billing, analytics, and payouts
- Next.js App Router folder blueprint for course, lesson, dashboard, creator, and API surfaces
- PostgreSQL schema for users, courses, lessons, enrollments, purchases, watch progress, creator revenue, and creator analytics
- FFmpeg to HLS to Shelby video pipeline
- Streaming delivery model for Shelby-hosted lesson manifests
- Creator dashboard architecture with transparent revenue reporting

## Video Asset Layout

```text
courses/{courseId}/lessons/{lessonId}/
  master.m3u8
  1080p.m3u8
  720p.m3u8
  segments/*.ts
```

## Monetization Models
- `Course purchase`: one-time purchase, example split `70% creator / 30% platform`
- `Subscription pool`: monthly creator distribution based on entitled watch time share
- `Tips`: direct fan support, example split `95% creator / 5% platform`

Subscription revenue formula:

```text
watch_time_share = creator_watch_time / total_platform_watch_time
creator_subscription_payout = subscription_pool_net * watch_time_share
```

## Playback Access Rules
- Student can stream paid lessons if they purchased the course.
- Student can stream eligible lessons if they have an active subscription.
- Preview lessons can remain public.
- Lesson playback should validate entitlement before returning Shelby manifest access.

## Notes
- The current repo still contains earlier streaming-oriented implementation paths such as `/watch` and admin upload flows.
- The architecture document is the updated source of truth for the course-platform refactor direction.
