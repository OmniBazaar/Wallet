/**
 * UnifiedBackupService - Cross-Database Backup and Restore
 *
 * Coordinates backup and restore operations across all database services
 * (WalletDatabase, TransactionDatabase, NFTDatabase) to ensure data consistency.
 */

import { WalletDatabase, BackupData as WalletBackupData } from './WalletDatabase';
import { TransactionDatabase, TransactionData } from './TransactionDatabase';
import { NFTDatabase, NFTData } from './NFTDatabase';

/**
 * Unified backup data structure
 */
export interface UnifiedBackupData {
  /** Backup timestamp */
  timestamp: number;
  /** Database version */
  version: number;
  /** Backup data from all databases */
  data: {
    /** Wallet data */
    wallets: WalletBackupData['data']['wallets'];
    /** Preferences data */
    preferences: WalletBackupData['data']['preferences'];
    /** Config data */
    configs: WalletBackupData['data']['configs'];
    /** Transaction data */
    transactions: TransactionData[];
    /** NFT data */
    nfts: NFTData[];
  };
}

/**
 * Service for coordinating backup/restore across all databases
 */
export class UnifiedBackupService {
  private walletDB: WalletDatabase;
  private transactionDB: TransactionDatabase;
  private nftDB: NFTDatabase;

  /**
   * Creates a new UnifiedBackupService instance
   * @param walletDB - Wallet database instance
   * @param transactionDB - Transaction database instance
   * @param nftDB - NFT database instance
   */
  constructor(
    walletDB: WalletDatabase,
    transactionDB: TransactionDatabase,
    nftDB: NFTDatabase
  ) {
    this.walletDB = walletDB;
    this.transactionDB = transactionDB;
    this.nftDB = nftDB;
  }

  /**
   * Create a unified backup of all databases
   * @returns Unified backup data
   */
  async createBackup(): Promise<UnifiedBackupData> {
    try {
      // Get wallet backup (includes wallets, preferences, configs)
      const walletBackup = await this.walletDB.createBackup();

      // Get all transactions
      const transactions = await this.transactionDB.getAllTransactions();

      // Get all NFTs
      const nfts = await this.nftDB.getNFTs();

      // Create unified backup
      const backup: UnifiedBackupData = {
        timestamp: Date.now(),
        version: 1,
        data: {
          wallets: walletBackup.data.wallets,
          preferences: walletBackup.data.preferences,
          configs: walletBackup.data.configs,
          transactions,
          nfts
        }
      };

      return backup;
    } catch (error) {
      console.error('Error creating unified backup:', error);
      throw new Error('Failed to create unified backup');
    }
  }

  /**
   * Restore data from unified backup
   * @param backup - Unified backup data
   * @returns Success status
   */
  async restoreFromBackup(backup: UnifiedBackupData): Promise<boolean> {
    try {
      // Clear all databases first
      await this.clearAll();

      // Restore wallet data (wallets, preferences, configs)
      const walletBackup: WalletBackupData = {
        timestamp: backup.timestamp,
        version: backup.version,
        data: {
          wallets: backup.data.wallets,
          preferences: backup.data.preferences,
          configs: backup.data.configs,
          transactions: [], // WalletDB doesn't store these
          nfts: [] // WalletDB doesn't store these
        }
      };
      await this.walletDB.restoreFromBackup(walletBackup);

      // Restore transactions
      for (const transaction of backup.data.transactions) {
        await this.transactionDB.saveTransaction(transaction);
      }

      // Restore NFTs
      for (const nft of backup.data.nfts) {
        await this.nftDB.saveNFT(nft);
      }

      return true;
    } catch (error) {
      console.error('Error restoring from unified backup:', error);
      return false;
    }
  }

  /**
   * Clear all databases
   * @returns Success status
   */
  async clearAll(): Promise<boolean> {
    try {
      await Promise.all([
        this.walletDB.clear(),
        this.transactionDB.clear(),
        this.nftDB.clear()
      ]);
      return true;
    } catch (error) {
      console.error('Error clearing databases:', error);
      return false;
    }
  }

  /**
   * Export backup to JSON string
   * @returns JSON string of backup data
   */
  async exportBackup(): Promise<string> {
    const backup = await this.createBackup();
    return JSON.stringify(backup, null, 2);
  }

  /**
   * Import backup from JSON string
   * @param jsonData - JSON string of backup data
   * @returns Success status
   */
  async importBackup(jsonData: string): Promise<boolean> {
    try {
      const backup = JSON.parse(jsonData) as UnifiedBackupData;
      return await this.restoreFromBackup(backup);
    } catch (error) {
      console.error('Error importing backup:', error);
      return false;
    }
  }

  /**
   * Verify backup integrity
   * @param backup - Backup to verify
   * @returns Whether backup is valid
   */
  static verifyBackup(backup: UnifiedBackupData): boolean {
    return (
      backup !== null &&
      backup !== undefined &&
      typeof backup === 'object' &&
      typeof backup.timestamp === 'number' &&
      backup.timestamp > 0 &&
      typeof backup.version === 'number' &&
      backup.version > 0 &&
      backup.data !== null &&
      backup.data !== undefined &&
      typeof backup.data === 'object' &&
      Array.isArray(backup.data.wallets) &&
      Array.isArray(backup.data.transactions) &&
      Array.isArray(backup.data.nfts)
    );
  }
}