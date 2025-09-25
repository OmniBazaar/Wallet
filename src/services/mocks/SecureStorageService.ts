/**
 * Mock Secure Storage Service
 * Local implementation to avoid cross-module dependencies during testing
 */

/**
 * Mock implementation of secure storage functionality
 * Provides encrypted storage operations for testing
 */
export class SecureStorageService {
  private storage: Map<string, unknown> = new Map();
  private initialized = false;

  /**
   * Initialize the service
   * @returns Promise that resolves when initialization is complete
   */
  async init(): Promise<void> {
    // Simulate async initialization
    await Promise.resolve();
    this.initialized = true;
  }

  /**
   * Store data securely
   * @param key Storage key
   * @param data Data to store
   * @returns Promise resolving when data is stored
   */
  async store(key: string, data: unknown): Promise<void> {
    if (!this.initialized) {
      throw new Error('SecureStorageService not initialized');
    }
    // Simulate async storage operation
    await Promise.resolve();
    this.storage.set(key, data);
  }

  /**
   * Retrieve data from secure storage
   * @param key Storage key
   * @returns Promise resolving to stored data or null if not found
   */
  async retrieve(key: string): Promise<unknown> {
    if (!this.initialized) {
      throw new Error('SecureStorageService not initialized');
    }
    // Simulate async retrieval operation
    await Promise.resolve();
    const value = this.storage.get(key);
    return value !== undefined ? value : null;
  }

  /**
   * Delete data from secure storage
   * @param key Storage key
   * @returns Promise resolving when data is deleted
   */
  async delete(key: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('SecureStorageService not initialized');
    }
    // Simulate async delete operation
    await Promise.resolve();
    this.storage.delete(key);
  }

  /**
   * Check if a key exists in storage
   * @param key Storage key
   * @returns Promise resolving to true if key exists
   */
  async exists(key: string): Promise<boolean> {
    if (!this.initialized) {
      throw new Error('SecureStorageService not initialized');
    }
    // Simulate async existence check
    await Promise.resolve();
    return this.storage.has(key);
  }

  /**
   * Clear all stored data
   * @returns Promise resolving when storage is cleared
   */
  async clear(): Promise<void> {
    if (!this.initialized) {
      throw new Error('SecureStorageService not initialized');
    }
    // Simulate async clear operation
    await Promise.resolve();
    this.storage.clear();
  }
}