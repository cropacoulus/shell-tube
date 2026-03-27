export type OptionBEventStoreBackend = "json" | "upstash";
export type OptionBProjectionStoreBackend = "memory" | "upstash";

export type OptionBConfig = {
  eventStoreBackend: OptionBEventStoreBackend;
  projectionStoreBackend: OptionBProjectionStoreBackend;
  upstashRedisRestUrl?: string;
  upstashRedisRestToken?: string;
  cronSecret?: string;
  mediaPipelineMode: "manual-pending" | "mock-manifest";
};

function normalizeEventStoreBackend(value: string | undefined): OptionBEventStoreBackend {
  if (value === "upstash") return "upstash";
  return "json";
}

function normalizeProjectionStoreBackend(value: string | undefined): OptionBProjectionStoreBackend {
  if (value === "upstash") return "upstash";
  return "memory";
}

export function createOptionBConfig(env: Record<string, string | undefined> = process.env): OptionBConfig {
  return {
    eventStoreBackend: normalizeEventStoreBackend(env.OPTION_B_EVENT_STORE_BACKEND),
    projectionStoreBackend: normalizeProjectionStoreBackend(env.OPTION_B_PROJECTION_STORE_BACKEND),
    upstashRedisRestUrl: env.UPSTASH_REDIS_REST_URL,
    upstashRedisRestToken: env.UPSTASH_REDIS_REST_TOKEN,
    cronSecret: env.CRON_SECRET,
    mediaPipelineMode: env.OPTION_B_MEDIA_PIPELINE_MODE === "mock-manifest" ? "mock-manifest" : "manual-pending",
  };
}
