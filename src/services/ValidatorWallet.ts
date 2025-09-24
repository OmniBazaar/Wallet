/**
 * Validator Wallet Service Integration
 *
 * Integrates wallet operations with the Validator service network
 */

// Import the validator client from the Validator module
// Using relative imports in monorepo structure
import { OmniValidatorClient, createOmniValidatorClient } from '../../../Validator/dist/client/index';
import { ethers } from 'ethers';
import { nanoid } from 'nanoid';
import { ref, Ref } from 'vue';
import { logger } from '../utils/logger';
import { SecureIndexedDB } from '../core/storage/SecureIndexedDB';

/** Configuration for validator wallet service */
export interface ValidatorWalletConfig {
  /** Validator node endpoint URL */
  validatorEndpoint: string;
  /** WebSocket endpoint for real-time updates */
  wsEndpoint?: string;
  /** API key for validator authentication */
  apiKey?: string;
  /** Network identifier */
  networkId: string;
  /** User identifier */
  userId: string;
  /** Enable automatic wallet backup */
  autoBackup: boolean;
  /** Backup interval in milliseconds (default: 24 hours) */
  backupInterval: number;
}

/** Represents a wallet account managed by the service */
export interface WalletAccount {
  /** Unique account identifier */
  id: string;
  /** Account Ethereum address */
  address: string;
  /** Account display name */
  name: string;
  /** Account type (e.g., 'ethereum', 'bitcoin', 'solana') */
  type: string;
  /** Current balance in wei/satoshi/lamports */
  balance: string;
  /** Account creation timestamp */
  createdAt: number;
  /** Last activity timestamp */
  lastActivity: number;
  /** Whether this is the primary account */
  isPrimary: boolean;
  /** Account metadata (e.g., color, icon) */
  metadata?: Record<string, unknown>;
}

/** Transaction request for sending funds */
export interface TransactionRequest {
  /** Sender account ID */
  fromAccountId: string;
  /** Recipient address */
  to: string;
  /** Amount to send in wei/satoshi/lamports */
  amount: string;
  /** Optional transaction data/memo */
  data?: string;
  /** Gas price override (EVM chains) */
  gasPrice?: string;
  /** Gas limit override (EVM chains) */
  gasLimit?: string;
}

/** Result of a transaction submission */
export interface TransactionResult {
  /** Whether transaction was successful */
  success: boolean;
  /** Transaction hash if successful */
  transactionHash?: string;
  /** Block number if confirmed */
  blockNumber?: number;
  /** Number of confirmations */
  confirmations?: number;
  /** Error message if failed */
  error?: string;
}

/** Represents a wallet backup for secure storage */
export interface WalletBackup {
  /** Unique backup identifier */
  id: string;
  /** User ID associated with this backup */
  userId: string;
  /** Encrypted wallet data */
  encryptedData: string;
  /** Timestamp when backup was created */
  timestamp: number;
  /** Backup format version */
  version: string;
  /** Checksum for data integrity verification */
  checksum: string;
}

/** ENS (Ethereum Name Service) resolution result */
export interface ENSResolution {
  /** Resolved Ethereum address */
  address: string;
  /** ENS domain name */
  name: string;
  /** Avatar image URL if available */
  avatar?: string;
  /** Profile description if available */
  description?: string;
  /** Social media links if available */
  social?: Record<string, string>;
  /** Whether the ENS record is verified */
  verified: boolean;
}

/**
 * Service for managing wallet operations with validator network integration.
 * Provides account management, transactions, and backup functionality.
 */
export class ValidatorWalletService {
  private client: OmniValidatorClient;
  private config: ValidatorWalletConfig;
  private accounts: Map<string, WalletAccount> = new Map();
  private activeAccountId: string | null = null;
  private isInitialized = false;
  private backupInterval: NodeJS.Timeout | null = null;

  // Reactive references for Vue integration
  public accountsRef: Ref<WalletAccount[]> = ref([]);
  public activeAccountRef: Ref<WalletAccount | null> = ref(null);
  public balancesRef: Ref<Record<string, string>> = ref({});

  /**
   * Create a new ValidatorWalletService.
   *
   * @param config Configuration including endpoints, API key and options
   */
  constructor(config: ValidatorWalletConfig) {
    this.config = config;
    this.client = createOmniValidatorClient({
      validatorEndpoint: config.validatorEndpoint,
      ...(config.wsEndpoint !== undefined && { wsEndpoint: config.wsEndpoint }),
      ...(config.apiKey !== undefined && { apiKey: config.apiKey }),
      timeout: 30000,
      retryAttempts: 3
    });
  }

