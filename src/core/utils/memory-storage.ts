/**
 * Browser storage area interface - local interface to avoid external dependency/type issues
 */
export interface BrowserStorageArea {
  /** Get value by key from storage */
  get(key: string): Promise<Record<string, unknown>>;
  /** Set multiple key-value pairs in storage */
  set(items: Record<string, unknown>): Promise<void>;
  /** Remove item by key from storage */
  remove(key: string): Promise<void>;
  /** Clear all items from storage */
  clear(): Promise<void>;
  /** Get entire storage contents */
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
  get(key: string): Promise<Record<string, unknown>> {
    return Promise.resolve(this.storage[key] != null ? { [key]: this.storage[key] } : {});
  }

  /**
   * Set multiple key-value pairs in memory storage
   * @param items Record of key-value pairs to store
   * @returns Promise that resolves when items are stored
   */
  set(items: Record<string, unknown>): Promise<void> {
    Object.keys(items).forEach((key) => {
      this.storage[key] = items[key];
    });
    return Promise.resolve();
  }

  /**
   * Remove item by key from memory storage
   * @param key Storage key to remove
   * @returns Promise that resolves when item is removed
   */
  remove(key: string): Promise<void> {
    delete this.storage[key];
    return Promise.resolve();
  }

  /**
   * Clear all items from memory storage
   * @returns Promise that resolves when storage is cleared
   */
  clear(): Promise<void> {
    this.storage = {};
    return Promise.resolve();
  }

  /**
   * Get entire storage contents
   * @returns Promise resolving to all stored data
   */
  getWholeStorage(): Promise<Record<string, unknown>> {
    return Promise.resolve(this.storage);
  }
}

export default MemoryStorage;
