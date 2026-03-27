import type { ProjectionStore } from "@/lib/projection-store/projection-store";

const values = new Map<string, string>();
const cursors = new Map<string, string>();

export const memoryProjectionStore: ProjectionStore = {
  async getJson<T>(key: string) {
    const raw = values.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  },
  async setJson<T>(key: string, value: T) {
    values.set(key, JSON.stringify(value));
  },
  async delete(key: string) {
    values.delete(key);
  },
  async getCursor(name: string) {
    return cursors.get(name) ?? null;
  },
  async setCursor(name: string, value: string) {
    cursors.set(name, value);
  },
};

export function resetMemoryProjectionStore() {
  values.clear();
  cursors.clear();
}
