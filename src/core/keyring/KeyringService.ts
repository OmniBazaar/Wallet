/**
 * KeyringService - Unified keyring management service
 *
 * This service provides a unified interface for keyring operations,
 * supporting both Web2-style (username/password) and Web3-style (seed phrase) authentication.
 * It integrates with the wallet's existing infrastructure and provider system.
 */

import { BIP39Keyring, Account as BIP39Account, ChainType } from './BIP39Keyring';
import { KeyringManager, UserSession } from './KeyringManager';
import { ethers } from 'ethers';
import { getProvider } from '../chains/ethereum/provider';
import { getCotiProvider } from '../chains/coti/provider';
import { getOmniCoinProvider } from '../chains/omnicoin/provider';

/** Authentication method type */
export type AuthMethod = 'web2' | 'web3';

/** Account information with authentication details */
export interface KeyringAccount {
  /** Unique account identifier */
  id: string;
  /** Human-readable account name */
  name: string;
  /** Blockchain address */
  address: string;
  /** Public key in hex format */
  publicKey: string;
  /** Blockchain type */
  chainType: ChainType;
  /** Account balance (optional) */
  balance?: string;
  /** Authentication method used */
  authMethod: AuthMethod;
  /** HD wallet derivation path (optional) */
  derivationPath?: string;
  /** Whether account is from hardware wallet */
  isHardware?: boolean;
}

/** Current keyring state */
export interface KeyringState {
  /** Whether keyring has been initialized */
  isInitialized: boolean;
  /** Whether keyring is currently locked */
  isLocked: boolean;
  /** Current authentication method */
  authMethod: AuthMethod | null;
  /** All managed accounts */
  accounts: KeyringAccount[];
  /** Currently active account */
  activeAccount: KeyringAccount | null;
  /** Active user session */
  session?: UserSession;
}

/** Transaction request parameters */
export interface TransactionRequest {
  /** Transaction recipient address */
  to: string;
  /**
   *
   */
  value?: string;
  /**
   *
   */
  data?: string;
  /**
   *
   */
  gasLimit?: string;
  /**
   *
   */
  gasPrice?: string;
  /**
   *
   */
  maxFeePerGas?: string;
  /**
   *
   */
  maxPriorityFeePerGas?: string;
  /**
   *
   */
  nonce?: number;
  /**
   *
   */
  chainId?: number;
}

/**
 *
 */
export class KeyringService {
  private static instance: KeyringService;
  private bip39Keyring: BIP39Keyring;
  private keyringManager: KeyringManager;
  private state: KeyringState;
  private providers: Map<ChainType, ethers.Provider> = new Map();
  private validatorClient: any = null; // Will be set when validator is available

  /**
   * Get seed from BIP39 keyring
   * @param password
   */
  async getSeed(password?: string): Promise<string | null> {
    if (!this.state.isInitialized || this.state.isLocked) {
      return null;
    }
    if (!password) {
      throw new Error('Password required to get seed');
    }
    return this.bip39Keyring.getMnemonic(password);
  }

  private constructor() {
    this.bip39Keyring = new BIP39Keyring();
    this.keyringManager = KeyringManager.getInstance();
    this.state = {
      isInitialized: false,
      isLocked: true,
      authMethod: null,
      accounts: [],
      activeAccount: null
    };

    this.initializeProviders();
  }

  /**
   *
   */
  public static getInstance(): KeyringService {
    if (!KeyringService.instance) {
      KeyringService.instance = new KeyringService();
    }
    return KeyringService.instance;
  }

  /**
   * Initialize providers for different chains
   */
  private async initializeProviders(): Promise<void> {
    try {
      // Initialize Ethereum provider
      const ethProvider = await getProvider();
      if (ethProvider) {
        this.providers.set('ethereum', ethProvider);
      }

      // Initialize COTI provider
      const cotiProvider = await getCotiProvider();
      if (cotiProvider) {
        this.providers.set('coti', cotiProvider);
      }

      // Initialize OmniCoin provider
      const omniProvider = await getOmniCoinProvider();
      if (omniProvider) {
        this.providers.set('omnicoin', omniProvider);
      }
    } catch (error) {
      console.warn('Error initializing providers:', error);
    }
  }

  /**
   * Initialize Web3-style wallet with seed phrase
   * @param password
   * @param mnemonic
   */
  async initializeWeb3Wallet(password: string, mnemonic?: string): Promise<string> {
    const seedPhrase = await this.bip39Keyring.initialize({
      password,
      mnemonic,
      seedPhraseLength: 24
    });

    this.state.isInitialized = true;
    this.state.isLocked = false;
    this.state.authMethod = 'web3';

    // Create default accounts for each chain
    await this.createDefaultAccounts();

    return seedPhrase;
  }

  /**
   * Initialize Web2-style wallet with username/password
   * @param username
   * @param password
   */
  async initializeWeb2Wallet(username: string, password: string): Promise<UserSession> {
    const session = await this.keyringManager.registerUser({ username, password });

    this.state.isInitialized = true;
    this.state.isLocked = false;
    this.state.authMethod = 'web2';
    this.state.session = session;

    // Convert Web2 accounts to unified format
    await this.syncWeb2Accounts();

    return session;
  }

