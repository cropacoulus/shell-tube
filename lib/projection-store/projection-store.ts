export type ProjectionStore = {
  getJson<T>(key: string): Promise<T | null>;
  setJson<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  getCursor(name: string): Promise<string | null>;
  setCursor(name: string, value: string): Promise<void>;
};
