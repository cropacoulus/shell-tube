import type {
  PlaybackTokenRequest,
  PlaybackTokenResponse,
} from "@/lib/contracts/playback";
import { listVideos } from "@/lib/server/data-store";
import { requestJson, ServiceError } from "@/lib/services/http-client";
import {
  getInternalBlobReadPath,
} from "@/lib/services/shelby-storage-client";
import { allowMockFallback } from "@/lib/services/runtime";

export async function createPlaybackSession(
  payload: PlaybackTokenRequest,
): Promise<PlaybackTokenResponse> {
  const baseUrl = process.env.PLAYBACK_SERVICE_URL;
  const token = process.env.SERVICE_AUTH_TOKEN;
  if (!baseUrl && !allowMockFallback()) {
    throw new ServiceError("playback", 503, "Playback service is not configured");
  }
  if (!baseUrl) {
    let manifestUrl = `https://cdn.example.com/manifests/${payload.titleId}/master.m3u8`;
    try {
      if (process.env.SHELBY_RPC_URL) {
        const customVideo = (await listVideos()).find((item) => item.id === payload.titleId);
        if (customVideo && !customVideo.manifestBlobKey.trim()) {
          throw new ServiceError(
            "playback",
            422,
            "Video stream is not ready: upload asset to Shelby and save stream key first.",
          );
        }
        if (customVideo?.manifestBlobKey) {
          manifestUrl = getInternalBlobReadPath(customVideo.manifestBlobKey);
        }
      }
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      // Keep CDN fallback for development when Shelby RPC is not configured.
    }

    return {
      playbackSessionId: `ps_${crypto.randomUUID()}`,
      token: `mock_token_${crypto.randomUUID()}`,
      expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
      manifestUrl,
      drm: {
        scheme: "widevine",
        licenseServerUrl: "https://license.example.com/widevine",
      },
      featureFlags: {
        shelbyEnabled: true,
      },
    };
  }

  return requestJson<PlaybackTokenResponse>({
    service: "playback",
    baseUrl,
    token,
    path: "/v1/playback/sessions",
    method: "POST",
    body: payload,
  });
}