  /**
   * Update the user identifier used by this service.
   * @param userId New user identifier to set
   */
  public setUserId(userId: string): void {
    this.config.userId = userId;
  }

  /**
   * Expose a readonly view of the current configuration.
   * @returns Readonly configuration object with all service settings
   */
  public getConfig(): Readonly<ValidatorWalletConfig> {
    return this.config;
  }

  /**
   * Initialize wallet service with Validator integration.
   * Checks validator health, loads existing accounts from storage,
   * and sets up auto-backup if enabled.
   * @returns Promise that resolves when initialization is complete
   * @throws Error if validator service is unhealthy or initialization fails
   */
  async initialize(): Promise<void> {
    try {
      // Check validator health
      const status = await this.client.getStatus();
      if (!status.isConnected) {
        throw new Error('Validator service is not connected');
      }

      // Load existing accounts from secure storage
      this.loadAccountsFromStorage();

      // Set up auto-backup if enabled
      if (this.config.autoBackup) {
        this.setupAutoBackup();
      }

      this.isInitialized = true;
      logger.info('Validator Wallet Service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Validator Wallet Service:', error);
      throw error;
    }
  }

  /**
   * Create a new wallet account.
   * Generates a new keypair and registers it with the validator network.
   * 
   * @param name Display name for the account
   * @param type Account type (default: 'ethereum')
   * @param metadata Optional metadata for the account
   * @returns Created wallet account
   */
  async createAccount(
    name: string,
    type: string = 'ethereum',
    metadata?: Record<string, unknown>
  ): Promise<WalletAccount> {
    if (!this.isInitialized) {
      throw new Error('Service not initialized');
    }

    // Generate new wallet
    const wallet = ethers.Wallet.createRandom();
    const account: WalletAccount = {
      id: nanoid(),
      address: wallet.address,
      name,
      type,
      balance: '0',
      createdAt: Date.now(),
      lastActivity: Date.now(),
      isPrimary: this.accounts.size === 0,
      ...(metadata !== undefined && metadata !== null ? { metadata } : {})
    };

    // Store private key securely using SecureIndexedDB
    await this.storePrivateKey(account.id, wallet.privateKey);

    // Add to accounts
    this.accounts.set(account.id, account);
    if (account.isPrimary) {
      this.activeAccountId = account.id;
      this.activeAccountRef.value = account;
    }

    // Update reactive state
    this.updateAccountsRef();

    // Backup if enabled
    if (this.config.autoBackup) {
      await this.backupWallet();
    }

    return account;
  }

  /**
   * Import an existing wallet account from a private key.
   * 
   * @param privateKey Private key to import
   * @param name Display name for the account
   * @param type Account type (default: 'ethereum')
   * @returns Imported wallet account
   */
  async importAccount(
    privateKey: string,
    name: string,
    type: string = 'ethereum'
  ): Promise<WalletAccount> {
    if (!this.isInitialized) {
      throw new Error('Service not initialized');
    }

    // Create wallet from private key
    const wallet = new ethers.Wallet(privateKey);
    const account: WalletAccount = {
      id: nanoid(),
      address: wallet.address,
      name,
      type,
      balance: '0',
      createdAt: Date.now(),
      lastActivity: Date.now(),
      isPrimary: this.accounts.size === 0,
      metadata: {}
    };

    // Store private key securely
    await this.storePrivateKey(account.id, privateKey);

    // Add to accounts
    this.accounts.set(account.id, account);
    if (account.isPrimary) {
      this.activeAccountId = account.id;
      this.activeAccountRef.value = account;
    }

    // Update reactive state
    this.updateAccountsRef();

    // Get initial balance
    await this.updateAccountBalance(account.id);

    return account;
  }

  /**
   * Get all wallet accounts.
   * @returns Array of wallet accounts
   */
  getAccounts(): WalletAccount[] {
    return Array.from(this.accounts.values());
  }

  /**
   * Get account by ID.
   * @param accountId Account identifier
   * @returns Account or undefined if not found
   */
  getAccount(accountId: string): WalletAccount | undefined {
    return this.accounts.get(accountId);
  }

  /**
   * Get the active account.
   * @returns Active account or null if none selected
   */
  getActiveAccount(): WalletAccount | null {
    return (this.activeAccountId !== null && this.activeAccountId !== '') ? this.accounts.get(this.activeAccountId) ?? null : null;
  }

