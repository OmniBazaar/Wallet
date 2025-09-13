/**
 * TransactionDatabase - Transaction Database Service
 * 
 * Provides database operations for transaction history,
 * pending transactions, and transaction metadata.
 */

/** Transaction status */
export enum TransactionStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
  CANCELED = 'canceled'
}

/** Transaction type */
export enum TransactionType {
  SEND = 'send',
  RECEIVE = 'receive',
  SWAP = 'swap',
  APPROVE = 'approve',
  CONTRACT = 'contract',
  STAKE = 'stake',
  UNSTAKE = 'unstake'
}

/** Transaction data stored in database */
export interface TransactionData {
  /** Unique transaction ID */
  id: string;
  /** Transaction hash */
  hash: string;
  /** Transaction type */
  type?: TransactionType;
  /** Transaction status */
  status: TransactionStatus | 'pending' | 'confirmed' | 'failed';
  /** From address */
  from: string;
  /** To address */
  to: string;
  /** Transaction value in wei */
  value: string;
  /** Gas price in wei */
  gasPrice?: string;
  /** Gas limit */
  gasLimit?: string;
  /** Gas used */
  gasUsed?: string;
  /** Chain ID */
  chainId: number;
  /** Block number */
  blockNumber?: number;
  /** Block hash */
  blockHash?: string;
  /** Transaction index in block */
  transactionIndex?: number;
  /** Number of confirmations */
  confirmations?: number;
  /** Transaction timestamp */
  timestamp: number;
  /** Transaction data */
  data?: string;
  /** Transaction logs */
  logs?: Array<{
    logIndex?: number;
    transactionIndex?: number;
    transactionHash?: string;
    blockHash?: string;
    blockNumber?: number;
    address?: string;
    data?: string;
    topics?: string[];
    type?: string;
    removed?: boolean;
  }>;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Nonce */
  nonce?: number;
  /** Receipt */
  receipt?: {
    transactionHash?: string;
    transactionIndex?: number;
    blockHash?: string;
    blockNumber?: number;
    from?: string;
    to?: string | null;
    cumulativeGasUsed?: string;
    gasUsed?: string;
    contractAddress?: string | null;
    logs?: Array<unknown>;
    logsBloom?: string;
    status?: number;
  };
}

/**
 * Transaction database service.
 * Manages transaction data storage and retrieval using IndexedDB.
 */
export class TransactionDatabase {
  private isInitialized = false;
  private dbName = 'OmniWalletTransactions';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;

  /**
   * Creates a new TransactionDatabase instance.
   */
  constructor() {}

