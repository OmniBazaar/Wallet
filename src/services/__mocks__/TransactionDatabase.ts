/**
 * Mock TransactionDatabase for testing
 */

/**
 * Transaction interface representing the structure of a transaction
 */
interface Transaction {
  /** Unique transaction identifier */
  id?: string;
  /** Transaction hash */
  hash?: string;
  /** Sender address */
  from?: string;
  /** Recipient address */
  to?: string;
  /** Transaction value in wei */
  value?: string | bigint;
  /** Transaction timestamp in milliseconds */
  timestamp?: number;
  /** Transaction status */
  status?: string;
  /** Additional transaction data */
  [key: string]: unknown;
}

/**
 * Transaction statistics interface
 */
interface TransactionStatistics {
  /** Total number of transactions */
  totalTransactions: number;
  /** Total volume of transactions in wei */
  totalVolume: string;
}

/**
 * Mock implementation of TransactionDatabase for testing purposes
 * Provides in-memory storage of transactions with common query methods
 */
export class TransactionDatabase {
  /** In-memory storage for transactions indexed by ID or hash */
  private transactions = new Map<string, Transaction>();
  /** Database initialization state */
  private isInitialized = false;

  /**
   * Initializes the mock database
   * @returns Promise that resolves when initialization is complete
   */
  init(): Promise<void> {
    this.isInitialized = true;
    return Promise.resolve();
  }

  /**
   * Clears all transactions from the database
   * @returns Promise that resolves when clearing is complete
   */
  clear(): Promise<void> {
    this.transactions.clear();
    return Promise.resolve();
  }

  /**
   * Saves a transaction to the database
   * @param transaction - Transaction object to save
   * @returns Promise that resolves to true when save is successful
   * @throws Error if database is not initialized
   */
  saveTransaction(transaction: Transaction): Promise<boolean> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    // Store by both ID and hash for easy retrieval
    const id = transaction.id ?? transaction.hash ?? `tx-${Date.now()}`;
    const txToSave = { ...transaction, id };
    this.transactions.set(id, txToSave);
    if (transaction.hash !== undefined && transaction.hash !== '' && transaction.hash !== id) {
      this.transactions.set(transaction.hash, txToSave);
    }
    return Promise.resolve(true);
  }

  /**
   * Retrieves a transaction by ID or hash
   * @param idOrHash - Transaction ID or hash
   * @returns Promise that resolves to the transaction or null if not found
   * @throws Error if database is not initialized
   */
  getTransaction(idOrHash: string): Promise<Transaction | null> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    return Promise.resolve(this.transactions.get(idOrHash) ?? null);
  }

  /**
   * Retrieves all transactions for a given address
   * @param address - Wallet address to search for
   * @returns Promise that resolves to array of transactions
   * @throws Error if database is not initialized
   */
  getTransactionsByAddress(address: string): Promise<Transaction[]> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    const uniqueTxs = new Map<string, Transaction>();
    for (const [, tx] of this.transactions) {
      if ((tx.from === address || tx.to === address) && tx.id !== undefined && tx.id !== '' && !uniqueTxs.has(tx.id)) {
        uniqueTxs.set(tx.id, tx);
      }
    }
    return Promise.resolve(Array.from(uniqueTxs.values()));
  }

  /**
   * Calculates statistics for transactions by address
   * @param address - Wallet address to calculate statistics for
   * @returns Promise that resolves to transaction statistics
   */
  async getStatistics(address: string): Promise<TransactionStatistics> {
    const transactions = await this.getTransactionsByAddress(address);
    const totalVolume = transactions.reduce((sum, tx) => {
      const value = typeof tx.value === 'string' ? BigInt(tx.value) : (tx.value ?? BigInt(0));
      return sum + value;
    }, BigInt(0));
    return {
      totalTransactions: transactions.length,
      totalVolume: totalVolume.toString()
    };
  }

  /**
   * Retrieves transactions within a date range
   * @param startDate - Start date as Date object or timestamp
   * @param endDate - End date as Date object or timestamp
   * @returns Promise that resolves to array of transactions
   * @throws Error if database is not initialized
   */
  getTransactionsByDateRange(startDate: Date | number, endDate: Date | number): Promise<Transaction[]> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    const startTime = typeof startDate === 'number' ? startDate : startDate.getTime();
    const endTime = typeof endDate === 'number' ? endDate : endDate.getTime();
    const uniqueTxs = new Map<string, Transaction>();
    for (const [, tx] of this.transactions) {
      if (tx.timestamp !== undefined &&
          tx.timestamp >= startTime &&
          tx.timestamp <= endTime &&
          tx.id !== undefined &&
          tx.id !== '' &&
          !uniqueTxs.has(tx.id)) {
        uniqueTxs.set(tx.id, tx);
      }
    }
    return Promise.resolve(Array.from(uniqueTxs.values()));
  }

  /**
   * Updates the status of a transaction
   * @param hash - Transaction hash
   * @param status - New status value
   * @param updates - Additional updates to apply
   * @returns Promise that resolves to true if update successful, false otherwise
   * @throws Error if database is not initialized
   */
  async updateTransactionStatus(
    hash: string,
    status: string,
    updates?: Partial<Transaction>
  ): Promise<boolean> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    const tx = await this.getTransaction(hash);
    if (tx === null) return false;

    const updatedTx: Transaction = { ...tx, status, ...updates };
    await this.saveTransaction(updatedTx);
    return true;
  }

  /**
   * Inserts multiple transactions at once
   * @param transactions - Array of transactions to insert
   * @returns Promise that resolves when all transactions are saved
   * @throws Error if database is not initialized
   */
  async bulkInsert(transactions: Transaction[]): Promise<void> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    for (const tx of transactions) {
      await this.saveTransaction(tx);
    }
  }

  /**
   * Retrieves all unique transactions from the database
   * @returns Promise that resolves to array of all transactions
   * @throws Error if database is not initialized
   */
  getAllTransactions(): Promise<Transaction[]> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    const uniqueTxs = new Map<string, Transaction>();
    for (const [, tx] of this.transactions) {
      if (tx.id !== undefined && tx.id !== '' && !uniqueTxs.has(tx.id)) {
        uniqueTxs.set(tx.id, tx);
      }
    }
    return Promise.resolve(Array.from(uniqueTxs.values()));
  }

  /**
   * Gets the total count of unique transactions
   * @returns Promise that resolves to the transaction count
   * @throws Error if database is not initialized
   */
  getTransactionCount(): Promise<number> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    const uniqueTxs = new Set<string>();
    for (const [, tx] of this.transactions) {
      if (tx.id !== undefined && tx.id !== '') {
        uniqueTxs.add(tx.id);
      }
    }
    return Promise.resolve(uniqueTxs.size);
  }

  /**
   * Removes transactions older than the specified age
   * @param maxAge - Maximum age in milliseconds
   * @returns Promise that resolves when cleanup is complete
   * @throws Error if database is not initialized
   */
  cleanupOldData(maxAge: number): Promise<void> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    const cutoffTime = Date.now() - maxAge;
    const toDelete: string[] = [];

    for (const [key, tx] of this.transactions) {
      if (tx.timestamp !== undefined && tx.timestamp < cutoffTime) {
        toDelete.push(key);
      }
    }

    for (const key of toDelete) {
      this.transactions.delete(key);
    }

    return Promise.resolve();
  }

  /**
   * Closes the database connection and clears all data
   * @returns Promise that resolves when database is closed
   */
  close(): Promise<void> {
    this.isInitialized = false;
    this.transactions.clear();
    return Promise.resolve();
  }
}