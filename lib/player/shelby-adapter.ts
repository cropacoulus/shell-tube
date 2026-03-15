import type { ShelbyBootstrapResponse } from "@/lib/contracts/shelby";

export type ShelbyAdapterStats = {
  peerHits: number;
  cdnFallbacks: number;
};

export type ShelbyAdapterEvent =
  | { type: "bootstrap"; swarmId: string; peerCount: number }
  | { type: "peer_hit"; chunkId: string; peerId?: string }
  | { type: "cdn_fallback"; reason: string };

export class ShelbyAdapter extends EventTarget {
  private stats: ShelbyAdapterStats = { peerHits: 0, cdnFallbacks: 0 };
  private bootstrap: ShelbyBootstrapResponse;

  constructor(bootstrap: ShelbyBootstrapResponse) {
    super();
    this.bootstrap = bootstrap;
    this.dispatch("bootstrap", {
      swarmId: bootstrap.swarmId,
      peerCount: bootstrap.peers.length,
    });
  }

  dispatch(type: ShelbyAdapterEvent["type"], detail: Omit<ShelbyAdapterEvent, "type">) {
    this.dispatchEvent(new CustomEvent(type, { detail: { type, ...detail } }));
  }

  recordPeerHit(chunkId: string, peerId?: string) {
    this.stats.peerHits += 1;
    this.dispatch("peer_hit", { chunkId, peerId });
  }

  recordCdnFallback(reason: string) {
    this.stats.cdnFallbacks += 1;
    this.dispatch("cdn_fallback", { reason });
  }

  getStats() {
    return { ...this.stats };
  }

  getPolicy() {
    return this.bootstrap.policy;
  }
}
