import { BrowserStorageArea } from "@enkryptcom/types";

class MemoryStorage implements BrowserStorageArea {
  private storage: { [key: string]: unknown } = {};

  async get(key: string): Promise<Record<string, unknown>> {
    return this.storage[key] ? { [key]: this.storage[key] } : {};
  }

  async set(items: Record<string, unknown>): Promise<void> {
    Object.keys(items).forEach((key) => {
      this.storage[key] = items[key];
    });
  }

  async remove(key: string): Promise<void> {
    delete this.storage[key];
  }

  async clear(): Promise<void> {
    this.storage = {};
  }

  async getWholeStorage(): Promise<Record<string, unknown>> {
    return this.storage;
  }
}

export default MemoryStorage;
