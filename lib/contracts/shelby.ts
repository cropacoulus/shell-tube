import type { DeviceClass, NetworkType } from "@/lib/contracts/common";

export type ShelbyBootstrapRequest = {
  userId?: string;
  profileId?: string;
  playbackSessionId: string;
  titleId: string;
  region: string;
  deviceClass: DeviceClass;
  networkType: NetworkType;
  maxPeers: number;
};

export type ShelbyPeer = {
  peerId: string;
  ipHint: string;
  port: number;
  reputation: number;
  lastSeenMs: number;
};

export type ShelbyBootstrapResponse = {
  swarmId: string;
  trackers: string[];
  peers: ShelbyPeer[];
  policy: {
    peerFirst: boolean;
    maxPeerLatencyMs: number;
    cdnFallbackThresholdMs: number;
    minChunkAvailability: number;
  };
  integrity: {
    hashAlgorithm: "sha256";
    manifestHash: string;
  };
};
