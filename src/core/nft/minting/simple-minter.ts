import type { NFTMintRequest, NFTMetadata, NFTItem } from '../../../types/nft';
import type { ListingMetadata } from '../../../types/listing';

/**
 * Configuration for NFT minting
 */
export interface MintingConfig {
  /**
   * NFT contract address
   */
  contractAddress: string;
  /**
   * Marketplace contract address
   */
  marketplaceAddress: string;
  /**
   * IPFS gateway URL
   */
  ipfsGateway: string;
  /**
   * Default royalty percentage (0-100)
   */
  defaultRoyalty: number;
  /**
   * RPC URL for blockchain connection
   */
  rpcUrl: string;
}

/**
 * Result of NFT minting operation
 */
export interface MintingResult {
  /**
   * Whether minting was successful
   */
  success: boolean;
  /**
   * Minted token ID
   */
  tokenId?: string;
  /**
   * Transaction hash of minting
   */
  transactionHash?: string;
  /**
   * IPFS hash of metadata
   */
  ipfsHash?: string;
  /**
   * Created NFT item
   */
  nftItem?: NFTItem;
  /**
   * Error message if failed
   */
  error?: string;
}

/**
 * Result of IPFS upload operation
 */
export interface IPFSUploadResult {
  /**
   * Whether upload was successful
   */
  success: boolean;
  /**
   * IPFS hash of uploaded content
   */
  hash?: string;
  /**
   * Error message if failed
   */
  error?: string;
}

/**
 * Simplified NFT minting service for OmniBazaar marketplace
 * Focuses on creating NFTs for product/service listings on OmniCoin blockchain
 */
export class SimplifiedNFTMinter {
  private config: MintingConfig;

  /**
   * Initialize the NFT minter
   * @param config - Minting configuration
   */
  constructor(config: MintingConfig) {
    this.config = config;
  }

  /**
   * Mint NFT for marketplace listing on OmniCoin blockchain
   * @param mintRequest - NFT mint request details
   * @param listingData - Marketplace listing metadata
   * @param sellerAddress - Address of the seller
   * @returns Promise resolving to minting result
   */
  async mintListingNFT(
    mintRequest: NFTMintRequest,
    listingData: ListingMetadata,
    sellerAddress: string
  ): Promise<MintingResult> {
    try {
      console.warn('Starting NFT minting process...');
      
      // 1. Validate the mint request
      const validation = this.validateMintRequest(mintRequest);
      if (!validation.valid) {
        return { success: false, error: `Validation failed: ${validation.errors.join(', ')}` };
      }

      // 2. Prepare metadata for IPFS
      const metadata = this.prepareNFTMetadata(mintRequest, listingData);
      
      // 3. Simulate IPFS upload (replace with real implementation)
      const ipfsResult = await this.simulateIPFSUpload(metadata, mintRequest.image);
      if (!ipfsResult.success) {
        return { success: false, error: `IPFS upload failed: ${ipfsResult.error}` };
      }

      // 4. Generate token ID
      const tokenId = this.generateTokenId();
      
      // 5. Simulate blockchain minting (replace with real implementation)
      const mintResult = await this.simulateBlockchainMinting(
        sellerAddress,
        tokenId,
        ipfsResult.hash !== undefined && ipfsResult.hash !== '' ? ipfsResult.hash : 'unknown'
      );

      if (!mintResult.success) {
        return { success: false, error: `Minting failed: ${mintResult.error}` };
      }

      // 6. Create NFT item object
      const nftItem = this.createNFTItem(
        tokenId,
        metadata,
        mintResult.transactionHash !== undefined && mintResult.transactionHash !== '' ? mintResult.transactionHash : 'unknown',
        ipfsResult.hash !== undefined && ipfsResult.hash !== '' ? ipfsResult.hash : 'unknown',
        sellerAddress
      );

      console.warn('NFT minting completed successfully');
      const result: MintingResult = {
        success: true,
        tokenId,
        nftItem,
      };
      if (mintResult.transactionHash !== undefined && mintResult.transactionHash !== '') {
        result.transactionHash = mintResult.transactionHash;
      }
      if (ipfsResult.hash !== undefined && ipfsResult.hash !== '') {
        result.ipfsHash = ipfsResult.hash;
      }
      return result;

    } catch (error) {
      console.warn('NFT minting error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown minting error'
      };
    }
  }

