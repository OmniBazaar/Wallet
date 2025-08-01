/**
 * ProviderManager - Unified provider management for all supported chains
 * 
 * This manager handles provider initialization, switching, and access
 * for all supported blockchains in the OmniBazaar wallet.
 */

import { ethers } from 'ethers';
import { LiveEthereumProvider, ETHEREUM_NETWORKS } from '../chains/ethereum/live-provider';
import { LiveCOTIProvider, COTI_NETWORKS } from '../chains/coti/live-provider';
import { LiveOmniCoinProvider, OMNICOIN_NETWORKS } from '../chains/omnicoin/live-provider';
import { keyringService, ChainType } from '../keyring/KeyringService';

export type NetworkType = 'mainnet' | 'testnet';
export type ProviderType = LiveEthereumProvider | LiveCOTIProvider | LiveOmniCoinProvider;

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

export const SUPPORTED_CHAINS: Record<ChainType, ChainConfig> = {
  ethereum: {
    chainType: 'ethereum',
    name: 'Ethereum',
    icon: 'ethereum',
    networks: Object.keys(ETHEREUM_NETWORKS),
    defaultNetwork: 'mainnet',
    features: {
      nft: true,
      defi: true
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
    networks: ['mainnet', 'devnet'],
    defaultNetwork: 'mainnet',
    features: {
      nft: true,
      defi: true
    }
  },
  coti: {
    chainType: 'coti',
    name: 'COTI',
    icon: 'coti',
    networks: Object.keys(COTI_NETWORKS),
    defaultNetwork: 'testnet',
    features: {
      privacy: true
    }
  },
  omnicoin: {
    chainType: 'omnicoin',
    name: 'OmniCoin',
    icon: 'omnicoin',
    networks: Object.keys(OMNICOIN_NETWORKS),
    defaultNetwork: 'testnet',
    features: {
      privacy: true,
      staking: true,
      marketplace: true,
      nft: true
    }
  }
};

export class ProviderManager {
  private static instance: ProviderManager;
  private providers: Map<ChainType, ProviderType> = new Map();
  private activeChain: ChainType = 'ethereum';
  private networkType: NetworkType = 'mainnet';
  private initialized: boolean = false;
  
  private constructor() {}

  public static getInstance(): ProviderManager {
    if (!ProviderManager.instance) {
      ProviderManager.instance = new ProviderManager();
    }
    return ProviderManager.instance;
  }

  /**
   * Initialize all providers
   */
  async initialize(networkType: NetworkType = 'mainnet'): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.networkType = networkType;

    try {
      // Initialize Ethereum provider
      const ethProvider = new LiveEthereumProvider(
        networkType === 'mainnet' ? 'mainnet' : 'sepolia'
      );
      this.providers.set('ethereum', ethProvider);

      // Initialize COTI provider
      const cotiProvider = new LiveCOTIProvider(networkType);
      this.providers.set('coti', cotiProvider);

      // Initialize OmniCoin provider
      const omniProvider = new LiveOmniCoinProvider(networkType);
      this.providers.set('omnicoin', omniProvider);

      // TODO: Initialize Bitcoin and Solana providers when implemented

      this.initialized = true;
    } catch (error) {
      console.error('Error initializing providers:', error);
      throw error;
    }
  }

  /**
   * Get provider for specific chain
   */
  getProvider(chainType: ChainType): ProviderType | null {
    return this.providers.get(chainType) || null;
  }

  /**
   * Get active provider
   */
  getActiveProvider(): ProviderType | null {
    return this.providers.get(this.activeChain) || null;
  }

  /**
   * Get active chain
   */
  getActiveChain(): ChainType {
    return this.activeChain;
  }

  /**
   * Set active chain
   */
  async setActiveChain(chainType: ChainType): Promise<void> {
    if (!SUPPORTED_CHAINS[chainType]) {
      throw new Error(`Unsupported chain: ${chainType}`);
    }

    this.activeChain = chainType;

    // Update active account in keyring
    const accounts = await keyringService.getAccounts(chainType);
    if (accounts.length > 0) {
      keyringService.setActiveAccount(accounts[0].address);
    }
  }

  /**
   * Get network type (mainnet/testnet)
   */
  getNetworkType(): NetworkType {
    return this.networkType;
  }

  /**
   * Switch network type
   */
  async switchNetworkType(networkType: NetworkType): Promise<void> {
    this.networkType = networkType;

    // Switch all providers to new network type
    const ethProvider = this.providers.get('ethereum') as LiveEthereumProvider;
    if (ethProvider) {
      await ethProvider.switchNetwork(networkType === 'mainnet' ? 'mainnet' : 'sepolia');
    }

    const cotiProvider = this.providers.get('coti') as LiveCOTIProvider;
    if (cotiProvider) {
      await cotiProvider.switchNetwork(networkType);
    }

    const omniProvider = this.providers.get('omnicoin') as LiveOmniCoinProvider;
    if (omniProvider) {
      await omniProvider.switchNetwork(networkType);
    }
  }

  /**
   * Get balance for active account
   */
  async getBalance(chainType?: ChainType): Promise<string> {
    const chain = chainType || this.activeChain;
    const provider = this.getProvider(chain);
    
    if (!provider) {
      throw new Error(`No provider for chain: ${chain}`);
    }

    try {
      switch (chain) {
        case 'ethereum': {
          const ethProvider = provider as LiveEthereumProvider;
          return await ethProvider.getFormattedBalance();
        }
        
        case 'coti': {
          const cotiProvider = provider as LiveCOTIProvider;
          const balances = await cotiProvider.getFormattedBalance(undefined, true);
          return balances.private 
            ? `Public: ${balances.public}, Private: ${balances.private}`
            : balances.public;
        }
        
        case 'omnicoin': {
          const omniProvider = provider as LiveOmniCoinProvider;
          const balances = await omniProvider.getFormattedBalance(undefined, true);
          let result = `XOM: ${balances.public}`;
          if (balances.private) result += `, XOMP: ${balances.private}`;
          if (balances.staked) result += `, Staked: ${balances.staked}`;
          return result;
        }
        
        default:
          return '0';
      }
    } catch (error) {
      console.error(`Error getting balance for ${chain}:`, error);
      return '0';
    }
  }

  /**
   * Get all balances for active account
   */
  async getAllBalances(): Promise<Record<ChainType, string>> {
    const balances: Record<ChainType, string> = {} as any;

    for (const chainType of Object.keys(SUPPORTED_CHAINS) as ChainType[]) {
      try {
        balances[chainType] = await this.getBalance(chainType);
      } catch (error) {
        console.error(`Error getting balance for ${chainType}:`, error);
        balances[chainType] = '0';
      }
    }

    return balances;
  }

  /**
   * Send transaction
   */
  async sendTransaction(
    to: string,
    amount: string,
    chainType?: ChainType,
    data?: string
  ): Promise<ethers.providers.TransactionResponse> {
    const chain = chainType || this.activeChain;
    const provider = this.getProvider(chain);
    
    if (!provider) {
      throw new Error(`No provider for chain: ${chain}`);
    }

    // Parse amount based on chain decimals
    let value: ethers.BigNumber;
    switch (chain) {
      case 'omnicoin':
      case 'coti':
        // 6 decimals
        value = ethers.utils.parseUnits(amount, 6);
        break;
      default:
        // 18 decimals
        value = ethers.utils.parseEther(amount);
    }

    const transaction = {
      to,
      value: value.toString(),
      data: data || '0x'
    };

    switch (chain) {
      case 'ethereum': {
        const ethProvider = provider as LiveEthereumProvider;
        return await ethProvider.sendTransaction(transaction);
      }
      
      case 'coti': {
        const cotiProvider = provider as LiveCOTIProvider;
        return await cotiProvider.sendTransaction(transaction);
      }
      
      case 'omnicoin': {
        const omniProvider = provider as LiveOmniCoinProvider;
        const signer = await omniProvider.getSigner();
        return await signer.sendTransaction(transaction);
      }
      
      default:
        throw new Error(`Transaction not supported for chain: ${chain}`);
    }
  }

  /**
   * Sign message
   */
  async signMessage(message: string, chainType?: ChainType): Promise<string> {
    const chain = chainType || this.activeChain;
    const activeAccount = keyringService.getActiveAccount();
    
    if (!activeAccount || activeAccount.chainType !== chain) {
      throw new Error(`No active account for chain: ${chain}`);
    }

    return await keyringService.signMessage(activeAccount.address, message);
  }

  /**
   * Get transaction history
   */
  async getTransactionHistory(
    address?: string,
    chainType?: ChainType,
    limit: number = 10
  ): Promise<any[]> {
    const chain = chainType || this.activeChain;
    const provider = this.getProvider(chain);
    
    if (!provider) {
      throw new Error(`No provider for chain: ${chain}`);
    }

    // This would typically use an indexing service or block explorer API
    // For now, return empty array
    console.warn('Transaction history not yet implemented');
    return [];
  }

  /**
   * Enable privacy mode for supported chains
   */
  async enablePrivacyMode(chainType: ChainType): Promise<void> {
    const provider = this.getProvider(chainType);
    
    if (chainType === 'coti') {
      const cotiProvider = provider as LiveCOTIProvider;
      cotiProvider.setPrivacyMode(true);
    } else if (chainType === 'omnicoin') {
      const omniProvider = provider as LiveOmniCoinProvider;
      omniProvider.setPrivacyMode(true);
    } else {
      throw new Error(`Privacy mode not supported for chain: ${chainType}`);
    }
  }

  /**
   * Disable privacy mode
   */
  async disablePrivacyMode(chainType: ChainType): Promise<void> {
    const provider = this.getProvider(chainType);
    
    if (chainType === 'coti') {
      const cotiProvider = provider as LiveCOTIProvider;
      cotiProvider.setPrivacyMode(false);
    } else if (chainType === 'omnicoin') {
      const omniProvider = provider as LiveOmniCoinProvider;
      omniProvider.setPrivacyMode(false);
    }
  }

  /**
   * Get supported features for a chain
   */
  getChainFeatures(chainType: ChainType): ChainConfig['features'] {
    return SUPPORTED_CHAINS[chainType]?.features || {};
  }

  /**
   * Check if a feature is supported
   */
  isFeatureSupported(chainType: ChainType, feature: keyof ChainConfig['features']): boolean {
    const features = this.getChainFeatures(chainType);
    return !!features[feature];
  }
}

// Export singleton instance
export const providerManager = ProviderManager.getInstance();