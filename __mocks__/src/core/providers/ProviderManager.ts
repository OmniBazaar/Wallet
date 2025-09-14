// Mock for ProviderManager to avoid blockchain dependency issues in tests

export type NetworkType = 'mainnet' | 'testnet';
export type ChainType = 'ethereum' | 'bitcoin' | 'omnicoin' | 'coti' | 'substrate' | 'solana';

// ChainType enum for test compatibility
export const ChainType = {
  Ethereum: 'ethereum' as ChainType,
  Bitcoin: 'bitcoin' as ChainType,
  Solana: 'solana' as ChainType,
  Substrate: 'substrate' as ChainType,
  COTI: 'coti' as ChainType,
  OmniCoin: 'omnicoin' as ChainType
} as const;

export interface ChainConfig {
  chainType: ChainType;
  name: string;
  icon: string;
  networks: string[];
  defaultNetwork: string;
  features: {
    privacy?: boolean;
    staking?: boolean;
    marketplace?: boolean;
    nft?: boolean;
    defi?: boolean;
  };
}

export const SUPPORTED_CHAINS: Record<string, ChainConfig> = {
  ethereum: {
    chainType: 'ethereum',
    name: 'Ethereum',
    icon: 'ethereum',
    networks: ['mainnet', 'sepolia', 'goerli'],
    defaultNetwork: 'mainnet',
    features: {
      defi: true,
      nft: true,
      marketplace: true
    }
  },
  bitcoin: {
    chainType: 'bitcoin',
    name: 'Bitcoin',
    icon: 'bitcoin',
    networks: ['mainnet', 'testnet'],
    defaultNetwork: 'mainnet',
    features: {}
  },
  solana: {
    chainType: 'solana',
    name: 'Solana',
    icon: 'solana',
    networks: ['mainnet', 'testnet'],
    defaultNetwork: 'mainnet',
    features: {
      nft: true,
      defi: true
    }
  },
  substrate: {
    chainType: 'substrate',
    name: 'Polkadot/Substrate',
    icon: 'polkadot',
    networks: ['polkadot', 'kusama'],
    defaultNetwork: 'polkadot',
    features: {
      staking: true
    }
  },
  coti: {
    chainType: 'coti',
    name: 'COTI',
    icon: 'coti',
    networks: ['mainnet', 'testnet'],
    defaultNetwork: 'testnet',
    features: {
      privacy: true
    }
  },
  omnicoin: {
    chainType: 'omnicoin',
    name: 'OmniCoin',
    icon: 'omnicoin',
    networks: ['mainnet', 'testnet'],
    defaultNetwork: 'testnet',
    features: {
      privacy: true,
      marketplace: true,
      staking: true
    }
  }
};

// Mock provider class
class MockProvider {
  private chainType: ChainType;
  
  constructor(chainType: ChainType) {
    this.chainType = chainType;
  }
  
  async getBalance(address: string): Promise<string> {
    return '1000000000000000000'; // 1 ETH/token
  }
  
  async sendTransaction(transaction: any): Promise<string> {
    return '0x' + '1'.repeat(64); // Mock transaction hash
  }
  
  async getNetwork(): Promise<any> {
    return { name: 'mock', chainId: 1337 };
  }
}

export class ProviderManager {
  private static instance: ProviderManager;
  private providers: Map<ChainType, MockProvider> = new Map();
  private evmProviders: Map<string, MockProvider> = new Map();
  private activeChain: ChainType = 'ethereum';
  private activeNetwork = 'ethereum';
  private networkType: NetworkType = 'mainnet';
  private initialized = false;

  private constructor() { }

  public static getInstance(): ProviderManager {
    if (!ProviderManager.instance) {
      ProviderManager.instance = new ProviderManager();
    }
    return ProviderManager.instance;
  }

  async initialize(networkType: NetworkType = 'mainnet'): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.networkType = networkType;

    // Initialize mock providers
    this.providers.set('ethereum', new MockProvider('ethereum'));
    this.providers.set('bitcoin', new MockProvider('bitcoin'));
    this.providers.set('omnicoin', new MockProvider('omnicoin'));
    this.providers.set('coti', new MockProvider('coti'));
    this.providers.set('substrate', new MockProvider('substrate'));
    this.providers.set('solana', new MockProvider('solana'));

    // Initialize mock EVM providers
    this.evmProviders.set('ethereum', new MockProvider('ethereum'));
    this.evmProviders.set('polygon', new MockProvider('ethereum'));
    this.evmProviders.set('arbitrum', new MockProvider('ethereum'));

