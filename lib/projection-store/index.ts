import type { ProjectionStore } from "@/lib/projection-store/projection-store";
import { memoryProjectionStore } from "@/lib/projection-store/memory-projection-store";
import { upstashProjectionStore } from "@/lib/projection-store/upstash-projection-store";
import { createOptionBConfig } from "@/lib/runtime/option-b-config";

export function createDefaultProjectionStore(): ProjectionStore {
  const config = createOptionBConfig();
  return config.projectionStoreBackend === "upstash" ? upstashProjectionStore : memoryProjectionStore;
}
