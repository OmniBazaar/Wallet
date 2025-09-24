/**
 * Mock ProviderManager for testing
 *
 * This mock implementation provides all the methods from the real ProviderManager
 * but with mocked behavior for testing purposes.
 */

import { ethers } from 'ethers';
import { ChainType } from '../../src/core/keyring/BIP39Keyring';
import type { NetworkType, ProviderType, ChainConfig } from '../../src/core/providers/ProviderManager';
import { SUPPORTED_CHAINS } from '../../src/core/providers/ProviderManager';
import { TestProviderFactory, type MockProvider } from './provider-factory';

/**
 * Mock ProviderManager implementation
 */
export class MockProviderManager {
  private providers: Map<ChainType, ProviderType> = new Map();
  private evmProviders: Map<string, MockProvider> = new Map();
  private activeChain: ChainType = ChainType.ETHEREUM;
  private activeNetwork = 'ethereum';
  private networkType: NetworkType = 'mainnet';
  private initialized = false;

  // Mock methods to control behavior
  public mockBalances = new Map<string, string>();
  public mockTransactionResponses = new Map<string, string>();

  constructor() {
    // Auto-initialize with mock providers
    this.initialize('testnet');
  }

  /**
   * Initialize mock providers
   */
  initialize(networkOrType: string = 'mainnet'): void {
    if (this.initialized) {
      return;
    }

    this.networkType = (networkOrType === 'mainnet' || networkOrType === 'testnet')
      ? networkOrType as NetworkType
      : 'mainnet';

    // Create mock providers for each chain
    const mockEthProvider = TestProviderFactory.createOmniCoinProvider() as MockProvider;
    this.providers.set(ChainType.ETHEREUM, mockEthProvider as unknown as ProviderType);

    // Create mock EVM providers
    const evmNetworks = ['ethereum', 'polygon', 'arbitrum', 'optimism', 'base', 'bsc', 'avalanche'];
    evmNetworks.forEach(network => {
      const mockProvider = TestProviderFactory.createOmniCoinProvider() as MockProvider;
      this.evmProviders.set(network, mockProvider);
    });

    this.initialized = true;
  }

  /**
   * Reset the provider manager for testing
   */
  reset(): void {
    this.providers.clear();
    this.evmProviders.clear();
    this.activeChain = ChainType.ETHEREUM;
    this.activeNetwork = 'ethereum';
    this.networkType = 'mainnet';
    this.initialized = false;
    this.mockBalances.clear();
    this.mockTransactionResponses.clear();
  }

  /**
   * Force re-initialization for testing
   */
  reinitialize(networkType: NetworkType): void {
    this.reset();
    this.initialize(networkType);
  }

  /**
   * Force re-initialization with specific network for testing
   */
  reinitializeWithNetwork(networkOrType: string): void {
    this.reset();
    this.initialize(networkOrType);
  }

  /**
   * Get provider for a specific chain type
   */
  getProvider(chainType: ChainType): ProviderType | null {
    const provider = this.providers.get(chainType);
    if (!provider && this.providers.size === 0) {
      throw new Error('Provider not found');
    }
    return provider || null;
  }

  /**
   * Get an EVM provider for a specific network
   */
  getEVMProvider(networkKey: string): MockProvider | null {
    return this.evmProviders.get(networkKey) || null;
  }

  /**
   * Switch the active EVM network
   */
  switchEVMNetwork(networkKey: string): void {
    if (!this.evmProviders.has(networkKey)) {
      // Create a new mock provider for this network
      const mockProvider = TestProviderFactory.createOmniCoinProvider() as MockProvider;
      this.evmProviders.set(networkKey, mockProvider);
    }

    this.activeNetwork = networkKey;
    this.activeChain = ChainType.ETHEREUM;
  }

  /**
   * Get list of available EVM networks
   */
  getAvailableEVMNetworks(): string[] {
    return Array.from(this.evmProviders.keys());
  }

  /**
   * Get all supported EVM networks
   */
  static getSupportedEVMNetworks(): string[] {
    return ['ethereum', 'polygon', 'arbitrum', 'optimism', 'base', 'bsc', 'avalanche', 'solana'];
  }

  /**
   * Get the currently active provider
   */
  getActiveProvider(): ProviderType | null {
    if (this.activeChain === ChainType.ETHEREUM && this.activeNetwork !== 'ethereum') {
      const provider = this.evmProviders.get(this.activeNetwork);
      return provider as unknown as ProviderType || null;
    }
    return this.getProvider(this.activeChain);
  }

  /**
   * Get active chain type
   */
  getActiveChain(): ChainType {
    return this.activeChain;
  }

