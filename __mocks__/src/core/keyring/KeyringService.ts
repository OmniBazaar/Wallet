// Mock for KeyringService to avoid blockchain dependency issues in tests

export type ChainType = 'ethereum' | 'bitcoin' | 'omnicoin' | 'coti' | 'substrate' | 'solana';

export interface KeyringState {
  isInitialized: boolean;
  isLocked: boolean;
  accounts: Record<string, any>;
  chainId?: number;
}

export class KeyringService {
  private static instance: KeyringService;
  private state: KeyringState;
  private providers: Map<ChainType, any> = new Map();
  private validatorClient: any = null;

  private constructor() {
    this.state = {
      isInitialized: false,
      isLocked: true,
      accounts: {}
    };
  }

  public static getInstance(): KeyringService {
    if (!KeyringService.instance) {
      KeyringService.instance = new KeyringService();
    }
    return KeyringService.instance;
  }

  async getSeed(password?: string): Promise<string | null> {
    if (!this.state.isInitialized || this.state.isLocked) {
      return null;
    }
    if (!password) {
      throw new Error('Password required to get seed');
    }
    return 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  }

  async initialize(): Promise<void> {
    this.state.isInitialized = true;
    this.state.isLocked = false;
  }

  async createWallet(mnemonicOrPassword?: string, password?: string): Promise<void> {
    // Handle both single-parameter (password) and two-parameter (mnemonic, password) calls
    let finalPassword: string;
    let finalMnemonic: string;
    
    if (password !== undefined) {
      // Two parameters: createWallet(mnemonic, password)
      finalMnemonic = mnemonicOrPassword || 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      finalPassword = password;
    } else {
      // Single parameter: createWallet(password)
      finalMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      finalPassword = mnemonicOrPassword || '';
    }
    
    if (!finalPassword) {
      throw new Error('Password is required');
    }
    // Mock keyring import - no actual implementation needed
    
    this.state.isInitialized = true;
    this.state.isLocked = false;
    this.state.accounts = {
      ethereum: '0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3',
      bitcoin: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
      omnicoin: 'omni1234567890abcdef'
    };
  }

  async unlock(password: string): Promise<boolean> {
    if (!this.state.isInitialized) {
      throw new Error('Keyring not initialized');
    }
    
    // Mock password validation
    if (password === 'test-password-123456' || password === 'secure-financial-test-123456') {
      this.state.isLocked = false;
      return true;
    }
    
    throw new Error('Invalid password');
  }

  async lock(): Promise<void> {
    this.state.isLocked = true;
  }

  isLocked(): boolean {
    return this.state.isLocked;
  }

  isInitialized(): boolean {
    return this.state.isInitialized;
  }

  getState(): KeyringState {
    return { ...this.state };
  }

  async getAccounts(): Promise<Record<string, string>> {
    if (this.state.isLocked) {
      throw new Error('Keyring is locked');
    }
    return this.state.accounts;
  }

  async signTransaction(transaction: any, chainType: ChainType = 'ethereum'): Promise<string> {
    if (this.state.isLocked) {
      throw new Error('Keyring is locked');
    }
    
    // Mock signing
    return '0x' + 'a'.repeat(130); // Mock signature
  }

  async signMessage(message: string, chainType: ChainType = 'ethereum'): Promise<string> {
    if (this.state.isLocked) {
      throw new Error('Keyring is locked');
    }
    
    // Mock signing
    return '0x' + 'b'.repeat(130); // Mock signature
  }

  getProvider(chainType: ChainType): any {
    return this.providers.get(chainType) || null;
  }

  async backup(password: string): Promise<string> {
    if (this.state.isLocked) {
      throw new Error('Keyring is locked');
    }
    
    return JSON.stringify({
      mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      accounts: this.state.accounts
    });
  }

  async restore(backup: string, password: string): Promise<void> {
    const data = JSON.parse(backup);
    await this.createWallet(data.mnemonic, password);
    this.state.accounts = data.accounts;
  }

  async createAccount(chainType: ChainType, name?: string): Promise<any> {
    if (this.state.isLocked) {
      throw new Error('Keyring is locked');
    }

    const addresses = {
      ethereum: '0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3',
      bitcoin: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
      solana: '7nYzHJbXSHAj7uuaK4FJNqrYPgFMhzxbPjvRcmZy8Xzd',
      substrate: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
      omnicoin: 'omni1234567890abcdef',
      coti: '0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3'
    };

    const account = {
      id: Math.random().toString(36).substr(2, 9),
      name: name || `${chainType} Account`,
      address: addresses[chainType] || addresses.ethereum,
      chainType: chainType,
      createdAt: Date.now()
    };

    return account;
  }

  getCurrentSession(): any | null {
    if (this.state.isLocked || !this.state.isInitialized) {
      return null;
    }

    return {
      accounts: {
        ethereum: {
          address: '0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3'
        },
        bitcoin: {
          address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'
        },
        solana: {
          address: '7nYzHJbXSHAj7uuaK4FJNqrYPgFMhzxbPjvRcmZy8Xzd'
        },
        omnicoin: {
          address: 'omni1234567890abcdef'
        },
        coti: {
          address: '0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3'
        },
        substrate: {
          address: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'
        }
      },
      user: {
        id: 'mock-user-id'
      }
    };
  }

  async addAccountFromSeed(seed: string, name?: string): Promise<any> {
    if (this.state.isLocked) {
      throw new Error('Keyring is locked');
    }

    const account = {
      id: Math.random().toString(36).substr(2, 9),
      name: name || 'Account',
      address: '0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3',
      chainType: 'ethereum',
      createdAt: Date.now()
    };

    return account;
  }

  async cleanup(): Promise<void> {
    // Mock cleanup - reset state
    this.state = {
      isInitialized: false,
      isLocked: true,
      accounts: {}
    };
  }
}

// Export singleton instance
export const keyringService = KeyringService.getInstance();