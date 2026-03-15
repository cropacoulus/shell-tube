# Stream P2P

Netflix-style streaming platform blueprint using Next.js (App Router) and Shelby protocol.

This repository contains:
- System architecture blueprint for control plane + media plane.
- Typed contracts for playback, Shelby bootstrap, and QoE events.
- Initial BFF API routes to serve as integration points for backend services.
- `/watch/[titleId]` real HLS player with ABR telemetry and Shelby adapter events.
- Wallet-based sign-in (Aptos wallet adapter challenge/signature) with JWT session cookies.
- Shelby RPC storage integration for movie ingest/read URLs.
- Sticky Netflix-style navbar with wallet profile avatar.
- Split UI: user experience (`/`, `/watch`, `/profile`) and admin studio dashboard (`/admin`).

## Getting Started

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## Blueprint Files
- `docs/system-architecture.md`: end-to-end system design and rollout phases.
- `lib/contracts/*.ts`: DTO contracts shared by client/BFF/services.
- `lib/services/*.ts`: real HTTP service clients with env-based routing and timeout/error handling.
- `app/api/v1/playback/token/route.ts`: playback session token endpoint.
- `app/api/v1/shelby/bootstrap/route.ts`: Shelby swarm bootstrap endpoint.
- `app/api/v1/qoe/events/route.ts`: QoE telemetry ingestion endpoint.

## Service Environment Variables

Set these to use real upstream services (otherwise local mock fallback is used for development):

```bash
CATALOG_SERVICE_URL=
RECOMMENDATION_SERVICE_URL=
ENTITLEMENT_SERVICE_URL=
PLAYBACK_SERVICE_URL=
SHELBY_COORDINATOR_URL=
ANALYTICS_SERVICE_URL=
SERVICE_AUTH_TOKEN=
AUTH_JWT_SECRET=
APP_ENV=development
SERVICE_STRICT_MODE=false
ALLOW_MOCK_FALLBACK=true
SHELBY_RPC_URL=
SHELBY_RPC_READ_PATH=/v1/blobs
SHELBY_RPC_WRITE_PATH=/v1/blobs
SHELBY_RPC_API_KEY=
WALLET_SIGNIN_STATEMENT=Sign this message to authenticate with Shelby Stream.
ADMIN_WALLETS=
NEXT_PUBLIC_SHELBY_API_KEY=
NEXT_PUBLIC_APTOS_NETWORK=testnet
```

- `APP_ENV`: `development | staging | production`
- `SERVICE_STRICT_MODE`: force strict upstream mode (`true`) or allow fallback (`false`)
- `ALLOW_MOCK_FALLBACK`: fallback switch for local development
- `SHELBY_RPC_*`: RPC endpoint/path config used for Shelby storage provider reads/writes
- `ADMIN_WALLETS`: comma-separated Aptos wallet addresses that receive admin role after sign-in
- `NEXT_PUBLIC_SHELBY_API_KEY`: API key used by Shelby React `useUploadBlobs` hook

## Wallet Sign-In
1. Open `/signin`.
2. Connect your Aptos wallet (Petra/Martian/etc).
3. Sign the challenge message.
4. Session cookie is issued after signature verification.

## Shelby Movie Ingest
Use `POST /api/v1/storage/ingest` to store assets into Shelby storage providers via Shelby RPC.

Example payload:
```json
{
  "titleId": "t_100",
  "fileName": "master.m3u8",
  "contentType": "application/vnd.apple.mpegurl",
  "dataBase64": "IyNFWFRN..."
}
```

## UI Routes
- User: `/`, `/watch/[titleId]`, `/profile`
- Admin: `/admin` (requires wallet listed in `ADMIN_WALLETS`)

## API Examples

### Request playback token

```bash
curl -X POST http://localhost:3000/api/v1/playback/token \
  -H "content-type: application/json" \
  -d '{
    "titleId":"t_100",
    "region":"ID",
    "deviceClass":"desktop"
  }'
```

### Bootstrap Shelby session

```bash
curl -X POST http://localhost:3000/api/v1/shelby/bootstrap \
  -H "content-type: application/json" \
  -d '{
    "playbackSessionId":"ps_1",
    "titleId":"t_100",
    "region":"ID",
    "deviceClass":"desktop",
    "networkType":"wifi",
    "maxPeers":2
  }'
```

### Send QoE events

```bash
curl -X POST http://localhost:3000/api/v1/qoe/events \
  -H "content-type: application/json" \
  -d '{
    "events":[
      {
        "type":"startup",
        "eventTs":"2026-03-15T10:00:00.000Z",
        "playbackSessionId":"ps_1",
        "titleId":"t_100",
        "positionMs":0,
        "deviceId":"web_1"
      }
    ]
  }'
```

## Next Build Steps
1. Harden wallet auth with server-side Aptos signature verification and Redis nonce storage.
2. Wire watch progress persistence for continue-watching from playback checkpoints.
3. Integrate real Shelby data-plane transport (WebRTC/quic) behind `ShelbyAdapter`.
4. Persist QoE to your event bus and wire SLO dashboards.

## Tech Notes
- Framework: Next.js 16 + React 19 + TypeScript.
- Current route implementations intentionally return mock data for integration scaffolding.