  /**
   * Check initialization status
   */
  async checkInitialization(): Promise<void> {
    const web3Initialized = await this.bip39Keyring.isInitialized();
    const web2Session = this.keyringManager.getCurrentSession();

    if (web3Initialized) {
      this.state.isInitialized = true;
      this.state.authMethod = 'web3';
      this.state.isLocked = this.bip39Keyring.locked();
    } else if (web2Session) {
      this.state.isInitialized = true;
      this.state.authMethod = 'web2';
      this.state.isLocked = false;
      this.state.session = web2Session;
      await this.syncWeb2Accounts();
    }
  }

  /**
   * Unlock wallet
   * @param password
   * @param username
   */
  async unlock(password: string, username?: string): Promise<void> {
    if (!this.state.isInitialized) {
      throw new Error('Wallet not initialized');
    }

    if (this.state.authMethod === 'web3') {
      await this.bip39Keyring.unlock(password);
      this.state.isLocked = false;
      await this.syncWeb3Accounts();
    } else if (this.state.authMethod === 'web2' && username) {
      const session = await this.keyringManager.loginUser({ username, password });
      this.state.isLocked = false;
      this.state.session = session;
      await this.syncWeb2Accounts();
    } else {
      throw new Error('Invalid unlock parameters');
    }
  }

  /**
   * Lock wallet
   */
  lock(): void {
    if (this.state.authMethod === 'web3') {
      this.bip39Keyring.lock();
    } else if (this.state.authMethod === 'web2') {
      this.keyringManager.logout();
    }

    this.state.isLocked = true;
    this.state.activeAccount = null;
  }

  /**
   * Create account
   * @param chainType
   * @param name
   */
  async createAccount(chainType: ChainType, name?: string): Promise<KeyringAccount> {
    if (this.state.isLocked) {
      throw new Error('Wallet is locked');
    }

    if (this.state.authMethod === 'web3') {
      const account = await this.bip39Keyring.createAccount(chainType, name);
      const keyringAccount = await this.convertBIP39Account(account);
      this.state.accounts.push(keyringAccount);

      if (!this.state.activeAccount) {
        this.state.activeAccount = keyringAccount;
      }

      return keyringAccount;
    } else {
      throw new Error('Web2 wallets use fixed accounts');
    }
  }

  /**
   * Get all accounts
   * @param chainType
   */
  async getAccounts(chainType?: ChainType): Promise<KeyringAccount[]> {
    if (chainType) {
      return this.state.accounts.filter(acc => acc.chainType === chainType);
    }
    return this.state.accounts;
  }

  /**
   * Get account by address
   * @param address
   */
  async getAccount(address: string): Promise<KeyringAccount | null> {
    return this.state.accounts.find(acc => acc.address === address) || null;
  }

  /**
   * Set active account
   * @param address
   */
  setActiveAccount(address: string): void {
    const account = this.state.accounts.find(acc => acc.address === address);
    if (account) {
      this.state.activeAccount = account;
    }
  }

  /**
   * Get active account
   */
  getActiveAccount(): KeyringAccount | null {
    return this.state.activeAccount;
  }

  /**
   * Sign message
   * @param address
   * @param message
   */
  async signMessage(address: string, message: string): Promise<string> {
    if (this.state.isLocked) {
      throw new Error('Wallet is locked');
    }

    const account = await this.getAccount(address);
    if (!account) {
      throw new Error('Account not found');
    }

    if (this.state.authMethod === 'web3') {
      const result = await this.bip39Keyring.signMessage(address, message);
      return result.signature;
    } else {
      // Web2 signing
      return await this.keyringManager.signTransaction({ to: '', value: '0', data: message }, account.chainType as 'ethereum' | 'omnicoin');
    }
  }

  /**
   * Sign transaction
   * @param address
   * @param transaction
   */
  async signTransaction(address: string, transaction: TransactionRequest): Promise<string> {
    if (this.state.isLocked) {
      throw new Error('Wallet is locked');
    }

    const account = await this.getAccount(address);
    if (!account) {
      throw new Error('Account not found');
    }

    if (this.state.authMethod === 'web3') {
      const result = await this.bip39Keyring.signTransaction(address, transaction);
      return result.signedTransaction;
    } else {
      // Web2 signing
      return await this.keyringManager.signTransaction(transaction, account.chainType as 'ethereum' | 'omnicoin');
    }
  }

  /**
   * Get account balance
   * @param address
   */
  async getBalance(address: string): Promise<string> {
    const account = await this.getAccount(address);
    if (!account) {
      throw new Error('Account not found');
    }

    const provider = this.providers.get(account.chainType);
    if (!provider) {
      throw new Error(`No provider for chain: ${account.chainType}`);
    }

    try {
      const balance = await provider.getBalance(address);
      return ethers.formatEther(balance);
    } catch (error) {
      console.warn('Error getting balance:', error);
      return '0';
    }
  }

