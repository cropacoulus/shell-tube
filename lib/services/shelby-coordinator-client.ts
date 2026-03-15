import type {
  ShelbyBootstrapRequest,
  ShelbyBootstrapResponse,
} from "@/lib/contracts/shelby";
import { requestJson, ServiceError } from "@/lib/services/http-client";
import { allowMockFallback } from "@/lib/services/runtime";

export async function bootstrapShelby(
  payload: ShelbyBootstrapRequest,
): Promise<ShelbyBootstrapResponse> {
  const baseUrl = process.env.SHELBY_COORDINATOR_URL;
  const token = process.env.SERVICE_AUTH_TOKEN;
  if (!baseUrl && !allowMockFallback()) {
    throw new ServiceError("shelby", 503, "Shelby coordinator is not configured");
  }
  if (!baseUrl) {
    return {
      swarmId: `swarm_${payload.titleId}_${payload.playbackSessionId}`,
      trackers: [
        "wss://tracker-jkt.shelby.example.com",
        "wss://tracker-sin.shelby.example.com",
      ],
      peers: [
        {
          peerId: "peer_a19c0",
          ipHint: "10.22.1.17",
          port: 443,
          reputation: 0.96,
          lastSeenMs: Date.now() - 1200,
        },
      ],
      policy: {
        peerFirst: true,
        maxPeerLatencyMs: 250,
        cdnFallbackThresholdMs: 900,
        minChunkAvailability: 0.75,
      },
      integrity: {
        hashAlgorithm: "sha256",
        manifestHash:
          "15fa83f63de5ba58f83ce2af2eb850fbe07f8666fa6ea13e8f7a683b2efc87d9",
      },
    };
  }

  return requestJson<ShelbyBootstrapResponse>({
    service: "shelby",
    baseUrl,
    token,
    path: "/v1/shelby/bootstrap",
    method: "POST",
    body: payload,
  });
}
