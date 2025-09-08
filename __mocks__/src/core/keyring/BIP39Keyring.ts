// Mock for BIP39Keyring to avoid blockchain dependency issues in tests

export type ChainType = 'ethereum' | 'bitcoin' | 'omnicoin' | 'coti' | 'substrate' | 'solana';

export interface KeyPair {
  privateKey: string;
  publicKey: string;
  address: string;
  derivationPath?: string;
  mnemonic?: string;
}

export class BIP39Keyring {
  private mnemonic: string | null = null;
  private password: string | null = null;
  private keyPairs: Map<ChainType, KeyPair> = new Map();
  private isUnlocked = false;

  constructor() {
    // Initialize empty
  }

  /**
   * Initialize new wallet with mnemonic
   */
  async initialize(options: { mnemonic?: string; password: string; seedPhraseLength?: 12 | 15 | 18 | 21 | 24 }): Promise<string> {
    const seedPhraseLength = options.seedPhraseLength || 24;
    const strength = (seedPhraseLength / 3) * 32;
    const mnemonic = options.mnemonic || BIP39Keyring.generateMnemonic(strength);
    
    if (!BIP39Keyring.validateMnemonic(mnemonic)) {
      throw new Error('Invalid mnemonic phrase');
    }

    await this.importFromMnemonic(mnemonic, options.password);
    return mnemonic;
  }

  /**
   * Create new account for specified chain
   */
  async createAccount(chainType: ChainType, name?: string): Promise<{ id: string; name: string; address: string; publicKey: string; derivationPath: string; chainType: ChainType; createdAt: number }> {
    if (!this.isUnlocked) {
      throw new Error('Wallet is locked');
    }

    await this.deriveKeys([chainType]);
    const keyPair = this.keyPairs.get(chainType);
    
    if (!keyPair) {
      throw new Error(`Failed to create account for ${chainType}`);
    }

    return {
      id: 'mock-account-' + chainType + '-' + Date.now(),
      name: name || `${chainType.charAt(0).toUpperCase() + chainType.slice(1)} Account 1`,
      address: keyPair.address,
      publicKey: keyPair.publicKey,
      derivationPath: `m/44'/${this.getCoinType(chainType)}'/0'/0/0`,
      chainType,
      createdAt: Date.now()
    };
  }

  /**
   * Get coin type for BIP44 derivation path
   */
  private getCoinType(chainType: ChainType): number {
    const coinTypes: Record<ChainType, number> = {
      ethereum: 60,
      bitcoin: 0,
      solana: 501,
      coti: 60,
      omnicoin: 9999,
      substrate: 354,
    };
    return coinTypes[chainType];
  }

  /**
   * Check if wallet is initialized
   */
  async isInitialized(): Promise<boolean> {
    return this.mnemonic !== null;
  }

  /**
   * Get account by address
   */
  async getAccount(address: string): Promise<{ id: string; address: string; chainType: ChainType } | null> {
    for (const [chainType, keyPair] of this.keyPairs.entries()) {
      if (keyPair.address === address) {
        return {
          id: 'mock-account-' + chainType,
          address: keyPair.address,
          chainType
        };
      }
    }
    return null;
  }