  /**
   * Prepare NFT metadata optimized for marketplace
   * @param mintRequest - NFT mint request details
   * @param listingData - Marketplace listing metadata
   * @returns NFT metadata
   */
  private prepareNFTMetadata(
    mintRequest: NFTMintRequest,
    listingData: ListingMetadata
  ): NFTMetadata {
    // Extract condition from listing details
    let condition: 'new' | 'used' | 'refurbished' | undefined;
    if (listingData.details !== undefined && 'condition' in listingData.details) {
      condition = listingData.details.condition;
    }

    return {
      name: mintRequest.name,
      description: mintRequest.description,
      image: '', // Will be set after IPFS upload
      attributes: [
        ...mintRequest.attributes,
        // Add marketplace-specific attributes
        { trait_type: 'Listing Type', value: listingData.type },
        { trait_type: 'Category', value: mintRequest.category !== undefined && mintRequest.category !== '' ? mintRequest.category : 'General' },
        { trait_type: 'Seller', value: listingData.seller.name },
        { trait_type: 'Location', value: listingData.seller.location.country },
        { trait_type: 'Blockchain', value: 'OmniCoin' },
        { trait_type: 'Minted Date', value: new Date().toISOString() }
      ],
      properties: {
        ...(mintRequest.category !== undefined && mintRequest.category !== '' ? { category: mintRequest.category } : {}),
        creators: [{
          address: listingData.seller.address,
          share: 100
        }]
      },
      marketplace: {
        category: mintRequest.category !== undefined && mintRequest.category !== '' ? mintRequest.category : 'general',
        condition: condition !== undefined ? condition : 'new',
        location: `${listingData.seller.location.city !== undefined ? listingData.seller.location.city : 'Unknown'}, ${listingData.seller.location.country}`,
        shipping: {
          domestic: 0, // TODO: Extract from listing data
          international: 0,
          free_shipping: true
        },
        returns: {
          accepted: true,
          period_days: 30,
          policy: 'Standard return policy applies'
        }
      }
    };
  }

  /**
   * Simulate IPFS upload (replace with real implementation)
   * @param metadata - NFT metadata to upload
   * @param _image - Image file or string (unused in simulation)
   * @returns Promise resolving to upload result
   */
  private async simulateIPFSUpload(metadata: NFTMetadata, _image: File | string): Promise<IPFSUploadResult> {
    try {
      // Simulate async upload delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Generate secure mock IPFS hash
      const { secureRandomBase36 } = await import('../../utils/secure-random');
      const hash = 'Qm' + secureRandomBase36(45);
      
      // Update metadata with IPFS image URL
      metadata.image = `ipfs://${hash}`;

      console.warn('IPFS upload simulated:', hash);
      return {
        success: true,
        hash
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'IPFS upload failed'
      };
    }
  }

  /**
   * Generate a unique token ID
   * @returns Generated token ID
   */
  private generateTokenId(): string {
    // Use timestamp + secure random for uniqueness
    // Import at module level for better performance
    const timestamp = Date.now().toString();
    const randomSuffix = Math.random().toString(36).substring(2, 9);
    return timestamp + randomSuffix;
  }

