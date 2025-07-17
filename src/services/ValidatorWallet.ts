/**
 * Validator Wallet Service Integration
 * 
 * Integrates wallet operations with the Validator service network
 */

import { ValidatorClient } from '../../Validator/src/client/ValidatorClient';
import { OmniCoinBlockchain } from '../../Validator/src/services/blockchain/OmniCoinBlockchain';
import { IPFSStorageNetwork } from '../../Validator/src/services/storage/IPFSStorageNetwork';
import { ethers } from 'ethers';
import { nanoid } from 'nanoid';
import { ref, Ref } from 'vue';

export interface ValidatorWalletConfig {
  validatorEndpoint: string;
  networkId: string;
  userId: string;
  enableSecureStorage: boolean;
  autoBackup: boolean;
}

export interface WalletAccount {
  id: string;
  address: string;
  name: string;
  type: 'mnemonic' | 'private-key' | 'ledger' | 'trezor';
  chainId: string;
  balance: string;
  derivationPath?: string;
  publicKey?: string;
  metadata: Record<string, unknown>;
}

export interface TransactionRequest {
  from: string;
  to: string;
  value: string;
  data?: string;
  chainId: string;
  nonce?: number;
  gasLimit?: string;
  gasPrice?: string;
  type?: number;
}

export interface TransactionResult {
  success: boolean;
  txHash?: string;
  blockNumber?: number;
  confirmations?: number;
  error?: string;
}

export interface WalletBackup {
  id: string;
  userId: string;
  encryptedData: string;
  timestamp: number;
  version: string;
  checksum: string;
}

export interface ENSResolution {
  address: string;
  name: string;
  avatar?: string;
  description?: string;
  social?: Record<string, string>;
  verified: boolean;
}

export class ValidatorWalletService {
  private validatorClient: ValidatorClient;
  private blockchain: OmniCoinBlockchain;
  private ipfsStorage: IPFSStorageNetwork;
  private config: ValidatorWalletConfig;
  private accounts: Map<string, WalletAccount> = new Map();
  private activeAccountId: string | null = null;
  private isInitialized = false;

  // Reactive references for Vue integration
  public accountsRef: Ref<WalletAccount[]> = ref([]);
  public activeAccountRef: Ref<WalletAccount | null> = ref(null);
  public balancesRef: Ref<Record<string, string>> = ref({});

  constructor(config: ValidatorWalletConfig) {
    this.config = config;
    this.validatorClient = new ValidatorClient(config.validatorEndpoint);
    this.blockchain = this.validatorClient.getBlockchain();
    this.ipfsStorage = this.validatorClient.getStorage();
  }

