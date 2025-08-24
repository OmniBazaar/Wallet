// OmniBazaar Wallet NFT Types
// Enhanced for marketplace integration

/**
 * Represents an individual NFT with marketplace integration
 */
export interface NFTItem {
  /** Unique identifier for this NFT */
  id: string;
  /** Token ID on the blockchain */
  tokenId: string;
  /** Human-readable name of the NFT */
  name: string;
  /** Description of the NFT */
  description: string;
  /** Primary image URL for the NFT */
  image: string;
  /** Alternative image URL */
  imageUrl?: string;
  /** Animation or video URL */
  animationUrl?: string;
  /** External URL for more information */
  externalUrl?: string;
  /** Array of trait attributes */
  attributes: NFTAttribute[];
  /** Contract name or identifier */
  contract: string;
  /** Smart contract address */
  contractAddress: string;
  /** NFT token standard */
  tokenStandard: 'ERC721' | 'ERC1155' | 'SPL' | 'other';
  /** Blockchain network name */
  blockchain: string;
  /** Current owner address */
  owner: string;
  /** Original creator address */
  creator?: string;
  /** Royalty percentage (0-100) */
  royalties?: number;
  /**
   *
   */
  metadata?: { name?: string; description?: string; image?: string; attributes?: Array<{ trait_type: string; value: unknown }> };

  // Marketplace-specific fields
  /** Whether this NFT is currently listed for sale */
  isListed?: boolean;
  /** Marketplace listing identifier */
  listingId?: string;
  /** Listing price as string */
  price?: string;
  /** Currency for the listing price */
  currency?: string;
  /** URL to view on marketplace */
  marketplaceUrl?: string;

  // IPFS fields
  /**
   *
   */
  ipfsHash?: string;
  /**
   *
   */
  metadataUri?: string;
}

/**
 * Represents an NFT attribute/trait following OpenSea metadata standard
 */
export interface NFTAttribute {
  /**
   *
   */
  trait_type: string;
  /**
   *
   */
  value: string | number;
  /**
   *
   */
  display_type?: 'number' | 'boost_percentage' | 'boost_number' | 'date' | string;
  /**
   *
   */
  max_value?: number;
}

/**
 * Represents an NFT collection with marketplace data
 */
export interface NFTCollection {
  /** Unique collection identifier */
  id: string;
  /** Collection name */
  name: string;
  /** Collection description */
  description?: string;
  /** Collection logo/image */
  image?: string;
  /** Collection banner image */
  banner?: string;
  /** Contract name or identifier */
  contract: string;
  /** Smart contract address */
  contractAddress: string;
  /** NFT standard used by this collection */
  tokenStandard: 'ERC721' | 'ERC1155' | 'SPL' | 'other';
  /** Blockchain network */
  blockchain: string;
  /** Collection creator address */
  creator: string;
  /** Whether collection is verified */
  verified: boolean;
  /** Total number of tokens in collection */
  totalSupply?: number;
  /**
   *
   */
  floorPrice?: string;
  /**
   *
   */
  volume24h?: string;
  /**
   *
   */
  items: NFTItem[];

  // Marketplace-specific fields
  /**
   *
   */
  categoryId?: string;
  /**
   *
   */
  tags?: string[];
  /** Default royalty percentage for collection */
  royalties?: number;
  /** Official website URL */
  website?: string;
  /** Social media links */
  social?: {
    twitter?: string;
    discord?: string;
    telegram?: string;
  };
}

/**
 * Standard NFT metadata with OmniBazaar marketplace extensions
 */
export interface NFTMetadata {
  /** NFT name */
  name: string;
  /** NFT description */
  description: string;
  /** Primary image URL */
  image: string;
  /** Animation or video URL */
  animation_url?: string;
  /** External link for more info */
  external_url?: string;
  /** Array of trait attributes */
  attributes: NFTAttribute[];
  /**
   *
   */
  properties?: {
    category?: string;
    creators?: Array<{
      address: string;
      share: number;
    }>;
  };

  // OmniBazaar marketplace extensions
  /**
   *
   */
  marketplace?: {
    category: string;
    subcategory?: string;
    condition?: 'new' | 'used' | 'refurbished';
    location?: string;
    shipping?: {
      domestic: number;
      international: number;
      free_shipping?: boolean;
    };
    returns?: {
      accepted: boolean;
      period_days: number;
      policy: string;
    };
  };
}

/**
 * Represents an NFT listing on the OmniBazaar marketplace
 */
