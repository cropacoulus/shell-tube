import type { DeviceClass } from "@/lib/contracts/common";

export type PlaybackTokenRequest = {
  userId?: string;
  profileId?: string;
  titleId: string;
  region: string;
  deviceClass: DeviceClass;
};

export type PlaybackTokenResponse = {
  playbackSessionId: string;
  token: string;
  expiresAt: string;
  manifestUrl: string;
  drm: {
    scheme: "widevine" | "fairplay" | "playready";
    licenseServerUrl: string;
  };
  featureFlags: {
    shelbyEnabled: boolean;
  };
};
