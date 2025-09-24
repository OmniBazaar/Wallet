/**
 * Mock WalletDatabase for testing
 */

export class WalletDatabase {
  private wallets = new Map<string, any>();
  private isInitialized = false;

  async init(): Promise<void> {
    this.isInitialized = true;
  }

  async clear(): Promise<void> {
    this.wallets.clear();
  }

  async saveWallet(walletData: any): Promise<void> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    this.wallets.set(walletData.address, walletData);
  }

  async getWallet(address: string): Promise<any | null> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    return this.wallets.get(address) || null;
  }

  async getAllWallets(): Promise<any[]> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    return Array.from(this.wallets.values());
  }

  async deleteWallet(address: string): Promise<boolean> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    return this.wallets.delete(address);
  }

  async updateMetadata(address: string, metadata: any): Promise<void> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    const wallet = await this.getWallet(address);
    if (wallet) {
      wallet.metadata = { ...wallet.metadata, ...metadata };
      await this.saveWallet(wallet);
    }
  }

  async updateWallet(address: string, updates: any): Promise<void> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    const wallet = await this.getWallet(address);
    if (wallet) {
      Object.assign(wallet, updates);
      await this.saveWallet(wallet);
    }
  }

  async encryptData(data: any): Promise<string> {
    // Mock encryption - just return a base64 string
    return Buffer.from(JSON.stringify(data)).toString('base64');
  }

  async decryptData(encrypted: string): Promise<any> {
    // Mock decryption
    return JSON.parse(Buffer.from(encrypted, 'base64').toString());
  }

  async createBackup(): Promise<any> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    return {
      timestamp: Date.now(),
      data: {
        wallets: Array.from(this.wallets.values()),
        transactions: [],
        nfts: []
      }
    };
  }

  async restoreFromBackup(backup: any): Promise<void> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    if (backup.data?.wallets) {
      for (const wallet of backup.data.wallets) {
        await this.saveWallet(wallet);
      }
    }
  }

  async syncWithRemote(localData?: any): Promise<any> {
    // Mock sync operation
    return {
      success: true,
      synced: {
        wallets: Array.from(this.wallets.values()),
        transactions: [],
        nfts: []
      }
    };
  }

  async handleSyncConflicts(conflicts: any[]): Promise<void> {
    // Mock conflict resolution
    return Promise.resolve();
  }

  async resolveConflict(local: any, remote: any): Promise<any> {
    // Mock conflict resolution - prefer remote if newer
    if (remote.lastModified > local.lastModified) {
      return remote;
    }
    return local;
  }

  async close(): Promise<void> {
    this.isInitialized = false;
    this.wallets.clear();
  }
}