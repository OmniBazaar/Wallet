import { randomBytes, createHash } from 'crypto';
import BrowserStorage, { StorageInterface } from '../common/browser-storage';

/**
 *
 */
export interface Account {
  /**
   *
   */
  id: string;
  /**
   *
   */
  name: string;
  /**
   *
   */
  address: string;
  /**
   *
   */
  publicKey: string;
  /**
   *
   */
  derivationPath: string;
  /**
   *
   */
  chainType: 'ethereum' | 'bitcoin' | 'solana' | 'coti' | 'omnicoin';
  /**
   *
   */
  createdAt: number;
}

/**
 *
 */
export interface WalletData {
  /**
   *
   */
  id: string;
  /**
   *
   */
  name: string;
  /**
   *
   */
  createdAt: number;
  /**
   *
   */
  accounts: Account[];
}

/**
 *
 */
export interface KeyringOptions {
  /**
   *
   */
  mnemonic?: string;
  /**
   *
   */
  password: string;
}

/**
 *
 */
class SimpleKeyring {
  private storage: StorageInterface;
  private isUnlocked = false;
  private encryptedSeed: string | null = null;
  private walletData: WalletData | null = null;
  
  private readonly STORAGE_KEYS = {
    ENCRYPTED_SEED: 'encrypted_seed',
    WALLET_DATA: 'wallet_data',
    SETTINGS: 'settings'
  };

  /**
   *
   * @param namespace
   */
  constructor(namespace = 'omnibazaar-wallet') {
    this.storage = new BrowserStorage(namespace);
  }

  // Initialize new wallet
  /**
   *
   * @param options
   */
  async initialize(options: KeyringOptions): Promise<void> {
    if (await this.isInitialized()) {
      throw new Error('Wallet is already initialized');
    }

    // Generate a simple seed if no mnemonic provided
    const seed = options.mnemonic || this.generateSeed();
    
    // Create encrypted seed
    this.encryptedSeed = this.encrypt(seed, options.password);
    
    // Create initial wallet data
    this.walletData = {
      id: this.generateId(),
      name: 'OmniBazaar Wallet',
      createdAt: Date.now(),
      accounts: []
    };

    // Save to storage
    await this.storage.set(this.STORAGE_KEYS.ENCRYPTED_SEED, this.encryptedSeed);
    await this.storage.set(this.STORAGE_KEYS.WALLET_DATA, this.walletData);

    // Unlock the wallet
    await this.unlock(options.password);
  }

  // Check if wallet is initialized
  /**
   *
   */
  async isInitialized(): Promise<boolean> {
    const encryptedSeed = await this.storage.get(this.STORAGE_KEYS.ENCRYPTED_SEED);
    return !!encryptedSeed;
  }

  // Unlock wallet with password
  /**
   *
   * @param password
   */
  async unlock(password: string): Promise<void> {
    if (!await this.isInitialized()) {
      throw new Error('Wallet is not initialized');
    }

    try {
      // Load encrypted seed
      this.encryptedSeed = await this.storage.get(this.STORAGE_KEYS.ENCRYPTED_SEED);
      if (!this.encryptedSeed) {
        throw new Error('No encrypted seed found');
      }

      // Verify password by trying to decrypt
      this.decrypt(this.encryptedSeed, password);

      // Load wallet data
      this.walletData = await this.storage.get(this.STORAGE_KEYS.WALLET_DATA);
      if (!this.walletData) {
        throw new Error('No wallet data found');
      }

      this.isUnlocked = true;
    } catch (error) {
      this.isUnlocked = false;
      throw new Error('Failed to unlock wallet: Invalid password');
    }
  }

  // Lock wallet
  /**
   *
   */
  lock(): void {
    this.isUnlocked = false;
  }

  // Get wallet lock status
  /**
   *
   */
  locked(): boolean {
    return !this.isUnlocked;
  }