  /**
   * Update all account balances
   */
  async updateBalances(): Promise<void> {
    const updatePromises = this.state.accounts.map(async (account) => {
      try {
        account.balance = await this.getBalance(account.address);
      } catch (error) {
        console.warn(`Error updating balance for ${account.address}:`, error);
        account.balance = '0';
      }
    });

    await Promise.all(updatePromises);
  }

  /**
   * Export seed phrase (Web3 only)
   * @param password
   */
  async exportSeedPhrase(password: string): Promise<string> {
    if (this.state.authMethod !== 'web3') {
      throw new Error('Seed phrase export only available for Web3 wallets');
    }

    return await this.bip39Keyring.getMnemonic(password);
  }

  /**
   * Resolve username to address through OmniCoin naming service or ENS
   * @param username
   */
  async resolveUsername(username: string): Promise<string | null> {
    try {
      // Check if it's an ENS name (.eth)
      if (username.endsWith('.eth')) {
        const provider = this.getProvider();
        if (provider) {
          const address = await provider.resolveName(username);
          return address;
        }
      }

      // Check if it's an OmniCoin username (.omnibazaar or no extension)
      const isOmniName = !username.includes('.') || username.endsWith('.omnibazaar');
      if (isOmniName) {
        // Try to resolve through KeyringManager if available
        if (this.keyringManager) {
          const cleanName = username.replace('.omnibazaar', '');
          return await this.keyringManager.resolveUsername(cleanName);
        }

        // Fallback to validator client if available
        if (this.validatorClient) {
          const cleanName = username.replace('.omnibazaar', '');
          return await this.validatorClient.resolveUsername(cleanName);
        }
      }

      return null;
    } catch (error) {
      console.warn('Error resolving username:', error);
      return null;
    }
  }

  /**
   * Get keyring state
   */
  getState(): KeyringState {
    return { ...this.state };
  }

  /**
   * Get provider for current active account's chain
   */
  private getProvider(): ethers.Provider | null {
    if (!this.state.activeAccount) {
      // Default to Ethereum provider
      return this.providers.get('ethereum') || null;
    }
    return this.providers.get(this.state.activeAccount.chainType) || null;
  }

  /**
   * Set validator client for username resolution
   * @param client
   */
  setValidatorClient(client: any): void {
    this.validatorClient = client;
  }

  /**
   * Reset wallet
   */
  async reset(): Promise<void> {
    if (this.state.authMethod === 'web3') {
      await this.bip39Keyring.reset();
    }

    this.state = {
      isInitialized: false,
      isLocked: true,
      authMethod: null,
      accounts: [],
      activeAccount: null
    };
  }

  // Private helper methods

  /**
   * Create default accounts for new wallet
   */
  private async createDefaultAccounts(): Promise<void> {
    // Create one account for each major chain
    await this.createAccount('ethereum', 'Main Ethereum Account');
    await this.createAccount('omnicoin', 'Main OmniCoin Account');
    await this.createAccount('coti', 'Main COTI Account');
  }

  /**
   * Convert BIP39 account to KeyringAccount
   * @param account
   */
  private async convertBIP39Account(account: BIP39Account): Promise<KeyringAccount> {
    const keyringAccount: KeyringAccount = {
      ...account,
      authMethod: 'web3',
      balance: '0'
    };

    // Try to get initial balance
    try {
      keyringAccount.balance = await this.getBalance(account.address);
    } catch (error) {
      console.warn(`Error getting balance for ${account.address}:`, error);
    }

    return keyringAccount;
  }

  /**
   * Sync Web3 accounts
   */
  private async syncWeb3Accounts(): Promise<void> {
    const accounts = await this.bip39Keyring.getAccounts();
    this.state.accounts = await Promise.all(
      accounts.map(acc => this.convertBIP39Account(acc))
    );

    if (this.state.accounts.length > 0 && !this.state.activeAccount) {
      this.state.activeAccount = this.state.accounts[0];
    }
  }

  /**
   * Sync Web2 accounts
   */
  private async syncWeb2Accounts(): Promise<void> {
    if (!this.state.session) return;

    const { accounts } = this.state.session;
    this.state.accounts = [
      {
        id: 'eth-web2',
        name: 'Ethereum Account',
        address: accounts.ethereum.address,
        publicKey: accounts.ethereum.publicKey,
        chainType: 'ethereum',
        authMethod: 'web2',
        balance: '0'
      },
      {
        id: 'omni-web2',
        name: 'OmniCoin Account',
        address: accounts.omnicoin.address,
        publicKey: accounts.omnicoin.publicKey,
        chainType: 'omnicoin',
        authMethod: 'web2',
        balance: '0'
      }
    ];

    if (this.state.accounts.length > 0 && !this.state.activeAccount) {
      this.state.activeAccount = this.state.accounts[0];
    }

    // Update balances
    await this.updateBalances();
  }
}

// Export singleton instance
export const keyringService = KeyringService.getInstance();
