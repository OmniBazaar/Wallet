/**
 * Validator Wallet Service Integration
 *
 * Integrates wallet operations with the Validator service network
 */

import { createAvalancheValidatorClient, AvalancheValidatorClient } from '../../Validator/src/client/AvalancheValidatorClient';
// Simple gql template literal tag for GraphQL queries
const gql = (strings: TemplateStringsArray, ...values: unknown[]): string => {
  let result = strings[0];
  for (let i = 0; i < values.length; i++) {
    result += String(values[i]) + strings[i + 1];
  }
  return result;
};
import { ethers } from 'ethers';
import { nanoid } from 'nanoid';
import { ref, Ref } from 'vue';

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
  /** Whether to enable secure storage */
  enableSecureStorage: boolean;
  /** Whether to enable automatic backups */
  autoBackup: boolean;
}

/** Represents a wallet account */
export interface WalletAccount {
  /** Unique account identifier */
  id: string;
  /** Wallet address */
  address: string;
  /** Human-readable account name */
  name: string;
  /** Type of wallet account */
  type: 'mnemonic' | 'private-key' | 'ledger' | 'trezor';
  /** Chain ID for this account */
  chainId: string;
  /** Account balance in native currency */
  balance: string;
  /** BIP44 derivation path for this account */
  derivationPath?: string;
  /** Public key for the account */
  publicKey?: string;
  /** Additional metadata for the account */
  metadata: Record<string, unknown>;
}

/** Represents a transaction request for the validator wallet */
export interface TransactionRequest {
  /** Sender wallet address */
  from: string;
  /** Recipient address */
  to: string;
  /** Transaction value in wei */
  value: string;
  /** Optional transaction data */
  data?: string;
  /** Chain ID for the transaction */
  chainId: string;
  /** Optional nonce for the transaction */
  nonce?: number;
  /** Optional gas limit for the transaction */
  gasLimit?: string;
  /** Optional gas price for the transaction */
  gasPrice?: string;
  /** Transaction type (EIP-2718) */
  type?: number;
}

