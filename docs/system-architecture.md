# Stream P2P System Architecture Blueprint

## 1) Product Scope
- Netflix-style VOD platform with personalized browsing, resilient playback, and device support.
- Next.js is the presentation and BFF layer.
- Shelby protocol provides peer-assisted segment delivery to reduce CDN load while preserving QoE.

## 2) Architecture Overview

### Client and Edge
- `Web App (Next.js App Router)`: browse UI, player shell, account pages.
- `Playback Client`: HLS/DASH player with ABR, Shelby peer adapter, QoE telemetry emitter.
- `Edge CDN`: baseline media segment delivery and manifest caching.

### BFF and Control Plane
- `Next.js API Routes`: auth/session, playback token, Shelby bootstrap, QoE ingest.
- `Shelby Coordinator`: tracker/signaling registry, peer policy, swarm admission.
- `Entitlement Service`: plan and region checks before playback.

### Data and Media Plane
- `Catalog Service`: title metadata, artwork, taxonomy.
- `Recommendation Service`: personalized rails and ranking.
- `Playback Service`: session lifecycle and enforcement.
- `Transcode + Packager`: ladder renditions and manifests.
- `Shelby RPC + Storage Providers`: media files, subtitles, manifests, keyframes.
- `Redis`: hot caches and short-lived session state.
- `Postgres`: accounts, profiles, subscription records.
- `Event Bus + Warehouse`: QoE analytics, rec features, experiments.

## 3) Main Flows

### A) Browse Flow
1. User opens home page.
2. Next.js server fetches rails from catalog/recommendation services.
3. Page renders with ISR/SSR and per-user personalization.

### B) Playback Start
1. Player requests playback token from BFF.
2. BFF validates auth + entitlement + geo policy.
3. BFF returns signed playback session token and manifest URL.
4. Player requests Shelby bootstrap for swarm config.
5. Player fetches segments from peers first, then CDN fallback on miss/latency.

### C) QoE Telemetry
1. Player sends startup, rebuffer, bitrate switch, fatal error events.
2. BFF validates and forwards to event bus.
3. Analytics derives SLO signals and Shelby policy adjustments.

## 4) Shelby Protocol in This Architecture
- `Control channel`: bootstrap session, tracker list, allowed peers, per-session policy.
- `Data channel`: encrypted segment chunk transfer over P2P transport.
- `Storage channel`: Shelby RPC routes blob reads/writes to decentralized storage providers.
- `Integrity`: chunk hash verification before decode.
- `Scheduling`: rarest-first with low-latency neighborhood bias.
- `Safety`: signed requests, peer reputation score, dynamic disable switch per region/device.

## 5) Suggested Next.js Folder Blueprint

```text
app/
  (browse)/
    page.tsx
    title/[id]/page.tsx
  watch/[titleId]/page.tsx
  api/v1/
    playback/token/route.ts
    shelby/bootstrap/route.ts
    qoe/events/route.ts
lib/
  contracts/
    common.ts
    playback.ts
    shelby.ts
    qoe.ts
  services/
    catalog-client.ts
    recommendation-client.ts
    entitlement-client.ts
    shelby-coordinator-client.ts
```

## 6) SLO Targets (Initial)
- Playback start time p95: <= 2.5s.
- Rebuffer ratio p95: <= 1.0%.
- Fatal playback error rate: < 0.3%.
- Shelby hit ratio (eligible sessions): >= 35% without QoE regression.

## 7) Rollout Strategy
1. CDN-only playback with auth, catalog, and playback token flow.
2. Add QoE telemetry and dashboards.
3. Enable Shelby behind feature flag for selected regions/devices.
4. Expand Shelby eligibility based on SLO pass rates.