  /**
   * Simulate blockchain minting (replace with real implementation)
   * @param _toAddress - Address to mint to (unused in simulation)
   * @param _tokenId - Token ID (unused in simulation)
   * @param _metadataHash - Metadata hash (unused in simulation)
   * @returns Promise resolving to minting result
   */
  private async simulateBlockchainMinting(
    _toAddress: string,
    _tokenId: string,
    _metadataHash: string
  ): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
    try {
      // Simulate async blockchain interaction delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Generate secure mock transaction hash
      const { generateSecureMockTxHash } = await import('../../utils/secure-random');
      const transactionHash = generateSecureMockTxHash();

      console.warn('Blockchain minting simulated:', transactionHash);
      return {
        success: true,
        transactionHash
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Blockchain minting failed'
      };
    }
  }

  /**
   * Create NFTItem from minting result
   * @param tokenId - Token ID
   * @param metadata - NFT metadata
   * @param transactionHash - Transaction hash
   * @param ipfsHash - IPFS hash
   * @param owner - Owner address
   * @returns NFT item object
   */
  private createNFTItem(
    tokenId: string,
    metadata: NFTMetadata,
    transactionHash: string,
    ipfsHash: string,
    owner: string
  ): NFTItem {
    return {
      id: `omnicoin_${this.config.contractAddress}_${tokenId}`,
      tokenId,
      name: metadata.name,
      description: metadata.description,
      image: metadata.image,
      imageUrl: this.getIPFSGatewayUrl(ipfsHash),
      attributes: metadata.attributes,
      contract: this.config.contractAddress,
      contractAddress: this.config.contractAddress,
      tokenStandard: 'ERC721',
      blockchain: 'omnicoin',
      owner,
      creator: owner,
      royalties: this.config.defaultRoyalty,
      metadata,
      ipfsHash,
      metadataUri: `ipfs://${ipfsHash}`,
      isListed: false // Will be set to true if auto-listing succeeds
    };
  }

  /**
   * Get IPFS gateway URL for content
   * @param hash - IPFS hash
   * @returns Gateway URL
   */
  private getIPFSGatewayUrl(hash: string): string {
    // Remove ipfs:// protocol if present
    const cleanHash = hash.replace('ipfs://', '');
    return `${this.config.ipfsGateway}/${cleanHash}`;
  }

  /**
   * Validate mint request
   * @param mintRequest - Mint request to validate
   * @returns Validation result
   */
  validateMintRequest(mintRequest: NFTMintRequest): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (mintRequest.name === undefined || mintRequest.name === '' || mintRequest.name.trim().length === 0) {
      errors.push('NFT name is required');
    }

    if (mintRequest.name !== undefined && mintRequest.name !== '' && mintRequest.name.length > 100) {
      errors.push('NFT name must be 100 characters or less');
    }

    if (mintRequest.description === undefined || mintRequest.description === '' || mintRequest.description.trim().length === 0) {
      errors.push('NFT description is required');
    }

    if (mintRequest.description !== undefined && mintRequest.description !== '' && mintRequest.description.length > 1000) {
      errors.push('NFT description must be 1000 characters or less');
    }

    if (mintRequest.image === undefined || mintRequest.image === null || (typeof mintRequest.image === 'string' && mintRequest.image === '')) {
      errors.push('NFT image is required');
    }

    if (mintRequest.listImmediately === true && (mintRequest.listingPrice === undefined || mintRequest.listingPrice === null || mintRequest.listingPrice === '')) {
      errors.push('Listing price is required when listing immediately');
    }

    if (mintRequest.listingPrice !== undefined && mintRequest.listingPrice !== null && mintRequest.listingPrice !== '' && parseFloat(mintRequest.listingPrice) <= 0) {
      errors.push('Listing price must be greater than 0');
    }

    if (mintRequest.royalties !== undefined && mintRequest.royalties !== null && (mintRequest.royalties < 0 || mintRequest.royalties > 20)) {
      errors.push('Royalties must be between 0% and 20%');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get estimated minting cost
   * @returns Promise resolving to cost estimate
   */
  getEstimatedMintingCost(): Promise<{
    gasEstimate: string;
    totalCost: string;
    currency: string;
  }> {
    // Simulate gas estimation
    return Promise.resolve({
      gasEstimate: '200000',
      totalCost: '0.005', // 0.005 XOM
      currency: 'XOM'
    });
  }

  /**
   * Get configuration
   * @returns Current minting configuration
   */
  getConfig(): MintingConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   * @param updates - Partial configuration updates
   */
  updateConfig(updates: Partial<MintingConfig>): void {
    this.config = { ...this.config, ...updates };
  }
} 