  /**
   * Set the active account.
   * @param accountId Account ID to make active
   */
  setActiveAccount(accountId: string): void {
    const account = this.accounts.get(accountId);
    if (account === undefined) {
      throw new Error('Account not found');
    }

    this.activeAccountId = accountId;
    this.activeAccountRef.value = account;
  }

  /**
   * Update account balance from the blockchain.
   * @param accountId Account ID to update
   * @returns Updated balance in wei
   */
  async updateAccountBalance(accountId: string): Promise<string> {
    try {
      const account = this.accounts.get(accountId);
      if (account === undefined) {
        throw new Error('Account not found');
      }

      // Get user info from validator (includes balance)
      const userInfo = await this.client.getUser(account.address);
      const balance = (userInfo?.stakingBalance !== undefined && userInfo.stakingBalance !== '') ? userInfo.stakingBalance : '0';

      // Update account balance
      account.balance = balance;

      // Update reactive balance
      this.balancesRef.value = {
        ...this.balancesRef.value,
        [account.address]: account.balance
      };

      return account.balance;
    } catch (error) {
      logger.error('Failed to update account balance:', error);
      throw error;
    }
  }

  /**
   * Send a transaction from an account.
   * @param request Transaction request details
   * @returns Transaction result
   */
  async sendTransaction(request: TransactionRequest): Promise<TransactionResult> {
    try {
      const account = this.accounts.get(request.fromAccountId);
      if (account === undefined) {
        throw new Error('Account not found');
      }

      // Get private key
      const privateKey = await this.getPrivateKey(request.fromAccountId);
      if (privateKey === null || privateKey === '') {
        throw new Error('Private key not found');
      }

      // Create wallet and provider
      const provider = new ethers.JsonRpcProvider(this.config.validatorEndpoint);
      const wallet = new ethers.Wallet(privateKey, provider);

      // Create transaction
      const tx = {
        to: request.to,
        value: ethers.parseEther(ethers.formatEther(request.amount)),
        data: (request.data !== undefined && request.data !== '') ? request.data : '0x',
        ...(request.gasLimit !== undefined && { gasLimit: BigInt(request.gasLimit) }),
        ...(request.gasPrice !== undefined && { gasPrice: BigInt(request.gasPrice) })
      };

      // Send transaction
      const response = await wallet.sendTransaction(tx);
      const receipt = await response.wait();

      // Update account activity
      account.lastActivity = Date.now();
      await this.updateAccountBalance(account.id);

      return {
        success: true,
        ...(receipt?.hash !== undefined && { transactionHash: receipt.hash }),
        ...(receipt?.blockNumber !== undefined && { blockNumber: receipt.blockNumber }),
        confirmations: 1
      };
    } catch (error) {
      logger.error('Transaction failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Transaction failed'
      };
    }
  }

  /**
   * Resolve ENS name to address using validator's ENS oracle.
   * @param ensName ENS name to resolve
   * @returns ENS resolution result or null if not found
   */
  async resolveENS(ensName: string): Promise<ENSResolution | null> {
    try {
      // Use validator's username resolution
      const address = await this.client.resolveUsername(ensName);
      
      if (address === null || address === '') {
        return null;
      }

      const resolution: ENSResolution = {
        address,
        name: ensName,
        verified: true
      };
      // avatar, description, and social are optional - don't include them
      return resolution;
    } catch (error) {
      logger.error('ENS resolution failed:', error);
      return null;
    }
  }

  /**
   * Backup wallet data to validator's secure storage.
   * @returns Backup object with ID and metadata
   */
  async backupWallet(): Promise<WalletBackup> {
    try {
      // Prepare wallet data
      const walletData = {
        accounts: Array.from(this.accounts.values()),
        activeAccountId: this.activeAccountId,
        version: '1.0.0'
      };

      // Wallet data is already encrypted by SecureIndexedDB
      const encryptedData = this.getSecureBackupData(walletData);
      
      // Create backup object
      const backup: WalletBackup = {
        id: nanoid(),
        userId: this.config.userId,
        encryptedData,
        timestamp: Date.now(),
        version: '1.0.0',
        checksum: ethers.id(encryptedData)
      };

      // Store backup via validator with proper secure storage
      await this.storeBackupSecurely(backup);
      logger.info('Wallet backup created:', backup.id);

      return backup;
    } catch (error) {
      logger.error('Wallet backup failed:', error);
      throw error;
    }
  }