  /**
   * Get active network
   */
  getActiveNetwork(): string {
    return this.activeNetwork;
  }

  /**
   * Switch to a different chain
   */
  switchChain(chainType: ChainType): void {
    this.setActiveChain(chainType);
  }

  /**
   * Get all supported chains
   */
  getSupportedChains(): ChainType[] {
    return Object.keys(SUPPORTED_CHAINS) as ChainType[];
  }

  /**
   * Get supported networks for a chain
   */
  getSupportedNetworks(chainType: ChainType): string[] {
    const chainConfig = SUPPORTED_CHAINS[chainType];
    if (!chainConfig) return [];

    if (chainType === ChainType.ETHEREUM) {
      return ['ethereum', 'polygon', 'arbitrum', 'optimism', 'base', 'bsc', 'avalanche'];
    }

    return chainConfig.networks;
  }

  /**
   * Get chain configuration
   */
  getChainConfig(chainType: ChainType): ChainConfig | null {
    return SUPPORTED_CHAINS[chainType] ?? null;
  }

  /**
   * Get network details
   */
  getNetworkDetails(networkOrChain: string): {
    chainId?: number;
    name: string;
    shortName?: string;
    currency?: string;
    rpcUrl?: string;
    explorer?: string;
    nativeCurrency: { symbol: string; decimals: number };
  } {
    // Mock network details
    const networks: Record<string, any> = {
      ethereum: {
        chainId: 1,
        name: 'Ethereum Mainnet',
        shortName: 'eth',
        currency: 'ETH',
        rpcUrl: 'https://mainnet.infura.io/v3/YOUR-PROJECT-ID',
        explorer: 'https://etherscan.io',
        nativeCurrency: { symbol: 'ETH', decimals: 18 }
      },
      polygon: {
        chainId: 137,
        name: 'Polygon Mainnet',
        shortName: 'matic',
        currency: 'MATIC',
        rpcUrl: 'https://polygon-rpc.com',
        explorer: 'https://polygonscan.com',
        nativeCurrency: { symbol: 'MATIC', decimals: 18 }
      },
      arbitrum: {
        chainId: 42161,
        name: 'Arbitrum One',
        currency: 'ETH',
        nativeCurrency: { symbol: 'ETH', decimals: 18 }
      },
      optimism: {
        chainId: 10,
        name: 'Optimism',
        currency: 'ETH',
        nativeCurrency: { symbol: 'ETH', decimals: 18 }
      },
      base: {
        chainId: 8453,
        name: 'Base',
        currency: 'ETH',
        nativeCurrency: { symbol: 'ETH', decimals: 18 }
      },
      bsc: {
        chainId: 56,
        name: 'BNB Smart Chain',
        currency: 'BNB',
        nativeCurrency: { symbol: 'BNB', decimals: 18 }
      },
      avalanche: {
        chainId: 43114,
        name: 'Avalanche',
        currency: 'AVAX',
        nativeCurrency: { symbol: 'AVAX', decimals: 18 }
      },
      solana: {
        name: 'Solana Mainnet',
        nativeCurrency: { symbol: 'SOL', decimals: 9 }
      },
      bitcoin: {
        name: 'Bitcoin Mainnet',
        nativeCurrency: { symbol: 'BTC', decimals: 8 }
      }
    };

    const network = networks[networkOrChain];
    if (!network) {
      throw new Error(`Network not found: ${networkOrChain}`);
    }

    return network;
  }

  /**
   * Set active chain
   */
  setActiveChain(chainType: ChainType): void {
    const chainConfig = SUPPORTED_CHAINS[chainType];
    if (!chainConfig) {
      throw new Error(`Unsupported chain: ${chainType}`);
    }
    this.activeChain = chainType;
  }

  /**
   * Get network type
   */
  getNetworkType(): NetworkType {
    return this.networkType;
  }

  /**
   * Switch network type
   */
  switchNetworkType(networkType: NetworkType): void {
    this.networkType = networkType;
  }

  /**
   * Get balance (mocked)
   */
  async getBalance(chainType?: ChainType): Promise<string> {
    const chain = chainType ?? this.activeChain;
    const mockKey = `${chain}-balance`;

    // Return mocked balance if set
    if (this.mockBalances.has(mockKey)) {
      return this.mockBalances.get(mockKey)!;
    }

    // Default balances by chain
    switch (chain) {
      case ChainType.ETHEREUM:
        return '1000000000000000000'; // 1 ETH in wei
      case ChainType.SOLANA:
        return '1000000000'; // 1 SOL in lamports
      case ChainType.BITCOIN:
        return '100000000'; // 1 BTC in satoshis
      default:
        return '1000000000000000000'; // Default 1 token
    }
  }

