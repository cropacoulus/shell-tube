"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from "react";
import type Hls from "hls.js";

import type { DeviceClass, NetworkType } from "@/lib/contracts/common";
import type { PlaybackTokenResponse } from "@/lib/contracts/playback";
import type { QoeEvent, QoeEventsIngestRequest } from "@/lib/contracts/qoe";
import type { ShelbyBootstrapResponse } from "@/lib/contracts/shelby";
import { buildProgressPayload } from "@/lib/player/progress-payload";
import { ShelbyAdapter } from "@/lib/player/shelby-adapter";

type StreamPlayerProps = {
  titleId: string;
  region: string;
};

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function detectDeviceClass(): DeviceClass {
  if (typeof window === "undefined") return "desktop";
  const width = window.innerWidth;
  if (width < 640) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}

function detectNetworkType(): NetworkType {
  if (typeof navigator === "undefined") return "unknown";
  const nav = navigator as Navigator & {
    connection?: { type?: string };
  };
  const type = nav.connection?.type ?? "unknown";
  if (type === "wifi" || type === "cellular" || type === "ethernet") return type;
  return "unknown";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function formatClock(totalSeconds: number) {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return "00:00";
  const sec = Math.floor(totalSeconds % 60);
  const min = Math.floor((totalSeconds / 60) % 60);
  const hour = Math.floor(totalSeconds / 3600);
  if (hour > 0) {
    return `${hour}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function IconPlay() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function IconPause() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
      <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
    </svg>
  );
}

function IconFullscreen() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
      <path d="M7 14H5v5h5v-2H7v-3zm0-4h2V7h3V5H5v5zm10 7h-3v2h5v-5h-2v3zm0-12V5h-5v2h3v3h2V5z" />
    </svg>
  );
}

function IconExitFullscreen() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
      <path d="M8 16h3v3h2v-5H8v2zm-3 3h5v-2H7v-3H5v5zm14-5h-5v5h2v-3h3v-2zm-3-9v3h-2V5h-5v2h3v3h2V7h3V5z" />
    </svg>
  );
}

function IconVolume({ muted }: { muted: boolean }) {
  if (muted) {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
        <path d="M3 9v6h4l5 5V4L7 9H3zm13.59 3 2.7 2.7-1.41 1.41-2.7-2.7-2.7 2.7-1.41-1.41 2.7-2.7-2.7-2.7 1.41-1.41 2.7 2.7 2.7-2.7 1.41 1.41-2.7 2.7z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1-3.29-2.5-4.03v8.05A4.49 4.49 0 0016.5 12z" />
    </svg>
  );
}

function IconReplay10() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
      <path d="M12 5V2L7 6l5 4V7c2.76 0 5 2.24 5 5a5 5 0 01-9.8 1.5H5.14A7 7 0 0012 19a7 7 0 000-14z" />
      <text x="12" y="15" textAnchor="middle" fontSize="6" fontWeight="700" fill="currentColor">
        10
      </text>
    </svg>
  );
}

function IconForward10() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
      <path d="M12 5V2l5 4-5 4V7a5 5 0 11-4.8 6.5H5.14A7 7 0 1012 5z" />
      <text x="12" y="15" textAnchor="middle" fontSize="6" fontWeight="700" fill="currentColor">
        10
      </text>
    </svg>
  );
}

export default function StreamPlayer({ titleId, region }: StreamPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playbackRef = useRef<PlaybackTokenResponse | null>(null);
  const adapterRef = useRef<ShelbyAdapter | null>(null);
  const qoeBufferRef = useRef<QoeEvent[]>([]);
  const progressFlushRef = useRef<{ lastPositionSec: number; pending: boolean }>({
    lastPositionSec: 0,
    pending: false,
  });
  const peerHitRatioRef = useRef(0);
  const lastTapRef = useRef<{ left: number; right: number }>({ left: 0, right: 0 });
  const skipOverlayTimeoutRef = useRef<number | null>(null);
  const skipPulseTimeoutRef = useRef<number | null>(null);
  const controlsHideTimeoutRef = useRef<number | null>(null);

  const [status, setStatus] = useState("Initializing player...");
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [abrKbps, setAbrKbps] = useState<number | null>(null);
  const [peerHitRatio, setPeerHitRatio] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [durationSec, setDurationSec] = useState(0);
  const [currentSec, setCurrentSec] = useState(0);
  const [bufferedSec, setBufferedSec] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekPreviewSec, setSeekPreviewSec] = useState<number | null>(null);
  const [skipOverlaySide, setSkipOverlaySide] = useState<"left" | "right" | null>(null);
  const [skipPulseSide, setSkipPulseSide] = useState<"left" | "right" | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);

  const deviceClass = useMemo(() => detectDeviceClass(), []);
  const networkType = useMemo(() => detectNetworkType(), []);

  const sendQoe = useCallback(async () => {
    if (qoeBufferRef.current.length === 0) return;

    const payload: QoeEventsIngestRequest = {
      events: [...qoeBufferRef.current],
    };
    qoeBufferRef.current = [];

    await fetch("/api/v1/qoe/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => null);
  }, []);

  const flushProgress = useCallback(
    async (force = false) => {
      const video = videoRef.current;
      if (!video) return;
      const payload = buildProgressPayload({
        lessonId: titleId,
        currentSec: video.currentTime,
        durationSec: Number.isFinite(video.duration) ? video.duration : 0,
      });
      const shouldSend =
        force ||
        payload.lastPositionSec === 0 ||
        Math.abs(payload.lastPositionSec - progressFlushRef.current.lastPositionSec) >= 15 ||
        payload.progressPercent >= 100;
      if (!shouldSend || progressFlushRef.current.pending) return;

      progressFlushRef.current.pending = true;
      await fetch("/api/progress", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => null);
      progressFlushRef.current = {
        lastPositionSec: payload.lastPositionSec,
        pending: false,
      };
    },
    [titleId],
  );

  const queueQoe = useCallback(
    (event: Omit<QoeEvent, "deviceId">) => {
      qoeBufferRef.current.push({ ...event, deviceId: "web-player" });
      if (qoeBufferRef.current.length >= 5) {
        void sendQoe();
      }
    },
    [sendQoe],
  );

  const seekBy = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    const next = clamp(video.currentTime + seconds, 0, Number.isFinite(video.duration) ? video.duration : 0);
    video.currentTime = next;
    setCurrentSec(next);
  }, []);

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    if (controlsHideTimeoutRef.current) {
      window.clearTimeout(controlsHideTimeoutRef.current);
      controlsHideTimeoutRef.current = null;
    }
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play().catch(() => null);
      return;
    }
    video.pause();
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const nextMute = !video.muted;
    video.muted = nextMute;
    setIsMuted(nextMute);
  }, []);

  const onSeekChange = useCallback((value: number) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    const next = clamp(value, 0, video.duration);
    video.currentTime = next;
    setCurrentSec(next);
    revealControls();
  }, [revealControls]);

  const updateSeekPreview = useCallback(
    (clientX: number, target: HTMLElement) => {
      if (durationSec <= 0) return;
      const rect = target.getBoundingClientRect();
      if (rect.width <= 0) return;
      const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
      setSeekPreviewSec(ratio * durationSec);
    },
    [durationSec],
  );

  const handleSeekMouseMove = useCallback(
    (event: ReactMouseEvent<HTMLInputElement>) => {
      setIsSeeking(true);
      updateSeekPreview(event.clientX, event.currentTarget);
    },
    [updateSeekPreview],
  );

  const handleSeekTouchMove = useCallback(
    (event: ReactTouchEvent<HTMLInputElement>) => {
      const point = event.touches[0];
      if (!point) return;
      setIsSeeking(true);
      updateSeekPreview(point.clientX, event.currentTarget);
    },
    [updateSeekPreview],
  );

  const onVolumeChange = useCallback((value: number) => {
    const video = videoRef.current;
    if (!video) return;
    const next = clamp(value, 0, 1);
    video.volume = next;
    video.muted = next === 0;
    setVolume(next);
    setIsMuted(video.muted);
    revealControls();
  }, [revealControls]);

  const onSpeedChange = useCallback((value: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = value;
    setPlaybackRate(value);
    revealControls();
  }, [revealControls]);

  const toggleFullscreen = useCallback(async () => {
    const wrapper = containerRef.current;
    if (!wrapper) return;

    if (!document.fullscreenElement) {
      await wrapper.requestFullscreen().catch(() => null);
      return;
    }
    await document.exitFullscreen().catch(() => null);
  }, []);

  const triggerSkip = useCallback(
    (side: "left" | "right") => {
      revealControls();
      if (side === "left") {
        seekBy(-10);
      } else {
        seekBy(10);
      }

      setSkipOverlaySide(side);
      if (skipOverlayTimeoutRef.current) {
        window.clearTimeout(skipOverlayTimeoutRef.current);
      }
      skipOverlayTimeoutRef.current = window.setTimeout(() => {
        setSkipOverlaySide(null);
      }, 620);

      setSkipPulseSide(side);
      if (skipPulseTimeoutRef.current) {
        window.clearTimeout(skipPulseTimeoutRef.current);
      }
      skipPulseTimeoutRef.current = window.setTimeout(() => {
        setSkipPulseSide(null);
      }, 260);
    },
    [revealControls, seekBy],
  );

  const handleTapZone = useCallback(
    (zone: "left" | "right") => {
      const now = Date.now();
      const prev = lastTapRef.current[zone];
      lastTapRef.current[zone] = now;
      if (now - prev > 320) return;
      triggerSkip(zone);
    },
    [triggerSkip],
  );

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      void sendQoe();
    }, 5000);
    return () => clearInterval(interval);
  }, [sendQoe]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const videoEl = video;
    let hls: Hls | null = null;
    let canceled = false;

    async function bootstrapShelby(playbackSessionId: string) {
      const response = await fetch("/api/v1/shelby/bootstrap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          playbackSessionId,
          titleId,
          region,
          deviceClass,
          networkType,
          maxPeers: 6,
        }),
      });
      if (!response.ok) throw new Error("Shelby bootstrap failed");
      const body = (await response.json()) as { data: ShelbyBootstrapResponse };
      return body.data;
    }

    async function getPlaybackToken() {
      const response = await fetch("/api/v1/playback/token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          titleId,
          region,
          deviceClass,
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(body?.error?.message || "Playback session failed");
      }
      const body = (await response.json()) as { data: PlaybackTokenResponse };
      return body.data;
    }

    function updatePeerRatio() {
      const stats = adapterRef.current?.getStats();
      if (!stats) return;
      const total = stats.peerHits + stats.cdnFallbacks;
      const ratio = total === 0 ? 0 : Math.round((stats.peerHits / total) * 100);
      peerHitRatioRef.current = ratio;
      setPeerHitRatio(ratio);
    }

    function isHlsManifestUrl(url: string) {
      return url.toLowerCase().includes(".m3u8");
    }

    async function init() {
      try {
        setStatus("Creating playback session...");
        const playback = await getPlaybackToken();
        if (canceled) return;
        playbackRef.current = playback;

        if (playback.featureFlags.shelbyEnabled) {
          setStatus("Bootstrapping Shelby peers...");
          const bootstrap = await bootstrapShelby(playback.playbackSessionId);
          if (canceled) return;
          adapterRef.current = new ShelbyAdapter(bootstrap);
          adapterRef.current.addEventListener("peer_hit", updatePeerRatio);
          adapterRef.current.addEventListener("cdn_fallback", updatePeerRatio);
        }

        setStatus("Loading stream...");

        if (!isHlsManifestUrl(playback.manifestUrl)) {
          videoEl.src = playback.manifestUrl;
          videoEl.addEventListener(
            "loadedmetadata",
            () => {
              setStatus("Ready");
              queueQoe({
                type: "startup",
                eventTs: new Date().toISOString(),
                playbackSessionId: playback.playbackSessionId,
                titleId,
                positionMs: 0,
              });
            },
            { once: true },
          );
        } else {
          const hlsModule = await import("hls.js");
          const HlsImpl = hlsModule.default;

          if (videoEl.canPlayType("application/vnd.apple.mpegurl")) {
            videoEl.src = playback.manifestUrl;
          } else if (HlsImpl.isSupported()) {
            hls = new HlsImpl({
              autoStartLoad: true,
              capLevelToPlayerSize: true,
              startLevel: -1,
              abrEwmaDefaultEstimate: 1_500_000,
            });
            hls.loadSource(playback.manifestUrl);
            hls.attachMedia(videoEl);

            hls.on(HlsImpl.Events.MANIFEST_PARSED, () => {
              queueQoe({
                type: "startup",
                eventTs: new Date().toISOString(),
                playbackSessionId: playback.playbackSessionId,
                titleId,
                positionMs: 0,
              });
              setStatus("Ready");
            });

            hls.on(HlsImpl.Events.LEVEL_SWITCHED, (_evt, data) => {
              const bitrate = hls?.levels[data.level]?.bitrate ?? 0;
              const bitrateKbps = Math.floor(bitrate / 1000);
              setAbrKbps(bitrateKbps);
              queueQoe({
                type: "bitrate_change",
                eventTs: new Date().toISOString(),
                playbackSessionId: playback.playbackSessionId,
                titleId,
                positionMs: Math.floor(videoEl.currentTime * 1000),
                bitrateKbps,
                peerHitRatio: peerHitRatioRef.current,
              });
            });

            hls.on(HlsImpl.Events.FRAG_BUFFERED, (_evt, data) => {
              if (!adapterRef.current) return;
              if (adapterRef.current.getPolicy().peerFirst) {
                adapterRef.current.recordPeerHit(data.frag.sn.toString());
              } else {
                adapterRef.current.recordCdnFallback("policy_peer_first_disabled");
              }
            });

            hls.on(HlsImpl.Events.ERROR, (_evt, data) => {
              if (!data.fatal) return;
              setFatalError(data.details || "Fatal playback error");
              queueQoe({
                type: "fatal_error",
                eventTs: new Date().toISOString(),
                playbackSessionId: playback.playbackSessionId,
                titleId,
                positionMs: Math.floor(videoEl.currentTime * 1000),
                errorCode: data.details || "UNKNOWN",
              });
            });
          } else {
            throw new Error("HLS is not supported on this browser");
          }
        }

        const onWaiting = () => {
          queueQoe({
            type: "rebuffer_start",
            eventTs: new Date().toISOString(),
            playbackSessionId: playback.playbackSessionId,
            titleId,
            positionMs: Math.floor(videoEl.currentTime * 1000),
            peerHitRatio: peerHitRatioRef.current,
          });
        };
        const onPlaying = () => {
          queueQoe({
            type: "rebuffer_end",
            eventTs: new Date().toISOString(),
            playbackSessionId: playback.playbackSessionId,
            titleId,
            positionMs: Math.floor(videoEl.currentTime * 1000),
            peerHitRatio: peerHitRatioRef.current,
          });
        };
        const onTimeUpdate = () => {
          setCurrentSec(videoEl.currentTime);
          void flushProgress();
        };
        const onLoadedMetadata = () => {
          setDurationSec(Number.isFinite(videoEl.duration) ? videoEl.duration : 0);
          setPlaybackRate(videoEl.playbackRate || 1);
          setVolume(videoEl.volume);
          setIsMuted(videoEl.muted);
        };
        const onProgress = () => {
          if (!videoEl.buffered.length) return;
          const end = videoEl.buffered.end(videoEl.buffered.length - 1);
          setBufferedSec(end);
        };
        const onPlay = () => setIsPlaying(true);
        const onPause = () => {
          setIsPlaying(false);
          revealControls();
          void flushProgress(true);
        };
        const onEnded = () => {
          setIsPlaying(false);
          revealControls();
          void flushProgress(true);
          queueQoe({
            type: "playback_end",
            eventTs: new Date().toISOString(),
            playbackSessionId: playback.playbackSessionId,
            titleId,
            positionMs: Math.floor(videoEl.currentTime * 1000),
            peerHitRatio: peerHitRatioRef.current,
          });
        };

        videoEl.addEventListener("waiting", onWaiting);
        videoEl.addEventListener("playing", onPlaying);
        videoEl.addEventListener("timeupdate", onTimeUpdate);
        videoEl.addEventListener("loadedmetadata", onLoadedMetadata);
        videoEl.addEventListener("progress", onProgress);
        videoEl.addEventListener("play", onPlay);
        videoEl.addEventListener("pause", onPause);
        videoEl.addEventListener("ended", onEnded);

        return () => {
          videoEl.removeEventListener("waiting", onWaiting);
          videoEl.removeEventListener("playing", onPlaying);
          videoEl.removeEventListener("timeupdate", onTimeUpdate);
          videoEl.removeEventListener("loadedmetadata", onLoadedMetadata);
          videoEl.removeEventListener("progress", onProgress);
          videoEl.removeEventListener("play", onPlay);
          videoEl.removeEventListener("pause", onPause);
          videoEl.removeEventListener("ended", onEnded);
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Player init failed";
        setFatalError(message);
        return () => undefined;
      }
    }

    let removeDomListeners: (() => void) | null = null;
    void init().then((cleanup) => {
      if (!canceled && typeof cleanup === "function") {
        removeDomListeners = cleanup;
      }
    });

    return () => {
      canceled = true;
      void flushProgress(true);
      void sendQoe();
      removeDomListeners?.();
      hls?.destroy();
    };
  }, [deviceClass, flushProgress, networkType, queueQoe, region, revealControls, sendQoe, titleId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (event.key === " ") {
        event.preventDefault();
        togglePlay();
        revealControls();
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        triggerSkip("right");
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        triggerSkip("left");
      }
      if (event.key.toLowerCase() === "m") {
        event.preventDefault();
        toggleMute();
        revealControls();
      }
      if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        void toggleFullscreen();
        revealControls();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [revealControls, toggleFullscreen, toggleMute, togglePlay, triggerSkip]);

  useEffect(() => {
    if (!isPlaying || !controlsVisible || isSeeking) return;
    controlsHideTimeoutRef.current = window.setTimeout(() => {
      setControlsVisible(false);
    }, 2600);
    return () => {
      if (controlsHideTimeoutRef.current) {
        window.clearTimeout(controlsHideTimeoutRef.current);
        controlsHideTimeoutRef.current = null;
      }
    };
  }, [controlsVisible, isPlaying, isSeeking]);

  useEffect(() => {
    return () => {
      if (skipOverlayTimeoutRef.current) {
        window.clearTimeout(skipOverlayTimeoutRef.current);
      }
      if (skipPulseTimeoutRef.current) {
        window.clearTimeout(skipPulseTimeoutRef.current);
      }
      if (controlsHideTimeoutRef.current) {
        window.clearTimeout(controlsHideTimeoutRef.current);
      }
    };
  }, []);

  const playedPercent = durationSec > 0 ? (currentSec / durationSec) * 100 : 0;
  const bufferedPercent = durationSec > 0 ? (bufferedSec / durationSec) * 100 : 0;
  const tooltipSec = seekPreviewSec ?? currentSec;
  const tooltipPercent = durationSec > 0 ? (tooltipSec / durationSec) * 100 : 0;
  const seekTrackStyle = {
    background: `linear-gradient(to right,
      rgba(239, 68, 68, 1) 0%,
      rgba(239, 68, 68, 1) ${clamp(playedPercent, 0, 100)}%,
      rgba(255, 255, 255, 0.45) ${clamp(playedPercent, 0, 100)}%,
      rgba(255, 255, 255, 0.45) ${clamp(bufferedPercent, 0, 100)}%,
      rgba(255, 255, 255, 0.22) ${clamp(bufferedPercent, 0, 100)}%,
      rgba(255, 255, 255, 0.22) 100%)`,
  };

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        className="overflow-hidden rounded-[1.6rem] border border-white/12 bg-[#030812] shadow-[0_24px_80px_rgba(0,0,0,0.42)]"
        onMouseMove={revealControls}
        onTouchStart={revealControls}
      >
        <div className="relative bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="aspect-video w-full bg-black"
            onDoubleClick={() => {
              void toggleFullscreen();
            }}
            onClick={revealControls}
          />
          <button
            type="button"
            aria-label="Double tap left to rewind 10 seconds"
            className="absolute inset-y-0 left-0 w-1/2"
            onDoubleClick={(event) => {
              event.preventDefault();
              handleTapZone("left");
            }}
            onTouchEnd={() => handleTapZone("left")}
          />
          <button
            type="button"
            aria-label="Double tap right to forward 10 seconds"
            className="absolute inset-y-0 right-0 w-1/2"
            onDoubleClick={(event) => {
              event.preventDefault();
              handleTapZone("right");
            }}
            onTouchEnd={() => handleTapZone("right")}
          />
          {skipOverlaySide ? (
            <div className="pointer-events-none absolute inset-0">
              <div
                className={`absolute top-1/2 -translate-y-1/2 rounded-full bg-black/65 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur md:px-4 md:py-2 md:text-sm ${
                  skipOverlaySide === "left" ? "left-[14%]" : "right-[14%]"
                }`}
              >
                {skipOverlaySide === "left" ? "-10s" : "+10s"}
              </div>
            </div>
          ) : null}
          <div
            className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent p-2.5 transition-opacity duration-200 sm:p-3 md:p-4 ${
              controlsVisible ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            <div className="relative mb-3">
              {isSeeking && seekPreviewSec !== null ? (
                <div
                  className="pointer-events-none absolute -top-8 -translate-x-1/2 rounded-full bg-[#09111c]/92 px-2.5 py-1 text-[10px] text-white shadow-lg"
                  style={{ left: `${clamp(tooltipPercent, 0, 100)}%` }}
                >
                  {formatClock(tooltipSec)}
                </div>
              ) : null}
              <input
                type="range"
                min={0}
                max={durationSec || 0}
                step={0.1}
                value={clamp(currentSec, 0, durationSec || 0)}
                onChange={(event) => onSeekChange(Number(event.target.value))}
                onMouseMove={handleSeekMouseMove}
                onMouseEnter={() => setIsSeeking(true)}
                onMouseLeave={() => {
                  setIsSeeking(false);
                  setSeekPreviewSec(null);
                }}
                onTouchStart={handleSeekTouchMove}
                onTouchMove={handleSeekTouchMove}
                onTouchEnd={() => {
                  setIsSeeking(false);
                  setSeekPreviewSec(null);
                }}
                className="stream-seekbar h-2 w-full cursor-pointer rounded-full md:h-1.5"
                style={seekTrackStyle}
                aria-label="Seek timeline"
              />
            </div>

            <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between md:gap-3">
              <div className="flex items-center justify-between gap-2 sm:justify-start">
                <button
                  type="button"
                  onClick={() => triggerSkip("left")}
                  aria-label="Skip backward 10 seconds"
                  className={`flex min-h-10 min-w-10 items-center justify-center rounded-full border border-white/20 bg-white/7 px-2.5 py-1.5 text-[11px] font-semibold text-white backdrop-blur hover:bg-white/14 md:min-h-0 md:min-w-0 md:px-3 md:text-sm ${
                    skipPulseSide === "left" ? "stream-skip-pulse" : ""
                  }`}
                >
                  <IconReplay10 />
                </button>
                <button
                  type="button"
                  onClick={togglePlay}
                  aria-label={isPlaying ? "Pause" : "Play"}
                  className="flex min-h-10 min-w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#f8d7a8] to-[#f4a261] px-3 py-1.5 text-[#08111c] shadow-[0_12px_32px_rgba(244,162,97,0.34)] hover:opacity-95 md:min-h-0"
                >
                  {isPlaying ? <IconPause /> : <IconPlay />}
                </button>
                <button
                  type="button"
                  onClick={() => triggerSkip("right")}
                  aria-label="Skip forward 10 seconds"
                  className={`flex min-h-10 min-w-10 items-center justify-center rounded-full border border-white/20 bg-white/7 px-2.5 py-1.5 text-[11px] font-semibold text-white backdrop-blur hover:bg-white/14 md:min-h-0 md:min-w-0 md:px-3 md:text-sm ${
                    skipPulseSide === "right" ? "stream-skip-pulse" : ""
                  }`}
                >
                  <IconForward10 />
                </button>
                <div className="ml-auto min-w-24 text-right text-xs text-white/80 md:ml-0 md:min-w-28 md:text-left md:text-sm">
                  {formatClock(currentSec)} / {formatClock(durationSec)}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 sm:justify-start">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleMute}
                    aria-label={isMuted || volume === 0 ? "Unmute" : "Mute"}
                    className="flex min-h-10 min-w-10 items-center justify-center rounded-full border border-white/20 bg-white/7 px-3 py-1.5 text-xs text-white hover:bg-white/14 md:min-h-0 md:min-w-0 md:text-sm"
                  >
                    <IconVolume muted={isMuted || volume === 0} />
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={isMuted ? 0 : volume}
                    onChange={(event) => onVolumeChange(Number(event.target.value))}
                    className="hidden h-2 w-20 cursor-pointer accent-white sm:block"
                    aria-label="Volume"
                  />
                </div>

                <label className="min-h-10 rounded-full border border-white/20 bg-white/7 px-2 py-1 text-xs text-white md:min-h-0 md:text-sm">
                  <span className="mr-1 text-white/80">Speed</span>
                  <select
                    value={playbackRate}
                    onChange={(event) => onSpeedChange(Number(event.target.value))}
                    className="bg-transparent pr-1 text-white outline-none"
                    aria-label="Playback speed"
                  >
                    {SPEED_OPTIONS.map((rate) => (
                      <option key={rate} value={rate} className="bg-black">
                        {rate}x
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  onClick={() => {
                    void toggleFullscreen();
                  }}
                  aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                  className="flex min-h-10 min-w-10 items-center justify-center rounded-full border border-white/20 bg-white/7 px-3 py-1.5 text-xs text-white hover:bg-white/14 md:min-h-0 md:min-w-0 md:text-sm"
                >
                  {isFullscreen ? <IconExitFullscreen /> : <IconFullscreen />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        className={`flex flex-wrap gap-2 text-[11px] text-white/75 transition-opacity md:text-xs ${
          isPlaying ? "hidden sm:flex" : "flex"
        }`}
      >
        <span className="rounded-full border border-white/10 bg-white/6 px-2.5 py-1 md:px-3">
          <span className="hidden sm:inline">Status: </span>
          {status}
        </span>
        <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1">
          ABR: {abrKbps ? `${abrKbps} kbps` : "auto"}
        </span>
        <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1">Shelby Hit Ratio: {peerHitRatio}%</span>
      </div>
      {fatalError ? <p className="text-sm text-red-300">{fatalError}</p> : null}
    </div>
  );
}
