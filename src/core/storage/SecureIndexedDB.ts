/**
 * Secure IndexedDB Storage with Encryption
 * Production-ready implementation for sensitive wallet data
 */

/**
 * Encrypted data structure
 */
interface EncryptedData {
  /** Encrypted data as base64 string */
  data: string;
  /** Initialization vector as base64 string */
  iv: string;
  /** Salt as base64 string */
  salt: string;
  /** Timestamp when data was encrypted */
  timestamp: number;
}

/**
 * IndexedDB record structure
 */
interface StorageRecord extends EncryptedData {
  /** Unique identifier */
  id: string;
  /** Logical type classification */
  type: string;
}

/**
 * Secure IndexedDB storage with encryption for sensitive wallet data
 */
export class SecureIndexedDB {
  private dbName: string;
  private db: IDBDatabase | null = null;
  private encryptionKey: CryptoKey | null = null;
  private readonly STORE_NAME = 'secure_storage';
  private readonly VERSION = 1;

  /**
   * Create a new secure IndexedDB instance
   * @param dbName - Name of the database
   */
  constructor(dbName = 'OmniWalletSecure') {
    this.dbName = dbName;
  }

  /**
   * Initialize the database and derive the encryption key from a password
   * @param password - User password used for key derivation
   * @returns Promise that resolves when initialization is complete
   */
  async initialize(password: string): Promise<void> {
    // Derive encryption key from password
    await this.deriveEncryptionKey(password);

    // Open IndexedDB
    await this.openDatabase();
  }

  /**
   * Open or create the IndexedDB database
   * @returns Promise that resolves when database is open
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
   * @param password - User password for key derivation
   * @returns Promise that resolves when key is derived
   */
  private async deriveEncryptionKey(password: string): Promise<void> {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);

    // Use a fixed salt for the master key (stored separately in production)
    // In production, this should be unique per user and stored securely
    const masterSaltArray = this.getMasterSalt();
    // Ensure we have a proper BufferSource by creating a new Uint8Array with clean buffer
    const masterSalt = new Uint8Array(masterSaltArray);

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
   * @returns Master salt as Uint8Array
   */
  private getMasterSalt(): Uint8Array {
    const SALT_KEY = 'omniwallet_master_salt';

    // Try to get existing salt from localStorage
    const storedSalt = localStorage.getItem(SALT_KEY);
    if (storedSalt !== null) {
      return Uint8Array.from(atob(storedSalt), c => c.charCodeAt(0));
    }

    // Generate new salt if none exists
    const newSalt = crypto.getRandomValues(new Uint8Array(32));
    localStorage.setItem(SALT_KEY, btoa(Array.from(newSalt).map(b => String.fromCharCode(b)).join('')));
    return newSalt;
  }

  /**
   * Store encrypted JSON‑serializable data under a key
   * @param key - Unique key for the record
   * @param data - Arbitrary JSON‑serializable payload
   * @param type - Optional logical type classification
   * @returns Promise that resolves when data is stored
   */
  async store(key: string, data: unknown, type = 'general'): Promise<void> {
    if (this.db === null || this.encryptionKey === null) {
      throw new Error('Database not initialized');
    }

    // Serialize data
    const serialized = JSON.stringify(data);

    // Encrypt data
    const encrypted = await this.encryptData(serialized);

    // Store in IndexedDB
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);

      const record: StorageRecord = {
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
   * Retrieve and decrypt data previously stored under a key
   * @param key - Storage key
   * @returns Parsed JSON object or null if not found
   */
  async retrieve(key: string): Promise<unknown> {
    if (this.db === null || this.encryptionKey === null) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.get(key);

      request.onsuccess = async () => {
        const record = request.result as StorageRecord | undefined;
        if (record === undefined) {
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
          resolve(JSON.parse(decrypted) as unknown);
        } catch (error) {
          reject(new Error('Failed to decrypt data'));
        }
      };

      request.onerror = () => reject(new Error('Failed to retrieve data'));
    });
  }

  /**
   * Delete a record by key
   * @param key - Storage key to remove
   * @returns Promise that resolves when data is deleted
   */
  async delete(key: string): Promise<void> {
    if (this.db === null) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to delete data'));
    });
  }

  /**
   * Clear all data from the secure store
   * @returns Promise that resolves when data is cleared
   */
  async clear(): Promise<void> {
    if (this.db === null) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to clear data'));
    });
  }

  /**
   * Encrypt a UTF‑8 string with AES‑GCM using the derived key
   * @param data - Plaintext UTF‑8 string
   * @returns Encrypted payload with IV/salt/timestamp
   */
  private async encryptData(data: string): Promise<EncryptedData> {
    if (this.encryptionKey === null) {
      throw new Error('Encryption key not initialized');
    }

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
      this.encryptionKey,
      dataBuffer
    );

    return {
      data: btoa(Array.from(new Uint8Array(encrypted)).map(b => String.fromCharCode(b)).join('')),
      iv: btoa(Array.from(iv).map(b => String.fromCharCode(b)).join('')),
      salt: btoa(Array.from(salt).map(b => String.fromCharCode(b)).join('')),
      timestamp: Date.now()
    };
  }

  /**
   * Decrypt an AES‑GCM payload using the derived key
   * @param encrypted - Encrypted payload with IV
   * @returns Decrypted UTF‑8 plaintext
   */
  private async decryptData(encrypted: EncryptedData): Promise<string> {
    if (this.encryptionKey === null) {
      throw new Error('Encryption key not initialized');
    }

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
      this.encryptionKey,
      encryptedBuffer
    );

    return decoder.decode(decrypted);
  }

  /**
   * Check if database is initialized
   * @returns True when DB and encryption key are initialized
   */
  isInitialized(): boolean {
    return this.db !== null && this.encryptionKey !== null;
  }

  /**
   * Close the database connection and clear the key from memory
   * @returns void
   */
  close(): void {
    if (this.db !== null) {
      this.db.close();
      this.db = null;
    }
    this.encryptionKey = null;
  }

  /**
   * Get all keys that match a logical `type` classification
   * @param type - Logical type index value
   * @returns Array of keys matching the type
   */
  async getKeysByType(type: string): Promise<string[]> {
    if (this.db === null) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const index = store.index('type');
      const request = index.getAllKeys(type);

      request.onsuccess = () => resolve(request.result as string[]);
      request.onerror = () => reject(new Error('Failed to get keys'));
    });
  }

  /**
   * Export all encrypted records as a JSON string
   * @returns JSON string containing all records
   */
  async exportEncrypted(): Promise<string> {
    if (this.db === null) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const data = request.result as StorageRecord[];
        resolve(JSON.stringify(data));
      };

      request.onerror = () => reject(new Error('Failed to export data'));
    });
  }

  /**
   * Import a JSON string of encrypted records, replacing current contents
   * @param encryptedData - JSON string produced by exportEncrypted
   * @returns Promise that resolves when data is imported
   */
  async importEncrypted(encryptedData: string): Promise<void> {
    if (this.db === null) {
      throw new Error('Database not initialized');
    }

    const data = JSON.parse(encryptedData) as StorageRecord[];

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
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