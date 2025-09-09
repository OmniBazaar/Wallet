/**
 * NFTService - Wrapper for Core NFT Service
 * 
 * Provides a simplified interface to the core NFT functionality,
 * integrating with the wallet service infrastructure.
 */

import { NFTService as CoreNFTService, NFTServiceConfig } from '../core/nft/NFTService';

/**
 * NFT service wrapper
 * Provides simplified access to core NFT functionality
 */
export class NFTService {
  private coreService: CoreNFTService;
  private isInitialized = false;

  /**
   * Creates a new NFTService instance
   * @param wallet - Wallet instance (optional)
   * @param config - NFT service configuration (optional)
   */
  constructor(wallet?: any, config?: NFTServiceConfig) {
    this.coreService = new CoreNFTService(wallet, config);
  }

  /**
   * Initialize the NFT service
   * @throws {Error} When initialization fails
   */
  async init(): Promise<void> {
    try {
      if (this.isInitialized) {
        return;
      }

      if (typeof this.coreService.initialize === 'function') {
        await this.coreService.initialize();
      }
      this.isInitialized = true;
      // console.log('NFTService wrapper initialized');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to initialize NFT service: ${errorMessage}`);
    }
  }

  /**
   * Initialize the NFT service (alias for init)
   * @throws {Error} When initialization fails
   */
  async initialize(): Promise<void> {
    return this.init();
  }

  /**
   * Check if service is initialized
   * @returns Initialization status
   */
  isNFTServiceInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Get NFTs for the active account across all chains
   * @returns Array of NFTs
   */
  async getActiveAccountNFTs(): Promise<any[]> {
    return await this.coreService.getActiveAccountNFTs();
  }

  /**
   * Get NFTs for a specific address across all chains
   * @param address - Wallet address
   * @returns Array of NFTs
   */
  async getNFTs(address: string): Promise<any[]> {
    return await this.coreService.getNFTs(address);
  }

  /**
   * Get NFTs for a specific chain
   * @param address - Wallet address
   * @param chainId - Chain ID
   * @returns Array of NFTs
   */
  async getNFTsForChain(address: string, chainId: number): Promise<any[]> {
    return await this.coreService.getNFTsForChain(address, chainId);
  }

  /**
   * Get NFT metadata
   * @param contractAddress - Contract address
   * @param tokenId - Token ID
   * @param chainId - Chain ID (optional)
   * @returns NFT metadata
   */
  async getNFTMetadata(
    contractAddress: string,
    tokenId: string,
    chainId: number = 1
  ): Promise<any | null> {
    return await this.coreService.getNFTMetadata(contractAddress, tokenId, chainId);
  }

  /**
   * Get collections for an address
   * @param address - Wallet address
   * @param chainId - Chain ID (optional)
   * @returns Array of collections
   */
  async getCollections(address: string, chainId?: number): Promise<any[]> {
    return await this.coreService.getCollections(address, chainId);
  }

  /**
   * Transfer NFT
   * @param params - Transfer parameters
   * @param params.contractAddress
   * @param params.tokenId
   * @param params.from
   * @param params.to
   * @param params.chainId
   * @returns Transfer result
   */
  async transferNFT(params: {
    contractAddress: string;
    tokenId: string;
    from: string;
    to: string;
    chainId: number;
  }): Promise<{ success: boolean; txHash?: string; error?: string }> {
    return await this.coreService.transferNFT(params);
  }

  /**
   * List NFT for sale
   * @param params - Listing parameters
   * @param params.contractAddress
   * @param params.tokenId
   * @param params.price
   * @param params.chainId
   * @returns Listing result
   */
  async listNFT(params: {
    contractAddress: string;
    tokenId: string;
    price: string;
    chainId: number;
  }): Promise<{ success: boolean; listingId?: string; error?: string }> {
    return await this.coreService.listNFT(params);
  }

  /**
   * Mint NFT
   * @param params - Mint parameters
   * @param params.name
   * @param params.description
   * @param params.image
   * @param params.attributes
   * @param params.recipient
   * @param params.chainId
   * @returns Mint result
   */
  async mintNFT(params: {
    name: string;
    description: string;
    image: string;
    attributes?: Array<{ trait_type: string; value: string | number }>;
    recipient?: string;
    chainId?: number;
  }): Promise<{ success: boolean; tokenId?: string; transactionHash?: string; error?: string }> {
    return await this.coreService.mintNFT(params);
  }

  /**
   * Buy NFT
   * @param params - Buy parameters
   * @param params.contractAddress
   * @param params.tokenId
   * @param params.price
   * @param params.chainId
   * @returns Buy result
   */
  async buyNFT(params: {
    contractAddress: string;
    tokenId: string;
    price: string;
    chainId: number;
  }): Promise<{ success: boolean; txHash?: string; error?: string }> {
    return await this.coreService.buyNFT(params);
  }

  /**
   * Get trending NFTs
   * @param chainId - Chain ID (optional)
   * @returns Array of trending NFTs
   */
  async getTrendingNFTs(chainId?: number): Promise<any[]> {
    return await this.coreService.getTrendingNFTs(chainId);
  }

  /**
   * Get supported chains
   * @returns Array of supported chains
   */
  getSupportedChains(): Array<{ chainId: number; name: string }> {
    return this.coreService.getSupportedChains();
  }

  /**
   * Check if using OmniProvider
   * @returns OmniProvider status
   */
  isUsingOmniProvider(): boolean {
    return this.coreService.isUsingOmniProvider();
  }

  /**
   * Switch between OmniProvider and external APIs
   * @param useOmniProvider - Whether to use OmniProvider
   */
  async switchProvider(useOmniProvider: boolean): Promise<void> {
    return await this.coreService.switchProvider(useOmniProvider);
  }

  /**
   * Get NFTs for current user (alias for getActiveAccountNFTs)
   * @returns Array of NFTs
   */
  async getUserNFTs(): Promise<any[]> {
    return await this.getActiveAccountNFTs();
  }

  /**
   * Discover NFTs for the active account
   */
  async discoverNFTs(): Promise<void> {
    if (typeof this.coreService.discoverNFTs === 'function') {
      return await this.coreService.discoverNFTs();
    }
  }

  /**
   * Clear cache and reset data
   */
  async clearCache(): Promise<void> {
    if (typeof this.coreService.clearCache === 'function') {
      await this.coreService.clearCache();
    }
    // console.log('NFTService wrapper cache cleared');
  }

  /**
   * Cleanup service and release resources
   */
  async cleanup(): Promise<void> {
    try {
      if (typeof this.coreService.cleanup === 'function') {
        await this.coreService.cleanup();
      }
      this.isInitialized = false;
      // console.log('NFTService wrapper cleanup completed');
    } catch (error) {
      console.error('Error during NFTService cleanup:', error);
    }
  }
}