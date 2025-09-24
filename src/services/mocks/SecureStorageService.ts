/**
 * Mock Secure Storage Service
 * Local implementation to avoid cross-module dependencies during testing
 */

/**
 * Mock implementation of secure storage functionality
 * Provides encrypted storage operations for testing
 */
export class SecureStorageService {
  private storage: Map<string, any> = new Map();
  private initialized = false;

  /**
   * Initialize the service
   */
  async init(): Promise<void> {
    this.initialized = true;
  }

  /**
   * Store data securely
   * @param key Storage key
   * @param data Data to store
   * @returns Promise resolving when data is stored
   */
  async store(key: string, data: any): Promise<void> {
    if (!this.initialized) {
      throw new Error('SecureStorageService not initialized');
    }
    this.storage.set(key, data);
  }

  /**
   * Retrieve data from secure storage
   * @param key Storage key
   * @returns Promise resolving to stored data or null if not found
   */
  async retrieve(key: string): Promise<any> {
    if (!this.initialized) {
      throw new Error('SecureStorageService not initialized');
    }
    return this.storage.get(key) ?? null;
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
    this.storage.clear();
  }
}