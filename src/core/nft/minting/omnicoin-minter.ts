// import { ethers } from 'ethers'; // TODO: implement ethers integration
import type { NFTMintRequest, NFTMetadata, NFTItem } from '../../../types/nft';
import type { ListingMetadata } from '../../../types/listing';
import { IPFSService } from '../../storage/ipfs-service';
import { OmniCoinProvider } from '../../chains/omnicoin/provider';

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
 *
 */
export interface MintingConfig {
  /**
   *
   */
  contractAddress: string;
  /**
   *
   */
  marketplaceAddress: string;
  /**
   *
   */
  ipfsGateway: string;
  /**
   *
   */
  defaultRoyalty: number;
}

/**
 *
 */
export interface MintingResult {
  /**
   *
   */
  success: boolean;
  /**
   *
   */
  tokenId?: string;
  /**
   *
   */
  transactionHash?: string;
  /**
   *
   */
  ipfsHash?: string;
  /**
   *
   */
  nftItem?: NFTItem;
  /**
   *
   */
  error?: string;
}

/**
 *
 */
export class OmniCoinNFTMinter {
  private provider: OmniCoinProvider;
  private ipfsService: IPFSService;
  private config: MintingConfig;

  /**
   *
   * @param config
   */
  constructor(config: MintingConfig) {
    this.config = config;
    this.provider = new OmniCoinProvider();
    this.ipfsService = new IPFSService({
      gateway: config.ipfsGateway
    });
  }

