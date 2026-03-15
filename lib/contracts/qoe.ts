export type QoeEventType =
  | "startup"
  | "rebuffer_start"
  | "rebuffer_end"
  | "bitrate_change"
  | "fatal_error"
  | "playback_end";

export type QoeEvent = {
  type: QoeEventType;
  eventTs: string;
  playbackSessionId: string;
  titleId: string;
  positionMs: number;
  bitrateKbps?: number;
  rebufferMs?: number;
  peerHitRatio?: number;
  errorCode?: string;
  deviceId: string;
};

export type QoeEventsIngestRequest = {
  events: QoeEvent[];
};

export type QoeEventsIngestResponse = {
  accepted: number;
  dropped: number;
};
