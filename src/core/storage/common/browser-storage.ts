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

export interface StorageInterface {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: string | number | boolean | object): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}

class BrowserStorage implements StorageInterface {
  private namespace: string;
  
  constructor(namespace: string) {
    this.namespace = namespace;
  }

  private getNamespacedKey(key: string): string {
    return `${this.namespace}:${key}`;
  }

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

export default BrowserStorage; 