  /**
   * Initialize wallet service with Validator integration
   */
  async initialize(): Promise<void> {
    try {
      // Initialize validator client
      await this.validatorClient.initialize();
      
      // Load existing accounts from secure storage
      await this.loadAccountsFromStorage();
      
      // Set up auto-backup if enabled
      if (this.config.autoBackup) {
        this.setupAutoBackup();
      }
      
      this.isInitialized = true;
      console.log('Validator Wallet Service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Validator Wallet Service:', error);
      throw new Error(`Wallet initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a new wallet account
   */
  async createAccount(
    name: string,
    type: WalletAccount['type'],
    chainId: string,
    options?: {
      mnemonic?: string;
      privateKey?: string;
      derivationPath?: string;
    }
  ): Promise<WalletAccount> {
    try {
      if (!this.isInitialized) {
        throw new Error('Wallet service not initialized');
      }

      let wallet: ethers.Wallet;
      let derivationPath: string | undefined;

      switch (type) {
        case 'mnemonic':
          if (options?.mnemonic) {
            wallet = ethers.Wallet.fromPhrase(options.mnemonic);
          } else {
            wallet = ethers.Wallet.createRandom();
          }
          derivationPath = options?.derivationPath || "m/44'/60'/0'/0/0";
          break;
          
        case 'private-key':
          if (!options?.privateKey) {
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
        publicKey: wallet.publicKey,
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
      
      console.log(`Created new ${type} account: ${account.address}`);
      return account;
    } catch (error) {
      console.error('Error creating account:', error);
      throw error;
    }
  }

  /**
   * Import an existing account
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

  /**
   * Get all accounts
   */
  getAccounts(): WalletAccount[] {
    return Array.from(this.accounts.values());
  }

  /**
   * Get account by ID
   */
  getAccount(accountId: string): WalletAccount | undefined {
    return this.accounts.get(accountId);
  }

  /**
   * Set active account
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
   */
  async updateAccountBalance(accountId: string): Promise<string> {
    try {
      const account = this.accounts.get(accountId);
      if (!account) {
        throw new Error('Account not found');
      }

      // Get balance from validator blockchain service
      const balance = await this.blockchain.getBalance(account.address);
      
      // Update account balance
      account.balance = balance.toString();
      
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
      console.log('Updated all account balances');
    } catch (error) {
      console.error('Error updating all balances:', error);
    }
  }

  /**
   * Send transaction
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
      
      // Submit to validator blockchain service
      const result = await this.blockchain.sendRawTransaction(signedTx);
      
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
   * Sign message
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
   * Resolve ENS name
   */
  async resolveENS(name: string): Promise<ENSResolution | null> {
    try {
      // Use validator blockchain service for ENS resolution
      const resolution = await this.blockchain.resolveENS(name);
      
      if (!resolution) {
        return null;
      }
      
      return {
        address: resolution.address,
        name: name,
        avatar: resolution.avatar,
        description: resolution.description,
        social: resolution.social,
        verified: resolution.verified || false
      };
    } catch (error) {
      console.error('Error resolving ENS name:', error);
      return null;
    }
  }

  /**
   * Backup wallet data
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

      // Store backup on IPFS
      const backupHash = await this.ipfsStorage.storeData(
        JSON.stringify(backup),
        `wallet_backup_${backup.id}.json`
      );

      console.log(`Wallet backup created with hash: ${backupHash}`);
      
      return backup;
    } catch (error) {
      console.error('Error backing up wallet:', error);
      throw error;
    }
  }

  /**
   * Restore wallet from backup
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
      
      console.log('Wallet restored successfully');
    } catch (error) {
      console.error('Error restoring wallet:', error);
      throw error;
    }
  }

  /**
   * Export account private key
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
      
      console.log(`Account removed: ${account.address}`);
    } catch (error) {
      console.error('Error removing account:', error);
      throw error;
    }
  }

  /**
   * Get transaction history
   */
  async getTransactionHistory(
    address: string,
    options?: {
      limit?: number;
      offset?: number;
      chainId?: string;
    }
  ): Promise<any[]> {
    try {
      // Get transaction history from validator blockchain service
      const history = await this.blockchain.getTransactionHistory(address, {
        limit: options?.limit || 50,
        offset: options?.offset || 0
      });
      
      return history;
    } catch (error) {
      console.error('Error getting transaction history:', error);
      return [];
    }
  }

  /**
   * Estimate gas for transaction
   */
  async estimateGas(request: TransactionRequest): Promise<string> {
    try {
      const gasEstimate = await this.blockchain.estimateGas({
        from: request.from,
        to: request.to,
        value: request.value,
        data: request.data
      });
      
      return gasEstimate.toString();
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
      const gasPrice = await this.blockchain.getGasPrice();
      return gasPrice.toString();
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
      
      // Disconnect from validator client
      await this.validatorClient.disconnect();
      
      // Clear local data
      this.accounts.clear();
      this.activeAccountId = null;
      this.isInitialized = false;
      
      // Update reactive data
      this.updateReactiveData();
      
      console.log('Validator Wallet Service disconnected');
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

      // Load account index from IPFS
      const indexData = await this.ipfsStorage.retrieveData(`wallet_index_${this.config.userId}.json`);
      
      if (!indexData) {
        console.log('No existing wallet data found');
        return;
      }

      const accountIds = JSON.parse(indexData) as string[];
      
      // Load individual accounts
      for (const accountId of accountIds) {
        try {
          const accountData = await this.ipfsStorage.retrieveData(`wallet_account_${accountId}.json`);
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
      
      console.log(`Loaded ${this.accounts.size} accounts from storage`);
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
      await this.ipfsStorage.storeData(accountData, `wallet_account_${account.id}.json`);

      // Save private key separately (encrypted)
      if (privateKey) {
        const encryptedKey = await this.encryptData(privateKey, this.config.userId);
        await this.ipfsStorage.storeData(encryptedKey, `wallet_key_${account.id}.json`);
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

  private async removeAccountFromStorage(accountId: string): Promise<void> {
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
      await this.ipfsStorage.storeData(
        JSON.stringify(accountIds),
        `wallet_index_${this.config.userId}.json`
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

      const encryptedKey = await this.ipfsStorage.retrieveData(`wallet_key_${accountId}.json`);
      
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

  private async encryptData(data: string, password: string): Promise<string> {
    // Simple encryption implementation - in production use proper encryption
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const passwordBuffer = encoder.encode(password);
    
    const key = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );
    
    const derivedKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: passwordBuffer,
        iterations: 100000,
        hash: 'SHA-256'
      },
      key,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
    
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      derivedKey,
      dataBuffer
    );
    
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    return btoa(String.fromCharCode(...combined));
  }

  private async decryptData(encryptedData: string, password: string): Promise<string> {
    // Simple decryption implementation - in production use proper decryption
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const passwordBuffer = encoder.encode(password);
    
    const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    
    const key = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );
    
    const derivedKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: passwordBuffer,
        iterations: 100000,
        hash: 'SHA-256'
      },
      key,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      derivedKey,
      encrypted
    );
    
    return decoder.decode(decrypted);
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
  validatorEndpoint: import.meta.env.VITE_VALIDATOR_ENDPOINT || 'localhost:3000',
  networkId: import.meta.env.VITE_NETWORK_ID || 'omnibazaar-mainnet',
  userId: '', // Will be set when user logs in
  enableSecureStorage: true,
  autoBackup: true
});

export default ValidatorWalletService;