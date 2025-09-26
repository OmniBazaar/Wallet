/**
 * Mock WalletDatabase for testing
 * @module __mocks__/WalletDatabase
 */

import type {
  WalletAccountData,
  WalletPreferences,
  WalletConfig,
  QueryOptions,
  BackupData,
  SyncData,
  SyncResult
} from '../WalletDatabase';

/** Conflict data structure */
interface ConflictData {
  /** Local data */
  local: SyncData;
  /** Remote data */
  remote: SyncData;
}

/**
 * Mock implementation of WalletDatabase for testing
 */
export class WalletDatabase {
  /** Internal wallet storage */
  private wallets = new Map<string, WalletAccountData>();

  /** Initialization state */
  private isInitialized = false;

  /** Preferences storage */
  private preferences = new Map<string, WalletPreferences>();

  /** Configuration storage */
  private configs = new Map<string, WalletConfig>();

  /**
   * Initialize the mock database
   * @returns Promise that resolves when initialized
   */
  async init(): Promise<void> {
    await Promise.resolve();
    this.isInitialized = true;
  }

  /**
   * Clear all data from the mock database
   * @returns Promise that resolves when cleared
   */
  async clear(): Promise<void> {
    this.wallets.clear();
    this.preferences.clear();
    this.configs.clear();
    await Promise.resolve();
  }

  /**
   * Save a wallet to the mock database
   * @param walletData - Wallet data to save
   * @returns Promise that resolves to success status
   */
  async saveWallet(walletData: Partial<WalletAccountData> & { address: string }): Promise<boolean> {
    if (!this.isInitialized) throw new Error('Database not initialized');

    const wallet: WalletAccountData = {
      id: walletData.id ?? walletData.address,
      address: walletData.address,
      name: walletData.name ?? 'Wallet',
      type: walletData.type ?? 'imported',
      chainId: walletData.chainId ?? 1,
      createdAt: walletData.createdAt ?? Date.now(),
      lastAccessedAt: walletData.lastAccessedAt ?? Date.now(),
      isActive: walletData.isActive ?? true,
      ...(walletData.publicKey !== undefined && { publicKey: walletData.publicKey }),
      ...(walletData.derivationPath !== undefined && { derivationPath: walletData.derivationPath }),
      ...(walletData.metadata !== undefined && { metadata: walletData.metadata })
    };

    this.wallets.set(walletData.address, wallet);
    await Promise.resolve();
    return true;
  }