  /**
   * Get all balances (mocked)
   */
  async getAllBalances(): Promise<Record<ChainType, string>> {
    const balances: Record<ChainType, string> = {} as Record<ChainType, string>;

    for (const chainType of Object.keys(SUPPORTED_CHAINS) as ChainType[]) {
      balances[chainType] = await this.getBalance(chainType);
    }

    return balances;
  }

  /**
   * Send transaction (mocked)
   */
  async sendTransaction(
    to: string,
    amount: string,
    chainType?: ChainType,
    data?: string
  ): Promise<ethers.TransactionResponse | string> {
    const chain = chainType ?? this.activeChain;
    const mockKey = `${chain}-${to}-${amount}`;

    // Return mocked transaction response if set
    if (this.mockTransactionResponses.has(mockKey)) {
      return this.mockTransactionResponses.get(mockKey)!;
    }

    // Return mock transaction hash
    return '0x' + '1'.repeat(64);
  }

  /**
   * Sign message (mocked)
   */
  async signMessage(message: string, chainType?: ChainType): Promise<string> {
    return '0xMockedSignature_' + message.substring(0, 10);
  }

  /**
   * Get current network details
   */
  getCurrentNetworkDetails(): {
    name: string;
    chainId: number;
    nativeCurrency: {
      name: string;
      symbol: string;
      decimals: number;
    };
  } {
    try {
      const details = this.getNetworkDetails(this.activeNetwork);
      return {
        name: details.name,
        chainId: details.chainId || 1,
        nativeCurrency: {
          name: details.nativeCurrency.symbol,
          symbol: details.nativeCurrency.symbol,
          decimals: details.nativeCurrency.decimals
        }
      };
    } catch {
      // Fallback for unknown networks
      return {
        name: 'Test Network',
        chainId: 1337,
        nativeCurrency: {
          name: 'TEST',
          symbol: 'TEST',
          decimals: 18
        }
      };
    }
  }

  /**
   * Get formatted balance (mocked)
   */
  async getFormattedBalance(_address?: string, _includePrivate = false): Promise<string> {
    return await this.getBalance(this.activeChain);
  }

  /**
   * Estimate gas (mocked)
   */
  async estimateGas(to: string, amount: string, data?: string): Promise<string> {
    return '21000'; // Standard gas estimate
  }

  /**
   * Get transaction history (mocked)
   */
  async getTransactionHistory(
    address?: string,
    chainType?: ChainType,
    limit = 10
  ): Promise<unknown[]> {
    // Return empty array for mock
    return [];
  }

  /**
   * Enable privacy mode (mocked)
   */
  enablePrivacyMode(chainType: ChainType): void {
    // Mock implementation
  }

  /**
   * Disable privacy mode (mocked)
   */
  disablePrivacyMode(chainType: ChainType): void {
    // Mock implementation
  }

  /**
   * Get chain features
   */
  getChainFeatures(chainType: ChainType): ChainConfig['features'] {
    const chainConfig = SUPPORTED_CHAINS[chainType];
    return chainConfig?.features ?? {};
  }

  /**
   * Check if feature is supported
   */
  isFeatureSupported(chainType: ChainType, feature: keyof ChainConfig['features']): boolean {
    const features = this.getChainFeatures(chainType);
    return features[feature] === true;
  }

  /**
   * Get gas price (mocked)
   */
  async getGasPrice(): Promise<string> {
    return '30000000000'; // 30 gwei
  }

  /**
   * Mock-specific methods for testing
   */

  /**
   * Set a mock balance for testing
   */
  setMockBalance(chainType: ChainType, balance: string): void {
    this.mockBalances.set(`${chainType}-balance`, balance);
  }

  /**
   * Set a mock transaction response for testing
   */
  setMockTransactionResponse(chain: ChainType, to: string, amount: string, response: string): void {
    this.mockTransactionResponses.set(`${chain}-${to}-${amount}`, response);
  }

  /**
   * Get the underlying mock provider for a chain
   */
  getMockProvider(chainType: ChainType): MockProvider | null {
    if (chainType === ChainType.ETHEREUM && this.activeNetwork !== 'ethereum') {
      return this.evmProviders.get(this.activeNetwork) || null;
    }
    const provider = this.providers.get(chainType);
    return provider as unknown as MockProvider || null;
  }
}

/**
 * Create a mock ProviderManager instance
 */
export function createMockProviderManager(): any {
  const instance = new MockProviderManager();
  return instance;
}

// Export the class as well for typing
export { MockProviderManager };