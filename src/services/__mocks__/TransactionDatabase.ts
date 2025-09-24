/**
 * Mock TransactionDatabase for testing
 */

export class TransactionDatabase {
  private transactions = new Map<string, any>();
  private isInitialized = false;

  async init(): Promise<void> {
    this.isInitialized = true;
  }

  async clear(): Promise<void> {
    this.transactions.clear();
  }

  async saveTransaction(transaction: any): Promise<boolean> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    // Store by both ID and hash for easy retrieval
    const id = transaction.id || transaction.hash || `tx-${Date.now()}`;
    const txToSave = { ...transaction, id };
    this.transactions.set(id, txToSave);
    if (transaction.hash && transaction.hash !== id) {
      this.transactions.set(transaction.hash, txToSave);
    }
    return true;
  }

  async getTransaction(idOrHash: string): Promise<any | null> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    return this.transactions.get(idOrHash) || null;
  }

  async getTransactionsByAddress(address: string): Promise<any[]> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    const uniqueTxs = new Map();
    for (const [key, tx] of this.transactions) {
      if ((tx.from === address || tx.to === address) && !uniqueTxs.has(tx.id)) {
        uniqueTxs.set(tx.id, tx);
      }
    }
    return Array.from(uniqueTxs.values());
  }

  async getStatistics(address: string): Promise<{ totalTransactions: number; totalVolume: string }> {
    const transactions = await this.getTransactionsByAddress(address);
    const totalVolume = transactions.reduce((sum, tx) => {
      return sum + BigInt(tx.value || 0);
    }, BigInt(0));
    return {
      totalTransactions: transactions.length,
      totalVolume: totalVolume.toString()
    };
  }

  async getTransactionsByDateRange(startDate: Date | number, endDate: Date | number): Promise<any[]> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    const startTime = typeof startDate === 'number' ? startDate : startDate.getTime();
    const endTime = typeof endDate === 'number' ? endDate : endDate.getTime();
    const uniqueTxs = new Map();
    for (const [key, tx] of this.transactions) {
      if (tx.timestamp >= startTime && tx.timestamp <= endTime && !uniqueTxs.has(tx.id)) {
        uniqueTxs.set(tx.id, tx);
      }
    }
    return Array.from(uniqueTxs.values());
  }

  async updateTransactionStatus(hash: string, status: string, updates?: any): Promise<boolean> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    const tx = await this.getTransaction(hash);
    if (!tx) return false;

    const updatedTx = { ...tx, status, ...updates };
    await this.saveTransaction(updatedTx);
    return true;
  }

  async bulkInsert(transactions: any[]): Promise<void> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    for (const tx of transactions) {
      await this.saveTransaction(tx);
    }
  }

  async getAllTransactions(): Promise<any[]> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    const uniqueTxs = new Map();
    for (const [key, tx] of this.transactions) {
      if (!uniqueTxs.has(tx.id)) {
        uniqueTxs.set(tx.id, tx);
      }
    }
    return Array.from(uniqueTxs.values());
  }

  async getTransactionCount(): Promise<number> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    const uniqueTxs = new Set();
    for (const [key, tx] of this.transactions) {
      uniqueTxs.add(tx.id);
    }
    return uniqueTxs.size;
  }

  async cleanupOldData(maxAge: number): Promise<void> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    const cutoffTime = Date.now() - maxAge;
    const toDelete: string[] = [];

    for (const [key, tx] of this.transactions) {
      if (tx.timestamp < cutoffTime) {
        toDelete.push(key);
      }
    }

    for (const key of toDelete) {
      this.transactions.delete(key);
    }
  }

  async close(): Promise<void> {
    this.isInitialized = false;
    this.transactions.clear();
  }
}