/** Result of a transaction execution */
export interface TransactionResult {
  /** Whether the transaction was successful */
  success: boolean;
  /** Transaction hash if successful */
  txHash?: string;
  /** Block number where transaction was mined */
  blockNumber?: number;
  /** Number of confirmations received */
  confirmations?: number;
  /** Error message if transaction failed */
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
  private client: AvalancheValidatorClient;
  private config: ValidatorWalletConfig;
  private accounts: Map<string, WalletAccount> = new Map();
  private activeAccountId: string | null = null;
  private isInitialized = false;

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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    this.client = createAvalancheValidatorClient({
      validatorEndpoint: config.validatorEndpoint,
      wsEndpoint: config.wsEndpoint,
      apiKey: config.apiKey
    });
  }

  /**
   * Update the user identifier used by this service.
   * @param userId
   */
  public setUserId(userId: string): void {
    this.config.userId = userId;
  }

  /** Expose a readonly view of the current configuration. */
  public getConfig(): Readonly<ValidatorWalletConfig> {
    return this.config;
  }

  /**
   * Initialize wallet service with Validator integration
   */
  async initialize(): Promise<void> {
    try {
      // Check validator health
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const health = await this.client.checkHealth();
      // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions, @typescript-eslint/no-unsafe-member-access
      if (!(health as any).data?.health?.healthy) {
        throw new Error('Validator service is not healthy');
      }

      // Load existing accounts from secure storage
      await this.loadAccountsFromStorage();

      // Set up auto-backup if enabled
      if (this.config.autoBackup) {
        this.setupAutoBackup();
      }

      this.isInitialized = true;
      console.warn('Validator Wallet Service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Validator Wallet Service:', error);
      throw new Error(`Wallet initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a new wallet account.
   *
   * @param name Human‑readable account name
   * @param type Account type (mnemonic/private‑key/ledger/trezor)
   * @param chainId Target chain identifier for this account
   * @param options Optional derivation / secret inputs
   * @param options.mnemonic BIP‑39 mnemonic phrase
   * @param options.privateKey Raw private key hex string
   * @param options.derivationPath BIP‑44 derivation path
   * @returns Newly created account record
   */
  async createAccount(
    name: string,
    type: WalletAccount['type'],
    chainId: string,
    options?: {
      /** Optional BIP‑39 mnemonic phrase */
      mnemonic?: string;
      /** Optional raw private key hex string */
      privateKey?: string;
      /** Optional BIP‑44 derivation path */
      derivationPath?: string;
    }
  ): Promise<WalletAccount> {
    try {
      if (!this.isInitialized) {
        throw new Error('Wallet service not initialized');
      }

      let wallet: ethers.HDNodeWallet | ethers.Wallet;
      let derivationPath: string | undefined;

      switch (type) {
        case 'mnemonic':
          if (options?.mnemonic != null) {
            wallet = ethers.Wallet.fromPhrase(options.mnemonic);
          } else {
            wallet = ethers.Wallet.createRandom();
          }
          derivationPath = options?.derivationPath ?? "m/44'/60'/0'/0/0";
          break;

        case 'private-key':
          if (options?.privateKey == null) {
            throw new Error('Private key required');
          }
          wallet = new ethers.Wallet(options.privateKey);
          break;

        case 'ledger':
        case 'trezor':
          // Hardware wallet support requires additional implementation
          throw new Error(`${type} support not yet implemented`);

        default:
          throw new Error(`Unsupported account type: ${type}`);
      }

      const account: WalletAccount = {
        id: nanoid(),
        address: wallet.address,
        name,
        type,
        chainId,
        balance: '0',
        derivationPath,
        publicKey: wallet instanceof ethers.HDNodeWallet ? wallet.publicKey : ethers.SigningKey.computePublicKey(wallet.privateKey),
        metadata: {
          createdAt: Date.now(),
          lastUsed: Date.now()
        }
      };

      // Store account
      this.accounts.set(account.id, account);

      // Update reactive references
      this.updateReactiveData();

      // Save to secure storage
      await this.saveAccountToStorage(account, wallet.privateKey);

      // Update balance
      await this.updateAccountBalance(account.id);

      console.warn(`Created new ${type} account: ${account.address}`);
      return account;
    } catch (error) {
      console.error('Error creating account:', error);
      throw error;
    }
  }

  /**
   * Import an existing account from a private key or mnemonic.
   *
   * @param name Account name
   * @param privateKeyOrMnemonic Secret to import (auto‑detects mnemonic)
   * @param chainId Target chain identifier
   * @returns Imported account record
   */
  async importAccount(
    name: string,
    privateKeyOrMnemonic: string,
    chainId: string
  ): Promise<WalletAccount> {
    try {
      // Determine if input is mnemonic or private key
      const isMnemonic = privateKeyOrMnemonic.trim().split(' ').length >= 12;

      return await this.createAccount(
        name,
        isMnemonic ? 'mnemonic' : 'private-key',
        chainId,
        {
          [isMnemonic ? 'mnemonic' : 'privateKey']: privateKeyOrMnemonic
        }
      );
    } catch (error) {
      console.error('Error importing account:', error);
      throw error;
    }
  }

  /** Get all accounts currently managed by the service. */
  getAccounts(): WalletAccount[] {
    return Array.from(this.accounts.values());
  }

  /**
   * Get account by its internal identifier.
   * @param accountId Internal account ID
   */
  getAccount(accountId: string): WalletAccount | undefined {
    return this.accounts.get(accountId);
  }

  /**
   * Set the active account to use by default for operations.
   * @param accountId Internal account ID
   */
  setActiveAccount(accountId: string): void {
    const account = this.accounts.get(accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    this.activeAccountId = accountId;
    this.activeAccountRef.value = account;

    // Update last used timestamp
    account.metadata.lastUsed = Date.now();
    this.saveAccountToStorage(account);
  }

  /**
   * Get active account
   */
  getActiveAccount(): WalletAccount | null {
    if (!this.activeAccountId) {
      return null;
    }
    return this.accounts.get(this.activeAccountId) || null;
  }

  /**
   * Update account balance
   * @param accountId
   */
  async updateAccountBalance(accountId: string): Promise<string> {
    try {
      const account = this.accounts.get(accountId);
      if (!account) {
        throw new Error('Account not found');
      }

      // Get balance from validator GraphQL API
      const result = await this.client.query({
        query: gql`
          query GetBalance($address: String!) {
            account(address: $address) {
              balance
            }
          }
        `,
        variables: { address: account.address }
      });

      const balance = result.data?.account?.balance || '0';

      // Update account balance
      account.balance = balance;

      // Update reactive balance
      this.balancesRef.value = {
        ...this.balancesRef.value,
        [account.address]: account.balance
      };

      return account.balance;
    } catch (error) {
      console.error('Error updating account balance:', error);
      return '0';
    }
  }

  /**
   * Update all account balances
   */
  async updateAllBalances(): Promise<void> {
    try {
      const updatePromises = Array.from(this.accounts.keys()).map(accountId =>
        this.updateAccountBalance(accountId)
      );

      await Promise.all(updatePromises);
      console.warn('Updated all account balances');
    } catch (error) {
      console.error('Error updating all balances:', error);
    }
  }

  /**
   * Send transaction
   * @param request
   */
  async sendTransaction(request: TransactionRequest): Promise<TransactionResult> {
    try {
      if (!this.isInitialized) {
        throw new Error('Wallet service not initialized');
      }

      // Validate request
      this.validateTransactionRequest(request);

      // Get account for signing
      const account = Array.from(this.accounts.values())
        .find(acc => acc.address.toLowerCase() === request.from.toLowerCase());

      if (!account) {
        throw new Error('Account not found for signing');
      }

      // Get private key from secure storage
      const privateKey = await this.getAccountPrivateKey(account.id);

      if (!privateKey) {
        throw new Error('Private key not available');
      }

      // Create wallet for signing
      const wallet = new ethers.Wallet(privateKey);

      // Prepare transaction
      const tx = {
        to: request.to,
        value: ethers.parseEther(request.value),
        data: request.data || '0x',
        chainId: BigInt(request.chainId),
        nonce: request.nonce,
        gasLimit: request.gasLimit ? BigInt(request.gasLimit) : undefined,
        gasPrice: request.gasPrice ? BigInt(request.gasPrice) : undefined,
        type: request.type
      };

      // Sign transaction
      const signedTx = await wallet.signTransaction(tx);

      // Submit to validator via GraphQL
      const mutation = gql`
        mutation SendTransaction($signedTx: String!) {
          sendRawTransaction(signedTx: $signedTx) {
            success
            transactionHash
            blockNumber
            confirmations
            error
          }
        }
      `;

      const mutationResult = await this.client.mutate({
        mutation,
        variables: { signedTx }
      });

      const result = mutationResult.data?.sendRawTransaction || {
        success: false,
        error: 'Transaction submission failed'
      };

      if (result.success) {
        // Update balance after successful transaction
        await this.updateAccountBalance(account.id);

        return {
          success: true,
          txHash: result.transactionHash,
          blockNumber: result.blockNumber,
          confirmations: result.confirmations
        };
      } else {
        return {
          success: false,
          error: result.error || 'Transaction failed'
        };
      }
    } catch (error) {
      console.error('Error sending transaction:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Sign an arbitrary message with the specified account.
   * @param accountId Internal account ID used to locate the private key
   * @param message UTF‑8 string payload to sign
   * @returns Hex signature string
   */
  async signMessage(accountId: string, message: string): Promise<string> {
    try {
      const account = this.accounts.get(accountId);
      if (!account) {
        throw new Error('Account not found');
      }

      // Get private key from secure storage
      const privateKey = await this.getAccountPrivateKey(accountId);

      if (!privateKey) {
        throw new Error('Private key not available');
      }

      // Create wallet and sign message
      const wallet = new ethers.Wallet(privateKey);
      const signature = await wallet.signMessage(message);

      return signature;
    } catch (error) {
      console.error('Error signing message:', error);
      throw error;
    }
  }

  /**
   * Resolve an ENS/Omni username to an address via the validator.
   * @param name ENS (.eth) or Omni username (no suffix)
   * @returns Resolution result with metadata or null if not found
   */
  async resolveENS(name: string): Promise<ENSResolution | null> {
    try {
      // Check if it's an OmniBazaar username (no domain extension)
      const isOmniName = !name.includes('.');
      const fullName = isOmniName ? name : name.replace('.omnibazaar', '');

      // Use validator's ENS resolution
      const address = await this.client.resolveUsername(fullName);

      if (!address) {
        return null;
      }

      // Get user metadata
      const query = gql`
        query GetUserMetadata($username: String!) {
          usernameRegistration(username: $username) {
            metadata {
              email
              website
              twitter
              avatar
              description
            }
          }
        }
      `;

      const result = await this.client.query({
        query,
        variables: { username: fullName }
      });

      const metadata = result.data?.usernameRegistration?.metadata || {};

      return {
        address,
        name: fullName,
        avatar: metadata.avatar,
        description: metadata.description,
        social: {
          twitter: metadata.twitter,
          website: metadata.website
        },
        verified: true
      };
    } catch (error) {
      console.error('Error resolving ENS name:', error);
      return null;
    }
  }

  /**
   * Create an encrypted backup of all wallet data.
   * @param password Password used to encrypt the backup payload
   * @returns Backup descriptor containing encrypted data and checksum
   */
  async backupWallet(password: string): Promise<WalletBackup> {
    try {
      if (!this.config.enableSecureStorage) {
        throw new Error('Secure storage not enabled');
      }

      // Prepare backup data
      const backupData = {
        accounts: Array.from(this.accounts.values()),
        activeAccountId: this.activeAccountId,
        timestamp: Date.now(),
        version: '1.0.0'
      };

      // Encrypt backup data
      const encryptedData = await this.encryptData(
        JSON.stringify(backupData),
        password
      );

      // Create backup object
      const backup: WalletBackup = {
        id: nanoid(),
        userId: this.config.userId,
        encryptedData,
        timestamp: Date.now(),
        version: '1.0.0',
        checksum: await this.calculateChecksum(encryptedData)
      };

      // Store backup on IPFS via validator
      const backupHash = await this.client.storeDocument(
        JSON.stringify(backup),
        {
          title: `Wallet Backup ${backup.id}`,
          author: this.config.userId,
          category: 'wallet-backups',
          type: 'backup',
          tags: ['wallet', 'backup'],
          permissions: {
            public: false,
            users: [this.config.userId],
            roles: []
          }
        }
      );

      console.warn(`Wallet backup created with hash: ${backupHash}`);

      return backup;
    } catch (error) {
      console.error('Error backing up wallet:', error);
      throw error;
    }
  }

  /**
   * Restore wallet from backup
   * @param backup
   * @param password
   */
  async restoreWallet(backup: WalletBackup, password: string): Promise<void> {
    try {
      // Verify checksum
      const checksum = await this.calculateChecksum(backup.encryptedData);
      if (checksum !== backup.checksum) {
        throw new Error('Backup data corrupted');
      }

      // Decrypt backup data
      const decryptedData = await this.decryptData(backup.encryptedData, password);
      const backupData = JSON.parse(decryptedData);

      // Clear existing accounts
      this.accounts.clear();

      // Restore accounts
      for (const accountData of backupData.accounts) {
        this.accounts.set(accountData.id, accountData);
      }

      // Restore active account
      this.activeAccountId = backupData.activeAccountId;

      // Update reactive data
      this.updateReactiveData();

      // Update all balances
      await this.updateAllBalances();

      console.warn('Wallet restored successfully');
    } catch (error) {
      console.error('Error restoring wallet:', error);
      throw error;
    }
  }

  /**
   * Export account private key
   * @param accountId
   * @param password
   */
  async exportPrivateKey(accountId: string, password: string): Promise<string> {
    try {
      // Verify password
      await this.verifyPassword(password);

      // Get private key from secure storage
      const privateKey = await this.getAccountPrivateKey(accountId);

      if (!privateKey) {
        throw new Error('Private key not available');
      }

      return privateKey;
    } catch (error) {
      console.error('Error exporting private key:', error);
      throw error;
    }
  }

  /**
   * Remove account
   * @param accountId
   */
  async removeAccount(accountId: string): Promise<void> {
    try {
      const account = this.accounts.get(accountId);
      if (!account) {
        throw new Error('Account not found');
      }

      // Remove from accounts map
      this.accounts.delete(accountId);

      // Update active account if necessary
      if (this.activeAccountId === accountId) {
        const remainingAccounts = Array.from(this.accounts.values());
        this.activeAccountId = remainingAccounts.length > 0 ? remainingAccounts[0].id : null;
      }

      // Remove from secure storage
      await this.removeAccountFromStorage(accountId);

      // Update reactive data
      this.updateReactiveData();

      console.warn(`Account removed: ${account.address}`);
    } catch (error) {
      console.error('Error removing account:', error);
      throw error;
    }
  }

  /**
   * Get transaction history
   * @param address
   * @param options
   * @param options.limit
   * @param options.offset
   * @param options.chainId
   */
  async getTransactionHistory(
    address: string,
    options?: {
      /**
       *
       */
      limit?: number;
      /**
       *
       */
      offset?: number;
      /**
       *
       */
      chainId?: string;
    }
  ): Promise<Array<{
    /**
     *
     */
    hash: string;
    /**
     *
     */
    from: string;
    /**
     *
     */
    to: string;
    /**
     *
     */
    value: string;
    /**
     *
     */
    timestamp: number;
    /**
     *
     */
    blockNumber: number;
    /**
     *
     */
    status: string;
    /**
     *
     */
    gasUsed: string;
    /**
     *
     */
    gasPrice: string;
  }>> {
    try {
      // Get transaction history from validator GraphQL API
      const query = gql`
        query GetTransactionHistory($address: String!, $limit: Int, $offset: Int) {
          transactionHistory(address: $address, limit: $limit, offset: $offset) {
            transactions {
              hash
              from
              to
              value
              timestamp
              blockNumber
              status
              gasUsed
              gasPrice
            }
            total
          }
        }
      `;

      const result = await this.client.query({
        query,
        variables: {
          address,
          limit: options?.limit || 50,
          offset: options?.offset || 0
        }
      });

      return result.data?.transactionHistory?.transactions || [];
    } catch (error) {
      console.error('Error getting transaction history:', error);
      return [];
    }
  }

  /**
   * Estimate gas for transaction
   * @param request
   */
  async estimateGas(request: TransactionRequest): Promise<string> {
    try {
      const query = gql`
        query EstimateGas($from: String!, $to: String!, $value: String!, $data: String) {
          estimateGas(from: $from, to: $to, value: $value, data: $data)
        }
      `;

      const result = await this.client.query({
        query,
        variables: {
          from: request.from,
          to: request.to,
          value: request.value,
          data: request.data || '0x'
        }
      });

      return result.data?.estimateGas || '21000';
    } catch (error) {
      console.error('Error estimating gas:', error);
      throw error;
    }
  }

  /**
   * Get gas price
   */
  async getGasPrice(): Promise<string> {
    try {
      const query = gql`
        query GetGasPrice {
          gasPrice
        }
      `;

      const result = await this.client.query({
        query
      });

      return result.data?.gasPrice || '1000000000'; // 1 gwei default
    } catch (error) {
      console.error('Error getting gas price:', error);
      throw error;
    }
  }

  /**
   * Disconnect from Validator services
   */
  async disconnect(): Promise<void> {
    try {
      // Save any pending data
      await this.saveAllAccountsToStorage();

      // Clear local data
      this.accounts.clear();
      this.activeAccountId = null;
      this.isInitialized = false;

      // Update reactive data
      this.updateReactiveData();

      console.warn('Validator Wallet Service disconnected');
    } catch (error) {
      console.error('Error disconnecting wallet service:', error);
    }
  }

  // Private helper methods
  private async loadAccountsFromStorage(): Promise<void> {
    try {
      if (!this.config.enableSecureStorage) {
        return;
      }

      // Load account index from validator storage
      const query = gql`
        query GetWalletIndex($userId: String!) {
          document(id: $userId, category: "wallet-index") {
            content
          }
        }
      `;

      const result = await this.client.query({
        query,
        variables: { userId: `wallet_index_${this.config.userId}` }
      });

      const indexData = result.data?.document?.content;

      if (!indexData) {
        console.warn('No existing wallet data found');
        return;
      }

      const accountIds = JSON.parse(indexData) as string[];

      // Load individual accounts
      for (const accountId of accountIds) {
        try {
          const accountQuery = gql`
            query GetWalletAccount($accountId: String!) {
              document(id: $accountId, category: "wallet-accounts") {
                content
              }
            }
          `;

          const accountResult = await this.client.query({
            query: accountQuery,
            variables: { accountId: `wallet_account_${accountId}` }
          });

          const accountData = accountResult.data?.document?.content;
          if (accountData) {
            const account = JSON.parse(accountData) as WalletAccount;
            this.accounts.set(account.id, account);
          }
        } catch (error) {
          console.error(`Error loading account ${accountId}:`, error);
        }
      }

      // Update reactive data
      this.updateReactiveData();

      console.warn(`Loaded ${this.accounts.size} accounts from storage`);
    } catch (error) {
      console.error('Error loading accounts from storage:', error);
    }
  }

  private async saveAccountToStorage(account: WalletAccount, privateKey?: string): Promise<void> {
    try {
      if (!this.config.enableSecureStorage) {
        return;
      }

      // Save account data
      const accountData = JSON.stringify(account);
      await this.client.storeDocument(
        accountData,
        {
          title: `Wallet Account ${account.id}`,
          author: this.config.userId,
          category: 'wallet-accounts',
          type: 'account',
          tags: ['wallet', 'account'],
          permissions: {
            public: false,
            users: [this.config.userId],
            roles: []
          }
        }
      );

      // Save private key separately (encrypted)
      if (privateKey) {
        const encryptedKey = await this.encryptData(privateKey, this.config.userId);
        await this.client.storeDocument(
          encryptedKey,
          {
            title: `Wallet Key ${account.id}`,
            author: this.config.userId,
            category: 'wallet-keys',
            type: 'key',
            tags: ['wallet', 'key'],
            permissions: {
              public: false,
              users: [this.config.userId],
              roles: []
            }
          }
        );
      }

      // Update account index
      await this.updateAccountIndex();
    } catch (error) {
      console.error('Error saving account to storage:', error);
    }
  }

  private async saveAllAccountsToStorage(): Promise<void> {
    try {
      const savePromises = Array.from(this.accounts.values()).map(account =>
        this.saveAccountToStorage(account)
      );

      await Promise.all(savePromises);
    } catch (error) {
      console.error('Error saving all accounts:', error);
    }
  }

  private async removeAccountFromStorage(_accountId: string): Promise<void> {
    try {
      if (!this.config.enableSecureStorage) {
        return;
      }

      // Remove account data and key
      // Note: IPFS doesn't support deletion, so we update the index
      await this.updateAccountIndex();
    } catch (error) {
      console.error('Error removing account from storage:', error);
    }
  }

  private async updateAccountIndex(): Promise<void> {
    try {
      const accountIds = Array.from(this.accounts.keys());
      await this.client.storeDocument(
        JSON.stringify(accountIds),
        {
          title: `Wallet Index ${this.config.userId}`,
          author: this.config.userId,
          category: 'wallet-index',
          type: 'index',
          tags: ['wallet', 'index'],
          permissions: {
            public: false,
            users: [this.config.userId],
            roles: []
          }
        }
      );
    } catch (error) {
      console.error('Error updating account index:', error);
    }
  }

  private async getAccountPrivateKey(accountId: string): Promise<string | null> {
    try {
      if (!this.config.enableSecureStorage) {
        return null;
      }

      const keyQuery = gql`
        query GetWalletKey($keyId: String!) {
          document(id: $keyId, category: "wallet-keys") {
            content
          }
        }
      `;

      const keyResult = await this.client.query({
        query: keyQuery,
        variables: { keyId: `wallet_key_${accountId}` }
      });

      const encryptedKey = keyResult.data?.document?.content;

      if (!encryptedKey) {
        return null;
      }

      const privateKey = await this.decryptData(encryptedKey, this.config.userId);
      return privateKey;
    } catch (error) {
      console.error('Error getting account private key:', error);
      return null;
    }
  }

  private validateTransactionRequest(request: TransactionRequest): void {
    if (!request.from || !ethers.isAddress(request.from)) {
      throw new Error('Invalid from address');
    }

    if (!request.to || !ethers.isAddress(request.to)) {
      throw new Error('Invalid to address');
    }

    if (!request.value || isNaN(parseFloat(request.value))) {
      throw new Error('Invalid transaction value');
    }

    if (!request.chainId) {
      throw new Error('Chain ID required');
    }
  }

  private updateReactiveData(): void {
    this.accountsRef.value = Array.from(this.accounts.values());
    this.activeAccountRef.value = this.activeAccountId ?
      this.accounts.get(this.activeAccountId) || null : null;
  }

  private setupAutoBackup(): void {
    // Set up periodic auto-backup (every 24 hours)
    setInterval(() => {
      this.backupWallet('auto-backup').catch(error => {
        console.error('Auto-backup failed:', error);
      });
    }, 24 * 60 * 60 * 1000);
  }

  /**
   * Encrypt data using AES-256-GCM with PBKDF2 key derivation
   * Production-ready implementation with proper salt generation
   * @param data
   * @param password
   */
  private async encryptData(data: string, password: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);

    // Generate a random salt for PBKDF2 (NEVER use password as salt)
    const salt = crypto.getRandomValues(new Uint8Array(32));

    // Import password for key derivation
    const passwordBuffer = encoder.encode(password);
    const baseKey = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );

    // Derive a 256-bit key using PBKDF2 with 210,000 iterations (OWASP 2023 recommendation)
    const derivedKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 210000, // OWASP 2023 recommendation for PBKDF2-SHA256
        hash: 'SHA-256'
      },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false, // Don't make key extractable
      ['encrypt']
    );

    // Generate a random IV for AES-GCM (96 bits / 12 bytes)
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt the data
    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128 // 128-bit authentication tag
      },
      derivedKey,
      dataBuffer
    );

    // Combine salt + iv + encrypted data
    const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(encrypted), salt.length + iv.length);

    // Return base64 encoded result
    return btoa(String.fromCharCode(...Array.from(combined)));
  }

  /**
   * Decrypt data encrypted with AES-256-GCM
   * Production-ready implementation matching the encryption method
   * @param encryptedData
   * @param password
   */
  private async decryptData(encryptedData: string, password: string): Promise<string> {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    // Decode from base64
    const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));

    // Extract salt, IV, and encrypted data
    const salt = combined.slice(0, 32);
    const iv = combined.slice(32, 44);
    const encrypted = combined.slice(44);

    // Import password for key derivation
    const passwordBuffer = encoder.encode(password);
    const baseKey = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );

    // Derive the same key using extracted salt
    const derivedKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 210000, // Must match encryption iterations
        hash: 'SHA-256'
      },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    // Decrypt the data
    try {
      const decrypted = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv,
          tagLength: 128
        },
        derivedKey,
        encrypted
      );

      return decoder.decode(decrypted);
    } catch (error) {
      throw new Error('Decryption failed: Invalid password or corrupted data');
    }
  }

  private async calculateChecksum(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private async verifyPassword(password: string): Promise<void> {
    // In a real implementation, verify password against stored hash
    // For now, we'll just check if password is provided
    if (!password || password.length < 8) {
      throw new Error('Invalid password');
    }
  }
}

// Export configured instance for easy use
export const validatorWallet = new ValidatorWalletService({
  validatorEndpoint: (typeof process !== 'undefined' && process.env?.['VITE_VALIDATOR_ENDPOINT']) || 'http://localhost:4000',
  wsEndpoint: (typeof process !== 'undefined' && process.env?.['VITE_VALIDATOR_WS_ENDPOINT']) || 'ws://localhost:4000/graphql',
  apiKey: (typeof process !== 'undefined' && process.env?.['VITE_VALIDATOR_API_KEY']) || undefined,
  networkId: (typeof process !== 'undefined' && process.env?.['VITE_NETWORK_ID']) || 'omnibazaar-mainnet',
  userId: '', // Will be set when user logs in
  enableSecureStorage: true,
  autoBackup: true
});

export default ValidatorWalletService;
