import type { ProjectionStore } from "@/lib/projection-store/projection-store";
import { runUpstashCommand } from "@/lib/upstash/rest-client";

function cursorKey(name: string) {
  return `stream:projection:cursor:${name}`;
}

export const upstashProjectionStore: ProjectionStore = {
  async getJson<T>(key: string) {
    const result = await runUpstashCommand<string | null>(["GET", key]);
    return result ? (JSON.parse(result) as T) : null;
  },
  async setJson<T>(key: string, value: T) {
    await runUpstashCommand(["SET", key, JSON.stringify(value)]);
  },
  async delete(key: string) {
    await runUpstashCommand(["DEL", key]);
  },
  async getCursor(name: string) {
    return (await runUpstashCommand<string | null>(["GET", cursorKey(name)])) ?? null;
  },
  async setCursor(name: string, value: string) {
    await runUpstashCommand(["SET", cursorKey(name), value]);
  },
};