    this.initialized = true;
  }

  getProvider(chainType: ChainType): MockProvider | null {
    return this.providers.get(chainType) || null;
  }

  getEVMProvider(networkKey: string): MockProvider | null {
    return this.evmProviders.get(networkKey) || null;
  }

  async switchEVMNetwork(networkKey: string): Promise<void> {
    const validNetworks = ['ethereum', 'polygon', 'arbitrum', 'optimism', 'base', 'bsc', 'avalanche'];
    if (!validNetworks.includes(networkKey)) {
      throw new Error(`Invalid EVM network: ${networkKey}`);
    }
    this.activeNetwork = networkKey;
    this.activeChain = 'ethereum';
  }

  getAvailableEVMNetworks(): string[] {
    return Array.from(this.evmProviders.keys());
  }

  getActiveChain(): ChainType {
    return this.activeChain;
  }

  getActiveNetwork(): string {
    return this.activeNetwork;
  }

  getNetworkType(): NetworkType {
    return this.networkType;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async switchChain(chainType: ChainType): Promise<void> {
    this.activeChain = chainType;
  }

  getSupportedChains(): Record<string, ChainConfig> {
    return SUPPORTED_CHAINS;
  }

  getChainConfig(chainType: ChainType): ChainConfig | null {
    return Object.values(SUPPORTED_CHAINS).find(config => config.chainType === chainType) || null;
  }

  // Missing methods needed by tests
  async setActiveChain(chainType: ChainType): Promise<void> {
    const validChains = ['ethereum', 'bitcoin', 'solana', 'substrate', 'coti', 'omnicoin'];
    if (!validChains.includes(chainType)) {
      throw new Error(`Invalid chain type: ${chainType}`);
    }
    this.activeChain = chainType;
  }

  getActiveProvider(): MockProvider | null {
    return this.providers.get(this.activeChain) || null;
  }

  async getCurrentNetworkDetails(): Promise<{
    name: string;
    chainId: number;
    nativeCurrency: {
      name: string;
      symbol: string;
      decimals: number;
    };
  }> {
    // Return appropriate network details based on active chain
    if (this.activeChain === 'solana') {
      return {
        name: 'Solana Devnet',
        chainId: 103,
        nativeCurrency: {
          name: 'Solana',
          symbol: 'SOL',
          decimals: 9
        }
      };
    } else if (this.activeChain === 'bitcoin') {
      return {
        name: 'Bitcoin Mainnet',
        chainId: 0,
        nativeCurrency: {
          name: 'Bitcoin',
          symbol: 'BTC',
          decimals: 8
        }
      };
    } else if (this.activeChain === 'substrate') {
      return {
        name: 'Polkadot',
        chainId: 0,
        nativeCurrency: {
          name: 'Polkadot',
          symbol: 'DOT',
          decimals: 10
        }
      };
    } else if (this.activeChain === 'ethereum') {
      // For EVM chains, check the active network
      switch (this.activeNetwork) {
        case 'polygon':
          return {
            name: 'Polygon',
            chainId: 137,
            nativeCurrency: {
              name: 'MATIC',
              symbol: 'MATIC',
              decimals: 18
            }
          };
        case 'arbitrum':
          return {
            name: 'Arbitrum One',
            chainId: 42161,
            nativeCurrency: {
              name: 'ETH',
              symbol: 'ETH',
              decimals: 18
            }
          };
        case 'optimism':
          return {
            name: 'Optimism',
            chainId: 10,
            nativeCurrency: {
              name: 'ETH',
              symbol: 'ETH',
              decimals: 18
            }
          };
        case 'base':
          return {
            name: 'Base',
            chainId: 8453,
            nativeCurrency: {
              name: 'ETH',
              symbol: 'ETH',
              decimals: 18
            }
          };
        default:
          // Default to Ethereum mainnet
          return {
            name: 'Ethereum Mainnet',
            chainId: 1,
            nativeCurrency: {
              name: 'Ether',
              symbol: 'ETH',
              decimals: 18
            }
          };
      }
    } else {
      // Default fallback
      return {
        name: 'Ethereum Mainnet',
        chainId: 1,
        nativeCurrency: {
          name: 'Ether',
          symbol: 'ETH',
          decimals: 18
        }
      };
    }
  }

  async getFormattedBalance(address?: string, includePrivate = false): Promise<string> {
    return '1.0';
  }

  async estimateGas(to: string, amount: string, data?: string): Promise<string> {
    return '21000';
  }

  getActiveAccount(): any | null {
    // Mock active account - tests can override this method
    return {
      address: '0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3',
      chainType: this.activeChain
    };
  }

  async getBalance(chainType?: ChainType): Promise<string> {
    // Check if there's an active account
    if (!this.getActiveAccount()) {
      return '0';
    }

    const activeChain = chainType || this.activeChain;
    // Return different balances based on chain type
    switch (activeChain) {
      case 'solana':
        return '1000000000'; // 1 SOL in lamports
      case 'bitcoin':
        return '100000000'; // 1 BTC in satoshis
      default:
        return '1000000000000000000'; // 1 ETH/token in wei
    }
  }

  static getSupportedEVMNetworks(): string[] {
    return ['ethereum', 'polygon', 'arbitrum', 'optimism', 'base'];
  }

  getSupportedChains(): ChainType[] {
    return ['ethereum', 'bitcoin', 'solana', 'substrate', 'coti', 'omnicoin'];
  }

  // Additional methods for blockchain multi-chain tests
  getChainFeatures(chainType: ChainType): any {
    const chainConfig = this.getChainConfig(chainType);
    return chainConfig?.features || {};
  }

  isFeatureSupported(chainType: ChainType, feature: string): boolean {
    const features = this.getChainFeatures(chainType);
    return !!features[feature];
  }

  async enablePrivacyMode(chainType: ChainType): Promise<void> {
    if (!this.isFeatureSupported(chainType, 'privacy')) {
      throw new Error(`Privacy mode not supported for chain: ${chainType}`);
    }
    // Mock privacy mode activation
  }

  async disablePrivacyMode(chainType: ChainType): Promise<void> {
    if (!this.isFeatureSupported(chainType, 'privacy')) {
      throw new Error(`Privacy mode not supported for chain: ${chainType}`);
    }
    // Mock privacy mode deactivation
  }

  getSupportedNetworks(chainType: ChainType): string[] {
    // Return supported blockchain names for EVM chains, network types for others
    if (chainType === 'ethereum') {
      return ['ethereum', 'polygon', 'arbitrum', 'optimism', 'base', 'bsc', 'avalanche', 'fantom', 'gnosis', 'harmony', 'moonbeam', 'celo'];
    }
    const chainConfig = this.getChainConfig(chainType);
    return chainConfig?.networks || [];
  }

  async sendTransaction(to: string, amount: string, chainType?: ChainType, data?: string): Promise<string> {
    const activeChain = chainType || this.activeChain;
    
    // Bitcoin transactions are now supported
    if (activeChain === 'bitcoin') {
      return 'mockBitcoinTxId';
    }
    
    // Return appropriate transaction hash format based on chain
    if (activeChain === 'solana') {
      return 'mockTxId';
    } else {
      // Ethereum-like chains
      return '0x' + '1'.repeat(64);
    }
  }

  async getGasPrice(): Promise<string> {
    return '30000000000'; // 30 gwei
  }

  getNetworkDetails(networkName: string): any {
    // Mock network details for different networks
    const networkDetails = {
      ethereum: { name: 'Ethereum', chainId: 1, rpcUrl: 'https://mainnet.infura.io', explorer: 'https://etherscan.io' },
      polygon: { name: 'Polygon', chainId: 137, rpcUrl: 'https://polygon-rpc.com', explorer: 'https://polygonscan.com' },
      arbitrum: { name: 'Arbitrum', chainId: 42161, rpcUrl: 'https://arb1.arbitrum.io/rpc', explorer: 'https://arbiscan.io' },
      optimism: { name: 'Optimism', chainId: 10, rpcUrl: 'https://mainnet.optimism.io', explorer: 'https://optimistic.etherscan.io' },
      base: { name: 'Base', chainId: 8453, rpcUrl: 'https://mainnet.base.org', explorer: 'https://basescan.org' }
    };
    
    return networkDetails[networkName] || {
      name: 'Mock Network',
      chainId: 1337,
      rpcUrl: 'https://mock.example.com',
      explorer: 'https://explorer.mock.example.com'
    };
  }

  async getNetworkDetailsAsync(chainType: ChainType, networkType: NetworkType): Promise<any> {
    return {
      name: 'Mock Network',
      chainId: 1337,
      rpcUrl: 'https://mock.example.com',
      explorerUrl: 'https://explorer.mock.example.com'
    };
  }
}

// Export singleton instance
export const providerManager = ProviderManager.getInstance();