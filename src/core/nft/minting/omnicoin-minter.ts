// import { ethers } from 'ethers'; // TODO: implement ethers integration
import type { NFTMintRequest, NFTMetadata, NFTItem } from '../../../types/nft';
import type { ListingMetadata } from '../../../types/listing';
import { IPFSService } from '../../storage/ipfs-service';
import { LiveOmniCoinProvider } from '../../chains/omnicoin/live-provider';

// OmniCoin NFT Contract ABI (ERC721 compatible)
const OMNICOIN_NFT_ABI = [
  'function mint(address to, uint256 tokenId, string memory tokenURI) public returns (bool)',
  'function setApprovalForAll(address operator, bool approved) public',
  'function ownerOf(uint256 tokenId) public view returns (address)',
  'function tokenURI(uint256 tokenId) public view returns (string)',
  'function totalSupply() public view returns (uint256)',
  'function nextTokenId() public view returns (uint256)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
  'event Mint(address indexed to, uint256 indexed tokenId, string tokenURI)'
];

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
 * OmniCoin NFT minting service for marketplace
 */
export class OmniCoinNFTMinter {
  private provider: LiveOmniCoinProvider;
  private ipfsService: IPFSService;
  private config: MintingConfig;

  /**
   * Initialize the NFT minter
   * @param config - Minting configuration
   */
  constructor(config: MintingConfig) {
    this.config = config;
    this.provider = new LiveOmniCoinProvider('testnet');
    this.ipfsService = new IPFSService(config.ipfsGateway !== '' ? config.ipfsGateway : 'https://ipfs.io');
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
      // 1. Prepare metadata for IPFS
      const metadata = this.prepareNFTMetadata(mintRequest, listingData);
      
      // 2. Upload metadata to IPFS
      const ipfsResult = await this.uploadToIPFS(metadata, mintRequest.image);
      if (!ipfsResult.success) {
        return { success: false, error: `IPFS upload failed: ${ipfsResult.error}` };
      }

      // 3. Get next token ID
      const tokenId = await this.getNextTokenId();
      
      // 4. Mint NFT on OmniCoin
      if (ipfsResult.metadataUri === undefined || ipfsResult.metadataUri === '') {
        return { success: false, error: 'IPFS metadata URI is required' };
      }
      
      const mintResult = await this.mintToBlockchain(
        sellerAddress,
        tokenId,
        ipfsResult.metadataUri
      );

      if (!mintResult.success) {
        return { success: false, error: `Minting failed: ${mintResult.error}` };
      }

      // 5. Create NFT item object
      if (mintResult.transactionHash === undefined || mintResult.transactionHash === '') {
        return { success: false, error: 'Transaction hash missing from mint result' };
      }
      
      const nftItem = this.createNFTItem(
        tokenId,
        metadata,
        mintResult.transactionHash,
        ipfsResult.metadataUri,
        sellerAddress
      );

      // 6. Auto-list if requested
      if (mintRequest.listImmediately === true && mintRequest.listingPrice !== undefined) {
        this.createMarketplaceListing(nftItem, mintRequest);
      }

      const result: MintingResult = {
        success: true,
        tokenId,
        nftItem,
      };
      if (mintResult.transactionHash !== undefined && mintResult.transactionHash !== '') {
        result.transactionHash = mintResult.transactionHash;
      }
      if (ipfsResult.ipfsHash !== undefined && ipfsResult.ipfsHash !== '') {
        result.ipfsHash = ipfsResult.ipfsHash;
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
   * @returns Promise resolving to NFT metadata
   */
  private prepareNFTMetadata(
    mintRequest: NFTMintRequest,
    listingData: ListingMetadata
  ): NFTMetadata {
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
        ...(mintRequest.category !== undefined && mintRequest.category !== '' && { category: mintRequest.category }),
        creators: [{
          address: listingData.seller.address,
          share: 100
        }]
      },
      marketplace: {
        category: mintRequest.category !== undefined && mintRequest.category !== '' ? mintRequest.category : 'general',
        condition: 'condition' in listingData.details ? listingData.details.condition : 'new',
        location: `${listingData.seller.location.city}, ${listingData.seller.location.country}`,
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
   * Upload image and metadata to IPFS
   * @param metadata - NFT metadata to upload
   * @param image - Image file or base64 string
   * @returns Promise resolving to upload result
   */
  private async uploadToIPFS(metadata: NFTMetadata, image: File | string): Promise<{
    /**
     * Whether upload was successful
     */
    success: boolean;
    /**
     * IPFS hash of metadata
     */
    ipfsHash?: string;
    /**
     * IPFS URI for metadata
     */
    metadataUri?: string;
    /**
     * Error message if failed
     */
    error?: string;
  }> {
    try {
      // Upload image first
      let imageHash: string;
      if (typeof image === 'string') {
        // Handle base64 or URL
        if (image.startsWith('data:')) {
          // Base64 image
          const blob = this.base64ToBlob(image);
          imageHash = await this.ipfsService.uploadFile(blob, 'image.jpg');
        } else {
          // URL - download and upload
          const response = await fetch(image);
          const blob = await response.blob();
          imageHash = await this.ipfsService.uploadFile(blob, 'image.jpg');
        }
      } else {
        // File object
        imageHash = await this.ipfsService.uploadFile(image, image.name);
      }

      // Update metadata with IPFS image URL
      metadata.image = `ipfs://${imageHash}`;

      // Upload metadata
      const metadataBlob = new Blob([JSON.stringify(metadata, null, 2)], {
        type: 'application/json'
      });
      const metadataHash = await this.ipfsService.uploadFile(metadataBlob, 'metadata.json');

      return {
        success: true,
        ipfsHash: metadataHash,
        metadataUri: `ipfs://${metadataHash}`
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'IPFS upload failed'
      };
    }
  }

  /**
   * Get next available token ID
   * @returns Promise resolving to next token ID
   */
  private async getNextTokenId(): Promise<string> {
    try {
      const contract = this.provider.getContract(
        this.config.contractAddress,
        OMNICOIN_NFT_ABI
      );
      const nextTokenIdMethod = contract['nextTokenId'] as (() => Promise<{ toString: () => string }>) | undefined;
      if (typeof nextTokenIdMethod === 'function') {
        const nextId = await nextTokenIdMethod();
        return nextId.toString();
      } else {
        throw new Error('nextTokenId method not available');
      }
    } catch (error) {
      // Fallback to timestamp-based ID
      return Date.now().toString();
    }
  }

  /**
   * Mint NFT to OmniCoin blockchain
   * @param toAddress - Address to mint to
   * @param tokenId - Token ID to mint
   * @param tokenURI - Token metadata URI
   * @returns Promise resolving to mint result
   */
  private async mintToBlockchain(
    toAddress: string,
    tokenId: string,
    tokenURI: string
  ): Promise<{
    /**
     * Whether mint was successful
     */
    success: boolean;
    /**
     * Transaction hash if successful
     */
    transactionHash?: string;
    /**
     * Error message if failed
     */
    error?: string;
  }> {
    try {
      this.provider.getSigner();
      const contract = this.provider.getContract(
        this.config.contractAddress,
        OMNICOIN_NFT_ABI
      );

      // Estimate gas
      type MintMethod = {
        (to: string, tokenId: string, uri: string, options?: { gasLimit: number }): Promise<{ wait: () => Promise<{ transactionHash: string }> }>;
        estimateGas: (to: string, tokenId: string, uri: string) => Promise<bigint>;
      };
      const mintMethod = contract['mint'] as MintMethod | undefined;
      if (mintMethod === undefined || mintMethod === null || mintMethod.estimateGas === undefined) {
        throw new Error('mint method not found');
      }
      const gasEstimate = await mintMethod.estimateGas(toAddress, tokenId, tokenURI);
      const gasLimit = Math.floor(Number(gasEstimate) * 1.2); // 20% buffer

      // Send transaction
      const tx = await mintMethod(toAddress, tokenId, tokenURI, {
        gasLimit
      });

      // Wait for confirmation
      const receipt = await tx.wait();
      const txHash = receipt.transactionHash;

      return {
        success: true,
        ...(typeof txHash === 'string' && { transactionHash: txHash })
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
   * @param metadataUri - Metadata URI
   * @param owner - Owner address
   * @returns NFT item object
   */
  private createNFTItem(
    tokenId: string,
    metadata: NFTMetadata,
    transactionHash: string,
    metadataUri: string,
    owner: string
  ): NFTItem {
    return {
      id: `omnicoin_${this.config.contractAddress}_${tokenId}`,
      tokenId,
      name: metadata.name,
      description: metadata.description,
      image: metadata.image,
      imageUrl: this.ipfsService.getGatewayUrl(metadata.image.replace('ipfs://', '')),
      attributes: metadata.attributes,
      contract: this.config.contractAddress,
      contractAddress: this.config.contractAddress,
      tokenStandard: 'ERC721',
      blockchain: 'omnicoin',
      owner,
      creator: owner,
      royalties: this.config.defaultRoyalty,
      metadata,
      ipfsHash: metadataUri.replace('ipfs://', ''),
      metadataUri,
      isListed: false // Will be set to true if auto-listing succeeds
    };
  }

  /**
   * Create marketplace listing for newly minted NFT
   * @param nftItem - NFT item to list
   * @param mintRequest - Mint request with listing details
   */
  private createMarketplaceListing(
    nftItem: NFTItem,
    mintRequest: NFTMintRequest
  ): void {
    try {
      // TODO: Integrate with marketplace listing service
      console.warn('Creating marketplace listing for NFT:', nftItem.id);
      
      // For now, just mark as listed
      nftItem.isListed = true;
      if (mintRequest.listingPrice !== undefined) {
        nftItem.price = mintRequest.listingPrice;
      }
      nftItem.currency = mintRequest.listingCurrency !== undefined && mintRequest.listingCurrency !== '' ? mintRequest.listingCurrency : 'XOM';
      
    } catch (error) {
      console.warn('Failed to create marketplace listing:', error);
    }
  }

  /**
   * Utility: Convert base64 to blob
   * @param base64 - Base64 encoded data
   * @returns Blob object
   */
  private base64ToBlob(base64: string): Blob {
    const parts = base64.split(',');
    const mimeMatch = parts[0] !== undefined ? parts[0].match(/:(.*?);/) : null;
    const mimeType = mimeMatch !== null && mimeMatch[1] !== undefined ? mimeMatch[1] : 'image/jpeg';
    const data = parts[1];
    if (data === undefined || data === '') {
      throw new Error('Invalid base64 data');
    }
    const bytes = atob(data);
    const uint8Array = new Uint8Array(bytes.length);
    
    for (let i = 0; i < bytes.length; i++) {
      uint8Array[i] = bytes.charCodeAt(i);
    }
    
    return new Blob([uint8Array], { type: mimeType });
  }

  /**
   * Get minting fee estimate
   * @returns Promise resolving to fee estimate
   */
  getMintingFee(): Promise<{
    /**
     * Gas price in wei
     */
    gasPrice: string;
    /**
     * Gas limit for minting
     */
    gasLimit: string;
    /**
     * Total fee in wei
     */
    totalFee: string;
    /**
     * Currency symbol
     */
    currency: string;
  }> {
    try {
      // Use default gas price since getGasPrice is not available on LiveOmniCoinProvider
      const gasPrice = '20000000000'; // 20 gwei default
      const gasLimit = '200000'; // Estimated gas limit for minting
      const totalFee = (BigInt(gasPrice) * BigInt(gasLimit)).toString();

      return Promise.resolve({
        gasPrice,
        gasLimit,
        totalFee,
        currency: 'XOM'
      });
    } catch (error) {
      throw new Error(`Failed to estimate minting fee: ${String(error)}`);
    }
  }

  /**
   * Validate mint request
   * @param mintRequest - Mint request to validate
   * @returns Validation result
   */
  validateMintRequest(mintRequest: NFTMintRequest): {
    /**
     * Whether request is valid
     */
    valid: boolean;
    /**
     * List of validation errors
     */
    errors: string[];
  } {
    const errors: string[] = [];

    if (mintRequest.name === undefined || mintRequest.name === '' || mintRequest.name.trim().length === 0) {
      errors.push('NFT name is required');
    }

    if (mintRequest.description === undefined || mintRequest.description === '' || mintRequest.description.trim().length === 0) {
      errors.push('NFT description is required');
    }

    if (mintRequest.image === undefined || mintRequest.image === null || (typeof mintRequest.image === 'string' && mintRequest.image === '')) {
      errors.push('NFT image is required');
    }

    if (mintRequest.listImmediately === true && (mintRequest.listingPrice === undefined || mintRequest.listingPrice === null)) {
      errors.push('Listing price is required when listing immediately');
    }

    if (mintRequest.royalties !== undefined && mintRequest.royalties !== null && (mintRequest.royalties < 0 || mintRequest.royalties > 20)) {
      errors.push('Royalties must be between 0% and 20%');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
} 
