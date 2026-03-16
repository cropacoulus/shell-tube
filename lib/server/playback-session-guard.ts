import type { PlaybackSessionRecord } from "../contracts/activity.ts";
import type { AuthContext } from "../auth/types.ts";

export function canBootstrapPlaybackSession(input: {
  session: PlaybackSessionRecord | null;
  auth: AuthContext;
  titleId: string;
}): { ok: true } | { ok: false; status: 403 | 404 | 422; code: string; message: string } {
  const { session, auth, titleId } = input;
  if (!session) {
    return {
      ok: false,
      status: 404,
      code: "NOT_FOUND",
      message: "Playback session not found",
    };
  }
  if (session.userId !== auth.userId || session.profileId !== auth.profileId) {
    return {
      ok: false,
      status: 403,
      code: "FORBIDDEN",
      message: "Playback session does not belong to the current user",
    };
  }
  if (session.lessonId !== titleId && session.courseId !== titleId) {
    return {
      ok: false,
      status: 422,
      code: "INVALID_REQUEST",
      message: "Playback session does not match the requested title",
    };
  }
  return { ok: true };
}
