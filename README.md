# Stream P2P

Netflix-style streaming app built with Next.js + Aptos wallet auth + Shelby storage flow.

## Current Features
- Wallet sign-in (`/signin`) using Aptos wallet adapter + challenge signature.
- JWT cookie session and admin role from `ADMIN_WALLETS`.
- Admin dashboard (`/admin`) for category/video management and video upload.
- Shelby upload flow:
  1. Register blob metadata on L1 (wallet-signed tx).
  2. Upload blob bytes server-side to Shelby RPC (`/api/v1/storage/ingest`).
- Watch page (`/watch/[titleId]`) with:
  - HLS playback + ABR telemetry
  - Shelby adapter events
  - custom responsive controls (icons, skip 10s, speed, fullscreen, volume)
  - mobile double-tap left/right skip
  - auto-hide controls while playing

## Routes
- User: `/`, `/watch/[titleId]`, `/profile`
- Auth: `/signin`
- Admin: `/admin` (wallet must be listed in `ADMIN_WALLETS`)

## Environment Variables

Copy `.env.example` to `.env` and fill values:

```bash
AUTH_JWT_SECRET=replace-with-strong-random-secret
ADMIN_WALLETS=0x_your_admin_wallet_address
NEXT_PUBLIC_APTOS_NETWORK=testnet
SHELBY_RPC_URL=https://api.testnet.shelby.xyz/shelby
SHELBY_API_KEY=replace-with-geomi-server-key
```

Notes:
- Use server key (`SHELBY_API_KEY`) from Geomi/Shelby provider.
- Upload is server-side; no frontend Shelby API key is required.
- `NEXT_PUBLIC_APTOS_NETWORK` should match wallet network.

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Upload & Stream Flow (Admin)
1. Sign in with admin wallet.
2. Open `/admin`.
3. Upload video/manifest from file input.
4. App performs L1 register tx from wallet.
5. Server uploads bytes to Shelby RPC.
6. Create video entry and watch on `/watch/[titleId]`.

## Troubleshooting
- `Blob ... has not been registered onto the L1`:
  - L1 register transaction has not succeeded yet. Re-run upload and confirm wallet tx.
- `Unauthorized: API key not found`:
  - `SHELBY_API_KEY` is missing/invalid.
- `Invalid Aptos address`:
  - Ensure signed-in wallet address is valid and session is active.
- Wallet verification error:
  - Make sure wallet network matches `NEXT_PUBLIC_APTOS_NETWORK`.

## Key Files
- `app/watch/[titleId]/stream-player.tsx`: custom streaming player UI/UX.
- `app/admin/admin-client.tsx`: admin upload + L1 register trigger.
- `app/api/v1/storage/ingest/route.ts`: server-side Shelby ingest endpoint.
- `lib/services/shelby-storage-client.ts`: Shelby RPC multipart upload/read client.
- `lib/storage/blob-path.ts`: shared blob path builder.