export interface MarketplaceListing {
  /**
   *
   */
  id: string;
  /**
   *
   */
  nftId: string;
  /**
   *
   */
  tokenId: string;
  /**
   *
   */
  contract: string;
  /**
   *
   */
  seller: string;
  /**
   *
   */
  price: string;
  /**
   *
   */
  currency: string;
  /**
   *
   */
  listingType: 'fixed_price' | 'auction' | 'best_offer';

  // Auction-specific fields
  /**
   *
   */
  auctionEndTime?: number;
  /**
   *
   */
  currentBid?: string;
  /**
   *
   */
  bidders?: string[];
  /**
   *
   */
  reservePrice?: string;

  // Listing metadata
  /**
   *
   */
  title: string;
  /**
   *
   */
  description: string;
  /**
   *
   */
  category: string;
  /**
   *
   */
  subcategory?: string;
  /**
   *
   */
  tags: string[];
  /**
   *
   */
  condition?: 'new' | 'used' | 'refurbished';
  /**
   *
   */
  location?: string;

  // Marketplace features
  /**
   *
   */
  featured: boolean;
  /**
   *
   */
  verified: boolean;
  /**
   *
   */
  escrowEnabled: boolean;
  /**
   *
   */
  instantPurchase: boolean;

  // Timestamps
  /**
   *
   */
  createdAt: number;
  /**
   *
   */
  updatedAt: number;
  /**
   *
   */
  expiresAt?: number;

  // Analytics
  /**
   *
   */
  views: number;
  /**
   *
   */
  likes: number;
  /**
   *
   */
  shares: number;
}

/**
 * Represents an NFT transfer/transaction event on the blockchain
 */
export interface NFTTransferEvent {
  /**
   *
   */
  id: string;
  /**
   *
   */
  transactionHash: string;
  /**
   *
   */
  blockNumber: number;
  /**
   *
   */
  timestamp: number;
  /**
   *
   */
  from: string;
  /**
   *
   */
  to: string;
  /**
   *
   */
  tokenId: string;
  /**
   *
   */
  contract: string;
  /**
   *
   */
  type: 'mint' | 'transfer' | 'burn' | 'sale';
  /**
   *
   */
  value?: string; // For sale events
  /**
   *
   */
  gasUsed?: string;
  /**
   *
   */
  gasPrice?: string;
}

/**
 * Request parameters for minting a new NFT
 */
export interface NFTMintRequest {
  /**
   *
   */
  name: string;
  /**
   *
   */
  description: string;
  /**
   *
   */
  image: File | string;
  /**
   *
   */
  attributes: NFTAttribute[];
  /**
   *
   */
  royalties?: number;
  /**
   *
   */
  collection?: string;

  // Marketplace listing options
  /**
   *
   */
  listImmediately?: boolean;
  /**
   *
   */
  listingPrice?: string;
  /**
   *
   */
  listingCurrency?: string;
  /**
   *
   */
  category?: string;

  // IPFS storage options
  /**
   *
   */
  useIPFS: boolean;
  /**
   *
   */
  pinToIPFS?: boolean;
}

/**
 * Search query parameters for marketplace NFT discovery
 */
export interface NFTSearchQuery {
  /**
   *
   */
  query?: string;
  /**
   *
   */
  category?: string;
  /**
   *
   */
  subcategory?: string;
  /**
   *
   */
  blockchain?: string;
  /**
   *
   */
  priceMin?: number;
  /**
   *
   */
  priceMax?: number;
  /**
   *
   */
  currency?: string;
  /**
   *
   */
  condition?: string;
  /**
   *
   */
  location?: string;
  /**
   *
   */
  sortBy?: 'price_asc' | 'price_desc' | 'created_desc' | 'popular' | 'ending_soon';
  /**
   *
   */
  verified?: boolean;
  /**
   *
   */
  hasOffers?: boolean;
  /**
   *
   */
  limit?: number;
  /**
   *
   */
  offset?: number;
}

/**
 * Result set from NFT marketplace search operations
 */
export interface NFTSearchResult {
  /**
   *
   */
  items: MarketplaceListing[];
  /**
   *
   */
  total: number;
  /**
   *
   */
  hasMore: boolean;
  /**
   *
   */
  filters: {
    categories: Array<{ id: string; name: string; count: number }>;
    blockchains: Array<{ id: string; name: string; count: number }>;
    priceRange: { min: number; max: number };
  };
}
