/**
 * NFT Service for Wallet Module
 * 
 * Integrates NFT functionality from Bazaar module with wallet-specific features.
 * Uses OmniBazaar validators as primary data source via OmniProvider.
 */

import { NFTManager } from './NFTManager';
import { NFT as WalletNFT } from './types';
import { createNFTProvider, createAllNFTProviders, type ProviderConfig } from './providers/provider-factory';
import type { ChainProvider } from './display/multi-chain-display';

// Import types from Bazaar if available
export interface NFTServiceConfig {
  useOmniProvider?: boolean;
  validatorUrl?: string;
  apiKeys?: {
    alchemy?: string;
    moralis?: string;
    opensea?: string;
    quicknode?: string;
    infura?: string;
  };
}

/**
 * Unified NFT Service for Wallet
 * 
 * @example
 * ```typescript
 * const nftService = NFTService.getInstance();
 * 
 * // Get NFTs for active account
 * const nfts = await nftService.getActiveAccountNFTs();
 * 
 * // Get NFTs for specific chain
 * const ethNfts = await nftService.getNFTsForChain(address, 1);
 * ```
 */
export class NFTService {
  private static instance: NFTService;
  private nftManager: NFTManager;
  private providers: Map<number, ChainProvider>;
  private config: NFTServiceConfig;
  private isInitialized = false;

  private constructor(config: NFTServiceConfig = {}) {
    this.config = {
      useOmniProvider: true, // Default to using OmniBazaar validators
      ...config
    };
    
    // Initialize NFT Manager
    this.nftManager = new NFTManager(config.apiKeys);
    
    // Initialize providers with OmniProvider by default
    this.providers = createAllNFTProviders({
      useOmniProvider: this.config.useOmniProvider,
      validatorUrl: this.config.validatorUrl,
      apiKeys: this.config.apiKeys
    });
  }

  /**
   * Get singleton instance
   */
  public static getInstance(config?: NFTServiceConfig): NFTService {
    if (!NFTService.instance) {
      NFTService.instance = new NFTService(config);
    }
    return NFTService.instance;
  }

  /**
   * Initialize the service
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Initialize all providers
    for (const provider of this.providers.values()) {
      if ('initialize' in provider && typeof provider.initialize === 'function') {
        await provider.initialize();
      }
    }

    this.isInitialized = true;
    console.log('NFTService initialized with', this.providers.size, 'chain providers');
    console.log('Using OmniProvider:', this.config.useOmniProvider);
  }

  /**
   * Get NFTs for the active account across all chains
   */
  public async getActiveAccountNFTs(): Promise<WalletNFT[]> {
    return this.nftManager.getActiveAccountNFTs();
  }

  /**
   * Get NFTs for a specific address across all chains
   */
  public async getNFTs(address: string): Promise<WalletNFT[]> {
    return this.nftManager.getNFTs(address);
  }

  /**
   * Get NFTs for a specific chain
   */
  public async getNFTsForChain(address: string, chainId: number): Promise<any[]> {
    const provider = this.providers.get(chainId);
    if (!provider) {
      console.warn(`No provider available for chain ${chainId}`);
      return [];
    }

    try {
      return await provider.getNFTs(address);
    } catch (error) {
      console.error(`Error fetching NFTs for chain ${chainId}:`, error);
      return [];
    }
  }

  /**
   * Get NFT metadata
   */
  public async getNFTMetadata(
    contractAddress: string,
    tokenId: string,
    chainId: number = 1
  ): Promise<any | null> {
    const provider = this.providers.get(chainId);
    if (!provider) {
      console.warn(`No provider available for chain ${chainId}`);
      return null;
    }

    try {
      return await provider.getNFTMetadata(contractAddress, tokenId);
    } catch (error) {
      console.error(`Error fetching NFT metadata:`, error);
      return null;
    }
  }

