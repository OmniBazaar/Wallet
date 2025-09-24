/**
 * Mock Database Implementations for Testing
 * 
 * These mocks replace IndexedDB-based services with in-memory implementations
 * suitable for running in Node.js test environments.
 */

/** Mock Transaction Database */
export class MockTransactionDatabase {
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
    // Store by ID, but also keep a hash index
    const id = transaction.id || transaction.hash || `tx-${Date.now()}`;
    const txToSave = { ...transaction, id };
    this.transactions.set(id, txToSave);
    if (transaction.hash) {
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

  async getStatistics(address: string): Promise<{ totalTransactions: number }> {
    const transactions = await this.getTransactionsByAddress(address);
    return { totalTransactions: transactions.length };
  }

  async getTransactionsByDateRange(startDate: Date, endDate: Date): Promise<any[]> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    const uniqueTxs = new Map();
    for (const [key, tx] of this.transactions) {
      if (tx.timestamp >= startDate.getTime() && tx.timestamp <= endDate.getTime() && !uniqueTxs.has(tx.id)) {
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

  async close(): Promise<void> {
    this.isInitialized = false;
    this.transactions.clear();
  }
}

/** Mock NFT Database */
export class MockNFTDatabase {
  private nfts = new Map<string, any>();
  private isInitialized = false;

  async init(): Promise<void> {
    this.isInitialized = true;
  }

  async clear(): Promise<void> {
    this.nfts.clear();
  }

  async saveNFT(nft: any): Promise<void> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    const key = `${nft.contractAddress}:${nft.tokenId}`;
    this.nfts.set(key, nft);
  }

  async getNFT(contractAddress: string, tokenId: string): Promise<any | null> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    const key = `${contractAddress}:${tokenId}`;
    return this.nfts.get(key) || null;
  }

  async getNFTsByOwner(owner: string): Promise<any[]> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    return Array.from(this.nfts.values()).filter(nft => nft.owner === owner);
  }

  async transferNFT(
    contractAddress: string,
    tokenId: string,
    from: string,
    to: string
  ): Promise<void> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    const nft = await this.getNFT(contractAddress, tokenId);
    if (nft && nft.owner === from) {
      nft.owner = to;
      await this.saveNFT(nft);
    }
  }

  async close(): Promise<void> {
    this.isInitialized = false;
    this.nfts.clear();
  }
}

/** Mock Wallet Database */
export class MockWalletDatabase {
  private wallets = new Map<string, any>();
  private isInitialized = false;

  async init(): Promise<void> {
    this.isInitialized = true;
  }

  async clear(): Promise<void> {
    this.wallets.clear();
  }

  async saveWallet(wallet: any): Promise<void> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    this.wallets.set(wallet.address, wallet);
  }

  async getWallet(address: string): Promise<any | null> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    return this.wallets.get(address) || null;
  }

  async updateWallet(address: string, updates: any): Promise<void> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    const wallet = this.wallets.get(address);
    if (wallet) {
      this.wallets.set(address, { ...wallet, ...updates });
    }
  }

  async close(): Promise<void> {
    this.isInitialized = false;
    this.wallets.clear();
  }
}