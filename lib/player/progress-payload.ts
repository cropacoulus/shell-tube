export type ProgressPayload = {
  lessonId: string;
  progressPercent: number;
  lastPositionSec: number;
};

export function buildProgressPayload(input: {
  lessonId: string;
  currentSec: number;
  durationSec: number;
}): ProgressPayload {
  const safeCurrent = Math.max(0, Math.round(input.currentSec));
  const safeDuration = Math.max(0, input.durationSec);
  const progressPercent =
    safeDuration > 0 ? Math.min(100, Math.max(0, Math.round((safeCurrent / safeDuration) * 100))) : 0;

  return {
    lessonId: input.lessonId,
    progressPercent,
    lastPositionSec: safeCurrent,
  };
}