  /**
   * Initializes the database connection.
   * Opens or creates the IndexedDB database for transaction storage.
   * @returns Promise that resolves when initialization is complete
   * @throws Error if IndexedDB is not supported
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;
    
    if (typeof indexedDB === 'undefined') {
      throw new Error('IndexedDB not supported');
    }

    this.db = await this.openDatabase();
    this.isInitialized = true;
    // console.log('TransactionDatabase initialized');
  }

  /**
   * Opens the IndexedDB database.
   * @returns Promise that resolves with the database instance
   * @private
   */
  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(new Error('Failed to open transaction database'));
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('transactions')) {
          const store = db.createObjectStore('transactions', { keyPath: 'id' });
          store.createIndex('hash', 'hash', { unique: true });
          store.createIndex('from', 'from', { unique: false });
          store.createIndex('to', 'to', { unique: false });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('type', 'type', { unique: false });
          store.createIndex('chainId', 'chainId', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  /**
   * Save transaction to database
   * @param transaction - Transaction data
   * @returns Success status
   */
  async saveTransaction(transaction: TransactionData): Promise<boolean> {
    if (this.db === null) throw new Error('Database not initialized');

    try {
      // Ensure transaction has an ID - use hash if ID not provided
      const txToSave = {
        ...transaction,
        id: (transaction.id !== undefined && transaction.id !== '') ? transaction.id : (transaction.hash !== undefined && transaction.hash !== '') ? transaction.hash : `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      };

      const tx = this.db.transaction(['transactions'], 'readwrite');
      const store = tx.objectStore('transactions');
      
      await new Promise<void>((resolve, reject) => {
        const request = store.put(txToSave);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      return true;
    } catch (error) {
      console.error('Error saving transaction:', error);
      return false;
    }
  }

  /**
   * Get transaction by ID or hash
   * @param idOrHash - Transaction ID or hash
   * @returns Transaction data or null
   */
  async getTransaction(idOrHash: string): Promise<TransactionData | null> {
    if (this.db === null) throw new Error('Database not initialized');

    try {
      const tx = this.db.transaction(['transactions'], 'readonly');
      const store = tx.objectStore('transactions');
      
      // First try to get by ID
      let result = await new Promise<TransactionData | null>((resolve, reject) => {
        const request = store.get(idOrHash);
        request.onsuccess = () => resolve(request.result as TransactionData | null);
        request.onerror = () => reject(request.error);
      });

      // If not found by ID and it looks like a hash, try by hash
      if (result === null && idOrHash.startsWith('0x') && idOrHash.length === 66) {
        result = await this.getTransactionByHash(idOrHash);
      }

      return result;
    } catch (error) {
      console.error('Error getting transaction:', error);
      return null;
    }
  }

  /**
   * Retrieves transactions with optional filtering.
   * @param filters - Optional filters to apply to transactions
   * @returns Promise that resolves with array of transactions
   */
  async getTransactions(filters?: Record<string, unknown>): Promise<TransactionData[]> {
    if (this.db === null) throw new Error('Database not initialized');

    try {
      const tx = this.db.transaction(['transactions'], 'readonly');
      const store = tx.objectStore('transactions');
      
      return new Promise<TransactionData[]>((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => {
          const rawResults = request.result as TransactionData[] | undefined;
          let results: TransactionData[] = rawResults ?? [];
          
          // Apply filters if provided
          if (filters !== undefined) {
            results = results.filter((tx: TransactionData) => {
              return Object.entries(filters).every(([key, value]) => {
                return (tx as unknown as Record<string, unknown>)[key] === value;
              });
            });
          }

          // Sort by timestamp (newest first)
          results.sort((a: TransactionData, b: TransactionData) => b.timestamp - a.timestamp);
          resolve(results);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error getting transactions:', error);
      return [];
    }
  }

  /**
   * Get transactions by address (either from or to)
   * @param address The address to search for
   * @returns Array of transactions
   */
  async getTransactionsByAddress(address: string): Promise<TransactionData[]> {
    if (this.db === null) throw new Error('Database not initialized');

    try {
      const tx = this.db.transaction(['transactions'], 'readonly');
      const store = tx.objectStore('transactions');
      
      return new Promise<TransactionData[]>((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => {
          const rawResults = request.result as TransactionData[] | undefined;
          let results: TransactionData[] = rawResults ?? [];
          
          // Filter by address (either from or to)
          results = results.filter((tx: TransactionData) => 
            tx.from.toLowerCase() === address.toLowerCase() || 
            tx.to.toLowerCase() === address.toLowerCase()
          );

          // Sort by timestamp (newest first)
          results.sort((a: TransactionData, b: TransactionData) => b.timestamp - a.timestamp);
          resolve(results);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error getting transactions by address:', error);
      return [];
    }
  }

  /**
   * Deletes a transaction by ID.
   * @param id - Transaction ID to delete
   * @returns Promise that resolves with success status
   */
  async deleteTransaction(id: string): Promise<boolean> {
    if (this.db === null) throw new Error('Database not initialized');

    try {
      const tx = this.db.transaction(['transactions'], 'readwrite');
      const store = tx.objectStore('transactions');
      
      await new Promise<void>((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      return true;
    } catch (error) {
      console.error('Error deleting transaction:', error);
      return false;
    }
  }

  /**
   * Clears all transactions from the database.
   * @returns Promise that resolves with success status
   */
  async clear(): Promise<boolean> {
    return await this.clearAll();
  }

  /**
   * Clears all transactions from the database.
   * @returns Promise that resolves with success status
   */
  async clearAll(): Promise<boolean> {
    if (this.db === null) throw new Error('Database not initialized');

    try {
      const tx = this.db.transaction(['transactions'], 'readwrite');
      const store = tx.objectStore('transactions');
      
      await new Promise<void>((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      return true;
    } catch (error) {
      console.error('Error clearing transactions:', error);
      return false;
    }
  }

  /**
   * Cleans up database resources and closes connections.
   * @returns Promise that resolves when cleanup is complete
   */
  cleanup(): void {
    try {
      if (this.db !== null) {
        this.db.close();
        this.db = null;
      }
      this.isInitialized = false;
    } catch (error) {
      console.error('Error during TransactionDatabase cleanup:', error);
    }
  }

  /**
   * Get transaction by hash
   * @param hash - Transaction hash
   * @returns Transaction data or null
   */
  async getTransactionByHash(hash: string): Promise<TransactionData | null> {
    if (this.db === null) throw new Error('Database not initialized');

    try {
      const tx = this.db.transaction(['transactions'], 'readonly');
      const store = tx.objectStore('transactions');
      const index = store.index('hash');
      
      return new Promise<TransactionData | null>((resolve, reject) => {
        const request = index.get(hash);
        request.onsuccess = () => resolve(request.result as TransactionData | null);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error getting transaction by hash:', error);
      return null;
    }
  }

  /**
   * Get transactions by date range
   * @param startDate - Start date timestamp
   * @param endDate - End date timestamp
   * @returns Array of transactions
   */
  async getTransactionsByDateRange(startDate: number, endDate: number): Promise<TransactionData[]> {
    if (this.db === null) throw new Error('Database not initialized');

    try {
      const tx = this.db.transaction(['transactions'], 'readonly');
      const store = tx.objectStore('transactions');
      
      return new Promise<TransactionData[]>((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => {
          const rawResults = request.result as TransactionData[] | undefined;
          let results: TransactionData[] = rawResults ?? [];
          
          // Filter by date range
          results = results.filter((tx: TransactionData) => 
            tx.timestamp >= startDate && tx.timestamp <= endDate
          );

          // Sort by timestamp (newest first)
          results.sort((a: TransactionData, b: TransactionData) => b.timestamp - a.timestamp);
          resolve(results);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error getting transactions by date range:', error);
      return [];
    }
  }

  /**
   * Update transaction status
   * @param hash - Transaction hash
   * @param status - New status
   * @param updates - Additional updates
   * @returns Success status
   */
  async updateTransactionStatus(hash: string, status: string, updates?: Partial<TransactionData>): Promise<boolean> {
    if (this.db === null) throw new Error('Database not initialized');

    try {
      const existing = await this.getTransactionByHash(hash);
      if (existing === null) {
        return false;
      }

      const updated: TransactionData = {
        ...existing,
        status: status as TransactionStatus,
        ...(updates ?? {})
      };

      const tx = this.db.transaction(['transactions'], 'readwrite');
      const store = tx.objectStore('transactions');
      
      await new Promise<void>((resolve, reject) => {
        const request = store.put(updated);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      return true;
    } catch (error) {
      console.error('Error updating transaction status:', error);
      return false;
    }
  }

  /**
   * Get transaction statistics
   * @param address - Address to get statistics for
   * @returns Statistics object
   */
  async getStatistics(address: string): Promise<{
    totalTransactions: number;
    totalVolume: string;
  }> {
    const transactions = await this.getTransactionsByAddress(address);
    
    let totalVolume = BigInt(0);
    for (const tx of transactions) {
      try {
        totalVolume += BigInt(tx.value !== '' ? tx.value : '0');
      } catch (e) {
        // Handle invalid values
      }
    }

    return {
      totalTransactions: transactions.length,
      totalVolume: totalVolume.toString()
    };
  }

  /**
   * Get all transactions
   * @returns Array of all transactions
   */
  async getAllTransactions(): Promise<TransactionData[]> {
    return await this.getTransactions();
  }

  /**
   * Bulk insert transactions
   * @param transactions - Array of transactions to insert
   * @returns Success status
   */
  async bulkInsert(transactions: TransactionData[]): Promise<boolean> {
    if (this.db === null) throw new Error('Database not initialized');

    try {
      const tx = this.db.transaction(['transactions'], 'readwrite');
      const store = tx.objectStore('transactions');
      
      for (const transaction of transactions) {
        await new Promise<void>((resolve, reject) => {
          const request = store.put(transaction);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      }

      return true;
    } catch (error) {
      console.error('Error bulk inserting transactions:', error);
      return false;
    }
  }

  /**
   * Get transaction count
   * @returns Number of transactions
   */
  async getTransactionCount(): Promise<number> {
    if (this.db === null) throw new Error('Database not initialized');

    try {
      const tx = this.db.transaction(['transactions'], 'readonly');
      const store = tx.objectStore('transactions');
      
      return new Promise<number>((resolve, reject) => {
        const request = store.count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error getting transaction count:', error);
      return 0;
    }
  }

  /**
   * Cleanup old data
   * @param maxAge - Maximum age in milliseconds
   * @returns Success status
   */
  async cleanupOldData(maxAge: number): Promise<boolean> {
    if (this.db === null) throw new Error('Database not initialized');

    try {
      const cutoffTime = Date.now() - maxAge;
      const tx = this.db.transaction(['transactions'], 'readwrite');
      const store = tx.objectStore('transactions');
      
      const allTransactions = await new Promise<TransactionData[]>((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => {
          const rawResults = request.result as TransactionData[] | undefined;
          resolve(rawResults ?? []);
        };
        request.onerror = () => reject(request.error);
      });

      // Delete old transactions
      for (const transaction of allTransactions) {
        if (transaction.timestamp < cutoffTime) {
          await new Promise<void>((resolve, reject) => {
            const request = store.delete(transaction.id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
          });
        }
      }

      return true;
    } catch (error) {
      console.error('Error cleaning up old data:', error);
      return false;
    }
  }

  /**
   * Close database connection (alias for cleanup)
   */
  close(): void {
    this.cleanup();
  }
}