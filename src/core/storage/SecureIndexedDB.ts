/**
 * Secure IndexedDB Storage with Encryption
 * Production-ready implementation for sensitive wallet data
 */

interface EncryptedData {
  data: string;
  iv: string;
  salt: string;
  timestamp: number;
}

/** Secure IndexedDB storage with encryption for sensitive wallet data */
export class SecureIndexedDB {
  private dbName: string;
  private db: IDBDatabase | null = null;
  private encryptionKey: CryptoKey | null = null;
  private readonly STORE_NAME = 'secure_storage';
  private readonly VERSION = 1;

  /**
   * Create a new secure IndexedDB instance
   * @param dbName Name of the database
   */
  constructor(dbName = 'OmniWalletSecure') {
    this.dbName = dbName;
  }

  /**
   * Initialize the database and encryption key
   * @param password
   */
  async initialize(password: string): Promise<void> {
    // Derive encryption key from password
    await this.deriveEncryptionKey(password);

    // Open IndexedDB
    await this.openDatabase();
  }

  /**
   * Open or create the IndexedDB database
   */
  private async openDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.VERSION);

      request.onerror = () => reject(new Error('Failed to open database'));

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('type', 'type', { unique: false });
        }
      };
    });
  }

  /**
   * Derive encryption key from password using PBKDF2
   * @param password User password for key derivation
   */
  private async deriveEncryptionKey(password: string): Promise<void> {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);

    // Use a fixed salt for the master key (stored separately in production)
    // In production, this should be unique per user and stored securely
    const masterSalt = await this.getMasterSalt();

    const baseKey = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );

    this.encryptionKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: masterSalt,
        iterations: 210000,
        hash: 'SHA-256'
      },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Get or generate master salt for key derivation
   */
  private async getMasterSalt(): Promise<Uint8Array> {
    const SALT_KEY = 'omniwallet_master_salt';

    // Try to get existing salt from localStorage
    const storedSalt = localStorage.getItem(SALT_KEY);
    if (storedSalt) {
      return Uint8Array.from(atob(storedSalt), c => c.charCodeAt(0));
    }

    // Generate new salt if none exists
    const newSalt = crypto.getRandomValues(new Uint8Array(32));
    localStorage.setItem(SALT_KEY, btoa(String.fromCharCode(...newSalt)));
    return newSalt;
  }

  /**
   * Store encrypted data
   * @param key
   * @param data
   * @param type
   */
  async store(key: string, data: any, type = 'general'): Promise<void> {
    if (!this.db || !this.encryptionKey) {
      throw new Error('Database not initialized');
    }

    // Serialize data
    const serialized = JSON.stringify(data);

    // Encrypt data
    const encrypted = await this.encryptData(serialized);

    // Store in IndexedDB
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);

      const record = {
        id: key,
        type: type,
        ...encrypted,
        timestamp: Date.now()
      };

      const request = store.put(record);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to store data'));
    });
  }

  /**
   * Retrieve and decrypt data
   * @param key
   */
  async retrieve(key: string): Promise<any> {
    if (!this.db || !this.encryptionKey) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.get(key);

      request.onsuccess = async () => {
        const record = request.result;
        if (!record) {
          resolve(null);
          return;
        }

        try {
          // Decrypt data
          const decrypted = await this.decryptData({
            data: record.data,
            iv: record.iv,
            salt: record.salt,
            timestamp: record.timestamp
          });

          // Parse and return
          resolve(JSON.parse(decrypted));
        } catch (error) {
          reject(new Error('Failed to decrypt data'));
        }
      };

      request.onerror = () => reject(new Error('Failed to retrieve data'));
    });
  }

  /**
   * Delete data
   * @param key
   */
  async delete(key: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to delete data'));
    });
  }

  /**
   * Clear all data
   */
  async clear(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to clear data'));
    });
  }

  /**
   * Encrypt data with AES-GCM
   * @param data
   */
  private async encryptData(data: string): Promise<EncryptedData> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);

    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Generate random salt for this specific encryption
    const salt = crypto.getRandomValues(new Uint8Array(32));

    // Encrypt
    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128
      },
      this.encryptionKey!,
      dataBuffer
    );

    return {
      data: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
      iv: btoa(String.fromCharCode(...iv)),
      salt: btoa(String.fromCharCode(...salt)),
      timestamp: Date.now()
    };
  }

  /**
   * Decrypt data with AES-GCM
   * @param encrypted
   */
  private async decryptData(encrypted: EncryptedData): Promise<string> {
    const decoder = new TextDecoder();

    // Decode from base64
    const encryptedBuffer = Uint8Array.from(atob(encrypted.data), c => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(encrypted.iv), c => c.charCodeAt(0));

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128
      },
      this.encryptionKey!,
      encryptedBuffer
    );

    return decoder.decode(decrypted);
  }

  /**
   * Check if database is initialized
   */
  isInitialized(): boolean {
    return this.db !== null && this.encryptionKey !== null;
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.encryptionKey = null;
  }

  /**
   * Get all keys of a specific type
   * @param type
   */
  async getKeysByType(type: string): Promise<string[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const index = store.index('type');
      const request = index.getAllKeys(type);

      request.onsuccess = () => resolve(request.result as string[]);
      request.onerror = () => reject(new Error('Failed to get keys'));
    });
  }

  /**
   * Export all data (encrypted)
   */
  async exportEncrypted(): Promise<string> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const data = request.result;
        resolve(JSON.stringify(data));
      };

      request.onerror = () => reject(new Error('Failed to export data'));
    });
  }

  /**
   * Import encrypted data
   * @param encryptedData
   */
  async importEncrypted(encryptedData: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const data = JSON.parse(encryptedData);

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);

      // Clear existing data
      store.clear();

      // Import new data
      for (const record of data) {
        store.put(record);
      }

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error('Failed to import data'));
    });
  }
}

// Export singleton instance
export const secureStorage = new SecureIndexedDB();
