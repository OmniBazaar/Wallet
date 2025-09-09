/**
 * Tests for TransactionDatabase Service
 * 
 * Tests the transaction history database functionality including
 * transaction storage, retrieval, filtering, and statistics.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { 
  TransactionDatabase,
  TransactionStatus,
  TransactionType,
  type TransactionData
} from '../../src/services/TransactionDatabase';

// Mock IndexedDB
const mockObjectStore = {
  put: jest.fn(),
  get: jest.fn(),
  getAll: jest.fn(),
  delete: jest.fn(),
  clear: jest.fn(),
  createIndex: jest.fn(),
  index: jest.fn(),
  count: jest.fn()
};

const mockIndex = {
  get: jest.fn(),
  getAll: jest.fn()
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

describe('TransactionDatabase', () => {
  let db: TransactionDatabase;

  const mockTxData: TransactionData = {
    id: 'tx-1',
    hash: '0x' + 'a'.repeat(64),
    type: TransactionType.SEND,
    status: TransactionStatus.CONFIRMED,
    from: '0x1234567890123456789012345678901234567890',
    to: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    value: '1000000000000000000', // 1 ETH
    gasPrice: '20000000000', // 20 gwei
    gasLimit: '21000',
    gasUsed: '21000',
    chainId: 1,
    blockNumber: 12345678,
    blockHash: '0x' + 'b'.repeat(64),
    transactionIndex: 42,
    confirmations: 12,
    timestamp: 1234567890000,
    data: '0x',
    nonce: 5
  };

  beforeEach(() => {
    jest.clearAllMocks();
    db = new TransactionDatabase();

    // Setup mock index
    mockObjectStore.index.mockReturnValue(mockIndex);

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
      (global.indexedDB.open as jest.Mock).mockImplementation(() => {
        setTimeout(() => mockOpenDBRequest.onsuccess?.(), 0);
        return mockOpenDBRequest;
      });

      await db.init();

      expect(global.indexedDB.open).toHaveBeenCalledWith('OmniWalletTransactions', 1);
      expect(db['isInitialized']).toBe(true);
    });

    it('should handle initialization errors', async () => {
      (global.indexedDB.open as jest.Mock).mockImplementation(() => {
        setTimeout(() => mockOpenDBRequest.onerror?.(), 0);
        return mockOpenDBRequest;
      });

      await expect(db.init()).rejects.toThrow('Failed to open transaction database');
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

    it('should create object store and indexes on upgrade', async () => {
      (global.indexedDB.open as jest.Mock).mockImplementation(() => {
        setTimeout(() => {
          mockOpenDBRequest.onupgradeneeded?.({ target: mockOpenDBRequest } as any);
          mockOpenDBRequest.onsuccess?.();
        }, 0);
        return mockOpenDBRequest;
      });

      await db.init();

      expect(mockDatabase.createObjectStore).toHaveBeenCalledWith('transactions', { keyPath: 'id' });
      expect(mockObjectStore.createIndex).toHaveBeenCalledWith('hash', 'hash', { unique: true });
      expect(mockObjectStore.createIndex).toHaveBeenCalledWith('from', 'from', { unique: false });
      expect(mockObjectStore.createIndex).toHaveBeenCalledWith('to', 'to', { unique: false });
      expect(mockObjectStore.createIndex).toHaveBeenCalledWith('status', 'status', { unique: false });
      expect(mockObjectStore.createIndex).toHaveBeenCalledWith('type', 'type', { unique: false });
      expect(mockObjectStore.createIndex).toHaveBeenCalledWith('chainId', 'chainId', { unique: false });
      expect(mockObjectStore.createIndex).toHaveBeenCalledWith('timestamp', 'timestamp', { unique: false });
    });
  });

  describe('Transaction Management', () => {
    beforeEach(async () => {
      (global.indexedDB.open as jest.Mock).mockImplementation(() => {
        setTimeout(() => mockOpenDBRequest.onsuccess?.(), 0);
        return mockOpenDBRequest;
      });
      await db.init();
    });

    it('should save transaction successfully', async () => {
      mockObjectStore.put.mockImplementation((data) => ({
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const result = await db.saveTransaction(mockTxData);

      expect(result).toBe(true);
      expect(mockObjectStore.put).toHaveBeenCalledWith(mockTxData);
    });

    it('should auto-generate ID if not provided', async () => {
      mockObjectStore.put.mockImplementation((data) => ({
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const txWithoutId = { ...mockTxData };
      delete (txWithoutId as any).id;

      const result = await db.saveTransaction(txWithoutId);

      expect(result).toBe(true);
      expect(mockObjectStore.put).toHaveBeenCalledWith(
        expect.objectContaining({
          ...txWithoutId,
          id: txWithoutId.hash // Should use hash as ID
        })
      );
    });

    it('should generate random ID if no hash or ID', async () => {
      mockObjectStore.put.mockImplementation((data) => ({
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const txWithoutIdOrHash = { ...mockTxData };
      delete (txWithoutIdOrHash as any).id;
      delete (txWithoutIdOrHash as any).hash;

      const result = await db.saveTransaction(txWithoutIdOrHash);

      expect(result).toBe(true);
      expect(mockObjectStore.put).toHaveBeenCalledWith(
        expect.objectContaining({
          ...txWithoutIdOrHash,
          id: expect.stringMatching(/^tx-\d+-\w+$/)
        })
      );
    });

    it('should handle save errors', async () => {
      mockObjectStore.put.mockImplementation(() => ({
        onsuccess: null,
        onerror: function() { this.onerror?.(); },
        error: new Error('Save failed')
      }));

      const result = await db.saveTransaction(mockTxData);

      expect(result).toBe(false);
    });

    it('should get transaction by ID', async () => {
      mockObjectStore.get.mockImplementation((id) => ({
        result: id === mockTxData.id ? mockTxData : null,
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const tx = await db.getTransaction(mockTxData.id);

      expect(tx).toEqual(mockTxData);
      expect(mockObjectStore.get).toHaveBeenCalledWith(mockTxData.id);
    });

    it('should get transaction by hash if not found by ID', async () => {
      mockObjectStore.get.mockImplementation(() => ({
        result: null,
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      mockIndex.get.mockImplementation((hash) => ({
        result: hash === mockTxData.hash ? mockTxData : null,
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const tx = await db.getTransaction(mockTxData.hash);

      expect(tx).toEqual(mockTxData);
      expect(mockIndex.get).toHaveBeenCalledWith(mockTxData.hash);
    });

    it('should return null for non-existent transaction', async () => {
      mockObjectStore.get.mockImplementation(() => ({
        result: null,
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const tx = await db.getTransaction('non-existent');

      expect(tx).toBeNull();
    });

    it('should delete transaction', async () => {
      mockObjectStore.delete.mockImplementation(() => ({
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const result = await db.deleteTransaction(mockTxData.id);

      expect(result).toBe(true);
      expect(mockObjectStore.delete).toHaveBeenCalledWith(mockTxData.id);
    });
  });

  describe('Transaction Queries', () => {
    const mockTransactions: TransactionData[] = [
      mockTxData,
      {
        ...mockTxData,
        id: 'tx-2',
        hash: '0x' + 'c'.repeat(64),
        type: TransactionType.RECEIVE,
        from: '0xbcdefabcdefabcdefabcdefabcdefabcdefabcde',
        timestamp: 1234567900000
      },
      {
        ...mockTxData,
        id: 'tx-3',
        hash: '0x' + 'd'.repeat(64),
        status: TransactionStatus.PENDING,
        chainId: 137,
        timestamp: 1234567880000
      }
    ];

    beforeEach(async () => {
      (global.indexedDB.open as jest.Mock).mockImplementation(() => {
        setTimeout(() => mockOpenDBRequest.onsuccess?.(), 0);
        return mockOpenDBRequest;
      });
      await db.init();

      mockObjectStore.getAll.mockImplementation(() => ({
        result: [...mockTransactions],
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));
    });

    it('should get all transactions sorted by timestamp', async () => {
      const txs = await db.getTransactions();

      expect(txs).toHaveLength(3);
      expect(txs[0].timestamp).toBeGreaterThanOrEqual(txs[1].timestamp);
      expect(txs[1].timestamp).toBeGreaterThanOrEqual(txs[2].timestamp);
    });

    it('should filter transactions', async () => {
      const txs = await db.getTransactions({ status: TransactionStatus.PENDING });

      expect(txs).toHaveLength(1);
      expect(txs[0].status).toBe(TransactionStatus.PENDING);
    });

    it('should get transactions by address', async () => {
      const address = mockTxData.from;
      const txs = await db.getTransactionsByAddress(address);

      expect(txs.length).toBeGreaterThan(0);
      expect(txs.every(tx => 
        tx.from.toLowerCase() === address.toLowerCase() || 
        tx.to.toLowerCase() === address.toLowerCase()
      )).toBe(true);
    });

    it('should get transactions by date range', async () => {
      const startDate = 1234567885000;
      const endDate = 1234567895000;

      const txs = await db.getTransactionsByDateRange(startDate, endDate);

      expect(txs).toHaveLength(1); // Only mockTxData falls in this range
      expect(txs[0].timestamp).toBeGreaterThanOrEqual(startDate);
      expect(txs[0].timestamp).toBeLessThanOrEqual(endDate);
    });

    it('should get transaction by hash', async () => {
      mockIndex.get.mockImplementation((hash) => ({
        result: mockTransactions.find(tx => tx.hash === hash) || null,
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const tx = await db.getTransactionByHash(mockTxData.hash);

      expect(tx).toEqual(mockTxData);
    });

    it('should handle query errors', async () => {
      mockObjectStore.getAll.mockImplementation(() => ({
        onsuccess: null,
        onerror: function() { this.onerror?.(); },
        error: new Error('Query failed')
      }));

      const txs = await db.getTransactions();

      expect(txs).toEqual([]);
    });
  });

  describe('Transaction Updates', () => {
    beforeEach(async () => {
      (global.indexedDB.open as jest.Mock).mockImplementation(() => {
        setTimeout(() => mockOpenDBRequest.onsuccess?.(), 0);
        return mockOpenDBRequest;
      });
      await db.init();
    });

    it('should update transaction status', async () => {
      mockIndex.get.mockImplementation(() => ({
        result: mockTxData,
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      mockObjectStore.put.mockImplementation((data) => ({
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const result = await db.updateTransactionStatus(
        mockTxData.hash,
        TransactionStatus.CONFIRMED,
        { confirmations: 20, blockNumber: 12345680 }
      );

      expect(result).toBe(true);
      expect(mockObjectStore.put).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockTxData,
          status: TransactionStatus.CONFIRMED,
          confirmations: 20,
          blockNumber: 12345680,
          updatedAt: expect.any(Number)
        })
      );
    });

    it('should not update non-existent transaction', async () => {
      mockIndex.get.mockImplementation(() => ({
        result: null,
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const result = await db.updateTransactionStatus('0x' + 'f'.repeat(64), TransactionStatus.FAILED);

      expect(result).toBe(false);
      expect(mockObjectStore.put).not.toHaveBeenCalled();
    });

    it('should handle update errors', async () => {
      mockIndex.get.mockImplementation(() => ({
        result: mockTxData,
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      mockObjectStore.put.mockImplementation(() => ({
        onsuccess: null,
        onerror: function() { this.onerror?.(); },
        error: new Error('Update failed')
      }));

      const result = await db.updateTransactionStatus(mockTxData.hash, TransactionStatus.FAILED);

      expect(result).toBe(false);
    });
  });

  describe('Statistics', () => {
    const address = '0x1234567890123456789012345678901234567890';
    const mockTxs = [
      { ...mockTxData, value: '1000000000000000000' }, // 1 ETH
      { ...mockTxData, id: 'tx-2', value: '2000000000000000000' }, // 2 ETH
      { ...mockTxData, id: 'tx-3', value: '500000000000000000' }, // 0.5 ETH
      { ...mockTxData, id: 'tx-4', value: 'invalid' }, // Invalid value
      { ...mockTxData, id: 'tx-5', value: undefined }, // No value
    ];

    beforeEach(async () => {
      (global.indexedDB.open as jest.Mock).mockImplementation(() => {
        setTimeout(() => mockOpenDBRequest.onsuccess?.(), 0);
        return mockOpenDBRequest;
      });
      await db.init();

      mockObjectStore.getAll.mockImplementation(() => ({
        result: mockTxs,
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));
    });

    it('should calculate statistics correctly', async () => {
      const stats = await db.getStatistics(address);

      expect(stats).toEqual({
        totalTransactions: 5,
        totalVolume: '3500000000000000000' // 3.5 ETH total (ignoring invalid values)
      });
    });

    it('should handle empty transaction list', async () => {
      mockObjectStore.getAll.mockImplementation(() => ({
        result: [],
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const stats = await db.getStatistics(address);

      expect(stats).toEqual({
        totalTransactions: 0,
        totalVolume: '0'
      });
    });
  });

  describe('Bulk Operations', () => {
    beforeEach(async () => {
      (global.indexedDB.open as jest.Mock).mockImplementation(() => {
        setTimeout(() => mockOpenDBRequest.onsuccess?.(), 0);
        return mockOpenDBRequest;
      });
      await db.init();
    });

    it('should bulk insert transactions', async () => {
      mockObjectStore.put.mockImplementation((data) => ({
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const txs = [
        mockTxData,
        { ...mockTxData, id: 'tx-2', hash: '0x' + 'e'.repeat(64) },
        { ...mockTxData, id: 'tx-3', hash: '0x' + 'f'.repeat(64) }
      ];

      const result = await db.bulkInsert(txs);

      expect(result).toBe(true);
      expect(mockObjectStore.put).toHaveBeenCalledTimes(3);
    });

    it('should handle bulk insert errors', async () => {
      mockObjectStore.put
        .mockImplementationOnce((data) => ({
          onsuccess: function() { this.onsuccess?.(); },
          onerror: null
        }))
        .mockImplementationOnce(() => ({
          onsuccess: null,
          onerror: function() { this.onerror?.(); },
          error: new Error('Insert failed')
        }));

      const txs = [
        mockTxData,
        { ...mockTxData, id: 'tx-2', hash: '0x' + 'e'.repeat(64) }
      ];

      const result = await db.bulkInsert(txs);

      expect(result).toBe(false);
    });
  });

  describe('Cleanup Operations', () => {
    beforeEach(async () => {
      (global.indexedDB.open as jest.Mock).mockImplementation(() => {
        setTimeout(() => mockOpenDBRequest.onsuccess?.(), 0);
        return mockOpenDBRequest;
      });
      await db.init();
    });

    it('should clear all transactions', async () => {
      mockObjectStore.clear.mockImplementation(() => ({
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const result = await db.clearAll();

      expect(result).toBe(true);
      expect(mockObjectStore.clear).toHaveBeenCalled();
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

    it('should cleanup old data', async () => {
      const now = Date.now();
      const oldTxs = [
        { ...mockTxData, id: 'old-1', timestamp: now - 100000 }, // Old
        { ...mockTxData, id: 'recent-1', timestamp: now - 1000 }, // Recent
        { ...mockTxData, id: 'old-2', timestamp: now - 200000 }, // Old
      ];

      mockObjectStore.getAll.mockImplementation(() => ({
        result: oldTxs,
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      mockObjectStore.delete.mockImplementation(() => ({
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const result = await db.cleanupOldData(50000); // 50 seconds max age

      expect(result).toBe(true);
      expect(mockObjectStore.delete).toHaveBeenCalledWith('old-1');
      expect(mockObjectStore.delete).toHaveBeenCalledWith('old-2');
      expect(mockObjectStore.delete).not.toHaveBeenCalledWith('recent-1');
    });
  });

  describe('Transaction Count', () => {
    beforeEach(async () => {
      (global.indexedDB.open as jest.Mock).mockImplementation(() => {
        setTimeout(() => mockOpenDBRequest.onsuccess?.(), 0);
        return mockOpenDBRequest;
      });
      await db.init();
    });

    it('should get transaction count', async () => {
      mockObjectStore.count.mockImplementation(() => ({
        result: 42,
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const count = await db.getTransactionCount();

      expect(count).toBe(42);
    });

    it('should handle count errors', async () => {
      mockObjectStore.count.mockImplementation(() => ({
        onsuccess: null,
        onerror: function() { this.onerror?.(); },
        error: new Error('Count failed')
      }));

      const count = await db.getTransactionCount();

      expect(count).toBe(0);
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

    it('should use close as alias for cleanup', async () => {
      (global.indexedDB.open as jest.Mock).mockImplementation(() => {
        setTimeout(() => mockOpenDBRequest.onsuccess?.(), 0);
        return mockOpenDBRequest;
      });

      await db.init();
      await db.close();

      expect(mockDatabase.close).toHaveBeenCalled();
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
  });

  describe('Error Handling Without Initialization', () => {
    it('should throw when saving without init', async () => {
      await expect(db.saveTransaction(mockTxData))
        .rejects.toThrow('Database not initialized');
    });

    it('should throw when getting transaction without init', async () => {
      await expect(db.getTransaction('id'))
        .rejects.toThrow('Database not initialized');
    });

    it('should throw when clearing without init', async () => {
      await expect(db.clearAll())
        .rejects.toThrow('Database not initialized');
    });
  });

  describe('Edge Cases', () => {
    beforeEach(async () => {
      (global.indexedDB.open as jest.Mock).mockImplementation(() => {
        setTimeout(() => mockOpenDBRequest.onsuccess?.(), 0);
        return mockOpenDBRequest;
      });
      await db.init();
    });

    it('should handle transactions with BigInt values', async () => {
      mockObjectStore.getAll.mockImplementation(() => ({
        result: [
          { ...mockTxData, value: '999999999999999999999999999' }, // Very large
          { ...mockTxData, id: 'tx-2', value: '1' }, // Very small
        ],
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const stats = await db.getStatistics(mockTxData.from);

      expect(stats.totalVolume).toBe('1000000000000000000000000000'); // Sum of both
    });

    it('should handle getAllTransactions alias', async () => {
      mockObjectStore.getAll.mockImplementation(() => ({
        result: [mockTxData],
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const txs = await db.getAllTransactions();

      expect(txs).toEqual([mockTxData]);
    });

    it('should handle string status in updates', async () => {
      mockIndex.get.mockImplementation(() => ({
        result: mockTxData,
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      mockObjectStore.put.mockImplementation((data) => ({
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const result = await db.updateTransactionStatus(
        mockTxData.hash,
        'confirmed' // String instead of enum
      );

      expect(result).toBe(true);
      expect(mockObjectStore.put).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'confirmed'
        })
      );
    });
  });
});