  /**
   * Get a wallet by address
   * @param address - Wallet address
   * @returns Promise that resolves to wallet data or null
   */
  async getWallet(address: string): Promise<WalletAccountData | null> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    const wallet = this.wallets.get(address);
    await Promise.resolve();
    return wallet ?? null;
  }

  /**
   * Get all wallets from the mock database
   * @returns Promise that resolves to array of wallet data
   */
  async getAllWallets(): Promise<WalletAccountData[]> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    await Promise.resolve();
    return Array.from(this.wallets.values());
  }

  /**
   * Delete a wallet by address
   * @param address - Wallet address to delete
   * @returns Promise that resolves to success status
   */
  async deleteWallet(address: string): Promise<boolean> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    const result = this.wallets.delete(address);
    await Promise.resolve();
    return result;
  }

  /**
   * Update wallet metadata
   * @param address - Wallet address
   * @param metadata - Metadata to update
   * @returns Promise that resolves when updated
   */
  async updateMetadata(address: string, metadata: Record<string, unknown>): Promise<void> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    const wallet = await this.getWallet(address);
    if (wallet !== null) {
      const updatedMetadata = { ...wallet.metadata, ...metadata };
      wallet.metadata = updatedMetadata;
      await this.saveWallet(wallet);
    }
  }

  /**
   * Update wallet data
   * @param address - Wallet address
   * @param updates - Updates to apply
   * @returns Promise that resolves to success status
   */
  async updateWallet(address: string, updates: Partial<WalletAccountData>): Promise<boolean> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    const wallet = await this.getWallet(address);
    if (wallet !== null) {
      const updated: WalletAccountData = {
        ...wallet,
        ...updates,
        lastAccessedAt: Date.now()
      };
      await this.saveWallet(updated);
      return true;
    }
    return false;
  }

  /**
   * Mock encrypt data
   * @param data - Data to encrypt
   * @param _password - Optional password (unused in mock)
   * @returns Encrypted data string
   */
  encryptData(data: unknown, _password?: string): string {
    // Mock encryption - just return a base64 string
    return `encrypted:${Buffer.from(JSON.stringify(data)).toString('base64')}`;
  }

  /**
   * Mock decrypt data
   * @param encrypted - Encrypted data string
   * @param _password - Optional password (unused in mock)
   * @returns Decrypted data
   */
  decryptData(encrypted: string, _password?: string): unknown {
    // Mock decryption
    if (!encrypted.startsWith('encrypted:')) {
      throw new Error('Invalid encrypted data format');
    }
    const base64Data = encrypted.substring('encrypted:'.length);
    return JSON.parse(Buffer.from(base64Data, 'base64').toString()) as unknown;
  }

  /**
   * Create a backup of all data
   * @returns Promise that resolves to backup data
   */
  async createBackup(): Promise<BackupData> {
    if (!this.isInitialized) throw new Error('Database not initialized');

    const wallets = Array.from(this.wallets.values());
    const preferences = Array.from(this.preferences.values());
    const configs = Array.from(this.configs.values());

    await Promise.resolve();

    return {
      timestamp: Date.now(),
      version: 1,
      data: {
        wallets,
        preferences,
        configs,
        transactions: [],
        nfts: []
      }
    };
  }

  /**
   * Restore data from backup
   * @param backup - Backup data to restore
   * @returns Promise that resolves to success status
   */
  async restoreFromBackup(backup: BackupData): Promise<boolean> {
    if (!this.isInitialized) throw new Error('Database not initialized');

    try {
      await this.clear();

      if (backup.data.wallets !== undefined && backup.data.wallets.length > 0) {
        for (const wallet of backup.data.wallets) {
          await this.saveWallet(wallet);
        }
      }

      if (backup.data.preferences !== undefined && backup.data.preferences.length > 0) {
        for (const pref of backup.data.preferences) {
          await this.savePreferences(pref);
        }
      }

      if (backup.data.configs !== undefined && backup.data.configs.length > 0) {
        for (const config of backup.data.configs) {
          await this.saveConfig(config);
        }
      }

      return true;
    } catch (error) {
      console.error('Error restoring from backup:', error);
      return false;
    }
  }

  /**
   * Mock sync with remote database
   * @param localData - Local data to sync
   * @returns Sync result
   */
  syncWithRemote(localData: SyncData): SyncResult {
    // Mock sync operation
    return {
      success: true,
      synced: {
        wallets: localData.wallets ?? Array.from(this.wallets.values()),
        transactions: localData.transactions ?? [],
        nfts: localData.nfts ?? []
      }
    };
  }

  /**
   * Handle sync conflicts
   * @param conflicts - Array of conflicts to handle
   * @returns Promise that resolves when conflicts are handled
   */
  async handleSyncConflicts(conflicts: ConflictData[]): Promise<void> {
    // Mock conflict resolution
    for (const conflict of conflicts) {
      const resolved = this.resolveConflict(conflict.local, conflict.remote);
      if (resolved.wallets !== undefined) {
        for (const wallet of resolved.wallets) {
          await this.saveWallet(wallet);
        }
      }
    }
  }

  /**
   * Resolve sync conflict
   * @param local - Local data
   * @param remote - Remote data
   * @returns Resolved data
   */
  resolveConflict(local: SyncData, remote: SyncData): SyncData {
    // Mock conflict resolution - prefer remote if newer
    if (local.lastModified === undefined || remote.lastModified === undefined) {
      return remote;
    }

    if (remote.lastModified > local.lastModified) {
      return remote;
    }
    return local;
  }

  /**
   * Close the mock database
   * @returns void
   */
  close(): void {
    this.isInitialized = false;
    this.wallets.clear();
    this.preferences.clear();
    this.configs.clear();
  }

  /**
   * Save account data (alias for saveWallet)
   * @param account - Account data to save
   * @returns Promise that resolves to success status
   */
  async saveAccount(account: WalletAccountData): Promise<boolean> {
    return this.saveWallet(account);
  }

  /**
   * Get account by ID
   * @param accountId - Account ID
   * @returns Promise that resolves to account data or null
   */
  async getAccount(accountId: string): Promise<WalletAccountData | null> {
    // Find by ID first, then by address
    for (const wallet of this.wallets.values()) {
      if (wallet.id === accountId) {
        return wallet;
      }
    }
    return this.getWallet(accountId);
  }

  /**
   * Get accounts with query options
   * @param options - Query options
   * @returns Promise that resolves to array of accounts
   */
  async getAccounts(options: QueryOptions = {}): Promise<WalletAccountData[]> {
    await Promise.resolve();
    let accounts = Array.from(this.wallets.values());

    // Apply filters
    if (options.filters !== undefined) {
      accounts = accounts.filter(account => {
        for (const [key, value] of Object.entries(options.filters ?? {})) {
          const accountKey = key as keyof WalletAccountData;
          if (account[accountKey] !== value) {
            return false;
          }
        }
        return true;
      });
    }

    // Apply sorting
    if (options.sortBy !== undefined) {
      accounts.sort((a, b) => {
        const sortKey = options.sortBy as keyof WalletAccountData;
        const aValue = a[sortKey] as string | number | boolean | undefined;
        const bValue = b[sortKey] as string | number | boolean | undefined;
        const order = options.sortOrder === 'desc' ? -1 : 1;

        if (aValue === undefined && bValue === undefined) return 0;
        if (aValue === undefined) return order;
        if (bValue === undefined) return -order;
        if (aValue < bValue) return -order;
        if (aValue > bValue) return order;
        return 0;
      });
    }

    // Apply pagination
    if (options.offset !== undefined || options.limit !== undefined) {
      const offset = options.offset ?? 0;
      const limit = options.limit ?? accounts.length;
      accounts = accounts.slice(offset, offset + limit);
    }

    return accounts;
  }

  /**
   * Delete account by ID
   * @param accountId - Account ID to delete
   * @returns Promise that resolves to success status
   */
  async deleteAccount(accountId: string): Promise<boolean> {
    // Try to delete by ID first
    for (const [address, wallet] of this.wallets.entries()) {
      if (wallet.id === accountId) {
        return this.deleteWallet(address);
      }
    }
    // Fall back to deleting by address
    return this.deleteWallet(accountId);
  }

  /**
   * Save preferences
   * @param preferences - Preferences to save
   * @returns Promise that resolves to success status
   */
  async savePreferences(preferences: WalletPreferences): Promise<boolean> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    this.preferences.set(preferences.userId, preferences);
    await Promise.resolve();
    return true;
  }

  /**
   * Save configuration
   * @param config - Configuration to save
   * @returns Promise that resolves to success status
   */
  async saveConfig(config: WalletConfig): Promise<boolean> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    this.configs.set(config.id, config);
    await Promise.resolve();
    return true;
  }

  /**
   * Clear all data (alias for clear)
   * @returns Promise that resolves to success status
   */
  async clearAll(): Promise<boolean> {
    await this.clear();
    return true;
  }
}