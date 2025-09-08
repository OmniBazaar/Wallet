/**
 * WalletDatabase - Main Wallet Database Service
 * 
 * Provides database operations for wallet data including accounts,
 * preferences, and general wallet configuration storage.
 */

/** Wallet account data stored in database */
export interface WalletAccountData {
  /** Account ID */
  id: string;
  /** Account address */
  address: string;
  /** Account name */
  name: string;
  /** Account type */
  type: 'imported' | 'generated' | 'hardware';
  /** Chain ID */
  chainId: number;
  /** Public key */
  publicKey?: string;
  /** Derivation path (for HD wallets) */
  derivationPath?: string;
  /** Creation timestamp */
  createdAt: number;
  /** Last accessed timestamp */
  lastAccessedAt: number;
  /** Whether account is active */
  isActive: boolean;
  /** Account metadata */
  metadata?: Record<string, any>;
}

/** Wallet preferences */
export interface WalletPreferences {
  /** User ID */
  userId: string;
  /** Default currency */
  defaultCurrency: string;
  /** Language preference */
  language: string;
  /** Theme preference */
  theme: 'light' | 'dark' | 'auto';
  /** Auto-lock timeout (minutes) */
  autoLockTimeout: number;
  /** Whether to show balance on startup */
  showBalanceOnStartup: boolean;
  /** Privacy mode enabled */
  privacyMode: boolean;
  /** Notification preferences */
  notifications: {
    transactions: boolean;
    priceAlerts: boolean;
    security: boolean;
  };
  /** Gas preferences */
  gasSettings: {
    defaultGasPrice: string;
    maxGasPrice: string;
    gasLimitBuffer: number;
  };
  /** Update preferences */
  updatedAt: number;
}

/** Wallet configuration */
export interface WalletConfig {
  /** Configuration ID */
  id: string;
  /** Configuration version */
  version: string;
  /** Network configurations */
  networks: Record<number, {
    name: string;
    rpcUrl: string;
    explorerUrl: string;
    isCustom: boolean;
  }>;
  /** Token configurations */
  tokens: Record<string, {
    symbol: string;
    name: string;
    decimals: number;
    logoUrl?: string;
    isCustom: boolean;
  }>;
  /** Security settings */
  security: {
    biometricEnabled: boolean;
    autoBackup: boolean;
    encryptionLevel: 'standard' | 'high';
  };
  /** Last update timestamp */
  updatedAt: number;
}

/** Database query options */
export interface QueryOptions {
  /** Number of records to return */
  limit?: number;
  /** Number of records to skip */
  offset?: number;
  /** Sort field */
  sortBy?: string;
  /** Sort order */
  sortOrder?: 'asc' | 'desc';
  /** Filters to apply */
  filters?: Record<string, any>;
}

/**
 * Main wallet database service
 */
export class WalletDatabase {
  private isInitialized = false;
  private dbName = 'OmniWallet';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;

  /**
   * Creates a new WalletDatabase instance
   */
  constructor() {}

  /**
   * Initialize the wallet database
   * @throws {Error} When initialization fails
   */
  async init(): Promise<void> {
    try {
      if (this.isInitialized) {
        return;
      }

      if (typeof indexedDB === 'undefined') {
        throw new Error('IndexedDB not supported');
      }

      this.db = await this.openDatabase();
      this.isInitialized = true;
      // // console.log('WalletDatabase initialized');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to initialize wallet database: ${errorMessage}`);
    }
  }

  /**
   * Open IndexedDB database
   * @private
   */
  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        reject(new Error('Failed to open database'));
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create accounts store
        if (!db.objectStoreNames.contains('accounts')) {
          const accountStore = db.createObjectStore('accounts', { keyPath: 'id' });
          accountStore.createIndex('address', 'address', { unique: false });
          accountStore.createIndex('chainId', 'chainId', { unique: false });
          accountStore.createIndex('type', 'type', { unique: false });
        }

        // Create preferences store
        if (!db.objectStoreNames.contains('preferences')) {
          db.createObjectStore('preferences', { keyPath: 'userId' });
        }

        // Create config store
        if (!db.objectStoreNames.contains('config')) {
          db.createObjectStore('config', { keyPath: 'id' });
        }

