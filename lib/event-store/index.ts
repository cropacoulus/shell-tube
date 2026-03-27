import type { EventStore } from "@/lib/event-store/event-store";
import { jsonEventStore } from "@/lib/event-store/json-event-store";
import { upstashEventStore } from "@/lib/event-store/upstash-event-store";
import { createOptionBConfig } from "@/lib/runtime/option-b-config";

export function createDefaultEventStore(): EventStore {
  const optionB = createOptionBConfig();
  if (optionB.eventStoreBackend === "upstash") {
    return upstashEventStore;
  }
  return jsonEventStore;
}
