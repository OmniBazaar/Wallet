/**
 * Tests for WalletDatabase Service
 * 
 * Tests the main wallet database functionality including account storage,
 * preferences management, configuration, and backup/restore operations.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { WalletDatabase } from '../../src/services/WalletDatabase';
import type { 
  WalletAccountData, 
  WalletPreferences, 
  WalletConfig,
  QueryOptions
} from '../../src/services/WalletDatabase';

// Mock IndexedDB
const mockObjectStore = {
  put: jest.fn(),
  get: jest.fn(),
  getAll: jest.fn(),
  delete: jest.fn(),
  clear: jest.fn(),
  createIndex: jest.fn()
};

const mockTransaction = {
  objectStore: jest.fn(() => mockObjectStore)
};

const mockDatabase = {
  transaction: jest.fn(() => mockTransaction),
  createObjectStore: jest.fn(() => mockObjectStore),
  objectStoreNames: {
    contains: jest.fn((name: string) => false)
  },
  close: jest.fn()
};

const mockOpenDBRequest = {
  result: mockDatabase,
  error: null,
  onsuccess: null as any,
  onerror: null as any,
  onupgradeneeded: null as any
};

// Mock indexedDB global
global.indexedDB = {
  open: jest.fn(() => mockOpenDBRequest),
  deleteDatabase: jest.fn(),
  databases: jest.fn(),
  cmp: jest.fn()
} as any;

// Mock btoa and atob for Node environment
global.btoa = (str: string) => Buffer.from(str).toString('base64');
global.atob = (str: string) => Buffer.from(str, 'base64').toString();

describe('WalletDatabase', () => {
  let db: WalletDatabase;

  const mockAccount: WalletAccountData = {
    id: 'account-1',
    address: '0x1234567890123456789012345678901234567890',
    name: 'Test Account',
    type: 'generated',
    chainId: 1,
    publicKey: '0x' + 'a'.repeat(130),
    derivationPath: "m/44'/60'/0'/0/0",
    createdAt: 1234567890000,
    lastAccessedAt: 1234567890000,
    isActive: true,
    metadata: { source: 'test' }
  };

  const mockPreferences: WalletPreferences = {
    userId: 'user-1',
    defaultCurrency: 'USD',
    language: 'en',
    theme: 'dark',
    autoLockTimeout: 15,
    showBalanceOnStartup: true,
    privacyMode: false,
    notifications: {
      transactions: true,
      priceAlerts: true,
      security: true
    },
    gasSettings: {
      defaultGasPrice: '20000000000',
      maxGasPrice: '100000000000',
      gasLimitBuffer: 1.2
    },
    updatedAt: 1234567890000
  };

  const mockConfig: WalletConfig = {
    id: 'config-1',
    version: '1.0.0',
    networks: {
      1: {
        name: 'Ethereum Mainnet',
        rpcUrl: 'https://mainnet.infura.io/v3/xxx',
        explorerUrl: 'https://etherscan.io',
        isCustom: false
      }
    },
    tokens: {
      '0xtoken': {
        symbol: 'TEST',
        name: 'Test Token',
        decimals: 18,
        logoUrl: 'https://example.com/logo.png',
        isCustom: true
      }
    },
    security: {
      biometricEnabled: true,
      autoBackup: true,
      encryptionLevel: 'high'
    },
    updatedAt: 1234567890000
  };

  beforeEach(() => {
    jest.clearAllMocks();
    db = new WalletDatabase();

    // Reset mock request callbacks
    mockOpenDBRequest.onsuccess = null;
    mockOpenDBRequest.onerror = null;
    mockOpenDBRequest.onupgradeneeded = null;
  });

  afterEach(async () => {
    await db.cleanup();
  });

  describe('Initialization', () => {
    it('should initialize database successfully', async () => {
      // Setup mock for successful initialization
      (global.indexedDB.open as jest.Mock).mockImplementation(() => {
        setTimeout(() => mockOpenDBRequest.onsuccess?.(), 0);
        return mockOpenDBRequest;
      });

      await db.init();

      expect(global.indexedDB.open).toHaveBeenCalledWith('OmniWallet', 1);
      expect(db['isInitialized']).toBe(true);
    });

    it('should handle initialization errors', async () => {
      // Setup mock for failed initialization
      (global.indexedDB.open as jest.Mock).mockImplementation(() => {
        setTimeout(() => mockOpenDBRequest.onerror?.(), 0);
        return mockOpenDBRequest;
      });

      await expect(db.init()).rejects.toThrow('Failed to initialize wallet database');
    });

    it('should not reinitialize if already initialized', async () => {
      (global.indexedDB.open as jest.Mock).mockImplementation(() => {
        setTimeout(() => mockOpenDBRequest.onsuccess?.(), 0);
        return mockOpenDBRequest;
      });

      await db.init();
      const openCalls = (global.indexedDB.open as jest.Mock).mock.calls.length;

      await db.init();
      expect((global.indexedDB.open as jest.Mock).mock.calls.length).toBe(openCalls);
    });

    it('should handle missing IndexedDB', async () => {
      const originalIndexedDB = global.indexedDB;
      (global as any).indexedDB = undefined;

      await expect(db.init()).rejects.toThrow('IndexedDB not supported');

      global.indexedDB = originalIndexedDB;
    });

    it('should create object stores on upgrade', async () => {
      (global.indexedDB.open as jest.Mock).mockImplementation(() => {
        setTimeout(() => {
          mockOpenDBRequest.onupgradeneeded?.({ target: mockOpenDBRequest } as any);
          mockOpenDBRequest.onsuccess?.();
        }, 0);
        return mockOpenDBRequest;
      });

      await db.init();

      expect(mockDatabase.createObjectStore).toHaveBeenCalledWith('accounts', { keyPath: 'id' });
      expect(mockDatabase.createObjectStore).toHaveBeenCalledWith('preferences', { keyPath: 'userId' });
      expect(mockDatabase.createObjectStore).toHaveBeenCalledWith('config', { keyPath: 'id' });
      expect(mockDatabase.createObjectStore).toHaveBeenCalledWith('contacts', { keyPath: 'id' });
    });
  });

  describe('Account Management', () => {
    beforeEach(async () => {
      (global.indexedDB.open as jest.Mock).mockImplementation(() => {
        setTimeout(() => mockOpenDBRequest.onsuccess?.(), 0);
        return mockOpenDBRequest;
      });
      await db.init();
    });

    it('should save account successfully', async () => {
      mockObjectStore.put.mockImplementation((data) => ({
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const result = await db.saveAccount(mockAccount);

      expect(result).toBe(true);
      expect(mockObjectStore.put).toHaveBeenCalledWith(mockAccount);
    });

    it('should handle save account errors', async () => {
      mockObjectStore.put.mockImplementation(() => ({
        onsuccess: null,
        onerror: function() { this.onerror?.(); },
        error: new Error('Save failed')
      }));

      const result = await db.saveAccount(mockAccount);

      expect(result).toBe(false);
    });

    it('should get account by ID', async () => {
      mockObjectStore.get.mockImplementation((id) => ({
        result: id === mockAccount.id ? mockAccount : null,
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const account = await db.getAccount(mockAccount.id);

      expect(account).toEqual(mockAccount);
      expect(mockObjectStore.get).toHaveBeenCalledWith(mockAccount.id);
    });

    it('should return null for non-existent account', async () => {
      mockObjectStore.get.mockImplementation(() => ({
        result: null,
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const account = await db.getAccount('non-existent');

      expect(account).toBeNull();
    });

    it('should get all accounts', async () => {
      const mockAccounts = [mockAccount, { ...mockAccount, id: 'account-2' }];
      
      mockObjectStore.getAll.mockImplementation(() => ({
        result: mockAccounts,
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const accounts = await db.getAccounts();

      expect(accounts).toEqual(mockAccounts);
    });

    it('should filter accounts', async () => {
      const accounts = [
        mockAccount,
        { ...mockAccount, id: 'account-2', type: 'imported' as const },
        { ...mockAccount, id: 'account-3', type: 'hardware' as const }
      ];

      mockObjectStore.getAll.mockImplementation(() => ({
        result: accounts,
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const filtered = await db.getAccounts({ filters: { type: 'imported' } });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].type).toBe('imported');
    });

    it('should sort accounts', async () => {
      const accounts = [
        { ...mockAccount, id: 'account-3', createdAt: 3000 },
        { ...mockAccount, id: 'account-1', createdAt: 1000 },
        { ...mockAccount, id: 'account-2', createdAt: 2000 }
      ];

      mockObjectStore.getAll.mockImplementation(() => ({
        result: accounts,
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const sorted = await db.getAccounts({ 
        sortBy: 'createdAt', 
        sortOrder: 'asc' 
      });

      expect(sorted[0].createdAt).toBe(1000);
      expect(sorted[1].createdAt).toBe(2000);
      expect(sorted[2].createdAt).toBe(3000);
    });

    it('should paginate accounts', async () => {
      const accounts = Array(10).fill(null).map((_, i) => ({
        ...mockAccount,
        id: `account-${i}`
      }));

      mockObjectStore.getAll.mockImplementation(() => ({
        result: accounts,
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const paginated = await db.getAccounts({ 
        limit: 5, 
        offset: 2 
      });

      expect(paginated).toHaveLength(5);
      expect(paginated[0].id).toBe('account-2');
      expect(paginated[4].id).toBe('account-6');
    });

    it('should delete account', async () => {
      mockObjectStore.delete.mockImplementation(() => ({
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const result = await db.deleteAccount(mockAccount.id);

      expect(result).toBe(true);
      expect(mockObjectStore.delete).toHaveBeenCalledWith(mockAccount.id);
    });

    it('should handle delete account errors', async () => {
      mockObjectStore.delete.mockImplementation(() => ({
        onsuccess: null,
        onerror: function() { this.onerror?.(); },
        error: new Error('Delete failed')
      }));

      const result = await db.deleteAccount(mockAccount.id);

      expect(result).toBe(false);
    });
  });

  describe('Preferences Management', () => {
    beforeEach(async () => {
      (global.indexedDB.open as jest.Mock).mockImplementation(() => {
        setTimeout(() => mockOpenDBRequest.onsuccess?.(), 0);
        return mockOpenDBRequest;
      });
      await db.init();
    });

    it('should save preferences', async () => {
      mockObjectStore.put.mockImplementation((data) => ({
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const result = await db.savePreferences(mockPreferences);

      expect(result).toBe(true);
      expect(mockObjectStore.put).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockPreferences,
          updatedAt: expect.any(Number)
        })
      );
    });

    it('should get preferences', async () => {
      mockObjectStore.get.mockImplementation((userId) => ({
        result: userId === mockPreferences.userId ? mockPreferences : null,
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const prefs = await db.getPreferences(mockPreferences.userId);

      expect(prefs).toEqual(mockPreferences);
    });

    it('should return default preferences if not found', async () => {
      mockObjectStore.get.mockImplementation(() => ({
        result: null,
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const prefs = await db.getPreferences('new-user');

      expect(prefs.userId).toBe('new-user');
      expect(prefs.defaultCurrency).toBe('USD');
      expect(prefs.language).toBe('en');
      expect(prefs.theme).toBe('auto');
    });

    it('should handle preferences errors with defaults', async () => {
      mockObjectStore.get.mockImplementation(() => ({
        onsuccess: null,
        onerror: function() { this.onerror?.(); },
        error: new Error('Get failed')
      }));

      const prefs = await db.getPreferences('user-1');

      expect(prefs.userId).toBe('user-1');
      expect(prefs.defaultCurrency).toBe('USD');
    });
  });

  describe('Configuration Management', () => {
    beforeEach(async () => {
      (global.indexedDB.open as jest.Mock).mockImplementation(() => {
        setTimeout(() => mockOpenDBRequest.onsuccess?.(), 0);
        return mockOpenDBRequest;
      });
      await db.init();
    });

    it('should save configuration', async () => {
      mockObjectStore.put.mockImplementation((data) => ({
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const result = await db.saveConfig(mockConfig);

      expect(result).toBe(true);
      expect(mockObjectStore.put).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockConfig,
          updatedAt: expect.any(Number)
        })
      );
    });

    it('should get configuration', async () => {
      mockObjectStore.get.mockImplementation((id) => ({
        result: id === mockConfig.id ? mockConfig : null,
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const config = await db.getConfig(mockConfig.id);

      expect(config).toEqual(mockConfig);
    });

    it('should return null for non-existent config', async () => {
      mockObjectStore.get.mockImplementation(() => ({
        result: null,
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const config = await db.getConfig('non-existent');

      expect(config).toBeNull();
    });
  });

  describe('Wallet Compatibility Methods', () => {
    beforeEach(async () => {
      (global.indexedDB.open as jest.Mock).mockImplementation(() => {
        setTimeout(() => mockOpenDBRequest.onsuccess?.(), 0);
        return mockOpenDBRequest;
      });
      await db.init();
    });

    it('should save wallet using compatibility method', async () => {
      mockObjectStore.put.mockImplementation((data) => ({
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const wallet = {
        address: '0xabcdef',
        name: 'Test Wallet'
      };

      const result = await db.saveWallet(wallet);

      expect(result).toBe(true);
      expect(mockObjectStore.put).toHaveBeenCalledWith(
        expect.objectContaining({
          id: wallet.address,
          address: wallet.address,
          name: wallet.name,
          type: 'imported',
          createdAt: expect.any(Number),
          lastAccessedAt: expect.any(Number),
          isActive: true
        })
      );
    });

    it('should get wallet by address', async () => {
      const walletData = {
        id: '0xabcdef',
        address: '0xabcdef',
        name: 'Test Wallet',
        type: 'imported' as const,
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
        isActive: true
      };

      mockObjectStore.get.mockImplementation((id) => ({
        result: id === walletData.id ? walletData : null,
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const wallet = await db.getWallet('0xabcdef');

      expect(wallet).toEqual(walletData);
    });

    it('should delete wallet', async () => {
      mockObjectStore.delete.mockImplementation(() => ({
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const result = await db.deleteWallet('0xabcdef');

      expect(result).toBe(true);
      expect(mockObjectStore.delete).toHaveBeenCalledWith('0xabcdef');
    });

    it('should get all wallets', async () => {
      const wallets = [
        { ...mockAccount, id: '0xabc' },
        { ...mockAccount, id: '0xdef' }
      ];

      mockObjectStore.getAll.mockImplementation(() => ({
        result: wallets,
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const allWallets = await db.getAllWallets();

      expect(allWallets).toEqual(wallets);
    });

    it('should update wallet', async () => {
      const existingWallet = {
        id: '0xabcdef',
        address: '0xabcdef',
        name: 'Old Name',
        lastAccessedAt: Date.now() - 10000
      };

      mockObjectStore.get.mockImplementation(() => ({
        result: existingWallet,
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      mockObjectStore.put.mockImplementation((data) => ({
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const updates = { name: 'New Name' };
      const result = await db.updateWallet('0xabcdef', updates);

      expect(result).toBe(true);
      expect(mockObjectStore.put).toHaveBeenCalledWith(
        expect.objectContaining({
          ...existingWallet,
          ...updates,
          lastAccessedAt: expect.any(Number)
        })
      );
    });

    it('should not update non-existent wallet', async () => {
      mockObjectStore.get.mockImplementation(() => ({
        result: null,
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const result = await db.updateWallet('non-existent', { name: 'New' });

      expect(result).toBe(false);
      expect(mockObjectStore.put).not.toHaveBeenCalled();
    });
  });

  describe('Data Encryption', () => {
    it('should encrypt data', async () => {
      const data = { secret: 'password123' };
      
      const encrypted = await db.encryptData(data);

      expect(encrypted).toMatch(/^encrypted:/);
      expect(encrypted).not.toContain('password123');
    });

    it('should decrypt data', async () => {
      const data = { secret: 'password123' };
      const encrypted = await db.encryptData(data);
      
      const decrypted = await db.decryptData(encrypted);

      expect(decrypted).toEqual(data);
    });

    it('should handle invalid encrypted data', async () => {
      await expect(db.decryptData('invalid-data'))
        .rejects.toThrow('Invalid encrypted data format');
    });
  });

  describe('Clear Operations', () => {
    beforeEach(async () => {
      (global.indexedDB.open as jest.Mock).mockImplementation(() => {
        setTimeout(() => mockOpenDBRequest.onsuccess?.(), 0);
        return mockOpenDBRequest;
      });
      await db.init();
    });

    it('should clear all data', async () => {
      mockObjectStore.clear.mockImplementation(() => ({
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const result = await db.clearAll();

      expect(result).toBe(true);
      expect(mockObjectStore.clear).toHaveBeenCalledTimes(4); // accounts, preferences, config, contacts
    });

    it('should handle clear errors', async () => {
      mockObjectStore.clear.mockImplementation(() => ({
        onsuccess: null,
        onerror: function() { this.onerror?.(); },
        error: new Error('Clear failed')
      }));

      const result = await db.clearAll();

      expect(result).toBe(false);
    });

    it('should use clear as alias for clearAll', async () => {
      mockObjectStore.clear.mockImplementation(() => ({
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const result = await db.clear();

      expect(result).toBe(true);
      expect(mockObjectStore.clear).toHaveBeenCalled();
    });
  });

  describe('Backup and Restore', () => {
    beforeEach(async () => {
      (global.indexedDB.open as jest.Mock).mockImplementation(() => {
        setTimeout(() => mockOpenDBRequest.onsuccess?.(), 0);
        return mockOpenDBRequest;
      });
      await db.init();
    });

    it('should create backup', async () => {
      const mockWallets = [mockAccount];
      const mockPrefs = [mockPreferences];
      const mockConfigs = [mockConfig];

      mockObjectStore.getAll.mockImplementation(() => {
        const callCount = mockObjectStore.getAll.mock.calls.length;
        return {
          result: callCount === 1 ? mockWallets : 
                  callCount === 2 ? mockPrefs : 
                  callCount === 3 ? mockConfigs : [],
          onsuccess: function() { this.onsuccess?.(); },
          onerror: null
        };
      });

      const backup = await db.createBackup();

      expect(backup).toMatchObject({
        timestamp: expect.any(Number),
        version: 1,
        data: {
          wallets: mockWallets,
          preferences: mockPrefs,
          configs: mockConfigs,
          transactions: [],
          nfts: []
        }
      });
    });

    it('should restore from backup', async () => {
      const backup = {
        timestamp: Date.now(),
        version: 1,
        data: {
          wallets: [mockAccount],
          preferences: [mockPreferences],
          configs: [mockConfig]
        }
      };

      mockObjectStore.clear.mockImplementation(() => ({
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      mockObjectStore.put.mockImplementation((data) => ({
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const result = await db.restoreFromBackup(backup);

      expect(result).toBe(true);
      expect(mockObjectStore.clear).toHaveBeenCalled();
      expect(mockObjectStore.put).toHaveBeenCalledTimes(3);
    });

    it('should handle restore errors', async () => {
      const backup = {
        timestamp: Date.now(),
        version: 1,
        data: {
          wallets: [mockAccount]
        }
      };

      mockObjectStore.clear.mockImplementation(() => ({
        onsuccess: null,
        onerror: function() { this.onerror?.(); },
        error: new Error('Clear failed')
      }));

      const result = await db.restoreFromBackup(backup);

      expect(result).toBe(false);
    });
  });

  describe('Sync Operations', () => {
    it('should sync with remote', async () => {
      const localData = {
        wallets: [mockAccount],
        transactions: [],
        nfts: []
      };

      const result = await db.syncWithRemote(localData);

      expect(result).toEqual({
        success: true,
        synced: localData
      });
    });

    it('should resolve conflicts favoring newer data', async () => {
      const localData = {
        id: '1',
        name: 'Local',
        lastModified: 1000
      };

      const remoteData = {
        id: '1',
        name: 'Remote',
        lastModified: 2000
      };

      const resolved = await db.resolveConflict(localData, remoteData);

      expect(resolved).toEqual(remoteData);
    });

    it('should handle missing timestamps in conflict resolution', async () => {
      const localData = { id: '1', name: 'Local' };
      const remoteData = { id: '1', name: 'Remote' };

      const resolved = await db.resolveConflict(localData, remoteData);

      expect(resolved).toEqual(remoteData);
    });
  });

  describe('Export Operations', () => {
    beforeEach(async () => {
      (global.indexedDB.open as jest.Mock).mockImplementation(() => {
        setTimeout(() => mockOpenDBRequest.onsuccess?.(), 0);
        return mockOpenDBRequest;
      });
      await db.init();
    });

    it('should export data as JSON', async () => {
      mockObjectStore.getAll.mockImplementation(() => ({
        result: [mockAccount],
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const exported = await db.exportData('json');
      const parsed = JSON.parse(exported);

      expect(parsed).toMatchObject({
        version: '1.0.0',
        exportDate: expect.any(String),
        wallets: [mockAccount]
      });
    });

    it('should reject unsupported export formats', async () => {
      await expect(db.exportData('xml'))
        .rejects.toThrow('Unsupported export format: xml');
    });
  });

  describe('Database Cleanup', () => {
    it('should cleanup database connection', async () => {
      (global.indexedDB.open as jest.Mock).mockImplementation(() => {
        setTimeout(() => mockOpenDBRequest.onsuccess?.(), 0);
        return mockOpenDBRequest;
      });

      await db.init();
      await db.cleanup();

      expect(mockDatabase.close).toHaveBeenCalled();
      expect(db['isInitialized']).toBe(false);
      expect(db['db']).toBeNull();
    });

    it('should handle cleanup errors gracefully', async () => {
      (global.indexedDB.open as jest.Mock).mockImplementation(() => {
        setTimeout(() => mockOpenDBRequest.onsuccess?.(), 0);
        return mockOpenDBRequest;
      });

      await db.init();
      mockDatabase.close.mockImplementation(() => {
        throw new Error('Close failed');
      });

      await db.cleanup(); // Should not throw

      expect(db['isInitialized']).toBe(false);
    });

    it('should use close as alias for cleanup', async () => {
      (global.indexedDB.open as jest.Mock).mockImplementation(() => {
        setTimeout(() => mockOpenDBRequest.onsuccess?.(), 0);
        return mockOpenDBRequest;
      });

      await db.init();
      await db.close();

      expect(mockDatabase.close).toHaveBeenCalled();
    });
  });

  describe('Error Handling Without Initialization', () => {
    it('should throw when saving without init', async () => {
      await expect(db.saveAccount(mockAccount))
        .rejects.toThrow('Database not initialized');
    });

    it('should throw when getting account without init', async () => {
      await expect(db.getAccount('id'))
        .rejects.toThrow('Database not initialized');
    });

    it('should throw when getting accounts without init', async () => {
      await expect(db.getAccounts())
        .rejects.toThrow('Database not initialized');
    });

    it('should throw when saving preferences without init', async () => {
      await expect(db.savePreferences(mockPreferences))
        .rejects.toThrow('Database not initialized');
    });
  });
});