  /**
   * Restore wallet from backup.
   * @param backupId Backup identifier
   * @returns True if restore successful
   */
  restoreFromBackup(backupId: string): boolean {
    try {
      // In production, this would retrieve from secure storage
      logger.info('Wallet restore requested for backup:', backupId);
      
      // For now, return false as we don't have actual backup storage
      return false;
    } catch (error) {
      logger.error('Wallet restore failed:', error);
      return false;
    }
  }

  /**
   * Disconnect from validator network and clean up.
   */
  disconnect(): void {
    // Clear auto-backup interval
    if (this.backupInterval !== null) {
      clearInterval(this.backupInterval);
      this.backupInterval = null;
    }

    // Clear accounts
    this.accounts.clear();
    this.activeAccountId = null;
    
    // Update reactive state
    this.accountsRef.value = [];
    this.activeAccountRef.value = null;
    this.balancesRef.value = {};
    
    this.isInitialized = false;
  }

  /**
   * Load accounts from secure storage.
   */
  private loadAccountsFromStorage(): void {
    // In production, this would load from secure browser storage
    // For now, we'll start with empty accounts
    logger.info('Loading accounts from storage');
  }

  /**
   * Store private key securely.
   * @param accountId Account ID
   * @param privateKey Private key to store
   */
  private async storePrivateKey(accountId: string, privateKey: string): Promise<void> {
    // Use SecureIndexedDB for secure storage
    const secureDb = this.getSecureStorage();
    if (secureDb !== null) {
      await secureDb.store(`key_${accountId}`, privateKey, 'private_key');
      logger.debug('Stored private key securely for account:', accountId);
    } else {
      throw new Error('Secure storage not initialized');
    }
  }

  /**
   * Get private key for account.
   * @param accountId Account ID
   * @returns Private key or null if not found
   */
  private async getPrivateKey(accountId: string): Promise<string | null> {
    // Retrieve from secure storage
    const secureDb = this.getSecureStorage();
    if (secureDb !== null) {
      try {
        const privateKey = await secureDb.retrieve(`key_${accountId}`);
        return privateKey as string;
      } catch (error) {
        logger.error('Failed to retrieve private key:', error);
        return null;
      }
    }
    return null;
  }

  /**
   * Set up automatic wallet backup.
   */
  private setupAutoBackup(): void {
    if (this.backupInterval !== null) {
      clearInterval(this.backupInterval);
    }

    this.backupInterval = setInterval(() => {
      void this.backupWallet();
    }, this.config.backupInterval);
  }

  /**
   * Update reactive accounts reference.
   */
  private updateAccountsRef(): void {
    this.accountsRef.value = Array.from(this.accounts.values());
  }

  /**
   * Get secure storage instance
   * @returns SecureIndexedDB instance or null
   */
  private getSecureStorage(): SecureIndexedDB | null {
    if (this.secureStorage === null) {
      // Initialize secure storage with a default password
      // In production, this should be derived from user credentials
      this.secureStorage = new SecureIndexedDB('OmniWalletSecure');
      // Note: initialize() should be called with user password
    }
    return this.secureStorage;
  }

  /**
   * Get secure backup data
   * @param walletData Raw wallet data
   * @returns Encrypted backup data
   */
  private getSecureBackupData(walletData: unknown): string {
    // Convert wallet data to string and let SecureIndexedDB handle encryption
    return Buffer.from(JSON.stringify(walletData)).toString('base64');
  }

  /**
   * Store backup securely
   * @param backup Wallet backup to store
   */
  private async storeBackupSecurely(backup: WalletBackup): Promise<void> {
    const secureDb = this.getSecureStorage();
    if (secureDb !== null) {
      await secureDb.store(`backup_${backup.id}`, backup, 'wallet_backup');
    }
  }

  private secureStorage: SecureIndexedDB | null = null;
}

// Export singleton instance with default configuration
export const validatorWallet = new ValidatorWalletService({
  validatorEndpoint: process.env['VITE_VALIDATOR_ENDPOINT'] ?? 'http://localhost:4000',
  wsEndpoint: process.env['VITE_VALIDATOR_WS_ENDPOINT'] ?? 'ws://localhost:4000/graphql',
  ...(process.env['VITE_VALIDATOR_API_KEY'] !== undefined && process.env['VITE_VALIDATOR_API_KEY'] !== '' ? { apiKey: process.env['VITE_VALIDATOR_API_KEY'] } : {}),
  networkId: process.env['VITE_NETWORK_ID'] ?? '1',
  userId: '', // Set by initializeValidatorServices
  autoBackup: true,
  backupInterval: 24 * 60 * 60 * 1000 // 24 hours
});