  /**
   * Mint NFT for marketplace listing on OmniCoin blockchain
   * @param mintRequest
   * @param listingData
   * @param sellerAddress
   */
  async mintListingNFT(
    mintRequest: NFTMintRequest,
    listingData: ListingMetadata,
    sellerAddress: string
  ): Promise<MintingResult> {
    try {
      // 1. Prepare metadata for IPFS
      const metadata = await this.prepareNFTMetadata(mintRequest, listingData);
      
      // 2. Upload metadata to IPFS
      const ipfsResult = await this.uploadToIPFS(metadata, mintRequest.image);
      if (!ipfsResult.success) {
        return { success: false, error: `IPFS upload failed: ${ipfsResult.error}` };
      }

      // 3. Get next token ID
      const tokenId = await this.getNextTokenId();
      
      // 4. Mint NFT on OmniCoin
      if (!ipfsResult.metadataUri) {
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
      if (!mintResult.transactionHash) {
        return { success: false, error: 'Transaction hash missing from mint result' };
      }
      
      const nftItem = await this.createNFTItem(
        tokenId,
        metadata,
        mintResult.transactionHash,
        ipfsResult.metadataUri,
        sellerAddress
      );

      // 6. Auto-list if requested
      if (mintRequest.listImmediately && mintRequest.listingPrice) {
        await this.createMarketplaceListing(nftItem, mintRequest);
      }

      return {
        success: true,
        tokenId,
        transactionHash: mintResult.transactionHash,
        ipfsHash: ipfsResult.ipfsHash,
        nftItem
      };

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
   * @param mintRequest
   * @param listingData
   */
  private async prepareNFTMetadata(
    mintRequest: NFTMintRequest,
    listingData: ListingMetadata
  ): Promise<NFTMetadata> {
    return {
      name: mintRequest.name,
      description: mintRequest.description,
      image: '', // Will be set after IPFS upload
      attributes: [
        ...mintRequest.attributes,
        // Add marketplace-specific attributes
        { trait_type: 'Listing Type', value: listingData.type },
        { trait_type: 'Category', value: mintRequest.category || 'General' },
        { trait_type: 'Seller', value: listingData.seller.name },
        { trait_type: 'Location', value: listingData.seller.location.country },
        { trait_type: 'Blockchain', value: 'OmniCoin' },
        { trait_type: 'Minted Date', value: new Date().toISOString() }
      ],
      properties: {
        category: mintRequest.category,
        creators: [{
          address: listingData.seller.address,
          share: 100
        }]
      },
      marketplace: {
        category: mintRequest.category || 'general',
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
   * @param metadata
   * @param image
   */
  private async uploadToIPFS(metadata: NFTMetadata, image: File | string): Promise<{
    /**
     *
     */
    success: boolean;
    /**
     *
     */
    ipfsHash?: string;
    /**
     *
     */
    metadataUri?: string;
    /**
     *
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
   */
  private async getNextTokenId(): Promise<string> {
    try {
      const contract = await this.provider.getContract(
        this.config.contractAddress,
        OMNICOIN_NFT_ABI
      );
      const nextId = await contract.nextTokenId();
      return nextId.toString();
    } catch (error) {
      // Fallback to timestamp-based ID
      return Date.now().toString();
    }
  }

  /**
   * Mint NFT to OmniCoin blockchain
   * @param toAddress
   * @param tokenId
   * @param tokenURI
   */
  private async mintToBlockchain(
    toAddress: string,
    tokenId: string,
    tokenURI: string
  ): Promise<{ /**
                *
                */
  success: boolean; /**
                     *
                     */
  transactionHash?: string; /**
                             *
                             */
  error?: string }> {
    try {
      const signer = await this.provider.getSigner();
      const contract = await this.provider.getContract(
        this.config.contractAddress,
        OMNICOIN_NFT_ABI,
        signer
      );

      // Estimate gas
      const gasEstimate = await contract.mint.estimateGas(toAddress, tokenId, tokenURI);
      const gasLimit = Math.floor(gasEstimate.toNumber() * 1.2); // 20% buffer

      // Send transaction
      const tx = await contract.mint(toAddress, tokenId, tokenURI, {
        gasLimit
      });

      // Wait for confirmation
      const receipt = await tx.wait();

      return {
        success: true,
        transactionHash: receipt.transactionHash
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
   * @param tokenId
   * @param metadata
   * @param transactionHash
   * @param metadataUri
   * @param owner
   */
  private async createNFTItem(
    tokenId: string,
    metadata: NFTMetadata,
    transactionHash: string,
    metadataUri: string,
    owner: string
  ): Promise<NFTItem> {
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
   * @param nftItem
   * @param mintRequest
   */
  private async createMarketplaceListing(
    nftItem: NFTItem,
    mintRequest: NFTMintRequest
  ): Promise<void> {
    try {
      // TODO: Integrate with marketplace listing service
      console.warn('Creating marketplace listing for NFT:', nftItem.id);
      
      // For now, just mark as listed
      nftItem.isListed = true;
      nftItem.price = mintRequest.listingPrice;
      nftItem.currency = mintRequest.listingCurrency || 'XOM';
      
    } catch (error) {
      console.warn('Failed to create marketplace listing:', error);
    }
  }

  /**
   * Utility: Convert base64 to blob
   * @param base64
   */
  private base64ToBlob(base64: string): Blob {
    const parts = base64.split(',');
    const mimeType = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const data = parts[1];
    const bytes = atob(data);
    const uint8Array = new Uint8Array(bytes.length);
    
    for (let i = 0; i < bytes.length; i++) {
      uint8Array[i] = bytes.charCodeAt(i);
    }
    
    return new Blob([uint8Array], { type: mimeType });
  }

  /**
   * Get minting fee estimate
   */
  async getMintingFee(): Promise<{
    /**
     *
     */
    gasPrice: string;
    /**
     *
     */
    gasLimit: string;
    /**
     *
     */
    totalFee: string;
    /**
     *
     */
    currency: string;
  }> {
    try {
      const gasPrice = await this.provider.getGasPrice();
      const gasLimit = '200000'; // Estimated gas limit for minting
      const totalFee = (BigInt(gasPrice) * BigInt(gasLimit)).toString();

      return {
        gasPrice,
        gasLimit,
        totalFee,
        currency: 'XOM'
      };
    } catch (error) {
      throw new Error(`Failed to estimate minting fee: ${error}`);
    }
  }

  /**
   * Validate mint request
   * @param mintRequest
   */
  validateMintRequest(mintRequest: NFTMintRequest): { /**
                                                       *
                                                       */
  valid: boolean; /**
                   *
                   */
  errors: string[] } {
    const errors: string[] = [];

    if (!mintRequest.name || mintRequest.name.trim().length === 0) {
      errors.push('NFT name is required');
    }

    if (!mintRequest.description || mintRequest.description.trim().length === 0) {
      errors.push('NFT description is required');
    }

    if (!mintRequest.image) {
      errors.push('NFT image is required');
    }

    if (mintRequest.listImmediately && !mintRequest.listingPrice) {
      errors.push('Listing price is required when listing immediately');
    }

    if (mintRequest.royalties && (mintRequest.royalties < 0 || mintRequest.royalties > 20)) {
      errors.push('Royalties must be between 0% and 20%');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
} 