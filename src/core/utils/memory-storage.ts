// Local interface to avoid external dependency/type issues
/**
 *
 */
export interface BrowserStorageArea {
  /**
   *
   */
  get(key: string): Promise<Record<string, unknown>>;
  /**
   *
   */
  set(items: Record<string, unknown>): Promise<void>;
  /**
   *
   */
  remove(key: string): Promise<void>;
  /**
   *
   */
  clear(): Promise<void>;
  /**
   *
   */
  getWholeStorage(): Promise<Record<string, unknown>>;
}

/**
 * In-memory storage implementation for browser storage interface
 * Provides a temporary storage solution that doesn't persist across sessions
 */
class MemoryStorage implements BrowserStorageArea {
  private storage: { [key: string]: unknown } = {};

  /**
   * Get value by key from memory storage
   * @param key Storage key to retrieve
   * @returns Promise resolving to record with key-value pair
   */
  async get(key: string): Promise<Record<string, unknown>> {
    return this.storage[key] != null ? { [key]: this.storage[key] } : {};
  }

  /**
   * Set multiple key-value pairs in memory storage
   * @param items Record of key-value pairs to store
   * @returns Promise that resolves when items are stored
   */
  async set(items: Record<string, unknown>): Promise<void> {
    Object.keys(items).forEach((key) => {
      this.storage[key] = items[key];
    });
  }

  /**
   * Remove item by key from memory storage
   * @param key Storage key to remove
   * @returns Promise that resolves when item is removed
   */
  async remove(key: string): Promise<void> {
    delete this.storage[key];
  }

  /**
   * Clear all items from memory storage
   * @returns Promise that resolves when storage is cleared
   */
  async clear(): Promise<void> {
    this.storage = {};
  }

  /**
   * Get entire storage contents
   * @returns Promise resolving to all stored data
   */
  async getWholeStorage(): Promise<Record<string, unknown>> {
    return this.storage;
  }
}

export default MemoryStorage;