  /**
   * Import wallet from mnemonic phrase
   */
  async importFromMnemonic(mnemonic: string, password: string): Promise<void> {
    // Validate mnemonic (basic mock validation)
    if (!mnemonic || mnemonic.split(' ').length < 12) {
      throw new Error('Invalid mnemonic');
    }

    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    this.mnemonic = mnemonic;
    this.password = password;
    this.isUnlocked = true;

    // Generate mock key pairs for different chains using valid formats
    this.keyPairs.set('ethereum', {
      privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', // Valid private key
      publicKey: '0x04f39fd6e51aad88f6f4ce6ab8827279cfffb92266e94b8a1060e5c4c4e6aa5cbe3f4f5a5ad6b3b8e2f3e8b1e0c6fb8d7a7f8e8f3e6b8e2c3a1b9f8e7d6c5',
      address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // Valid checksum address
      mnemonic
    });

    this.keyPairs.set('bitcoin', {
      privateKey: 'L1aW4aubDFB7yfras2S1mN3bqg9nwySY8nkoLmJebSLD5BWv3ENZ', // Valid WIF private key
      publicKey: '03f39fd6e51aad88f6f4ce6ab8827279cfffb92266e94b8a1060e5c4c4e6aa5cbe',
      address: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
      mnemonic
    });

    this.keyPairs.set('solana', {
      privateKey: '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtrzVHFH', // Valid Solana private key format
      publicKey: '11111111111111111111111111111112BSEKGw', // Valid base58 public key (>32 chars)
      address: '11111111111111111111111111111112BSEKGw', // Valid Solana address (base58, >32 chars)
      mnemonic
    });

    this.keyPairs.set('omnicoin', {
      privateKey: 'omni_ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
      publicKey: 'omni_pub_f39fd6e51aad88f6f4ce6ab8827279cfffb92266e94b8a1060e5c4c4e6aa5c',
      address: 'omni1f39fd6e51aad88f6f4ce6ab8827279cfffb92266',
      mnemonic
    });

    this.keyPairs.set('coti', {
      privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
      publicKey: '0x04f39fd6e51aad88f6f4ce6ab8827279cfffb92266e94b8a1060e5c4c4e6aa5cbe3f4f5a5ad6b3b8e2f3e8b1e0c6fb8d7a7f8e8f3e6b8e2c3a1b9f8e7d6c5',
      address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      mnemonic
    });

    this.keyPairs.set('substrate', {
      privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
      publicKey: '0x04f39fd6e51aad88f6f4ce6ab8827279cfffb92266e94b8a1060e5c4c4e6aa5cbe3f4f5a5ad6b3b8e2f3e8b1e0c6fb8d7a7f8e8f3e6b8e2c3a1b9f8e7d6c5',
      address: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
      mnemonic
    });
  }

  /**
   * Generate new mnemonic
   */
  static generateMnemonic(strength = 256): string {
    // Generate proper length mnemonics based on strength
    const words12 = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    const words24 = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art';
    
    // 128 bits = 12 words, 256 bits = 24 words
    return strength === 256 ? words24 : (strength === 128 ? words12 : words24);
  }

  /**
   * Validate mnemonic
   */
  static validateMnemonic(mnemonic: string): boolean {
    // Validate based on word count and known valid mnemonics
    if (!mnemonic) return false;
    const words = mnemonic.trim().split(' ');
    
    // Common test mnemonics that should be valid
    const validMnemonics = [
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art',
      'test test test test test test test test test test test junk'
    ];
    
    // Check if it's a known valid mnemonic or proper length
    return validMnemonics.includes(mnemonic) || (words.length >= 12 && words.length <= 24 && words.length % 3 === 0);
  }

  /**
   * Get mnemonic (requires password)
   */
  async getMnemonic(password: string): Promise<string> {
    if (!this.isUnlocked) {
      throw new Error('Keyring is locked');
    }

    if (password !== this.password) {
      throw new Error('Invalid password');
    }

    if (!this.mnemonic) {
      throw new Error('No mnemonic available');
    }

    return this.mnemonic;
  }

  /**
   * Get private key for specific chain
   */
  async getPrivateKey(chainType: ChainType, password: string): Promise<string> {
    if (!this.isUnlocked) {
      throw new Error('Keyring is locked');
    }

    if (password !== this.password) {
      throw new Error('Invalid password');
    }

    const keyPair = this.keyPairs.get(chainType);
    if (!keyPair) {
      throw new Error(`No keys for chain: ${chainType}`);
    }

    return keyPair.privateKey;
  }

  /**
   * Get public key for specific chain
   */
  getPublicKey(chainType: ChainType): string {
    const keyPair = this.keyPairs.get(chainType);
    if (!keyPair) {
      throw new Error(`No keys for chain: ${chainType}`);
    }

    return keyPair.publicKey;
  }

  /**
   * Get address for specific chain
   */
  getAddress(chainType: ChainType): string {
    const keyPair = this.keyPairs.get(chainType);
    if (!keyPair) {
      throw new Error(`No keys for chain: ${chainType}`);
    }

    return keyPair.address;
  }

  /**
   * Sign transaction
   */
  async signTransaction(transaction: any, chainType: ChainType, password: string): Promise<string> {
    if (!this.isUnlocked) {
      throw new Error('Keyring is locked');
    }

    if (password !== this.password) {
      throw new Error('Invalid password');
    }

    // Mock signing - return a mock signature
    return '0x' + 'signature'.repeat(16) + chainType.slice(0, 8);
  }

