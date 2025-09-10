import { randomBytes, createHash } from 'crypto';
import BrowserStorage, { StorageInterface } from '../common/browser-storage';

/**
 * Account descriptor stored in the simple keyring
 */
export interface Account {
  /** Unique identifier for the account */
  id: string;
  /** User-friendly account name */
  name: string;
  /** Blockchain address */
  address: string;
  /** Public key for the account */
  publicKey: string;
  /** BIP44 derivation path */
  derivationPath: string;
  /** Type of blockchain */
  chainType: 'ethereum' | 'bitcoin' | 'solana' | 'coti' | 'omnicoin';
  /** Timestamp when account was created */
  createdAt: number;
}

/**
 * Wallet metadata and account list persisted to storage
 */
export interface WalletData {
  /** Unique wallet identifier */
  id: string;
  /** Wallet name */
  name: string;
  /** Timestamp when wallet was created */
  createdAt: number;
  /** List of accounts in the wallet */
  accounts: Account[];
}

/**
 * Options used when initializing or unlocking the keyring
 */
export interface KeyringOptions {
  /** Optional mnemonic phrase for wallet recovery */
  mnemonic?: string;
  /** Password for wallet encryption */
  password: string;
}

/**
 * Simple, browser‑storage backed keyring for development/testing.
 * Provides init/unlock/lock and account creation for multiple chains.
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
   * Create a keyring bound to a browser storage namespace
   * @param namespace - Storage namespace key
   */
  constructor(namespace = 'omnibazaar-wallet') {
    this.storage = new BrowserStorage(namespace);
  }

  /**
   * Initialize a new wallet with an encrypted seed and empty account list
   * @param options - Initialization options (mnemonic or password)
   * @returns Promise that resolves when initialization is complete
   */
  async initialize(options: KeyringOptions): Promise<void> {
    if (await this.isInitialized()) {
      throw new Error('Wallet is already initialized');
    }

    // Generate a simple seed if no mnemonic provided
    const seed = options.mnemonic ?? this.generateSeed();
    
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

  /**
   * Check whether the keyring has been initialized
   * @returns Promise resolving to true if initialized
   */
  async isInitialized(): Promise<boolean> {
    const encryptedSeed = await this.storage.get<string>(this.STORAGE_KEYS.ENCRYPTED_SEED);
    return encryptedSeed !== null;
  }

  /**
   * Unlock the keyring with the given password
   * @param password - Wallet password
   * @returns Promise that resolves when wallet is unlocked
   */
  async unlock(password: string): Promise<void> {
    if (!await this.isInitialized()) {
      throw new Error('Wallet is not initialized');
    }

    try {
      // Load encrypted seed
      const storedSeed = await this.storage.get<string>(this.STORAGE_KEYS.ENCRYPTED_SEED);
      if (storedSeed === null || storedSeed === '') {
        throw new Error('No encrypted seed found');
      }
      this.encryptedSeed = storedSeed;

      // Verify password by trying to decrypt
      this.decrypt(this.encryptedSeed, password);

      // Load wallet data
      const storedWalletData = await this.storage.get<WalletData>(this.STORAGE_KEYS.WALLET_DATA);
      if (storedWalletData === null) {
        throw new Error('No wallet data found');
      }
      this.walletData = storedWalletData;

      this.isUnlocked = true;
    } catch (error) {
      this.isUnlocked = false;
      throw new Error('Failed to unlock wallet: Invalid password');
    }
  }

  /**
   * Lock the keyring, clearing in‑memory unlocked state
   * @returns void
   */
  lock(): void {
    this.isUnlocked = false;
  }

  /**
   * Return true if the keyring is currently locked
   * @returns True if locked, false if unlocked
   */
  locked(): boolean {
    return !this.isUnlocked;
  }

  /**
   * Create a new account for the specified chain type
   * @param chainType - Target chain type
   * @param name - Optional display name
   * @returns Promise resolving to the new account
   */
  async createAccount(chainType: Account['chainType'], name?: string): Promise<Account> {
    if (!this.isUnlocked || this.walletData === null) {
      throw new Error('Wallet is locked');
    }

    const accountIndex = this.walletData.accounts.filter(acc => acc.chainType === chainType).length;
    const derivationPath = this.getDerivationPath(chainType, accountIndex);
    
    // Generate address and public key (simplified)
    const keyPair = this.generateKeyPair(chainType, accountIndex);
    
    const account: Account = {
      id: this.generateId(),
      name: name !== undefined && name !== '' 
        ? name 
        : `${chainType.charAt(0).toUpperCase() + chainType.slice(1)} Account ${accountIndex + 1}`,
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

  /**
   * Get all accounts or accounts for a specific chain
   * @param chainType - Optional chain type filter
   * @returns Promise resolving to array of accounts
   */
  getAccounts(chainType?: Account['chainType']): Promise<Account[]> {
    if (this.walletData === null) {
      return Promise.resolve([]);
    }

    return Promise.resolve(
      chainType !== undefined
        ? this.walletData.accounts.filter(acc => acc.chainType === chainType)
        : this.walletData.accounts
    );
  }

  /**
   * Get account by address
   * @param address - Account address to find
   * @returns Promise resolving to account or null if not found
   */
  getAccount(address: string): Promise<Account | null> {
    if (this.walletData === null) {
      return Promise.resolve(null);
    }

    const account = this.walletData.accounts.find(acc => acc.address === address);
    return Promise.resolve(account ?? null);
  }

  /**
   * Sign message with account (placeholder implementation)
   * @param address - Address to sign with
   * @param message - Message to sign
   * @returns Promise resolving to signature string
   */
  async signMessage(address: string, message: string): Promise<string> {
    if (!this.isUnlocked) {
      throw new Error('Wallet is locked');
    }

    const account = await this.getAccount(address);
    if (account === null) {
      throw new Error('Account not found');
    }

    // Placeholder signature - to be implemented with proper crypto
    const messageHash = createHash('sha256').update(message).digest();
    return `0x${messageHash.toString('hex')}`;
  }

  /**
   * Reset wallet (delete all data)
   * @returns Promise that resolves when reset is complete
   */
  async reset(): Promise<void> {
    await this.storage.clear();
    this.lock();
    this.walletData = null;
    this.encryptedSeed = null;
  }

  /**
   * Encrypt text with password using simple XOR (not secure for production)
   * @param text - Text to encrypt
   * @param password - Password for encryption
   * @returns Base64 encoded encrypted string
   */
  private encrypt(text: string, password: string): string {
    // Simple XOR encryption for now (not secure for production)
    const key = this.hashPassword(password);
    let encrypted = '';
    for (let i = 0; i < text.length; i++) {
      encrypted += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return Buffer.from(encrypted).toString('base64');
  }

  /**
   * Decrypt text with password
   * @param encryptedText - Base64 encoded encrypted text
   * @param password - Password for decryption
   * @returns Decrypted string
   */
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

  /**
   * Hash password using SHA256
   * @param password - Password to hash
   * @returns Hex string hash
   */
  private hashPassword(password: string): string {
    return createHash('sha256').update(password).digest('hex');
  }

  /**
   * Generate random seed
   * @returns Hex string seed
   */
  private generateSeed(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Get BIP44 derivation path for chain and account index
   * @param chainType - Type of blockchain
   * @param accountIndex - Account index
   * @returns BIP44 derivation path string
   */
  private getDerivationPath(chainType: Account['chainType'], accountIndex: number): string {
    const coinTypes = {
      ethereum: "60",
      bitcoin: "0", 
      solana: "501",
      coti: "60", // Using Ethereum's coin type for now
      omnicoin: "60" // Using Ethereum's coin type for now
    };

    const coinType = coinTypes[chainType];
    return `m/44'/${coinType}'/0'/0/${accountIndex}`;
  }

  /**
   * Generate key pair for specified chain
   * @param chainType - Type of blockchain
   * @param accountIndex - Account index
   * @returns Object with address and publicKey
   */
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
      default: {
        const _exhaustiveCheck: never = chainType;
        throw new Error(`Unsupported chain type: ${String(_exhaustiveCheck)}`);
      }
    }
  }

  /**
   * Generate unique identifier
   * @returns Hex string ID
   */
  private generateId(): string {
    return randomBytes(16).toString('hex');
  }
}

export default SimpleKeyring;