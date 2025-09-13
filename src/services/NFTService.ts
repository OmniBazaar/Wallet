/**
 * NFTService - Wrapper for Core NFT Service
 * 
 * Provides a simplified interface to the core NFT functionality,
 * integrating with the wallet service infrastructure.
 */

import { NFTService as CoreNFTService, NFTServiceConfig } from '../core/nft/NFTService';
import type { NFT as WalletNFT } from '../core/nft/types';

/**
 * Transfer result from NFT transfer operation
 */
export interface NFTTransferResult {
  /** Whether the transfer was successful */
  success: boolean;
  /** Transaction hash if successful */
  txHash?: string;
  /** Error message if failed */
  error?: string;
}

/**
 * Listing result from NFT listing operation
 */
export interface NFTListingResult {
  /** Whether the listing was successful */
  success: boolean;
  /** Listing ID if successful */
  listingId?: string;
  /** Error message if failed */
  error?: string;
}

/**
 * Mint result from NFT minting operation
 */
export interface NFTMintResult {
  /** Whether the mint was successful */
  success: boolean;
  /** Token ID if successful */
  tokenId?: string;
  /** Transaction hash if successful */
  transactionHash?: string;
  /** Error message if failed */
  error?: string;
}

/**
 * Supported chain information
 */
export interface SupportedChain {
  /** Chain ID */
  chainId: number;
  /** Chain name */
  name: string;
}

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
  constructor(wallet?: unknown, config?: NFTServiceConfig) {
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
   * @returns Promise that resolves when initialized
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
  async getActiveAccountNFTs(): Promise<WalletNFT[]> {
    return await this.coreService.getActiveAccountNFTs();
  }

  /**
   * Get NFTs for a specific address across all chains
   * @param address - Wallet address
   * @returns Array of NFTs
   */
  async getNFTs(address: string): Promise<WalletNFT[]> {
    return await this.coreService.getNFTs(address);
  }

  /**
   * Get NFTs for a specific chain
   * @param address - Wallet address
   * @param chainId - Chain ID
   * @returns Array of NFTs
   */
  async getNFTsForChain(address: string, chainId: number): Promise<unknown[]> {
    return await this.coreService.getNFTsForChain(address, chainId);
  }

  /**
   * Get NFT metadata
   * @param contractAddress - Contract address
   * @param tokenId - Token ID
   * @param chainId - Chain ID (optional)
   * @returns NFT metadata or null if not found
   */
  async getNFTMetadata(
    contractAddress: string,
    tokenId: string,
    chainId: number = 1
  ): Promise<WalletNFT | null> {
    return await this.coreService.getNFTMetadata(contractAddress, tokenId, chainId);
  }

  /**
   * Get collections for an address
   * @param address - Wallet address
   * @param chainId - Chain ID (optional)
   * @returns Array of collections
   */
  async getCollections(address: string, chainId?: number): Promise<unknown[]> {
    return await this.coreService.getCollections(address, chainId);
  }

  /**
   * Transfer NFT
   * @param params - Transfer parameters
   * @param params.contractAddress - NFT contract address
   * @param params.tokenId - Token ID to transfer
   * @param params.from - Current owner address
   * @param params.to - Recipient address
   * @param params.chainId - Chain ID where the NFT exists
   * @returns Transfer result
   */
  async transferNFT(params: {
    contractAddress: string;
    tokenId: string;
    from: string;
    to: string;
    chainId: number;
  }): Promise<NFTTransferResult> {
    return await this.coreService.transferNFT(params);
  }

  /**
   * List NFT for sale
   * @param params - Listing parameters
   * @param params.contractAddress - NFT contract address
   * @param params.tokenId - Token ID to list
   * @param params.price - Listing price in wei or smallest unit
   * @param params.chainId - Chain ID where the NFT exists
   * @returns Listing result
   */
  async listNFT(params: {
    contractAddress: string;
    tokenId: string;
    price: string;
    chainId: number;
  }): Promise<NFTListingResult> {
    return await this.coreService.listNFT(params);
  }

  /**
   * Mint NFT
   * @param params - Mint parameters
   * @param params.name - Name of the NFT
   * @param params.description - Description of the NFT
   * @param params.image - Image URL or IPFS hash
   * @param params.attributes - Array of NFT attributes
   * @param params.recipient - Address to mint to (defaults to sender)
   * @param params.chainId - Chain ID to mint on (defaults to current chain)
   * @returns Mint result
   */
  async mintNFT(params: {
    name: string;
    description: string;
    image: string;
    attributes?: Array<{ trait_type: string; value: string | number }>;
    recipient?: string;
    chainId?: number;
  }): Promise<NFTMintResult> {
    return await this.coreService.mintNFT(params);
  }

  /**
   * Buy NFT
   * @param params - Buy parameters
   * @param params.contractAddress - NFT contract address
   * @param params.tokenId - Token ID to buy
   * @param params.price - Price to pay in wei or smallest unit
   * @param params.chainId - Chain ID where the NFT exists
   * @returns Buy result
   */
  async buyNFT(params: {
    contractAddress: string;
    tokenId: string;
    price: string;
    chainId: number;
  }): Promise<NFTTransferResult> {
    return await this.coreService.buyNFT(params);
  }

  /**
   * Get trending NFTs
   * @param chainId - Chain ID (optional)
   * @returns Array of trending NFTs
   */
  async getTrendingNFTs(chainId?: number): Promise<unknown[]> {
    return await this.coreService.getTrendingNFTs(chainId);
  }

  /**
   * Get supported chains
   * @returns Array of supported chains
   */
  getSupportedChains(): SupportedChain[] {
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
   * @returns Promise that resolves when provider is switched
   */
  async switchProvider(useOmniProvider: boolean): Promise<void> {
    return await this.coreService.switchProvider(useOmniProvider);
  }

  /**
   * Get NFTs for current user (alias for getActiveAccountNFTs)
   * @returns Array of NFTs
   */
  async getUserNFTs(): Promise<WalletNFT[]> {
    return await this.getActiveAccountNFTs();
  }

  /**
   * Discover NFTs for the active account
   * @returns Promise that resolves when discovery is complete
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Error during NFTService cleanup: ${errorMessage}`);
    }
  }
}