  /**
   * Sign message
   */
  async signMessage(message: string, chainType: ChainType, password: string): Promise<string> {
    if (!this.isUnlocked) {
      throw new Error('Keyring is locked');
    }

    if (password !== this.password) {
      throw new Error('Invalid password');
    }

    // Mock signing - return a mock signature
    return '0x' + 'message_sig'.repeat(12) + chainType.slice(0, 8);
  }

  /**
   * Lock keyring
   */
  lock(): void {
    this.isUnlocked = false;
    // In a real implementation, sensitive data would be cleared from memory
  }

  /**
   * Unlock keyring
   */
  async unlock(password: string): Promise<boolean> {
    if (password === this.password && this.mnemonic) {
      this.isUnlocked = true;
      return true;
    }
    throw new Error('Invalid password');
  }

  /**
   * Check if keyring is unlocked
   */
  isLocked(): boolean {
    return !this.isUnlocked;
  }

  /**
   * Check if keyring has been initialized
   */
  isInitialized(): boolean {
    return this.mnemonic !== null;
  }

  /**
   * Get all available addresses
   */
  getAddresses(): Record<ChainType, string> {
    const addresses: Record<string, string> = {};
    for (const [chainType, keyPair] of this.keyPairs.entries()) {
      addresses[chainType] = keyPair.address;
    }
    return addresses as Record<ChainType, string>;
  }

  /**
   * Derive keys for additional chains
   */
  async deriveKeys(chainTypes: ChainType[]): Promise<void> {
    if (!this.isUnlocked || !this.mnemonic) {
      throw new Error('Keyring must be unlocked and initialized');
    }

    // Mock derivation for requested chain types
    for (const chainType of chainTypes) {
      if (!this.keyPairs.has(chainType)) {
        this.keyPairs.set(chainType, {
          privateKey: `${chainType}_` + 'x'.repeat(60),
          publicKey: `${chainType}_pub_` + 'y'.repeat(56),
          address: `${chainType}1234567890abcdef`,
          mnemonic: this.mnemonic
        });
      }
    }
  }

  /**
   * Get accounts for a specific chain
   */
  async getAccounts(chainType: ChainType): Promise<KeyPair[]> {
    if (!this.isUnlocked) {
      throw new Error('Keyring is locked');
    }

    const keyPair = this.keyPairs.get(chainType);
    if (keyPair) {
      // Add derivationPath if missing
      if (!keyPair.derivationPath) {
        keyPair.derivationPath = `m/44'/${this.getCoinType(chainType)}'/0'/0/0`;
      }
      return [keyPair];
    }
    return [];
  }

  /**
   * Add a new account for a chain
   */
  async addAccount(chainType: ChainType): Promise<KeyPair[]> {
    if (!this.isUnlocked || !this.mnemonic) {
      throw new Error('Keyring must be unlocked and initialized');
    }

    // Create a new account with different values
    const newKeyPair: KeyPair = {
      privateKey: chainType === 'ethereum' 
        ? '0xdf57089febbacf7ba0bc227dafbffa9fc08a93fdc68e1e42411a14efcf23656e' // Different valid private key
        : `${chainType}_new_df57089febbacf7ba0bc227dafbffa9fc08a93fdc68e1e42411a14efcf23656e`,
      publicKey: chainType === 'ethereum' 
        ? '0x04c3e7f4e5a2b3c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9'
        : `${chainType}_new_pub_w`.repeat(16),
      address: chainType === 'ethereum' 
        ? '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' // Different valid checksum address
        : `${chainType}987654321fedcba`,
      mnemonic: this.mnemonic
    };

    // For simplicity, just return the new account (in real implementation, would store multiple)
    return [newKeyPair];
  }
}

// Export ChainType enum to match the real implementation
export const ChainType = {
  Ethereum: 'ethereum' as ChainType,
  Bitcoin: 'bitcoin' as ChainType,
  Solana: 'solana' as ChainType,
  Coti: 'coti' as ChainType,
  OmniCoin: 'omnicoin' as ChainType,
  Substrate: 'substrate' as ChainType
} as const;