  /**
   * Get collections for an address
   */
  public async getCollections(address: string, chainId?: number): Promise<any[]> {
    if (chainId !== undefined) {
      const provider = this.providers.get(chainId);
      if (provider) {
        return provider.getCollections(address);
      }
      return [];
    }

    // Get collections from all chains
    const allCollections = [];
    for (const provider of this.providers.values()) {
      try {
        const collections = await provider.getCollections(address);
        allCollections.push(...collections);
      } catch (error) {
        console.warn('Error fetching collections:', error);
      }
    }

    return allCollections;
  }

  /**
   * Transfer NFT
   */
  public async transferNFT(params: {
    contractAddress: string;
    tokenId: string;
    from: string;
    to: string;
    chainId: number;
  }): Promise<{ success: boolean; txHash?: string; error?: string }> {
    return this.nftManager.transferNFT({
      ...params,
      chainType: this.getChainType(params.chainId)
    });
  }

  /**
   * List NFT for sale
   */
  public async listNFT(params: {
    contractAddress: string;
    tokenId: string;
    price: string;
    chainId: number;
  }): Promise<{ success: boolean; listingId?: string; error?: string }> {
    // This would integrate with the marketplace
    console.log('Listing NFT:', params);
    
    // For now, return success
    return {
      success: true,
      listingId: `listing_${Date.now()}`
    };
  }

  /**
   * Buy NFT
   */
  public async buyNFT(params: {
    contractAddress: string;
    tokenId: string;
    price: string;
    chainId: number;
  }): Promise<{ success: boolean; txHash?: string; error?: string }> {
    console.log('Buying NFT:', params);
    
    // This would integrate with the marketplace
    return {
      success: true,
      txHash: '0x' + Array(64).fill(0).map(() => 
        Math.floor(Math.random() * 16).toString(16)
      ).join('')
    };
  }

  /**
   * Get trending NFTs
   */
  public async getTrendingNFTs(chainId?: number): Promise<any[]> {
    if (chainId !== undefined) {
      const provider = this.providers.get(chainId);
      if (provider && 'getTrendingNFTs' in provider) {
        return (provider as any).getTrendingNFTs();
      }
      return [];
    }

    // Get trending from all chains
    const allTrending = [];
    for (const provider of this.providers.values()) {
      if ('getTrendingNFTs' in provider) {
        try {
          const trending = await (provider as any).getTrendingNFTs();
          allTrending.push(...trending);
        } catch (error) {
          console.warn('Error fetching trending NFTs:', error);
        }
      }
    }

    return allTrending;
  }

  /**
   * Check if using OmniProvider
   */
  public isUsingOmniProvider(): boolean {
    return this.config.useOmniProvider === true;
  }

  /**
   * Switch between OmniProvider and external APIs
   */
  public async switchProvider(useOmniProvider: boolean): Promise<void> {
    this.config.useOmniProvider = useOmniProvider;
    
    // Recreate providers with new configuration
    this.providers = createAllNFTProviders({
      useOmniProvider,
      validatorUrl: this.config.validatorUrl,
      apiKeys: this.config.apiKeys
    });
    
    // Reinitialize
    this.isInitialized = false;
    await this.initialize();
    
    console.log('Switched to', useOmniProvider ? 'OmniProvider' : 'External APIs');
  }

  /**
   * Get supported chains
   */
  public getSupportedChains(): Array<{ chainId: number; name: string }> {
    return [
      { chainId: 1, name: 'Ethereum' },
      { chainId: 137, name: 'Polygon' },
      { chainId: 56, name: 'Binance Smart Chain' },
      { chainId: 43114, name: 'Avalanche' },
      { chainId: 42161, name: 'Arbitrum' },
      { chainId: 10, name: 'Optimism' },
      { chainId: 8453, name: 'Base' }
    ];
  }

  /**
   * Helper to convert chain ID to chain type
   */
  private getChainType(chainId: number): 'ethereum' | 'solana' {
    // All EVM chains are 'ethereum' type
    // Solana would have its own chain ID range
    return chainId < 1000000 ? 'ethereum' : 'solana';
  }
}