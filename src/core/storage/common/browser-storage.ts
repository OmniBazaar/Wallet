/** Chrome extension storage API type definitions */
declare const chrome: {
  storage: {
    local: {
      get: (keys: string[] | null, callback: (result: Record<string, unknown>) => void) => void;
      set: (items: Record<string, unknown>, callback: () => void) => void;
      remove: (keys: string[], callback: () => void) => void;
    };
  };
  runtime: {
    lastError?: Error;
  };
};

/**
 * Generic storage interface that can be implemented by different storage backends
 */
export interface StorageInterface {
  /**
   * Retrieves a value from storage
   * @param key - The storage key
   * @returns Promise resolving to the stored value or null if not found
   */
  get<T = unknown>(key: string): Promise<T | null>;
  
  /**
   * Stores a value in storage
   * @param key - The storage key
   * @param value - The value to store
   * @returns Promise that resolves when storage is complete
   */
  set(key: string, value: string | number | boolean | object): Promise<void>;
  
  /**
   * Removes a key from storage
   * @param key - The storage key to remove
   * @returns Promise that resolves when removal is complete
   */
  remove(key: string): Promise<void>;
  
  /**
   * Clears all keys in the storage namespace
   * @returns Promise that resolves when clearing is complete
   */
  clear(): Promise<void>;
}

/**
 * Browser storage implementation using Chrome extension storage API
 * Provides namespaced storage to avoid key conflicts between different modules
 * @example
 * ```typescript
 * const storage = new BrowserStorage('wallet');
 * await storage.set('accounts', accountsData);
 * const accounts = await storage.get('accounts');
 * ```
 */
class BrowserStorage implements StorageInterface {
  /** The namespace prefix for all storage keys */
  private namespace: string;
  
  /**
   * Creates a new browser storage instance with the specified namespace
   * @param namespace - The namespace to use for all storage operations
   */
  constructor(namespace: string) {
    this.namespace = namespace;
  }

  /**
   * Adds the namespace prefix to a storage key
   * @param key - The base storage key
   * @returns The namespaced key
   */
  private getNamespacedKey(key: string): string {
    return `${this.namespace}:${key}`;
  }

  /**
   * Retrieves a value from Chrome extension storage
   * @param key - The storage key (will be namespaced automatically)
   * @returns Promise resolving to the stored value or null if not found
   */
  async get<T = unknown>(key: string): Promise<T | null> {
    return new Promise((resolve) => {
      try {
        const namespacedKey = this.getNamespacedKey(key);
        chrome.storage.local.get([namespacedKey], (result: Record<string, unknown>) => {
          if (chrome.runtime.lastError) {
            console.error('BrowserStorage.get error:', chrome.runtime.lastError);
            resolve(null);
          } else {
            resolve(result[namespacedKey]);
          }
        });
      } catch (error) {
        console.error('BrowserStorage.get error:', error);
        resolve(null);
      }
    });
  }

  /**
   * Stores a value in Chrome extension storage
   * @param key - The storage key (will be namespaced automatically)
   * @param value - The value to store (must be serializable)
   * @returns Promise that resolves when storage is complete
   * @throws {Error} When storage operation fails
   */
  async set(key: string, value: string | number | boolean | object): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const namespacedKey = this.getNamespacedKey(key);
        chrome.storage.local.set({ [namespacedKey]: value }, () => {
          if (chrome.runtime.lastError) {
            console.error('BrowserStorage.set error:', chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      } catch (error) {
        console.error('BrowserStorage.set error:', error);
        reject(error);
      }
    });
  }

  /**
   * Removes a key from Chrome extension storage
   * @param key - The storage key to remove (will be namespaced automatically)
   * @returns Promise that resolves when removal is complete
   * @throws {Error} When removal operation fails
   */
  async remove(key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const namespacedKey = this.getNamespacedKey(key);
        chrome.storage.local.remove([namespacedKey], () => {
          if (chrome.runtime.lastError) {
            console.error('BrowserStorage.remove error:', chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      } catch (error) {
        console.error('BrowserStorage.remove error:', error);
        reject(error);
      }
    });
  }

  /**
   * Clears all keys in this storage namespace
   * Only removes keys that start with the namespace prefix
   * @returns Promise that resolves when clearing is complete
   * @throws {Error} When clearing operation fails
   */
  async clear(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Get all keys in this namespace
        chrome.storage.local.get(null, (allData: Record<string, unknown>) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }
          
          const keysToRemove = Object.keys(allData).filter(key => 
            key.startsWith(`${this.namespace}:`)
          );
          
          if (keysToRemove.length > 0) {
            chrome.storage.local.remove(keysToRemove, () => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve();
              }
            });
          } else {
            resolve();
          }
        });
      } catch (error) {
        console.error('BrowserStorage.clear error:', error);
        reject(error);
      }
    });
  }
}

/**
 * Chrome extension storage implementation with namespace support
 */
export default BrowserStorage; 