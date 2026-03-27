import type {
  PlaybackTokenRequest,
  PlaybackTokenResponse,
} from "@/lib/contracts/playback";
import { getPublishedLessonFromProjection } from "@/lib/projections/lesson-read-model";
import { getContentRepository } from "@/lib/repositories";
import { createOptionBConfig } from "@/lib/runtime/option-b-config";
import { buildPlaybackContext } from "@/lib/server/playback-context";
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
    let lessonId: string | undefined;
    let courseId: string | undefined;
    try {
      const lesson =
        createOptionBConfig().projectionStoreBackend === "upstash"
          ? await getPublishedLessonFromProjection(payload.titleId)
          : await getContentRepository().getLessonRecordById(payload.titleId);
      if (!lesson || lesson.publishStatus !== "published") {
        throw new ServiceError("playback", 404, "Lesson is not available for playback.");
      }
      const playbackContext = buildPlaybackContext(lesson);
      lessonId = playbackContext.lessonId;
      courseId = playbackContext.courseId;
      if (!playbackContext.manifestBlobKey.trim()) {
        throw new ServiceError(
          "playback",
          422,
          "Lesson stream is not ready: upload the Verra media asset and save the stream key first.",
        );
      }
      if (process.env.SHELBY_RPC_URL) {
        manifestUrl = getInternalBlobReadPath(playbackContext.manifestBlobKey);
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
      lessonId,
      courseId,
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
