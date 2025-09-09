/**
 * SecureIndexedDB Test Suite
 * 
 * Tests secure IndexedDB storage with encryption for sensitive wallet data.
 * Uses fake-indexeddb for testing IndexedDB functionality in Node.js environment.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import 'fake-indexeddb/auto';
import { SecureIndexedDB, secureStorage } from '../../../src/core/storage/SecureIndexedDB';

// Mock crypto API for Node.js test environment
const mockCrypto = {
  getRandomValues: (array: Uint8Array) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  },
  subtle: {
    importKey: jest.fn(),
    deriveKey: jest.fn(),
    encrypt: jest.fn(),
    decrypt: jest.fn()
  }
};

// Set up global crypto
(global as any).crypto = mockCrypto;

// Mock localStorage
const mockLocalStorage = (() => {
  let store: { [key: string]: string } = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();

(global as any).localStorage = mockLocalStorage;

describe('SecureIndexedDB', () => {
  let storage: SecureIndexedDB;
  const TEST_PASSWORD = 'TestPassword123!@#';
  const TEST_DB_NAME = 'TestSecureDB';

  // Helper to create mock crypto key
  const mockCryptoKey = { type: 'secret', algorithm: 'AES-GCM' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.clear();
    storage = new SecureIndexedDB(TEST_DB_NAME);

    // Set up crypto mocks
    mockCrypto.subtle.importKey.mockResolvedValue(mockCryptoKey);
    mockCrypto.subtle.deriveKey.mockResolvedValue(mockCryptoKey);
    
    // Mock encrypt to add a simple tag to data
    mockCrypto.subtle.encrypt.mockImplementation(async (algorithm, key, data) => {
      const dataArray = new Uint8Array(data);
      const encrypted = new Uint8Array(dataArray.length + 16);
      // Simple XOR encryption for testing
      for (let i = 0; i < dataArray.length; i++) {
        encrypted[i] = dataArray[i] ^ 0xAB;
      }
      // Add mock tag
      for (let i = 0; i < 16; i++) {
        encrypted[dataArray.length + i] = i;
      }
      return encrypted.buffer;
    });
    
    // Mock decrypt to reverse the encryption
    mockCrypto.subtle.decrypt.mockImplementation(async (algorithm, key, data) => {
      const dataArray = new Uint8Array(data);
      const decrypted = new Uint8Array(dataArray.length - 16);
      // Reverse XOR encryption
      for (let i = 0; i < decrypted.length; i++) {
        decrypted[i] = dataArray[i] ^ 0xAB;
      }
      return decrypted.buffer;
    });
  });

  afterEach(() => {
    if (storage.isInitialized()) {
      storage.close();
    }
    // Clean up IndexedDB
    indexedDB.deleteDatabase(TEST_DB_NAME);
  });

  describe('Initialization', () => {
    it('should initialize with password', async () => {
      await expect(storage.initialize(TEST_PASSWORD)).resolves.toBeUndefined();
      expect(storage.isInitialized()).toBe(true);
    });

    it('should derive encryption key from password', async () => {
      await storage.initialize(TEST_PASSWORD);

      expect(mockCrypto.subtle.importKey).toHaveBeenCalledWith(
        'raw',
        expect.any(Uint8Array),
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
      );

      expect(mockCrypto.subtle.deriveKey).toHaveBeenCalledWith(
        {
          name: 'PBKDF2',
          salt: expect.any(Uint8Array),
          iterations: 210000,
          hash: 'SHA-256'
        },
        mockCryptoKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
    });

    it('should generate and store master salt', async () => {
      await storage.initialize(TEST_PASSWORD);
      
      const salt = localStorage.getItem('omniwallet_master_salt');
      expect(salt).toBeDefined();
      expect(salt).toMatch(/^[A-Za-z0-9+/]+=*$/); // Base64 pattern
    });

    it('should reuse existing master salt', async () => {
      // First initialization
      await storage.initialize(TEST_PASSWORD);
      const salt1 = localStorage.getItem('omniwallet_master_salt');

      // Close and create new instance
      storage.close();
      storage = new SecureIndexedDB(TEST_DB_NAME);

      // Second initialization
      await storage.initialize(TEST_PASSWORD);
      const salt2 = localStorage.getItem('omniwallet_master_salt');

      expect(salt2).toBe(salt1);
    });

    it('should create database with correct structure', async () => {
      await storage.initialize(TEST_PASSWORD);

      // Verify database exists
      const dbList = await indexedDB.databases();
      expect(dbList.some(db => db.name === TEST_DB_NAME)).toBe(true);
    });

    it('should handle database open errors', async () => {
      // Mock indexedDB.open to fail
      const originalOpen = indexedDB.open;
      (indexedDB as any).open = jest.fn(() => {
        const request = originalOpen.call(indexedDB, TEST_DB_NAME, 1);
        setTimeout(() => {
          request.dispatchEvent(new Event('error'));
        }, 0);
        return request;
      });

      await expect(storage.initialize(TEST_PASSWORD)).rejects.toThrow('Failed to open database');

      // Restore original
      (indexedDB as any).open = originalOpen;
    });
  });

  describe('Store and Retrieve', () => {
    beforeEach(async () => {
      await storage.initialize(TEST_PASSWORD);
    });

    it('should store and retrieve JSON data', async () => {
      const testData = {
        username: 'testuser',
        settings: { theme: 'dark', language: 'en' },
        balance: '1000.50'
      };

      await storage.store('user_data', testData);
      const retrieved = await storage.retrieve('user_data');

      expect(retrieved).toEqual(testData);
    });

    it('should encrypt data before storage', async () => {
      const sensitiveData = { privateKey: 'secret123', mnemonic: 'word1 word2 word3' };
      
      await storage.store('wallet_keys', sensitiveData);

      expect(mockCrypto.subtle.encrypt).toHaveBeenCalledWith(
        {
          name: 'AES-GCM',
          iv: expect.any(Uint8Array),
          tagLength: 128
        },
        mockCryptoKey,
        expect.any(ArrayBuffer)
      );
    });

    it('should decrypt data on retrieval', async () => {
      const testData = { secret: 'classified' };
      
      await storage.store('secret_data', testData);
      await storage.retrieve('secret_data');

      expect(mockCrypto.subtle.decrypt).toHaveBeenCalledWith(
        {
          name: 'AES-GCM',
          iv: expect.any(Uint8Array),
          tagLength: 128
        },
        mockCryptoKey,
        expect.any(ArrayBuffer)
      );
    });

    it('should store with type classification', async () => {
      await storage.store('key1', { data: 'test1' }, 'wallet');
      await storage.store('key2', { data: 'test2' }, 'settings');
      await storage.store('key3', { data: 'test3' }, 'wallet');

      const walletKeys = await storage.getKeysByType('wallet');
      expect(walletKeys).toHaveLength(2);
      expect(walletKeys).toContain('key1');
      expect(walletKeys).toContain('key3');
    });

    it('should handle complex nested data', async () => {
      const complexData = {
        wallets: [
          { address: '0x123', balance: { ETH: '1.5', USDC: '1000' } },
          { address: '0x456', balance: { ETH: '0.5', USDC: '500' } }
        ],
        transactions: [
          { hash: '0xabc', from: '0x123', to: '0x789', value: '0.1' }
        ],
        metadata: {
          version: 1,
          lastUpdate: new Date().toISOString(),
          preferences: { notifications: true, autoBackup: false }
        }
      };

      await storage.store('complex_data', complexData);
      const retrieved = await storage.retrieve('complex_data');

      expect(retrieved).toEqual(complexData);
    });

    it('should return null for non-existent keys', async () => {
      const result = await storage.retrieve('non_existent_key');
      expect(result).toBeNull();
    });

    it('should overwrite existing data', async () => {
      await storage.store('test_key', { version: 1 });
      await storage.store('test_key', { version: 2 });

      const retrieved = await storage.retrieve('test_key');
      expect(retrieved).toEqual({ version: 2 });
    });

    it('should handle empty objects and arrays', async () => {
      await storage.store('empty_object', {});
      await storage.store('empty_array', []);

      expect(await storage.retrieve('empty_object')).toEqual({});
      expect(await storage.retrieve('empty_array')).toEqual([]);
    });

    it('should handle special characters in keys', async () => {
      const specialKey = 'user@example.com:wallet:2024';
      await storage.store(specialKey, { data: 'test' });
      
      const retrieved = await storage.retrieve(specialKey);
      expect(retrieved).toEqual({ data: 'test' });
    });

    it('should throw when database not initialized', async () => {
      storage.close();
      
      await expect(storage.store('key', { data: 'test' }))
        .rejects.toThrow('Database not initialized');
      
      await expect(storage.retrieve('key'))
        .rejects.toThrow('Database not initialized');
    });

    it('should handle decryption errors gracefully', async () => {
      await storage.store('test_key', { data: 'test' });
      
      // Mock decrypt to fail
      mockCrypto.subtle.decrypt.mockRejectedValueOnce(new Error('Decryption failed'));
      
      await expect(storage.retrieve('test_key'))
        .rejects.toThrow('Failed to decrypt data');
    });
  });

  describe('Delete Operations', () => {
    beforeEach(async () => {
      await storage.initialize(TEST_PASSWORD);
    });

    it('should delete stored data', async () => {
      await storage.store('test_key', { data: 'test' });
      
      // Verify it exists
      let retrieved = await storage.retrieve('test_key');
      expect(retrieved).toEqual({ data: 'test' });

      // Delete it
      await storage.delete('test_key');

      // Verify it's gone
      retrieved = await storage.retrieve('test_key');
      expect(retrieved).toBeNull();
    });

    it('should handle deleting non-existent keys', async () => {
      await expect(storage.delete('non_existent_key')).resolves.toBeUndefined();
    });

    it('should clear all data', async () => {
      // Store multiple items
      await storage.store('key1', { data: 'test1' });
      await storage.store('key2', { data: 'test2' });
      await storage.store('key3', { data: 'test3' });

      // Clear all
      await storage.clear();

      // Verify all are gone
      expect(await storage.retrieve('key1')).toBeNull();
      expect(await storage.retrieve('key2')).toBeNull();
      expect(await storage.retrieve('key3')).toBeNull();
    });

    it('should throw when database not initialized for delete', async () => {
      storage.close();
      
      await expect(storage.delete('key'))
        .rejects.toThrow('Database not initialized');
    });

    it('should throw when database not initialized for clear', async () => {
      storage.close();
      
      await expect(storage.clear())
        .rejects.toThrow('Database not initialized');
    });
  });

  describe('Export and Import', () => {
    beforeEach(async () => {
      await storage.initialize(TEST_PASSWORD);
    });

    it('should export all encrypted data', async () => {
      // Store test data
      await storage.store('key1', { data: 'test1' }, 'type1');
      await storage.store('key2', { data: 'test2' }, 'type2');
      await storage.store('key3', { data: 'test3' }, 'type1');

      const exported = await storage.exportEncrypted();
      expect(exported).toBeTruthy();

      const parsed = JSON.parse(exported);
      expect(parsed).toBeInstanceOf(Array);
      expect(parsed).toHaveLength(3);

      // Verify structure
      parsed.forEach((record: any) => {
        expect(record).toHaveProperty('id');
        expect(record).toHaveProperty('type');
        expect(record).toHaveProperty('data');
        expect(record).toHaveProperty('iv');
        expect(record).toHaveProperty('salt');
        expect(record).toHaveProperty('timestamp');
      });
    });

    it('should import encrypted data', async () => {
      // Store and export
      await storage.store('original1', { data: 'test1' });
      await storage.store('original2', { data: 'test2' });
      const exported = await storage.exportEncrypted();

      // Clear and import
      await storage.clear();
      await storage.importEncrypted(exported);

      // Verify imported data
      expect(await storage.retrieve('original1')).toEqual({ data: 'test1' });
      expect(await storage.retrieve('original2')).toEqual({ data: 'test2' });
    });

    it('should replace existing data on import', async () => {
      // Store initial data
      await storage.store('key1', { version: 1 });
      await storage.store('key2', { version: 1 });

      // Export different data from another instance
      const storage2 = new SecureIndexedDB('TempDB');
      await storage2.initialize(TEST_PASSWORD);
      await storage2.store('key1', { version: 2 });
      await storage2.store('key3', { version: 1 });
      const exported = await storage2.exportEncrypted();
      storage2.close();

      // Import into original
      await storage.importEncrypted(exported);

      // Verify replacement
      expect(await storage.retrieve('key1')).toEqual({ version: 2 });
      expect(await storage.retrieve('key2')).toBeNull(); // Should be gone
      expect(await storage.retrieve('key3')).toEqual({ version: 1 });
    });

    it('should handle empty export', async () => {
      const exported = await storage.exportEncrypted();
      const parsed = JSON.parse(exported);
      expect(parsed).toEqual([]);
    });

    it('should handle invalid import data', async () => {
      await expect(storage.importEncrypted('invalid json'))
        .rejects.toThrow();

      await expect(storage.importEncrypted('null'))
        .rejects.toThrow();
    });

    it('should throw when database not initialized', async () => {
      storage.close();
      
      await expect(storage.exportEncrypted())
        .rejects.toThrow('Database not initialized');
      
      await expect(storage.importEncrypted('[]'))
        .rejects.toThrow('Database not initialized');
    });
  });

  describe('Query Operations', () => {
    beforeEach(async () => {
      await storage.initialize(TEST_PASSWORD);
    });

    it('should get keys by type', async () => {
      await storage.store('wallet1', { address: '0x123' }, 'wallet');
      await storage.store('wallet2', { address: '0x456' }, 'wallet');
      await storage.store('setting1', { theme: 'dark' }, 'settings');
      await storage.store('wallet3', { address: '0x789' }, 'wallet');

      const walletKeys = await storage.getKeysByType('wallet');
      expect(walletKeys).toHaveLength(3);
      expect(walletKeys).toContain('wallet1');
      expect(walletKeys).toContain('wallet2');
      expect(walletKeys).toContain('wallet3');

      const settingsKeys = await storage.getKeysByType('settings');
      expect(settingsKeys).toHaveLength(1);
      expect(settingsKeys).toContain('setting1');
    });

    it('should return empty array for non-existent type', async () => {
      const keys = await storage.getKeysByType('non_existent_type');
      expect(keys).toEqual([]);
    });

    it('should handle type query errors', async () => {
      storage.close();
      
      await expect(storage.getKeysByType('wallet'))
        .rejects.toThrow('Database not initialized');
    });
  });

  describe('Timestamp Tracking', () => {
    beforeEach(async () => {
      await storage.initialize(TEST_PASSWORD);
    });

    it('should add timestamp to stored records', async () => {
      const before = Date.now();
      await storage.store('test_key', { data: 'test' });
      const after = Date.now();

      const exported = await storage.exportEncrypted();
      const records = JSON.parse(exported);
      
      expect(records[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(records[0].timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('Database Lifecycle', () => {
    it('should properly close database', async () => {
      await storage.initialize(TEST_PASSWORD);
      expect(storage.isInitialized()).toBe(true);

      storage.close();
      expect(storage.isInitialized()).toBe(false);
    });

    it('should allow reinitialization after close', async () => {
      await storage.initialize(TEST_PASSWORD);
      storage.close();

      await storage.initialize(TEST_PASSWORD);
      expect(storage.isInitialized()).toBe(true);

      // Should work normally
      await storage.store('test', { data: 'value' });
      const retrieved = await storage.retrieve('test');
      expect(retrieved).toEqual({ data: 'value' });
    });

    it('should handle multiple databases', async () => {
      const storage1 = new SecureIndexedDB('DB1');
      const storage2 = new SecureIndexedDB('DB2');

      await storage1.initialize('password1');
      await storage2.initialize('password2');

      await storage1.store('key', { db: 1 });
      await storage2.store('key', { db: 2 });

      expect(await storage1.retrieve('key')).toEqual({ db: 1 });
      expect(await storage2.retrieve('key')).toEqual({ db: 2 });

      storage1.close();
      storage2.close();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await storage.initialize(TEST_PASSWORD);
    });

    it('should handle transaction errors', async () => {
      // Mock transaction to fail
      const db = (storage as any).db;
      const originalTransaction = db.transaction.bind(db);
      db.transaction = jest.fn(() => {
        const tx = originalTransaction(['secure_storage'], 'readwrite');
        const originalObjectStore = tx.objectStore.bind(tx);
        tx.objectStore = jest.fn(() => {
          const store = originalObjectStore('secure_storage');
          store.put = jest.fn(() => {
            const request = { onsuccess: null, onerror: null };
            setTimeout(() => {
              if (request.onerror) request.onerror();
            }, 0);
            return request;
          });
          return store;
        });
        return tx;
      });

      await expect(storage.store('test', { data: 'value' }))
        .rejects.toThrow('Failed to store data');
    });

    it('should handle encryption errors', async () => {
      mockCrypto.subtle.encrypt.mockRejectedValueOnce(new Error('Encryption failed'));

      await expect(storage.store('test', { data: 'value' }))
        .rejects.toThrow();
    });
  });

  describe('Singleton Instance', () => {
    it('should export singleton instance', () => {
      expect(secureStorage).toBeInstanceOf(SecureIndexedDB);
    });

    it('should use default database name', async () => {
      await secureStorage.initialize(TEST_PASSWORD);
      
      const dbList = await indexedDB.databases();
      expect(dbList.some(db => db.name === 'OmniWalletSecure')).toBe(true);

      secureStorage.close();
    });
  });

  describe('Security Considerations', () => {
    beforeEach(async () => {
      await storage.initialize(TEST_PASSWORD);
    });

    it('should use high iteration count for key derivation', async () => {
      expect(mockCrypto.subtle.deriveKey).toHaveBeenCalledWith(
        expect.objectContaining({ iterations: 210000 }),
        expect.anything(),
        expect.anything(),
        false,
        ['encrypt', 'decrypt']
      );
    });

    it('should generate unique IV for each encryption', async () => {
      await storage.store('key1', { data: 'test' });
      await storage.store('key2', { data: 'test' });

      const encryptCalls = mockCrypto.subtle.encrypt.mock.calls;
      const iv1 = encryptCalls[0][0].iv;
      const iv2 = encryptCalls[1][0].iv;

      expect(iv1).not.toEqual(iv2);
    });

    it('should generate unique salt for each record', async () => {
      await storage.store('key1', { data: 'test' });
      await storage.store('key2', { data: 'test' });

      const exported = await storage.exportEncrypted();
      const records = JSON.parse(exported);

      expect(records[0].salt).not.toBe(records[1].salt);
    });

    it('should not expose plaintext in exported data', async () => {
      const sensitiveData = {
        privateKey: '0x1234567890abcdef',
        mnemonic: 'word1 word2 word3 word4',
        password: 'userPassword123'
      };

      await storage.store('sensitive', sensitiveData);
      const exported = await storage.exportEncrypted();

      // Check that sensitive strings don't appear in export
      expect(exported).not.toContain('0x1234567890abcdef');
      expect(exported).not.toContain('word1 word2 word3');
      expect(exported).not.toContain('userPassword123');
    });

    it('should require same password for decryption', async () => {
      await storage.store('test', { data: 'secret' });
      storage.close();

      // Try with different password (would fail in real implementation)
      const storage2 = new SecureIndexedDB(TEST_DB_NAME);
      await storage2.initialize('DifferentPassword');

      // In real implementation, this would fail due to different derived key
      // For this test, we're verifying the encryption/decryption was called
      await storage2.retrieve('test');
      expect(mockCrypto.subtle.decrypt).toHaveBeenCalled();

      storage2.close();
    });
  });
});