        // Create contacts store
        if (!db.objectStoreNames.contains('contacts')) {
          const contactStore = db.createObjectStore('contacts', { keyPath: 'id' });
          contactStore.createIndex('address', 'address', { unique: false });
          contactStore.createIndex('name', 'name', { unique: false });
        }
      };
    });
  }

  /**
   * Save wallet account
   * @param account - Account data to save
   * @returns Success status
   */
  async saveAccount(account: WalletAccountData): Promise<boolean> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const transaction = this.db.transaction(['accounts'], 'readwrite');
      const store = transaction.objectStore('accounts');
      
      await new Promise<void>((resolve, reject) => {
        const request = store.put(account);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      // // console.log(`Account saved: ${account.address}`);
      return true;
    } catch (error) {
      console.error('Error saving account:', error);
      return false;
    }
  }

  /**
   * Get wallet account by ID
   * @param accountId - Account ID
   * @returns Account data or null
   */
  async getAccount(accountId: string): Promise<WalletAccountData | null> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const transaction = this.db.transaction(['accounts'], 'readonly');
      const store = transaction.objectStore('accounts');
      
      return new Promise<WalletAccountData | null>((resolve, reject) => {
        const request = store.get(accountId);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error getting account:', error);
      return null;
    }
  }

  /**
   * Get all wallet accounts
   * @param options - Query options
   * @returns Array of accounts
   */
  async getAccounts(options: QueryOptions = {}): Promise<WalletAccountData[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const transaction = this.db.transaction(['accounts'], 'readonly');
      const store = transaction.objectStore('accounts');
      
      return new Promise<WalletAccountData[]>((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => {
          let results = request.result || [];
          
          // Apply filters
          if (options.filters) {
            results = results.filter(account => {
              return Object.entries(options.filters!).every(([key, value]) => {
                return (account)[key] === value;
              });
            });
          }

          // Apply sorting
          if (options.sortBy) {
            results.sort((a, b) => {
              const aVal = (a)[options.sortBy!];
              const bVal = (b)[options.sortBy!];
              const order = options.sortOrder === 'desc' ? -1 : 1;
              return aVal > bVal ? order : aVal < bVal ? -order : 0;
            });
          }

          // Apply pagination
          if (options.offset || options.limit) {
            const start = options.offset || 0;
            const end = options.limit ? start + options.limit : undefined;
            results = results.slice(start, end);
          }

          resolve(results);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error getting accounts:', error);
      return [];
    }
  }

  /**
   * Delete wallet account
   * @param accountId - Account ID
   * @returns Success status
   */
  async deleteAccount(accountId: string): Promise<boolean> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const transaction = this.db.transaction(['accounts'], 'readwrite');
      const store = transaction.objectStore('accounts');
      
      await new Promise<void>((resolve, reject) => {
        const request = store.delete(accountId);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      // // console.log(`Account deleted: ${accountId}`);
      return true;
    } catch (error) {
      console.error('Error deleting account:', error);
      return false;
    }
  }

  /**
   * Save wallet preferences
   * @param preferences - Preferences to save
   * @returns Success status
   */
  async savePreferences(preferences: WalletPreferences): Promise<boolean> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      preferences.updatedAt = Date.now();
      
      const transaction = this.db.transaction(['preferences'], 'readwrite');
      const store = transaction.objectStore('preferences');
      
      await new Promise<void>((resolve, reject) => {
        const request = store.put(preferences);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      // // console.log('Preferences saved');
      return true;
    } catch (error) {
      console.error('Error saving preferences:', error);
      return false;
    }
  }

  /**
   * Get wallet preferences
   * @param userId - User ID
   * @returns Preferences or default preferences
   */
  async getPreferences(userId: string): Promise<WalletPreferences> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const transaction = this.db.transaction(['preferences'], 'readonly');
      const store = transaction.objectStore('preferences');
      
      const preferences = await new Promise<WalletPreferences | null>((resolve, reject) => {
        const request = store.get(userId);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });

      if (preferences) {
        return preferences;
      }

      // Return default preferences
      return {
        userId,
        defaultCurrency: 'USD',
        language: 'en',
        theme: 'auto',
        autoLockTimeout: 15,
        showBalanceOnStartup: true,
        privacyMode: false,
        notifications: {
          transactions: true,
          priceAlerts: true,
          security: true
        },
        gasSettings: {
          defaultGasPrice: '20000000000', // 20 gwei
          maxGasPrice: '100000000000', // 100 gwei
          gasLimitBuffer: 1.2
        },
        updatedAt: Date.now()
      };
    } catch (error) {
      console.error('Error getting preferences:', error);
      // Return default preferences on error
      return {
        userId,
        defaultCurrency: 'USD',
        language: 'en',
        theme: 'auto',
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
        updatedAt: Date.now()
      };
    }
  }

  /**
   * Save wallet configuration
   * @param config - Configuration to save
   * @returns Success status
   */
  async saveConfig(config: WalletConfig): Promise<boolean> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      config.updatedAt = Date.now();
      
      const transaction = this.db.transaction(['config'], 'readwrite');
      const store = transaction.objectStore('config');
      
      await new Promise<void>((resolve, reject) => {
        const request = store.put(config);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      // // console.log('Configuration saved');
      return true;
    } catch (error) {
      console.error('Error saving configuration:', error);
      return false;
    }
  }

  /**
   * Get wallet configuration
   * @param configId - Configuration ID
   * @returns Configuration or null
   */
  async getConfig(configId: string): Promise<WalletConfig | null> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const transaction = this.db.transaction(['config'], 'readonly');
      const store = transaction.objectStore('config');
      
      return new Promise<WalletConfig | null>((resolve, reject) => {
        const request = store.get(configId);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error getting configuration:', error);
      return null;
    }
  }

  /**
   * Clear all wallet data
   * @returns Success status
   */
  async clearAll(): Promise<boolean> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const transaction = this.db.transaction(['accounts', 'preferences', 'config', 'contacts'], 'readwrite');
      
      await Promise.all([
        new Promise<void>((resolve, reject) => {
          const request = transaction.objectStore('accounts').clear();
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        }),
        new Promise<void>((resolve, reject) => {
          const request = transaction.objectStore('preferences').clear();
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        }),
        new Promise<void>((resolve, reject) => {
          const request = transaction.objectStore('config').clear();
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        }),
        new Promise<void>((resolve, reject) => {
          const request = transaction.objectStore('contacts').clear();
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        })
      ]);

      // // console.log('All wallet data cleared');
      return true;
    } catch (error) {
      console.error('Error clearing wallet data:', error);
      return false;
    }
  }

  /**
   * Clear database (alias for clearAll)
   */
  async clear(): Promise<boolean> {
    return await this.clearAll();
  }

  /**
   * Save wallet data
   * @param wallet - Wallet data to save
   * @returns Success status
   */
  async saveWallet(wallet: any): Promise<boolean> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      // Generate ID if not provided
      const walletData = {
        id: wallet.address,
        ...wallet,
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
        isActive: true,
        type: 'imported' as const
      };

      const transaction = this.db.transaction(['accounts'], 'readwrite');
      const store = transaction.objectStore('accounts');
      
      await new Promise<void>((resolve, reject) => {
        const request = store.put(walletData);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      return true;
    } catch (error) {
      console.error('Error saving wallet:', error);
      return false;
    }
  }

  /**
   * Get wallet by address
   * @param address - Wallet address
   * @returns Wallet data or null
   */
  async getWallet(address: string): Promise<any | null> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const transaction = this.db.transaction(['accounts'], 'readonly');
      const store = transaction.objectStore('accounts');
      
      // Use the ID directly as address is the ID
      return new Promise<any | null>((resolve, reject) => {
        const request = store.get(address);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error getting wallet:', error);
      return null;
    }
  }

  /**
   * Delete wallet by address
   * @param address - Wallet address
   * @returns Success status
   */
  async deleteWallet(address: string): Promise<boolean> {
    return this.deleteAccount(address);
  }

  /**
   * Get all wallets
   * @returns Array of wallets
   */
  async getAllWallets(): Promise<any[]> {
    const accounts = await this.getAccounts();
    return accounts;
  }

  /**
   * Update wallet metadata
   * @param address - Wallet address
   * @param updates - Updates to apply
   * @returns Success status
   */
  async updateWallet(address: string, updates: any): Promise<boolean> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const existing = await this.getWallet(address);
      if (!existing) {
        return false;
      }

      const updated = {
        ...existing,
        ...updates,
        lastAccessedAt: Date.now()
      };

      const transaction = this.db.transaction(['accounts'], 'readwrite');
      const store = transaction.objectStore('accounts');
      
      await new Promise<void>((resolve, reject) => {
        const request = store.put(updated);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      return true;
    } catch (error) {
      console.error('Error updating wallet:', error);
      return false;
    }
  }

  /**
   * Encrypt sensitive data
   * @param data - Data to encrypt
   * @param password - Encryption password (optional)
   * @returns Encrypted data
   */
  async encryptData(data: any, password?: string): Promise<string> {
    // Simple base64 encoding for testing - in production use proper encryption
    const jsonStr = JSON.stringify(data);
    const encrypted = btoa(jsonStr);
    return `encrypted:${encrypted}`;
  }

  /**
   * Decrypt sensitive data
   * @param encryptedData - Encrypted data
   * @param password - Decryption password (optional)
   * @returns Decrypted data
   */
  async decryptData(encryptedData: string, password?: string): Promise<any> {
    // Simple base64 decoding for testing - in production use proper decryption
    if (!encryptedData.startsWith('encrypted:')) {
      throw new Error('Invalid encrypted data format');
    }
    
    const base64Data = encryptedData.substring('encrypted:'.length);
    const jsonStr = atob(base64Data);
    return JSON.parse(jsonStr);
  }

  /**
   * Create a backup of all wallet data
   * @returns Backup object with timestamp and data
   */
  async createBackup(): Promise<any> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const wallets = await this.getAccounts();
      const preferences = await this.getAllPreferences();
      const configs = await this.getAllConfigs();

      // Also backup transactions and NFTs if they exist
      const transactions = await this.getAllTransactions();
      const nfts = await this.getAllNFTs();

      const backup = {
        timestamp: Date.now(),
        version: this.dbVersion,
        data: {
          wallets,
          preferences,
          configs,
          transactions,
          nfts
        }
      };

      return backup;
    } catch (error) {
      console.error('Error creating backup:', error);
      throw error;
    }
  }

  /**
   * Restore data from backup
   * @param backup - Backup object
   * @returns Success status
   */
  async restoreFromBackup(backup: any): Promise<boolean> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      // Clear existing data first
      await this.clearAll();

      // Restore wallets
      if (backup.data.wallets) {
        for (const wallet of backup.data.wallets) {
          await this.saveAccount(wallet);
        }
      }

      // Restore preferences
      if (backup.data.preferences) {
        for (const pref of backup.data.preferences) {
          await this.savePreferences(pref);
        }
      }

      // Restore configs
      if (backup.data.configs) {
        for (const config of backup.data.configs) {
          await this.saveConfig(config);
        }
      }

      // Restore transactions and NFTs through companion databases
      // These will be handled by their respective databases

      return true;
    } catch (error) {
      console.error('Error restoring from backup:', error);
      return false;
    }
  }

  /**
   * Sync with remote database
   * @param localData - Local data to sync
   * @returns Sync result
   */
  async syncWithRemote(localData: any): Promise<any> {
    // Mock sync for testing
    return {
      success: true,
      synced: {
        wallets: localData.wallets || [],
        transactions: localData.transactions || [],
        nfts: localData.nfts || []
      }
    };
  }

  /**
   * Resolve sync conflicts
   * @param localData - Local data
   * @param remoteData - Remote data
   * @returns Resolved data (favors newer data)
   */
  async resolveConflict(localData: any, remoteData: any): Promise<any> {
    // Simple conflict resolution - favor newer data
    if (!localData.lastModified || !remoteData.lastModified) {
      return remoteData;
    }
    
    return localData.lastModified > remoteData.lastModified ? localData : remoteData;
  }

  /**
   * Export data in standard format
   * @param format - Export format (json, csv, etc.)
   * @returns Exported data as string
   */
  async exportData(format: string = 'json'): Promise<string> {
    const backup = await this.createBackup();
    
    if (format === 'json') {
      return JSON.stringify({
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        ...backup.data
      }, null, 2);
    }
    
    throw new Error(`Unsupported export format: ${format}`);
  }

  /**
   * Helper: Get all preferences
   * @private
   */
  private async getAllPreferences(): Promise<WalletPreferences[]> {
    if (!this.db) return [];
    
    try {
      const transaction = this.db.transaction(['preferences'], 'readonly');
      const store = transaction.objectStore('preferences');
      
      return new Promise<WalletPreferences[]>((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error getting all preferences:', error);
      return [];
    }
  }

  /**
   * Helper: Get all configs
   * @private
   */
  private async getAllConfigs(): Promise<WalletConfig[]> {
    if (!this.db) return [];
    
    try {
      const transaction = this.db.transaction(['config'], 'readonly');
      const store = transaction.objectStore('config');
      
      return new Promise<WalletConfig[]>((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error getting all configs:', error);
      return [];
    }
  }

  /**
   * Helper: Get all transactions (stub - actual data from TransactionDatabase)
   * @private
   */
  private async getAllTransactions(): Promise<any[]> {
    // This is a stub - actual transaction data should come from TransactionDatabase
    return [];
  }

  /**
   * Helper: Get all NFTs (stub - actual data from NFTDatabase)
   * @private
   */
  private async getAllNFTs(): Promise<any[]> {
    // This is a stub - actual NFT data should come from NFTDatabase
    return [];
  }

  /**
   * Close database connection (alias for cleanup)
   */
  async close(): Promise<void> {
    return this.cleanup();
  }

  /**
   * Cleanup database and close connection
   */
  async cleanup(): Promise<void> {
    try {
      if (this.db) {
        this.db.close();
        this.db = null;
      }
      this.isInitialized = false;
      // // console.log('WalletDatabase cleanup completed');
    } catch (error) {
      console.error('Error during WalletDatabase cleanup:', error);
    }
  }
}