  // Create new account for specified chain
  /**
   *
   * @param chainType
   * @param name
   */
  async createAccount(chainType: Account['chainType'], name?: string): Promise<Account> {
    if (!this.isUnlocked || !this.walletData) {
      throw new Error('Wallet is locked');
    }

    const accountIndex = this.walletData.accounts.filter(acc => acc.chainType === chainType).length;
    const derivationPath = this.getDerivationPath(chainType, accountIndex);
    
    // Generate address and public key (simplified)
    const keyPair = this.generateKeyPair(chainType, accountIndex);
    
    const account: Account = {
      id: this.generateId(),
      name: name || `${chainType.charAt(0).toUpperCase() + chainType.slice(1)} Account ${accountIndex + 1}`,
      address: keyPair.address,
      publicKey: keyPair.publicKey,
      derivationPath,
      chainType,
      createdAt: Date.now()
    };

    // Add to wallet data
    this.walletData.accounts.push(account);
    
    // Save to storage
    await this.storage.set(this.STORAGE_KEYS.WALLET_DATA, this.walletData);

    return account;
  }

  // Get all accounts
  /**
   *
   * @param chainType
   */
  async getAccounts(chainType?: Account['chainType']): Promise<Account[]> {
    if (!this.walletData) {
      return [];
    }

    return chainType 
      ? this.walletData.accounts.filter(acc => acc.chainType === chainType)
      : this.walletData.accounts;
  }

  // Get account by address
  /**
   *
   * @param address
   */
  async getAccount(address: string): Promise<Account | null> {
    if (!this.walletData) {
      return null;
    }

    return this.walletData.accounts.find(acc => acc.address === address) || null;
  }

  // Sign message with account (placeholder implementation)
  /**
   *
   * @param address
   * @param message
   */
  async signMessage(address: string, message: string): Promise<string> {
    if (!this.isUnlocked) {
      throw new Error('Wallet is locked');
    }

    const account = await this.getAccount(address);
    if (!account) {
      throw new Error('Account not found');
    }

    // Placeholder signature - to be implemented with proper crypto
    const messageHash = createHash('sha256').update(message).digest();
    return `0x${messageHash.toString('hex')}`;
  }

  // Reset wallet (delete all data)
  /**
   *
   */
  async reset(): Promise<void> {
    await this.storage.clear();
    this.lock();
    this.walletData = null;
    this.encryptedSeed = null;
  }

  // Private helper methods
  private encrypt(text: string, password: string): string {
    // Simple XOR encryption for now (not secure for production)
    const key = this.hashPassword(password);
    let encrypted = '';
    for (let i = 0; i < text.length; i++) {
      encrypted += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return Buffer.from(encrypted).toString('base64');
  }

  private decrypt(encryptedText: string, password: string): string {
    try {
      const key = this.hashPassword(password);
      const encrypted = Buffer.from(encryptedText, 'base64').toString();
      let decrypted = '';
      for (let i = 0; i < encrypted.length; i++) {
        decrypted += String.fromCharCode(encrypted.charCodeAt(i) ^ key.charCodeAt(i % key.length));
      }
      return decrypted;
    } catch (error) {
      throw new Error('Failed to decrypt');
    }
  }

  private hashPassword(password: string): string {
    return createHash('sha256').update(password).digest('hex');
  }

  private generateSeed(): string {
    return randomBytes(32).toString('hex');
  }

  private getDerivationPath(chainType: Account['chainType'], accountIndex: number): string {
    const coinTypes = {
      ethereum: "60",
      bitcoin: "0", 
      solana: "501",
      coti: "60", // Using Ethereum's coin type for now
      omnicoin: "60" // Using Ethereum's coin type for now
    };

    const coinType = coinTypes[chainType] || "60";
    return `m/44'/${coinType}'/0'/0/${accountIndex}`;
  }

  private generateKeyPair(chainType: Account['chainType'], accountIndex: number): { address: string; publicKey: string } {
    // Simplified key generation for demonstration
    const seed = createHash('sha256').update(`${chainType}-${accountIndex}`).digest();
    const publicKey = seed.toString('hex');
    
    switch (chainType) {
      case 'ethereum':
      case 'coti':
      case 'omnicoin':
        return {
          address: '0x' + seed.slice(-20).toString('hex'),
          publicKey: '0x' + publicKey
        };
      case 'bitcoin':
        return {
          address: 'bc1' + seed.slice(0, 32).toString('hex'),
          publicKey: publicKey
        };
      case 'solana':
        return {
          address: seed.slice(0, 32).toString('hex'),
          publicKey: publicKey
        };
      default:
        throw new Error(`Unsupported chain type: ${chainType}`);
    }
  }

  private generateId(): string {
    return randomBytes(16).toString('hex');
  }
}

export default SimpleKeyring; 